/**
 * ============================================================
 * LLM Gateway Service — 统一 LLM 调用入口
 * ============================================================
 * 职责:
 * 1. 根据 LLM_PROVIDER 环境变量选择 Provider
 * 2. 提供统一的 chat() 和 chatStream() 接口
 * 3. 熔断降级: Ollama 不可用时回退到 canned 响应
 * ============================================================
 */

import { Injectable, Logger } from '@nestjs/common';
import { ChatMessage, LLMOptions, LLMResponse } from './interfaces';
import { OllamaProvider } from './ollama.provider';

@Injectable()
export class LlmGatewayService {
  private readonly logger = new Logger(LlmGatewayService.name);
  private failureCount = 0;
  private readonly maxFailures = 3;
  private circuitOpenUntil = 0;

  constructor(private readonly ollamaProvider: OllamaProvider) {}

  async chat(
    messages: ChatMessage[],
    options?: LLMOptions,
  ): Promise<LLMResponse> {
    if (this.isCircuitOpen()) {
      this.logger.warn('Circuit breaker open, returning fallback response');
      return this.fallbackResponse(messages);
    }

    try {
      const result = await this.ollamaProvider.chat(messages, options);
      this.failureCount = 0;
      return result;
    } catch (error) {
      this.handleFailure(error);
      return this.fallbackResponse(messages);
    }
  }

  async *chatStream(
    messages: ChatMessage[],
    options?: LLMOptions,
  ): AsyncGenerator<string, LLMResponse, unknown> {
    if (this.isCircuitOpen()) {
      this.logger.warn('Circuit breaker open, streaming fallback response');
      const fallback = this.fallbackResponse(messages);
      yield fallback.content;
      return fallback;
    }

    try {
      const startTime = Date.now();
      let totalContent = '';
      let lastResult: LLMResponse;

      const generator = this.ollamaProvider.chatStream(messages, options);

      try {
        while (true) {
          const { done, value } = await generator.next();
          if (done) {
            lastResult = value;
            break;
          }
          totalContent += value;
          yield value;
        }
      } finally {
        await generator.return(undefined as never);
      }

      this.failureCount = 0;

      return (
        lastResult || {
          content: totalContent,
          model: 'ollama',
          responseTimeMs: Date.now() - startTime,
        }
      );
    } catch (error) {
      this.handleFailure(error);
      // 流式已经开始，无法回退，抛出错误让上层处理
      throw error;
    }
  }

  async isAvailable(): Promise<boolean> {
    return this.ollamaProvider.isAvailable();
  }

  getProviderName(): string {
    return this.ollamaProvider.name;
  }

  // ============================================================
  // 熔断器
  // ============================================================

  private isCircuitOpen(): boolean {
    if (this.failureCount >= this.maxFailures) {
      if (Date.now() < this.circuitOpenUntil) {
        return true;
      }
      // 半开状态：重置计数，允许一次尝试
      this.failureCount = 0;
    }
    return false;
  }

  private handleFailure(error: any): void {
    this.failureCount++;
    this.logger.error(
      `LLM failure #${this.failureCount}: ${error.message}`,
    );

    if (this.failureCount >= this.maxFailures) {
      this.circuitOpenUntil = Date.now() + 30_000; // 30 秒后重试
      this.logger.warn(
        `Circuit breaker opened for 30s after ${this.failureCount} failures`,
      );
    }
  }

  private fallbackResponse(messages: ChatMessage[]): LLMResponse {
    const userMessage = messages.find((m) => m.role === 'user');
    const query = userMessage?.content || '';

    const fallbackText = `感谢你的咨询。我目前遇到了一些技术问题，暂时无法提供 AI 分析。

以下是一些通用建议：
1. 保持规律作息，每天 7-8 小时睡眠
2. 饮食均衡，多吃蔬菜水果，减少油腻和辛辣
3. 适量运动，每天至少 30 分钟
4. 如症状持续或加重，请及时就医

如果情况紧急，请拨打 120 或前往最近医院急诊科。

> 你的问题「${query.slice(0, 50)}」已记录，稍后可在历史中查看。`;

    return {
      content: fallbackText,
      model: 'fallback',
      responseTimeMs: 0,
    };
  }
}
