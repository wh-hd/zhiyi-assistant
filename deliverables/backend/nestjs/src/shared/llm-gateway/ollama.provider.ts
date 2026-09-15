import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ChatMessage, LLMOptions, LLMProvider, LLMResponse } from './interfaces';

interface ModelInfo {
  template?: string;
  system?: string;
  license?: string;
  details?: Record<string, unknown>;
}

/**
 * Qwen2.5 系列模型 chat template 占位符。
 * 当 Ollama 模型没有提供 template（例如部分从 HuggingFace GGUF 直接导入的模型）时，
 * 我们用这个手动格式走 /api/generate，避免 /api/chat 把系统提示词当内容返回。
 */
const QWEN_IM_START = '<|im_start|>';
const QWEN_IM_END = '<|im_end|>'; 

@Injectable()
export class OllamaProvider implements LLMProvider {
  readonly name = 'ollama';
  private readonly logger = new Logger(OllamaProvider.name);
  private readonly baseUrl: string;
  private readonly model: string;
  private readonly fallbackModel: string;
  private readonly timeout: number;
  private availableModel: string | null = null;
  private readonly modelInfoCache = new Map<string, ModelInfo | null>();
  /**
   * 记录「经探测发现 /api/chat 会泄露模板/角色提示词」的模型。
   * 一旦命中，后续所有调用直接走 /api/generate，不再重复踩雷。
   */
  private readonly generateOnlyModels = new Set<string>();

  constructor(private configService: ConfigService) {
    this.baseUrl = configService.get<string>(
      'LLM_BASE_URL',
      'http://ollama:11434',
    );
    this.model = configService.get<string>(
      'LLM_MODEL',
      'fableforge-ai/nexus-medical:q4_k_m',
    );
    this.fallbackModel = configService.get<string>(
      'LLM_FALLBACK_MODEL',
      'qwen2.5:1.5b',
    );
    // 环境变量始终是字符串，ConfigService.get<number> 不做运行时转换
    // 必须显式 Number() 否则 AbortSignal.timeout() 会报 TypeError
    this.timeout = Number(configService.get('LLM_TIMEOUT', 30000)) || 30000;
  }

  /**
   * 剥离 LLM 输出中的 chat template token 与常见泄露内容。
   * 这是用户可见前的最后清洗关卡，必须彻底：
   *
   * 1. 占位 / 控制 token：
   *    - 自定义占位符：{output} {/output} {response} {/response}
   *      {assistant_response} {/assistant_response} {thinking} {/thinking}
   *      {system} {user} {assistant} 及其闭合标签
   *    - ChatML / Qwen 系列：<im_start> <im_end> <|im_start|> <|im_end|>
   *      <|start|> <|end|> <|system|> <|user|> <|assistant|> <|endoftext|>
   * 2. 泄露的角色提示词：模型把自身系统提示词当内容返回
   *    （常见于无正确 chat template 的 GGUF base 模型，例如
   *    "You are a deep learning engineer..."）。检测开头 "You are a/an/the ..."，
   *    一直删到首个中文字符（真实回答起点）或换行处为止，避免误删中文回答。
   * 3. 模型卡签名行（如「AI · hf.co/King3DjbI/...」）。
   * 4. 压缩连续空白（含换行/制表）为单个空格，并 trim 首尾。
   */
  private stripTemplateTokens(content: string): string {
    if (!content) return content;
    let result = content;

    // 1) 占位 / 控制 token
    const tokenPattern =
      /\{assistant_response\}|\{\/assistant_response\}|\{response\}|\{\/response\}|\{output\}|\{\/output\}|\{thinking\}|\{\/thinking\}|\{system\}|\{\/system\}|\{user\}|\{\/user\}|\{assistant\}|\{\/assistant\}|<im_start>|<im_end>|<\|im_start\|>|<\|im_end\|>|<\|start\|>|<\|end\|>|<\|system\|>|<\|user\|>|<\|assistant\|>|<\|endoftext\|>/gi;
    result = result.replace(tokenPattern, ' ');

    // 2) 防御性清洗：删掉开头泄露的英文角色提示词（如 "You are a deep learning engineer..."）。
    //    容错前置空白（前面刚被 token 替换出空格），遇到首个中文或换行即停，保留真实回答。
    const leakedSystemPattern = /^\s*You\s+are\b[\s\S]*?(?=[\u4e00-\u9fff]|\n|$)/i;
    result = result.replace(leakedSystemPattern, ' ');

    // 3) 模型卡签名行（如 "AI · hf.co/King3DjbI/nexus-medical-GGUF:q4_k_m"）
    result = result.replace(/AI\s*[·•*]\s*hf\.co\S*/gi, ' ');

    // 4) 压缩连续空白（含换行/制表）为单个空格，并 trim 首尾
    result = result.replace(/\s+/g, ' ').trim();

    return result;
  }

