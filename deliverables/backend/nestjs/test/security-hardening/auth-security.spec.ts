import { UnauthorizedException } from '@nestjs/common';
import { AuthService } from '../../src/modules/auth/auth.service';

function config(values: Record<string, unknown>): any {
  const merged = {
    JWT_ACCESS_SECRET: 'test-access-secret',
    JWT_REFRESH_SECRET: 'test-refresh-secret',
    ...values,
  };
  return {
    get: jest.fn((key: string, fallback: unknown) => (key in merged ? merged[key] : fallback)),
    getOrThrow: jest.fn((key: string) => {
      if (!(key in merged)) throw new Error(`Missing required config: ${key}`);
      return merged[key];
    }),
  };
}

describe('AuthService 安全行为', () => {
  afterEach(() => jest.restoreAllMocks());

  it('真实微信配置网络失败时 fail-closed 且不创建用户', async () => {
    const prisma: any = { user: { findUnique: jest.fn(), create: jest.fn() } };
    const service = new AuthService(
      prisma,
      {} as any,
      config({ NODE_ENV: 'production', WX_APP_ID: 'real-app', WX_APP_SECRET: 'real-secret' }),
      { emitRefreshTokenReplay: jest.fn() } as any,
    );
    jest.spyOn(global, 'fetch').mockRejectedValue(new Error('network'));
    await expect(service.wechatLogin('sensitive-code')).rejects.toBeInstanceOf(UnauthorizedException);
    expect(prisma.user.create).not.toHaveBeenCalled();
  });

  it('仅开发环境双缺失凭证允许开发身份', async () => {
    const user = { id: 'user-1', wxOpenid: 'dev', deletedAt: null };
    const prisma: any = {
      user: { findUnique: jest.fn().mockResolvedValue(user) },
      refreshToken: { create: jest.fn().mockResolvedValue({}) },
    };
    const jwt: any = { sign: jest.fn().mockReturnValueOnce('access').mockReturnValueOnce('refresh') };
    const service = new AuthService(
      prisma, jwt, config({
        NODE_ENV: 'development', ALLOW_DEV_IDENTITY: true,
        WX_APP_ID: '', WX_APP_SECRET: '',
      }),
      { emitRefreshTokenReplay: jest.fn() } as any,
    );
    await expect(service.wechatLogin('code')).resolves.toMatchObject({ accessToken: 'access' });
  });

  it('开发环境缺失与占位混合凭证拒绝开发身份', async () => {
    const user = { id: 'user-1', wxOpenid: 'dev', deletedAt: null };
    const prisma: any = {
      user: { findUnique: jest.fn().mockResolvedValue(null), create: jest.fn().mockResolvedValue(user) },
      refreshToken: { create: jest.fn().mockResolvedValue({}) },
    };
    const jwt: any = {
      sign: jest.fn().mockReturnValueOnce('access').mockReturnValueOnce('refresh'),
    };
    const service = new AuthService(
      prisma,
      jwt,
      config({ NODE_ENV: 'development', WX_APP_ID: '', WX_APP_SECRET: 'your_wx_secret' }),
      { emitRefreshTokenReplay: jest.fn() } as any,
    );

    await expect(service.wechatLogin('sensitive-code'))
      .rejects.toBeInstanceOf(UnauthorizedException);
    expect(prisma.user.findUnique).not.toHaveBeenCalled();
    expect(prisma.user.create).not.toHaveBeenCalled();
  });

  it('微信响应体读取仍受配置超时保护', async () => {
    jest.useFakeTimers();
    try {
      const prisma: any = { user: { findUnique: jest.fn(), create: jest.fn() } };
      const service = new AuthService(
        prisma,
        {} as any,
        config({
          NODE_ENV: 'production',
          WX_APP_ID: 'real-app',
          WX_APP_SECRET: 'real-secret',
          WX_JSCODE2SESSION_TIMEOUT_MS: 1000,
        }),
        { emitRefreshTokenReplay: jest.fn() } as any,
      );
      jest.spyOn(global, 'fetch').mockImplementation(async (_url, init) => ({
        ok: true,
        json: () => new Promise((_resolve, reject) => {
          init?.signal?.addEventListener('abort', () => {
            reject(Object.assign(new Error('aborted'), { name: 'AbortError' }));
          });
        }),
      }) as any);

      const login = service.wechatLogin('sensitive-code');
      // 提前挂一个 catch，避免超时期间出现未处理拒绝告警
      login.catch(() => undefined);
      await jest.advanceTimersByTimeAsync(1001);
      await expect(login).rejects.toBeInstanceOf(UnauthorizedException);
      expect(prisma.user.create).not.toHaveBeenCalled();
    } finally {
      jest.useRealTimers();
    }
  });

  it('重放在事务提交后告警；告警失败不改变 401', async () => {
    const order: string[] = [];
    const tx: any = {
      refreshToken: {
        findUnique: jest.fn().mockResolvedValue({ id: 'old', userId: 'user-1', revokedAt: new Date() }),
        updateMany: jest.fn().mockImplementation(async () => { order.push('revoke'); return { count: 1 }; }),
      },
    };
    const prisma: any = {
      $transaction: jest.fn(async (callback: any) => {
        const result = await callback(tx);
        order.push('commit');
        return result;
      }),
    };
    const alert = {
      emitRefreshTokenReplay: jest.fn().mockImplementation(async () => {
        order.push('alert');
        throw new Error('unavailable');
      }),
    };
    const jwt: any = { verify: jest.fn().mockReturnValue({ sub: 'user-1' }) };
    const service = new AuthService(prisma, jwt, config({ JWT_SECRET: 'secret' }), alert as any);
    await expect(service.refreshToken('old-token', 'req-1')).rejects.toBeInstanceOf(UnauthorizedException);
    await new Promise((resolve) => setImmediate(resolve));
    expect(order.slice(0, 2)).toEqual(['revoke', 'commit']);
    expect(alert.emitRefreshTokenReplay).toHaveBeenCalledWith('user-1', 'req-1');
  });

  it('条件消费 count=1 时在同事务创建新 token', async () => {
    const tx: any = {
      refreshToken: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'old', userId: 'user-1', revokedAt: null, expiresAt: new Date(Date.now() + 60000),
        }),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        create: jest.fn().mockResolvedValue({}),
      },
      user: { findUnique: jest.fn().mockResolvedValue({ id: 'user-1' }) },
    };
    const prisma: any = { $transaction: jest.fn((callback: any) => callback(tx)) };
    const jwt: any = {
      verify: jest.fn().mockReturnValue({ sub: 'user-1' }),
      sign: jest.fn().mockReturnValueOnce('access').mockReturnValueOnce('new-refresh'),
    };
    const service = new AuthService(
      prisma, jwt, config({ JWT_SECRET: 'secret' }),
      { emitRefreshTokenReplay: jest.fn() } as any,
    );
    await expect(service.refreshToken('old-refresh')).resolves.toMatchObject({ refreshToken: 'new-refresh' });
    expect(tx.refreshToken.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ revokedAt: null, expiresAt: { gt: expect.any(Date) } }),
    }));
    expect(tx.refreshToken.create).toHaveBeenCalledTimes(1);
  });
});
