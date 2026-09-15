/**
 * ============================================================
 * LLM Gateway 接口定义
 * ============================================================
 * 统一的 LLM Provider 抽象层，支持 Ollama/OpenAI/DeepSeek 等
 * 通过 LLM_PROVIDER 环境变量切换
 * ============================================================
 */

export type LLMRole = 'system' | 'user' | 'assistant';

export interface ChatMessage {
  role: LLMRole;
  content: string;
}

export interface LLMOptions {
  model?: string;
  temperature?: number;
  maxTokens?: number;
  topP?: number;
  timeout?: number;
  signal?: AbortSignal;
}

export interface LLMResponse {
  content: string;
  model: string;
  tokensUsed?: number;
  responseTimeMs: number;
}

export interface LLMProvider {
  readonly name: string;

  /** 非流式对话 */
  chat(messages: ChatMessage[], options?: LLMOptions): Promise<LLMResponse>;

  /** 流式对话 — 逐 token yield */
  chatStream(
    messages: ChatMessage[],
    options?: LLMOptions,
  ): AsyncGenerator<string, LLMResponse, unknown>;

  /** 健康检查 — 模型是否可用 */
  isAvailable(): Promise<boolean>;
}

export interface SystemPromptContext {
  nickname: string;
  age?: number;
  gender?: number;
  bloodType?: string;
  chronicDiseases?: any[];
  allergies?: any[];
  familyHistory?: any[];
}

/**
 * 构建系统提示词 — 智医助手人格 + 健康上下文 + 安全约束
 */
export function buildSystemPrompt(ctx: SystemPromptContext): string {
  const genderText = ctx.gender === 1 ? '男' : ctx.gender === 2 ? '女' : '未知';
  const diseases = ctx.chronicDiseases?.length
    ? ctx.chronicDiseases.map((d: any) => `${d.disease || d.name || '未知'}(${d.severity || '未知'})`).join('、')
    : '无';
  const allergies = ctx.allergies?.length
    ? ctx.allergies.map((a: any) => `${a.allergen || a.name || '未知'}(${a.severity || '未知'})`).join('、')
    : '无';

  return `你是"智医助手"，一个温暖、专业的家庭健康助手。你的职责是提供健康建议和生活指导。

## 核心规则
1. 你不是医生，不能进行医疗诊断或开具处方
2. 所有建议仅供参考，不替代专业医疗诊断
3. 如涉及严重症状（胸痛、呼吸困难、意识不清等），必须建议用户立即就医
4. 你必须始终使用简体中文回答（即使用户使用英文提问，也必须用中文回复），严禁使用英文作答
5. 回答要简洁明了（200-400字），适合普通用户理解
6. 不要使用"我建议你去医院"作为开头，先给实际建议
7. 如果用户的问题与健康/医疗无关，必须礼貌地说明你的职责范围（你只提供健康相关建议），并温和地把话题引导回健康/医疗话题，不要顺着无关话题展开长篇回答
8. 禁止输出 Markdown 标题格式（例如以 "#"、"##" 开头的标题行，或 "---" 分隔线后紧跟 "# Part 1" 这类标题）；直接用数字分点作答，不要套用论文/报告的章节结构

## 当前咨询成员信息
- 姓名：${ctx.nickname}
- 年龄：${ctx.age ?? '未知'}岁
- 性别：${genderText}
- 血型：${ctx.bloodType ?? '未知'}
- 慢性病史：${diseases}
- 过敏史：${allergies}

## 回复格式
- 直接回答问题，不要"你好"等寒暄
- 用数字分点列出建议
- 结尾附一句温暖提醒
- 如需就医，明确说明原因`;
}
