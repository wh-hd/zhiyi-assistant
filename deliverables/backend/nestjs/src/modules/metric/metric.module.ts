import { Module } from '@nestjs/common';
import { MetricController } from './metric.controller';
import { MetricService } from './metric.service';
import { AdminGuard } from '../../common/guards/admin.guard';

@Module({
  controllers: [MetricController],
  providers: [MetricService, AdminGuard],
  exports: [MetricService],
})
export class MetricModule {}