  private isInvalidContent(content: string): boolean {
    if (!content || content.trim().length < 2) return true;
    const lowered = content.trim().toLowerCase();
    if (lowered.startsWith('you are')) return true;
    // 任意泄露 token 出现即判定无效
    const leakTokens = [
      '{output}',
      '{/output}',
      '{response}',
      '{/response}',
      '{assistant_response}',
      '{/assistant_response}',
      '{thinking}',
      '{/thinking}',
      '<im_end>',
      '<|im_end|>',
      '<|endoftext|>',
    ];
    return leakTokens.some((t) => lowered.includes(t));
  }

  /**
   * 查询 Ollama 模型信息（缓存）。
   * 若模型没有 template，则走 /api/generate；否则走 /api/chat。
   */
  private async getModelInfo(model: string): Promise<ModelInfo | null> {
    const cached = this.modelInfoCache.get(model);
    if (cached !== undefined) return cached;

    try {
      const res = await fetch(`${this.baseUrl}/api/show`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: model }),
        signal: AbortSignal.timeout(5000),
      });
      if (!res.ok) {
        this.logger.warn(`Failed to get model info for ${model}: HTTP ${res.status}`);
        this.modelInfoCache.set(model, null);
        return null;
      }
      const info = (await res.json()) as ModelInfo;
      this.modelInfoCache.set(model, info);
      return info;
    } catch (error) {
      this.logger.warn(`Failed to get model info for ${model}: ${error.message}`);
      this.modelInfoCache.set(model, null);
      return null;
    }
  }

  private hasChatTemplate(model: string): boolean {
    const info = this.modelInfoCache.get(model);
    return !!info?.template && info.template.trim().length > 0;
  }

  /**
   * 为无 chat template 的模型构造 Qwen2.5 风格对话 prompt。
   */
  private buildGeneratePrompt(messages: ChatMessage[]): string {
    let prompt = '';
    for (const message of messages) {
      if (message.role === 'system') {
        prompt += `${QWEN_IM_START}system\n${message.content}${QWEN_IM_END}\n`;
      } else if (message.role === 'user') {
        prompt += `${QWEN_IM_START}user\n${message.content}${QWEN_IM_END}\n`;
      } else if (message.role === 'assistant') {
        prompt += `${QWEN_IM_START}assistant\n${message.content}${QWEN_IM_END}\n`;
      }
    }
    prompt += `${QWEN_IM_START}assistant\n`;
    return prompt;
  }

  /**
   * 获取可用模型 — 优先 NEXUS-Medical，回退 qwen2.5
   */
  private async resolveModel(): Promise<string> {
    if (this.availableModel) return this.availableModel;

    try {
      const res = await fetch(`${this.baseUrl}/api/tags`, {
        signal: AbortSignal.timeout(5000),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      const data = await res.json();
      const modelNames: string[] = (data.models || []).map(
        (m: any) => m.name,
      );

      if (modelNames.includes(this.model)) {
        this.availableModel = this.model;
        this.logger.log(`Using primary model: ${this.model}`);
      } else if (modelNames.includes(this.fallbackModel)) {
        this.availableModel = this.fallbackModel;
        this.logger.warn(
          `Primary model "${this.model}" not found, using fallback: ${this.fallbackModel}`,
        );
      } else if (modelNames.length > 0) {
        this.availableModel = modelNames[0];
        this.logger.warn(
          `No configured model found, using first available: ${this.availableModel}`,
        );
      } else {
        throw new Error('No models available in Ollama');
      }

      return this.availableModel;
    } catch (error) {
      this.logger.error(`Failed to resolve model: ${error.message}`);
      // 最后的回退
      this.availableModel = this.model;
      return this.model;
    }
  }

  async isAvailable(): Promise<boolean> {
    try {
      const res = await fetch(`${this.baseUrl}/api/tags`, {
        signal: AbortSignal.timeout(5000),
      });
      if (!res.ok) return false;
      const data = await res.json();
      return (data.models || []).length > 0;
    } catch {
      return false;
    }
  }

  async chat(
    messages: ChatMessage[],
    options?: LLMOptions,
  ): Promise<LLMResponse> {
    const model = options?.model || (await this.resolveModel());
    await this.getModelInfo(model);

    if (this.generateOnlyModels.has(model) || !this.hasChatTemplate(model)) {
      this.logger.debug(`Using /api/generate for ${model} (chat path disabled)`);
      return this.generate(messages, options, model);
    }

    const startTime = Date.now();
    this.logger.debug(
      `Chat request: model=${model}, messages=${messages.length}`,
    );

    const res = await fetch(`${this.baseUrl}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model,
        messages,
        stream: false,
        options: {
          temperature: Number(options?.temperature) || 0.7,
          num_predict: Number(options?.maxTokens) || 2048,
          top_p: options?.topP ?? 0.9,
        },
      }),
      signal: options?.signal
        ? AbortSignal.any([options.signal, AbortSignal.timeout(Number(options?.timeout || this.timeout) || 30000)])
        : AbortSignal.timeout(Number(options?.timeout || this.timeout) || 30000),
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => 'unknown');
      throw new Error(
        `Ollama API error ${res.status}: ${errText}`,
      );
    }

    const data = await res.json();
    let content = this.stripTemplateTokens(data.message?.content || '');

    // 防御性兜底：如果 /api/chat 返回的内容还是泄露了角色提示词或模板占位符，
    // 立刻禁掉该模型的 /api/chat 并切换到 /api/generate 重写 Qwen2.5 prompt
    if (this.isInvalidContent(content)) {
      this.logger.warn(
        `Chat response looks invalid for ${model}, disabling /api/chat and falling back to /api/generate`,
      );
      this.generateOnlyModels.add(model);
      return this.generate(messages, options, model);
    }

    const responseTimeMs = Date.now() - startTime;
    this.logger.log(
      `Chat complete: ${responseTimeMs}ms, model=${model}`,
    );

    return {
      content,
      model,
      tokensUsed:
        data.prompt_eval_count + data.eval_count || undefined,
      responseTimeMs,
    };
  }

  /**
   * 无 chat template 模型的兜底调用（/api/generate）。
   */
  private async generate(
    messages: ChatMessage[],
    options: LLMOptions | undefined,
    model: string,
  ): Promise<LLMResponse> {
    const startTime = Date.now();
    const prompt = this.buildGeneratePrompt(messages);

    this.logger.debug(`Generate request: model=${model}, prompt=${prompt.length} chars`);

    const res = await fetch(`${this.baseUrl}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model,
        prompt,
        stream: false,
        options: {
          temperature: Number(options?.temperature) || 0.7,
          num_predict: Number(options?.maxTokens) || 2048,
          top_p: options?.topP ?? 0.9,
        },
      }),
      signal: options?.signal
        ? AbortSignal.any([options.signal, AbortSignal.timeout(Number(options?.timeout || this.timeout) || 30000)])
        : AbortSignal.timeout(Number(options?.timeout || this.timeout) || 30000),
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => 'unknown');
      throw new Error(`Ollama generate error ${res.status}: ${errText}`);
    }

    const data = await res.json();
    const content = this.stripTemplateTokens(data.response || '');
    const responseTimeMs = Date.now() - startTime;

    this.logger.log(`Generate complete: ${responseTimeMs}ms, model=${model}`);

    return {
      content,
      model,
      tokensUsed: (data.prompt_eval_count || 0) + (data.eval_count || 0) || undefined,
      responseTimeMs,
    };
  }

  async *chatStream(
    messages: ChatMessage[],
    options?: LLMOptions,
  ): AsyncGenerator<string, LLMResponse, unknown> {
    const model = options?.model || (await this.resolveModel());
    await this.getModelInfo(model);

    if (this.generateOnlyModels.has(model) || !this.hasChatTemplate(model)) {
      this.logger.debug(`Using /api/generate stream for ${model} (chat path disabled)`);
      const fallbackResult = yield* this.generateStream(messages, options, model);
      return fallbackResult;
    }

    const startTime = Date.now();
    this.logger.debug(
      `Stream request: model=${model}, messages=${messages.length}`,
    );

    const res = await fetch(`${this.baseUrl}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model,
        messages,
        stream: true,
        options: {
          temperature: Number(options?.temperature) || 0.7,
          num_predict: Number(options?.maxTokens) || 2048,
          top_p: options?.topP ?? 0.9,
        },
      }),
      signal: options?.signal
        ? AbortSignal.any([options.signal, AbortSignal.timeout(Number(options?.timeout || this.timeout) || 30000)])
        : AbortSignal.timeout(Number(options?.timeout || this.timeout) || 30000),
    });

    if (!res.ok || !res.body) {
      const errText = await res.text().catch(() => 'unknown');
      throw new Error(
        `Ollama stream error ${res.status}: ${errText}`,
      );
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    let totalContent = '';
    let tokensUsed = 0;
    let naturallyCompleted = false;
    let switchedToGenerate = false;

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) {
          naturallyCompleted = true;
          break;
        }

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (!line.trim()) continue;

          try {
            const json = JSON.parse(line);

            if (json.message?.content) {
              const chunk = json.message.content;
              totalContent += chunk;

              // 流式过程中若发现模型在返回角色提示词或模板占位符，立即切换路径。
              // 注意：泄露 chunk 在检测成功后才可能被 yield，此处先于 yield 拦截，
              // 因此已输出给客户端的内容都是干净的（已过滤），不会包含 {output} / "You are" 等。
              if (!switchedToGenerate && this.shouldSwitchToGenerate(chunk, totalContent)) {
                switchedToGenerate = true;
                // 记录该模型 chat 路径不可用，后续请求直接走 /api/generate
                this.generateOnlyModels.add(model);
                this.logger.warn(
                  `Stream leak detected for ${model}, switching to /api/generate mid-stream`,
                );
                await reader.cancel('switching to generate fallback').catch(() => undefined);
                reader.releaseLock();
                const fallbackResult = yield* this.generateStream(messages, options, model);
                return fallbackResult;
              }

              yield this.stripTemplateTokens(chunk);
            }

            if (json.done) {
              tokensUsed =
                (json.prompt_eval_count || 0) +
                (json.eval_count || 0);
            }
          } catch {
            // Incomplete JSON, skip
          }
        }
      }
    } finally {
      if (!naturallyCompleted && !switchedToGenerate) await reader.cancel('stream cancelled').catch(() => undefined);
      reader.releaseLock();
    }

    const responseTimeMs = Date.now() - startTime;
    this.logger.log(
      `Stream complete: ${responseTimeMs}ms, ${totalContent.length} chars, model=${model}`,
    );

    return {
      content: this.stripTemplateTokens(totalContent),
      model,
      tokensUsed: tokensUsed || undefined,
      responseTimeMs,
    };
  }

  private shouldSwitchToGenerate(chunk: string, totalContent: string): boolean {
    // totalContent 已包含当前 chunk，统一小写后判断
    const combined = `${totalContent}${chunk}`.toLowerCase();

    // 1) 任意 "You are a/an/the ..." 角色提示词句柄
    if (/you are\s+(a|an|the)\b/.test(combined)) return true;

    // 2) 任意模板占位 / 控制 token
    const leakTokens = [
      '{output}',
      '{/output}',
      '{response}',
      '{/response}',
      '{assistant_response}',
      '{/assistant_response}',
      '{thinking}',
      '{/thinking}',
      '<im_end>',
      '<|im_end|>',
      '<|endoftext|>',
    ];
    return leakTokens.some((t) => combined.includes(t));
  }

  /**
   * 无 chat template 模型的流式兜底（/api/generate stream）。
   */
  private async *generateStream(
    messages: ChatMessage[],
    options: LLMOptions | undefined,
    model: string,
  ): AsyncGenerator<string, LLMResponse, unknown> {
    const startTime = Date.now();
    const prompt = this.buildGeneratePrompt(messages);

    this.logger.debug(`Generate stream request: model=${model}, prompt=${prompt.length} chars`);

    const res = await fetch(`${this.baseUrl}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model,
        prompt,
        stream: true,
        options: {
          temperature: Number(options?.temperature) || 0.7,
          num_predict: Number(options?.maxTokens) || 2048,
          top_p: options?.topP ?? 0.9,
        },
      }),
      signal: options?.signal
        ? AbortSignal.any([options.signal, AbortSignal.timeout(Number(options?.timeout || this.timeout) || 30000)])
        : AbortSignal.timeout(Number(options?.timeout || this.timeout) || 30000),
    });

    if (!res.ok || !res.body) {
      const errText = await res.text().catch(() => 'unknown');
      throw new Error(`Ollama generate stream error ${res.status}: ${errText}`);
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    let totalContent = '';
    let tokensUsed = 0;
    let naturallyCompleted = false;

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) {
          naturallyCompleted = true;
          break;
        }

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (!line.trim()) continue;

          try {
            const json = JSON.parse(line);
            const chunk = json.response || '';
            totalContent += chunk;
            yield this.stripTemplateTokens(chunk);

            if (json.done) {
              tokensUsed =
                (json.prompt_eval_count || 0) +
                (json.eval_count || 0);
            }
          } catch {
            // Incomplete JSON, skip
          }
        }
      }
    } finally {
      if (!naturallyCompleted) await reader.cancel('stream cancelled').catch(() => undefined);
      reader.releaseLock();
    }

    const responseTimeMs = Date.now() - startTime;
    this.logger.log(
      `Generate stream complete: ${responseTimeMs}ms, ${totalContent.length} chars, model=${model}`,
    );

    return {
      content: this.stripTemplateTokens(totalContent),
      model,
      tokensUsed: tokensUsed || undefined,
      responseTimeMs,
    };
  }
}
