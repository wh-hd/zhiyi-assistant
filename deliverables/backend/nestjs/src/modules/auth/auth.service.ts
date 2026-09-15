import { Injectable, Logger, UnauthorizedException, ConflictException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Prisma, User } from '@prisma/client';
import { createHash, randomUUID } from 'crypto';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../../shared/prisma/prisma.service';
import { SecurityAlertService } from './security-alert.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';

interface WxSessionResult {
  openid?: string;
  session_key?: string;
  unionid?: string;
  errcode?: number;
  errmsg?: string;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

type RotationOutcome =
  | { type: 'SUCCESS'; tokens: AuthTokens }
  | { type: 'REPLAY' }
  | { type: 'INVALID' };

class WxSessionError extends Error {
  constructor(readonly category: string) {
    super(category);
    this.name = 'WxSessionError';
  }
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly securityAlertService: SecurityAlertService,
  ) {}

  /** 使用微信 code 登录；仅明确的开发占位配置允许本地身份。 */
  async wechatLogin(code: string) {
    if (!code) throw new UnauthorizedException('缺少登录凭证 code');

    const appId = this.configService.get<string>('WX_APP_ID', '').trim();
    const appSecret = this.configService.get<string>('WX_APP_SECRET', '').trim();
    const nodeEnv = this.configService.get<string>('NODE_ENV', 'development');
    const appIdPlaceholder = this.isMissingOrPlaceholder(appId);
    const appSecretPlaceholder = this.isMissingOrPlaceholder(appSecret);
    const allowDevIdentity = this.configService.get<boolean>('ALLOW_DEV_IDENTITY', false);
    const developmentFallbackAllowed = nodeEnv === 'development'
      && allowDevIdentity
      && appId.length === 0
      && appSecret.length === 0;

    let openid: string;
    if (developmentFallbackAllowed) {
      openid = `dev_openid_${code}`;
      this.logger.warn('微信登录使用开发身份模式');
    } else if (appIdPlaceholder || appSecretPlaceholder) {
      this.logger.warn('微信登录失败 category=configuration');
      throw new UnauthorizedException('微信登录失败');
    } else {
      const timeoutMs = this.getBoundedInteger(
        'WX_JSCODE2SESSION_TIMEOUT_MS',
        8000,
        1000,
        30000,
      );
      try {
        const wxSession = await this.getWxSession(code, appId, appSecret, timeoutMs);
        openid = wxSession.openid as string;
      } catch (error) {
        const category = error instanceof WxSessionError ? error.category : 'network';
        this.logger.warn(`微信登录失败 category=${category}`);
        throw new UnauthorizedException('微信登录失败');
      }
    }

    let user = await this.prisma.user.findUnique({ where: { wxOpenid: openid } });
    if (!user) {
      user = await this.prisma.user.create({ data: { wxOpenid: openid } });
      this.logger.log('微信登录已创建新用户');
    }
    const tokens = await this.generateTokens(user.id);
    return { user: this.sanitizeUser(user), ...tokens };
  }

  /** 账号密码注册：邮箱唯一，密码使用 bcrypt 哈希存储。 */
  async register(dto: RegisterDto) {
    const email = dto.email.trim().toLowerCase();
    const existing = await this.prisma.user.findUnique({ where: { email } });
    if (existing) throw new ConflictException('该邮箱已注册，请直接登录');
    const passwordHash = await bcrypt.hash(dto.password, 10);
    const user = await this.prisma.user.create({
      data: {
        email,
        passwordHash,
        nickname: dto.nickname?.trim() || email.split('@')[0],
        phone: dto.phone?.trim() || null,
      },
    });
    const tokens = await this.generateTokens(user.id);
    return { user: this.sanitizeUser(user), ...tokens };
  }

  /** 账号密码登录：支持邮箱或手机号作为标识，校验 bcrypt 密码哈希。 */
  async login(dto: LoginDto) {
    const identifier = dto.identifier.trim();
    const user = await this.prisma.user.findFirst({
      where: { OR: [{ email: identifier }, { phone: identifier }] },
    });
    if (!user || !user.passwordHash) {
      throw new UnauthorizedException('账号或密码错误');
    }
    const matched = await bcrypt.compare(dto.password, user.passwordHash);
    if (!matched) throw new UnauthorizedException('账号或密码错误');
    const tokens = await this.generateTokens(user.id);
    return { user: this.sanitizeUser(user), ...tokens };
  }

  /** 调用微信 jscode2session，严格校验 HTTP、JSON、错误码和 openid。 */
  private async getWxSession(
    code: string,
    appId: string,
    appSecret: string,
    timeoutMs: number,
  ): Promise<WxSessionResult> {
    const query = new URLSearchParams({
      appid: appId,
      secret: appSecret,
      js_code: code,
      grant_type: 'authorization_code',
    });
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    let data: WxSessionResult;
    try {
      const response = await fetch(`https://api.weixin.qq.com/sns/jscode2session?${query}`, {
        signal: controller.signal,
      });
      if (!response.ok) throw new WxSessionError('http');
      data = await response.json() as WxSessionResult;
    } catch (error) {
      if (controller.signal.aborted || (error instanceof Error && error.name === 'AbortError')) {
        throw new WxSessionError('timeout');
      }
      if (error instanceof WxSessionError) throw error;
      throw new WxSessionError('network');
    } finally {
      clearTimeout(timer);
    }
    if (typeof data.errcode === 'number' && data.errcode !== 0) {
      throw new WxSessionError('upstream');
    }
    if (typeof data.openid !== 'string' || data.openid.trim().length === 0) {
      throw new WxSessionError('invalid-response');
    }
    return data;
  }

