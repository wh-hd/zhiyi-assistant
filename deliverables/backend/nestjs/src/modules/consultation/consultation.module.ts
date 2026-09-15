import { Module } from '@nestjs/common';
import { ConsultationController } from './consultation.controller';
import { ConsultationService } from './consultation.service';
import { PrismaModule } from '../../shared/prisma/prisma.module';
import { CacheModule } from '../../shared/cache/cache.module';
import { EventBusModule } from '../../shared/events/event-bus.module';
// LlmGatewayModule 和 RedLineEngineModule 均为 @Global()，无需显式导入

@Module({
  imports: [PrismaModule, CacheModule, EventBusModule],
  controllers: [ConsultationController],
  providers: [ConsultationService],
  exports: [ConsultationService],
})
export class ConsultationModule {}
