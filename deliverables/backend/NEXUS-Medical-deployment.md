# NEXUS-Medical (HuggingFace) 模型部署 + 程序接入

## 你要的结果
1. **Docker 中部署 HuggingFace 模型** → `ollama-setup.sh` 从 HF 拉取 NEXUS-Medical GGUF 并建稳定别名 `nexus-medical`。
2. **程序模型接入打通** → AI 咨询 SSE 真正调用该模型（已端到端验证）。

## 关键事实
- `fableforge-ai/NEXUS-Medical` 仓库**只含 safetensors**，不能被 Ollama 直接运行。
- 可运行的 GGUF 量化在兄弟仓库 **`King3Djbl/nexus-medical-GGUF`**（含 `nexus-medical-q4_k_m.gguf` ~986MB）。
- 官方推荐：`ollama run hf.co/King3Djbl/nexus-medical-GGUF:Q4_K_M`（Ollama ≥0.5 支持 `hf.co/` 直拉）。
- 该模型**要求 ChatML 模板**，已在 Modelfile 中显式声明。

## 改动清单
| 文件 | 作用 |
|---|---|
| `backend/ollama-setup.sh` | **新增**。三级回退拉取（HF GGUF → Ollama 仓库 → qwen2.5），建 `nexus-medical` 别名（显式 ChatML），始终 exit 0 |
| `backend/docker-compose.yml` | `ollama-setup` 挂载并执行脚本；api `LLM_MODEL` 改为 `nexus-medical` |
| `nestjs/src/modules/ai/ai.controller.ts` + `ai.module.ts` | **新增**。`GET /v1/ai/status` 返回 `{provider,model,available}`（模型接入自检） |
| `nestjs/src/app.module.ts` | 注册 `AiModule` |
| `frontend/zhiyi-assistant-prototype.html` | `sendChat()` 由 `setTimeout` 假回复改为调用真实 `API.consultStream()` SSE；暴露 `window.primaryMemberId` |
| `nestjs/public/prototype.html` | 同步上述原型 |
| `nestjs/public/test.html` | AI Chat 面板新增「Check AI Model Status」按钮（调用 `/v1/ai/status`） |

## 验证结果（本机已跑通）
- `GET /v1/ai/status` → `{provider:ollama, model:nexus-medical, available:true}`
- `POST /v1/consultations`（SSE）→ `disclaimer:1, chunk:527, done:1`，model `nexus-medical:latest`，返回 943 字连贯中文医疗回答（**真实模型推理，非降级**）
- ChatML Modelfile 语法已本地 `ollama create` 验证通过
- `npm run build` 干净通过

## 你怎么测试
1. 完整启动（自动从 HF 拉模型）：`docker compose up -d --build`（或双击 `start_server.bat`）。
2. 打开 `http://localhost:3000/test.html` → 左侧 **AI Chat** →
   - 点 **Check AI Model Status**：应显示 `available=true, model=nexus-medical`
   - 点 **Start AI Consultation**：看 SSE 流式中文回答
3. 打开 `http://localhost:3000/prototype.html` → 底部 **咨询** Tab → 输入健康问题 → 实时流式回复（真模型）。

## 注意
- 若端口 3000 被旧进程占用：`netstat -ano | grep :3000` → `taskkill /F /PID <pid>`。
- 模型首次拉取约 986MB（取决于网速），拉取期间 AI 咨询会优雅降级，拉完自动可用。
