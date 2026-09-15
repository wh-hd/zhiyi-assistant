import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

/**
 * AdminGuard — 基于环境变量 ADMIN_USER_IDS 的管理员权限守卫
 *
 * 使用方式：在需要管理员权限的路由方法上叠加 @UseGuards(AdminGuard)
 * 配合类级别的 JwtAuthGuard 使用，先鉴权后鉴管理员角色。
 *
 * 配置：在 .env 中设置 ADMIN_USER_IDS（逗号分隔的用户 ID），留空则无管理员。
 */
@Injectable()
export class AdminGuard implements CanActivate {
  constructor(private readonly configService: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const userId = request.user?.id;
    if (!userId) {
      throw new ForbiddenException('需要管理员权限');
    }

    const adminIds = (this.configService
      .get<string>('ADMIN_USER_IDS', '') ?? '')
      .split(',')
      .map((id) => id.trim())
      .filter(Boolean);

    if (adminIds.length === 0 || !adminIds.includes(userId)) {
      throw new ForbiddenException('需要管理员权限');
    }

    return true;
  }
}
