import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

/**
 * 统一响应格式拦截器
 * 将 controller 返回的数据包装为 { success: true, data: ..., meta: ... }
 */
@Injectable()
export class TransformInterceptor<T> implements NestInterceptor<T, any> {
  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest();

    return next.handle().pipe(
      map((data) => {
        // 跳过已经是标准格式的响应（如 SSE 流）
        if (data && data.success !== undefined) return data;

        // 跳过原始响应（Buffer/Stream）
        if (data instanceof Buffer || (data && data.pipe)) return data;

        return {
          success: true,
          data: data ?? null,
          meta: {
            timestamp: new Date().toISOString(),
            requestId: (request as any).requestId,
          },
        };
      }),
    );
  }
}
