import { Module } from '@nestjs/common';
import { HealthRecordController } from './health-record.controller';
import { HealthRecordService } from './health-record.service';
import { PrismaModule } from '../../shared/prisma/prisma.module';
import { CacheModule } from '../../shared/cache/cache.module';
import { EventBusModule } from '../../shared/events/event-bus.module';

@Module({
  imports: [PrismaModule, CacheModule, EventBusModule],
  controllers: [HealthRecordController],
  providers: [HealthRecordService],
  exports: [HealthRecordService],
})
export class HealthRecordModule {}
