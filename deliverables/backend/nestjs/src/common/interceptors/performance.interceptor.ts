import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Logger,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';

/**
 * 性能监控拦截器
 * - 记录每个 API 请求的响应时间
 * - 慢请求（> 500ms）输出 warn，便于高并发场景下快速定位瓶颈
 * - 记录 5xx / 异常响应
 */
@Injectable()
export class PerformanceInterceptor implements NestInterceptor {
  private readonly logger = new Logger('Performance');
  private readonly slowThresholdMs = 500;

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const req = context.switchToHttp().getRequest();
    const method = req.method;
    const path = req.originalUrl || req.url;
    const start = Date.now();

    return next.handle().pipe(
      tap({
        next: () => {
          const duration = Date.now() - start;
          const message = `${method} ${path} ${duration}ms`;
          if (duration > this.slowThresholdMs) {
            this.logger.warn(`[SLOW] ${message}`);
          } else {
            this.logger.debug(message);
          }
        },
        error: (err) => {
          const duration = Date.now() - start;
          const status = err?.status ?? err?.response?.statusCode ?? 'unknown';
          this.logger.error(
            `[ERROR] ${method} ${path} ${status} ${duration}ms - ${err.message}`,
          );
        },
      }),
    );
  }
}
