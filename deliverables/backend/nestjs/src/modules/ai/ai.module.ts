/**
 * ============================================================
 * AI 模块 — 模型状态自检 + 用药识别 / 报告解读端点
 * LLM Gateway 为全局模块，可直接注入；UploadService 经 UploadModule 提供
 * ============================================================
 */

import { Module } from '@nestjs/common';
import { AiController } from './ai.controller';
import { UploadModule } from '../upload/upload.module';

@Module({
  imports: [UploadModule],
  controllers: [AiController],
})
export class AiModule {}
