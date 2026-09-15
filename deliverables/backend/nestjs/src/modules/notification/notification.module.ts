import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { NotificationController } from './notification.controller';
import { NotificationService } from './notification.service';
import { NotificationConsumer } from './notification.consumer';
import { NotificationSchedulerService } from './notification-scheduler.service';
// 直接提供以下领域服务（其依赖 Prisma/Cache/EventBus 均为 @Global），
// 供定时任务调用各自的扫描查询方法；不导入它们的模块以避免重复注册控制器路由。
import { AssessmentService } from '../assessment/assessment.service';
import { MedicationService } from '../medication/medication.service';
import { MetricService } from '../metric/metric.service';

@Module({
  imports: [ScheduleModule],
  controllers: [NotificationController],
  providers: [
    NotificationService,
    NotificationConsumer,
    NotificationSchedulerService,
    AssessmentService,
    MedicationService,
    MetricService,
  ],
  exports: [NotificationService],
})
export class NotificationModule {}
