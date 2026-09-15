import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { validateEnvironment } from './config/env.validation';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { ScheduleModule } from '@nestjs/schedule';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';

import { AppController } from './app.controller';
import { AppService } from './app.service';

import { PrismaModule } from './shared/prisma/prisma.module';
import { CacheModule } from './shared/cache/cache.module';
import { EventBusModule } from './shared/events/event-bus.module';
import { LlmGatewayModule } from './shared/llm-gateway/llm-gateway.module';
import { RedLineEngineModule } from './shared/red-line-engine/red-line-engine.module';

import { AuthModule } from './modules/auth/auth.module';
import { UserModule } from './modules/user/user.module';
import { FamilyModule } from './modules/family/family.module';
import { HealthRecordModule } from './modules/health-record/health-record.module';
import { AssessmentModule } from './modules/assessment/assessment.module';
import { ConsultationModule } from './modules/consultation/consultation.module';
import { MedicationModule } from './modules/medication/medication.module';
import { MetricModule } from './modules/metric/metric.module';
import { TaskModule } from './modules/task/task.module';
import { NotificationModule } from './modules/notification/notification.module';
import { KnowledgeModule } from './modules/knowledge/knowledge.module';
import { ReportModule } from './modules/report/report.module';
import { UploadModule } from './modules/upload/upload.module';
import { AiModule } from './modules/ai/ai.module';
import { LocalJsonStorageModule } from './shared/local-json-storage/local-json-storage.module';
import { FamilyPolicyModule } from './common/policies/family-policy.module';

@Module({
  imports: [
    // ---- 基础设施 ----
    ConfigModule.forRoot({
      isGlobal: true,
      ignoreEnvFile: process.env.NODE_ENV === 'production',
      envFilePath: ['.env'],
      validate: validateEnvironment,
    }),

    ThrottlerModule.forRoot([
      {
        name: 'default',
        ttl: 60000,      // 60秒窗口
        limit: 1000,     // 每个IP 60秒内最多1000次（支持高并发读场景）
      },
      {
        name: 'burst',
        ttl: 1000,       // 1秒窗口
        limit: 50,       // 每秒突发上限50，防止短时流量尖峰
      },
    ]),

    EventEmitterModule.forRoot({
      wildcard: false,
      delimiter: '.',
      newListener: true,
      removeListener: true,
      maxListeners: 20,
      verboseMemoryLeak: process.env.NODE_ENV === 'development',
    }),

    // ---- 定时任务（@nestjs/schedule：复评 / 漏服 / 连续异常预警） ----
    ScheduleModule.forRoot(),

    // ---- 共享基础设施 ----
    PrismaModule,
    CacheModule,
    EventBusModule,
    LlmGatewayModule,
    RedLineEngineModule,
    LocalJsonStorageModule,
    FamilyPolicyModule,

    // ---- 业务模块 ----
    AuthModule,
    UserModule,
    FamilyModule,
    HealthRecordModule,
    AssessmentModule,
    ConsultationModule,
    MedicationModule,
    MetricModule,
    TaskModule,
    NotificationModule,
    KnowledgeModule,
    ReportModule,
    UploadModule,
    AiModule,
  ],

  controllers: [AppController],
  providers: [
    AppService,
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule {}
