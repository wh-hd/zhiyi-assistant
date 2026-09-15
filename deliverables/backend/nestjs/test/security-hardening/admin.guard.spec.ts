import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { GUARDS_METADATA } from '@nestjs/common/constants';
import { AdminGuard } from '../../src/common/guards/admin.guard';
import { MetricController } from '../../src/modules/metric/metric.controller';

function contextFor(userId?: string): ExecutionContext {
  return {
    switchToHttp: () => ({ getRequest: () => ({ user: userId ? { id: userId } : undefined }) }),
  } as unknown as ExecutionContext;
}

describe('AdminGuard', () => {
  it.each([undefined, '', '   ', ' , , '])('空白名单拒绝访问: %p', (value) => {
    const config = { get: jest.fn().mockReturnValue(value) } as unknown as ConfigService;
    expect(() => new AdminGuard(config).canActivate(contextFor('user-a')))
      .toThrow(ForbiddenException);
  });

  it('支持多 ID、trim 并过滤空条目', () => {
    const config = {
      get: jest.fn().mockReturnValue(' user-a, ,user-b  ,'),
    } as unknown as ConfigService;
    const guard = new AdminGuard(config);
    expect(guard.canActivate(contextFor('user-b'))).toBe(true);
    expect(() => guard.canActivate(contextFor('user-c'))).toThrow(ForbiddenException);
  });

  it('无认证用户时拒绝', () => {
    const config = { get: jest.fn().mockReturnValue('user-a') } as unknown as ConfigService;
    expect(() => new AdminGuard(config).canActivate(contextFor())).toThrow(ForbiddenException);
  });

  it('GET thresholds 不挂 AdminGuard，PATCH thresholds 挂载守卫', () => {
    const readGuards = Reflect.getMetadata(
      GUARDS_METADATA,
      MetricController.prototype.thresholds,
    ) ?? [];
    const writeGuards = Reflect.getMetadata(
      GUARDS_METADATA,
      MetricController.prototype.updateThreshold,
    ) ?? [];
    expect(readGuards).not.toContain(AdminGuard);
    expect(writeGuards).toContain(AdminGuard);
  });
});