  /** 原子消费并轮换 refresh token；重放处置提交后再返回 401。 */
  async refreshToken(refreshToken: string, requestId?: string): Promise<AuthTokens> {
    if (!refreshToken) throw new UnauthorizedException('缺少 refresh token');
    const refreshSecret = this.configService.getOrThrow<string>('JWT_REFRESH_SECRET');
    let payload: { sub?: string };
    try {
      payload = this.jwtService.verify<{ sub?: string }>(refreshToken, {
        secret: refreshSecret,
      });
    } catch {
      throw new UnauthorizedException('refresh token 无效或已过期');
    }
    const userId = payload.sub;
    if (!userId) throw new UnauthorizedException('refresh token 无效');
    const tokenHash = createHash('sha256').update(refreshToken).digest('hex');
    const outcome = await this.rotateRefreshTokenAtomic(tokenHash, userId);

    if (outcome.type === 'SUCCESS') return outcome.tokens;
    if (outcome.type === 'REPLAY') {
      const maskedUserId = createHash('sha256').update(userId).digest('hex').slice(0, 12);
      this.logger.warn(`检测到 refresh token 重放 maskedUserId=${maskedUserId}`);
      void this.securityAlertService.emitRefreshTokenReplay(userId, requestId).catch(() => {
        this.logger.error('安全告警异步处理失败');
      });
      throw new UnauthorizedException('refresh token 已撤销，请重新登录');
    }
    throw new UnauthorizedException('refresh token 无效或已过期');
  }

  private async rotateRefreshTokenAtomic(
    tokenHash: string,
    userId: string,
  ): Promise<RotationOutcome> {
    const maxAttempts = 3;
    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
      try {
        return await this.prisma.$transaction(async (tx) => {
          const stored = await tx.refreshToken.findUnique({ where: { tokenHash } });
          if (!stored || stored.userId !== userId) return { type: 'INVALID' };
          const now = new Date();
          if (stored.revokedAt) {
            await tx.refreshToken.updateMany({
              where: { userId, revokedAt: null },
              data: { revokedAt: now },
            });
            return { type: 'REPLAY' };
          }
          const consumed = await tx.refreshToken.updateMany({
            where: {
              id: stored.id,
              userId,
              revokedAt: null,
              expiresAt: { gt: now },
            },
            data: { revokedAt: now },
          });
          if (consumed.count !== 1) {
            await tx.refreshToken.updateMany({
              where: { userId, revokedAt: null },
              data: { revokedAt: now },
            });
            return { type: 'REPLAY' };
          }
          const user = await tx.user.findUnique({ where: { id: userId }, select: { id: true } });
          if (!user) return { type: 'INVALID' };
          const tokens = await this.generateTokens(userId, tx);
          return { type: 'SUCCESS', tokens };
        });
      } catch (error) {
        const retryable = error instanceof Prisma.PrismaClientKnownRequestError
          && error.code === 'P2034';
        if (!retryable || attempt === maxAttempts) throw error;
      }
    }
    throw new UnauthorizedException('refresh token 轮换失败');
  }

  /** 撤销当前会话的 refresh token。 */
  async logout(userId: string, refreshToken: string) {
    if (!refreshToken) return { success: true };
    const tokenHash = createHash('sha256').update(refreshToken).digest('hex');
    await this.prisma.refreshToken.updateMany({
      where: { userId, tokenHash, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    return { success: true };
  }

  private async generateTokens(
    userId: string,
    tx?: Prisma.TransactionClient,
  ): Promise<AuthTokens> {
    const accessExpires = Number(this.configService.get<string | number>('JWT_ACCESS_EXPIRES', 3600));
    const accessToken = this.jwtService.sign(
      { sub: userId },
      { secret: this.configService.getOrThrow<string>('JWT_ACCESS_SECRET'), expiresIn: `${accessExpires}s` },
    );
    const refreshExpires = Number(
      this.configService.get<string | number>('JWT_REFRESH_EXPIRES', 2592000),
    );
    const refreshToken = this.jwtService.sign(
      { sub: userId, jti: randomUUID() },
      {
        expiresIn: `${refreshExpires}s`,
        secret: this.configService.getOrThrow<string>('JWT_REFRESH_SECRET'),
      },
    );
    const expiresAt = new Date(Date.now() + refreshExpires * 1000);
    const client = tx ?? this.prisma;
    await client.refreshToken.create({
      data: {
        userId,
        tokenHash: createHash('sha256').update(refreshToken).digest('hex'),
        expiresAt,
      },
    });
    return { accessToken, refreshToken, expiresIn: accessExpires };
  }

  private isMissingOrPlaceholder(value: string): boolean {
    if (!value) return true;
    return /^(your[_-]|replace[_-]|placeholder|changeme|example)/i.test(value);
  }

  private getBoundedInteger(
    key: string,
    fallback: number,
    minimum: number,
    maximum: number,
  ): number {
    const value = Number(this.configService.get<string | number>(key, fallback));
    return Number.isInteger(value) && value >= minimum && value <= maximum
      ? value
      : fallback;
  }

  private sanitizeUser(user: User): Omit<User, 'deletedAt' | 'wxOpenid'> {
    const { deletedAt: _deletedAt, wxOpenid: _wxOpenid, ...safe } = user;
    return safe;
  }
}
