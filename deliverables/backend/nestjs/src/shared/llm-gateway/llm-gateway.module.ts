/**
 * ============================================================
 * LLM Gateway Module
 * ============================================================
 * 全局模块，导出 LlmGatewayService 供所有业务模块使用
 * ============================================================
 */

import { Global, Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { OllamaProvider } from './ollama.provider';
import { LlmGatewayService } from './llm-gateway.service';

@Global()
@Module({
  imports: [ConfigModule],
  providers: [OllamaProvider, LlmGatewayService],
  exports: [LlmGatewayService],
})
export class LlmGatewayModule {}
