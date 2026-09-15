import { OllamaProvider } from '../../src/shared/llm-gateway/ollama.provider';

function makeConfig() {
  const map: Record<string, unknown> = {
    LLM_BASE_URL: 'http://localhost:11434',
    LLM_MODEL: 'nexus-medical',
    LLM_FALLBACK_MODEL: 'qwen2.5:1.5b',
    LLM_TIMEOUT: 30000,
  };
  return {
    get: jest.fn((key: string, fallback?: unknown) =>
      key in map ? map[key] : fallback,
    ),
  } as any;
}

function jsonResponse(obj: any, status = 200): any {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => obj,
    text: async () => JSON.stringify(obj),
    body: undefined,
  };
}

describe('OllamaProvider 回复泄露防护', () => {
  let provider: any;

  beforeEach(() => {
    provider = new OllamaProvider(makeConfig());
  });

  describe('stripTemplateTokens', () => {
    it('剥离 {output} / {response} 等占位符', () => {
      expect(provider.stripTemplateTokens('你好{output}世界')).toBe('你好 世界');
      expect(provider.stripTemplateTokens('{response}内容{/response}')).toBe('内容');
      expect(provider.stripTemplateTokens('{assistant_response}x{/assistant_response}')).toBe('x');
    });

    it('剥离 <im_end> / <|im_end|> / <|endoftext|> 控制 token', () => {
      expect(provider.stripTemplateTokens('文本<im_end>更多')).toBe('文本 更多');
      expect(provider.stripTemplateTokens('<|im_end|>尾巴')).toBe('尾巴');
      expect(provider.stripTemplateTokens('<|endoftext|>')).toBe('');
    });

    it('删除开头泄露的 "You are ..." 角色提示词（止于首个中文）', () => {
      expect(
        provider.stripTemplateTokens('You are a deep learning engineer. 请描述症状'),
      ).toBe('请描述症状');
      expect(
        provider.stripTemplateTokens('You are an AI language model trained to help. 建议多休息'),
      ).toBe('建议多休息');
    });

    it('模型卡签名行被移除', () => {
      expect(
        provider.stripTemplateTokens('AI · hf.co/King3DjbI/nexus-medical-GGUF:q4_k_m 模型'),
      ).toBe('模型');
    });

    it('正常中文回答原样保留', () => {
      expect(provider.stripTemplateTokens('建议多休息，多喝水。')).toBe(
        '建议多休息，多喝水。',
      );
    });
  });

  describe('isInvalidContent', () => {
    it('空 / 仅空白视为无效', () => {
      expect(provider.isInvalidContent('')).toBe(true);
      expect(provider.isInvalidContent('   ')).toBe(true);
    });

    it('以 "You are" 开头视为无效（覆盖各类角色提示词）', () => {
      expect(provider.isInvalidContent('You are a medical student')).toBe(true);
      expect(provider.isInvalidContent('You are a deep learning engineer')).toBe(true);
      expect(provider.isInvalidContent('You are an AI assistant')).toBe(true);
    });

    it('含模板占位符视为无效', () => {
      expect(provider.isInvalidContent('{output}')).toBe(true);
      expect(provider.isInvalidContent('xx {response} yy')).toBe(true);
      expect(provider.isInvalidContent('<|im_end|>')).toBe(true);
    });

    it('正常中文回答视为有效', () => {
      expect(provider.isInvalidContent('建议多休息，多喝水。')).toBe(false);
    });
  });

  describe('shouldSwitchToGenerate（流式中途检测）', () => {
    it('检测到角色提示词立即切换', () => {
      expect(
        provider.shouldSwitchToGenerate('You are a deep learning engineer', 'You are a deep learning engineer'),
      ).toBe(true);
      expect(provider.shouldSwitchToGenerate('You are an AI', 'You are an AI')).toBe(true);
    });

    it('检测到模板占位符立即切换', () => {
      expect(provider.shouldSwitchToGenerate('{output}', '{output}')).toBe(true);
      expect(provider.shouldSwitchToGenerate('xx <|im_end|>', 'xx <|im_end|>')).toBe(true);
    });

    it('正常中文不切换', () => {
      expect(provider.shouldSwitchToGenerate('建议多', '建议多休息')).toBe(false);
    });
  });

  describe('chat() 路径切换', () => {
    afterEach(() => jest.restoreAllMocks());

    it('/api/chat 泄露时禁掉 chat 路径并切换到 /api/generate 返回干净内容', async () => {
      const fetchMock = jest.fn(async (url: string, init?: any) => {
        const body = init?.body ? JSON.parse(init.body) : {};
        if (url.endsWith('/api/tags')) {
          return jsonResponse({ models: [{ name: 'nexus-medical' }] });
        }
        if (url.endsWith('/api/show')) {
          return jsonResponse({ template: '{{ .System }}\n{{ .Prompt }}' });
        }
        if (url.endsWith('/api/chat')) {
          return jsonResponse({
            message: { content: 'You are a deep learning engineer. {output}' },
            done: true,
            prompt_eval_count: 1,
            eval_count: 5,
          });
        }
        if (url.endsWith('/api/generate')) {
          return jsonResponse({
            response: '建议多休息，多喝水，必要时就医。',
            done: true,
            prompt_eval_count: 1,
            eval_count: 8,
          });
        }
        return jsonResponse({});
      });
      (global as any).fetch = fetchMock;

      const res = await provider.chat([
        { role: 'system', content: '你是智医助手' },
        { role: 'user', content: '我头疼' },
      ]);

      expect(res.content).toBe('建议多休息，多喝水，必要时就医。');
      expect(res.content.toLowerCase()).not.toContain('you are');
      expect(res.content).not.toContain('{output}');
      // 确认确实走了 /api/generate
      const generateCall = fetchMock.mock.calls.find((c: any[]) =>
        String(c[0]).endsWith('/api/generate'),
      );
      expect(generateCall).toBeDefined();
    });

    it('模型无 chat template 时直接走 /api/generate', async () => {
      const fetchMock = jest.fn(async (url: string, init?: any) => {
        if (url.endsWith('/api/tags')) {
          return jsonResponse({ models: [{ name: 'nexus-medical' }] });
        }
        if (url.endsWith('/api/show')) {
          return jsonResponse({}); // 无 template
        }
        if (url.endsWith('/api/generate')) {
          return jsonResponse({
            response: '请描述具体症状。',
            done: true,
            prompt_eval_count: 1,
            eval_count: 4,
          });
        }
        return jsonResponse({});
      });
      (global as any).fetch = fetchMock;

      const res = await provider.chat([
        { role: 'system', content: '你是智医助手' },
        { role: 'user', content: '我咳嗽' },
      ]);

      expect(res.content).toBe('请描述具体症状。');
      const chatCall = fetchMock.mock.calls.find((c: any[]) =>
        String(c[0]).endsWith('/api/chat'),
      );
      expect(chatCall).toBeUndefined();
    });

    it('/api/chat 返回干净内容时直接返回，不切换', async () => {
      const fetchMock = jest.fn(async (url: string) => {
        if (url.endsWith('/api/tags')) {
          return jsonResponse({ models: [{ name: 'nexus-medical' }] });
        }
        if (url.endsWith('/api/show')) {
          return jsonResponse({ template: 'tmpl' });
        }
        if (url.endsWith('/api/chat')) {
          return jsonResponse({
            message: { content: '建议多喝温水，注意休息。' },
            done: true,
            prompt_eval_count: 1,
            eval_count: 5,
          });
        }
        return jsonResponse({});
      });
      (global as any).fetch = fetchMock;

      const res = await provider.chat([
        { role: 'system', content: '你是智医助手' },
        { role: 'user', content: '我发烧' },
      ]);

      expect(res.content).toBe('建议多喝温水，注意休息。');
      const generateCall = fetchMock.mock.calls.find((c: any[]) =>
        String(c[0]).endsWith('/api/generate'),
      );
      expect(generateCall).toBeUndefined();
    });
  });
});
