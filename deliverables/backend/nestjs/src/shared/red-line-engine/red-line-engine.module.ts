import { Module, Global, OnModuleInit, Logger } from '@nestjs/common';
import { RedLineEngine } from './red-line-engine';
import { ConsultationService } from '../../modules/consultation/consultation.service';

/**
 * 红线规则引擎模块（全局）
 *
 * OnModuleInit: 自动注入到 ConsultationService
 * 避免循环依赖：使用 forwardRef 或延迟注入
 */
@Global()
@Module({
  providers: [RedLineEngine],
  exports: [RedLineEngine],
})
export class RedLineEngineModule implements OnModuleInit {
  private readonly logger = new Logger(RedLineEngineModule.name);

  constructor(
    private readonly engine: RedLineEngine,
    // 延迟注入 ConsultationService 以避免循环依赖
    // 实际场景使用 @Inject(forwardRef(() => ConsultationService))
  ) {}

  onModuleInit() {
    this.logger.log(
      'RedLineEngine initialized with 18 rule categories (immediate/urgent/advisory)',
    );
    // 性能基准测试（预热）
    const testQueries = [
      '我最近有点胸痛，还出冷汗',
      '孩子发烧39度了',
      '今天天气不错',
    ];

    for (const q of testQueries) {
      const start = performance.now();
      this.engine.check(q);
      const elapsed = (performance.now() - start).toFixed(2);
      this.logger.debug(`RedLine check latency: ${elapsed}ms for query: "${q}"`);
    }
  }
}
