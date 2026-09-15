# 智医助手 · 微信小程序迁移规划（代码通读版）

> 生成日期：2026-07-13 ｜ 状态：规划
> 依据：已通读 `deliverables/frontend/`（zhiyi-assistant-prototype.html/.css/.js）、`deliverables/backend/nestjs/`（12 业务模块 + Prisma + SSE）、`DESIGN-SYSTEM.md`、`WECHAT-MIGRATION-ROADMAP.md`、PRD 与 CODE-AUDIT 系列报告。
> 本文件在既有 `WECHAT-MIGRATION-ROADMAP.md` 基础上**补全**了模块依赖图、逐项复用/重构/替换映射、上线资质细节，并**修正**了其中一处技术判断（SSE 流式不必强依赖 WebSocket，详见 §2.4）。

---

## 0. 现状基线结论（通读代码后）

| 层 | 现状 | 迁移性质 |
|---|---|---|
| 后端 | NestJS 单体，12 模块，REST `/v1/*`，已含 `wechat-login`（code→openid 雏形）、JWT 双令牌原子轮换、手动 SSE、multer 上传（字段名 `file`）、TiDB Cloud(MySQL) + Redis + MinIO + Ollama 本地 LLM | **高复用**，仅少数接口需补完 |
| 前端 | 浏览器原型（已拆 HTML/CSS/JS 三件套），17 屏 + 3 Modal，**纯后端驱动**（`syncFromBackend` + `API` 对象），无任何 localStorage、登录态仅内存 | **需重写**为小程序原生/Taro/uni-app |
| 设计 | SoftCare 设计系统，CSS 自定义属性令牌（`var()`），WXSS **支持 var()**，可直接平移 | **高复用**（样式层） |
| 微信登录 | `auth.service.wechatLogin` 已调 `jscode2session`，但 `.env` 中 `WX_APP_ID/SECRET` 为空，仅 `code=xiaolin` 开发态 | **需补 env + 真机联调** |
| SSE 流式 | `consultation.service` 手动 `res.writeHead(text/event-stream)` + `res.write`，小程序 `wx.request` 原生不支持 `EventSource` | **需适配**（见 §2.4，非必改 WebSocket） |

**一句话判断**：后端是「几乎能直接用」的资产；前端是「逻辑可平移、视图必须重写」的原型；真正的阻塞项是**微信登录闭环、流式咨询适配、医疗健康类目资质**三项，而非代码量。

---

## 1. 核心功能模块及依赖关系

### 1.1 功能模块清单（17 屏 → 后端依赖）

| 前端页面（screen） | 核心功能 | 直接调用的后端端点 | 模块 |
|---|---|---|---|
| `screen-login`（登录落地页） | 微信一键登录、协议勾选 | `POST /auth/wechat-login` | auth |
| `home`（首页仪表盘） | 成员切换 / 今日用药 / 指标趋势 / 咨询入口 / 待办 | `/families`、`/families/:id/members`、`/medications/today`、`/metrics/trend`、`/consultations/history`、`/tasks`、`/notifications` | family / medication / metric / consultation / task / notification |
| `archive`（家庭档案） | 成员卡片列表 | `/families/:id/members` | family |
| `member-detail` | 成员详情、健康时间线 | `/families/:id/members/:mid`、`/health-records/:mid` | family / health-record |
| `add-member` | 新增成员 | `POST /families/:id/members`、`PATCH /health-records/:mid/*` | family / health-record |
| `meds` / `add-med` | 用药提醒、打卡、依从性 | `/medications`、`/medications/today`、`/medications/:id/adherence` | medication |
| `metrics` / `record-metric` | 11 类指标记录、趋势 SVG 图 | `/metrics`、`/metrics/batch`、`/metrics/trend`、`/metrics/thresholds` | metric |
| `consult`（AI 咨询） | SSE 流式对话、红线提示 | `POST /consultations`（SSE）、`/consultations/redline-check` | consultation |
| `assess` / `assess-report` / `screen-assess-history` | 健康自评分步答题、结果 | `/assessments/start`、`/answer`、`/:id/result`、`/history` | assessment |
| `profile` / `settings` | 我的、设置、授权管理 | `GET/PATCH /users/me`、`/notifications` | user / notification |
| `screen-task-edit` | 待办增删改 | `/tasks` | task |
| `screen-metric-history` / `screen-device-sync` | 指标历史、设备同步（占位） | `/metrics/trend`（设备页暂无真实适配） | metric |
| `about` / 导出 / 清缓存 / 退登（Modal） | 关于、导出、清缓存、退登 | `/reports/generate`、`/health-records/export`、`/auth/logout` | report / health-record / auth |

### 1.2 后端模块依赖图（内部）

```
                          ┌─────────────┐
                          │   auth      │  JWT 双令牌 / wechatLogin / refreshToken
                          └──────┬──────┘
                                 │ 注入 JwtAuthGuard(Bearer)
        ┌──────────────┬─────────┼──────────┬──────────────┬─────────────┐
        ▼              ▼         ▼          ▼              ▼             ▼
   ┌─────────┐   ┌──────────┐ ┌──────┐ ┌──────────┐  ┌─────────┐  ┌──────────┐
   │  user   │   │  family  │ │metric│ │assessment│  │medication│  │  task    │
   └─────────┘   └────┬─────┘ └──┬───┘ └────┬─────┘  └────┬────┘  └────┬─────┘
                      │          │          │             │            │
                      ▼          ▼          ▼             ▼            ▼
                 ┌──────────────┐  ┌──────────┐   ┌──────────────┐
                 │health-record │  │notification│  │  report(导出) │
                 └──────────────┘  └────┬─────┘   └──────┬───────┘
                                        │                │
                                        ▼                ▼
                                 ┌──────────────┐   (PDF 需 PDF_FONT_PATH)
                                 │ wechat_sub-  │
                                 │ scribe(当前  │
                                 │  仅 mock)    │
                                 └──────────────┘

   consultation ──┬──> auth (鉴权)
                  ├──> ai / llmGateway (Ollama 本地 LLM, NEXUS-Medical 1.5B)
                  ├──> redline 引擎 (本地 18 条规则, <5ms)
                  └──> notification (咨询后通知)

   ai(recognize-medication / analyze-report) ──> llmGateway（多模态未启用，状态 unavailable）
   upload ──> MinIO + auth（生产 UPLOAD_ENABLED=false 禁用）
   knowledge ──> 静态知识库（getById 缺 isPublished 校验，P3）
```

**关键依赖洞察**：
- `auth` 是所有模块的「地基」——**微信登录闭环必须在第一阶段完成**，否则后续页面无法联调。
- `consultation` 是唯一「非标准 REST + 重外部依赖（LLM）」的模块，是迁移重点适配对象。
- `notification` 的微信订阅消息当前为 mock，是上线前必须补齐的真实通道。
- `upload` 生产被 `UPLOAD_ENABLED=false` 强制关闭，上架前需开启并配置 HTTPS 域名。

---

## 2. 微信小程序技术限制与适配点

| 技术点 | Web 原型现状 | 小程序限制 | 适配方案 |
|---|---|---|---|
| 网络请求 | `fetch` + `apiFetch()` | 无 `fetch`；用 `wx.request`；**无 Cookie**；只收 HTTPS；域名需白名单 | 封装 `wx.request` 适配器，Token 放 `header.Authorization`；后端维持无状态 JWT（已满足） |
| **流式响应** | `fetch` + `ReadableStream` 读 SSE | `wx.request` 无 `EventSource`；但**支持 `enableChunked:true` + `onChunkReceived`** 接收分块 | 见 §2.4（关键修正） |
| 内联 SVG / Lucide | 大量 `<svg>` 内联图标 | WXML **不支持内联 SVG** | 转 iconfont（iconfont.cn 生成字体）或 base64 图片；Taro 下可用 SVG 组件但需编译支持 |
| DOM 操作 | `document.getElementById().innerHTML=`、事件委托 `data-handler` | 无 DOM、无 `innerHTML` | 改写为 WXML 数据绑定 + `setData`/`useState`；列表渲染用 `wx:for` |
| 本地存储 | **无**（Token 仅内存，刷新即丢） | `wx.setStorageSync` / `getStorageSync` | 登录态、草稿、离线兜底统一落 `Storage` |
| 登录 | `wx.login` 已预留（`smartLogin`） | 需 `button open-type` 触发或 `wx.login` 取 code | 调 `wx.login()` → `/auth/wechat-login` → 存 JWT |
| 文件上传 | `FormData` + `fetch` | `wx.uploadFile`（仅 `filePath+name` 单文件） | 已兼容：后端 multer 字段名 `file`；前端 `wx.chooseImage`+`wx.uploadFile` |
| 路由 | `switchScreen(id)` 单页切换 | 每页需在 `app.json` 注册，用 `navigateTo`/`switchTab` | 17 屏映射为 pages；tabBar 配置首页/档案/指标/咨询/我的 |
| CSS 变量 | `:root` 令牌 + `var()` | **WXSS 支持 `var()`** | 设计 Token **直接平移**，几乎零改动 |
| 设备 API | `navigator.getBattery()` | 小程序无此 API | 状态栏用电量组件移除或降级 |
| 组件 | 自定义 HTML 组件 + `classList.toggle` | 用小程序原生组件（view/text/scroll-view/switch 等） | `toggle-switch` → 原生 `switch` 或自定义组件；`modal` → 原生 `view`+`cover` |
| 实时推送 | 轮询/通知 | `wx.requestSubscribeMessage` + 服务端订阅消息 | 替换 `wechat_subscribe` 的 mock 为真实下发 |
| 内容安全 | 无 | 用户生成内容需过 `msgSecCheck` | 后端加内容安全中间件（咨询/自评/反馈/头像） |

### 2.4 流式咨询（SSE）适配 —— 修正既有判断

既有 `WECHAT-MIGRATION-ROADMAP.md` 认为「SSE 必须改 WebSocket」。实际上 **微信小程序 `wx.request` 自基础库 2.21+ 支持 `enableChunked: true`，可通过 `onChunkReceived` 拿到分块 `ArrayBuffer` 并手动拼装解析 SSE 的 `data:` 行**。因此有三种路线：

| 路线 | 后端改动 | 前端改动 | 体验 | 推荐度 |
|---|---|---|---|---|
| A. `wx.request` + `enableChunked` 解析 SSE | **几乎为零**（保持 SSE 输出） | 写一个 chunk 解析器（UTF-8 解码 + 按 `\n\n` 切事件） | 接近流式，略低于 WS | ⭐⭐⭐ 首选（最快、最小改动） |
| B. 新增 WebSocket Gateway | 新增 `@WebSocketGateway` + SSE→WS 桥接 | `wx.connectSocket` + 帧解析 | 最佳流式 | ⭐⭐ 体验优先时 |
| C. 先返回 `consultationId` + 轮询增量 | 新增「拉增量」端点 | 定时 `GET /consultations/:id/messages` | 无打字机 | ⭐ 兜底降级 |

**结论**：先用路线 A 跑通（后端 SSE 不动，仅前端加解析器），把 WebSocket 作为「体验增强」留到 Phase 4 可选，避免过早重构后端。

---

## 3. 复用 / 重构 / 替换映射

### 3.1 后端（结论：≈85% 直连复用）

| 模块/能力 | 判定 | 说明 |
|---|---|---|
| auth（JWT 双令牌、refresh 轮换） | ✅ 复用 | 无状态 JWT 天然适配小程序 |
| auth.wechatLogin（code→openid） | 🔧 重构 | 补 `WX_APP_ID/SECRET` 真实值 + 真机 `code2session` 联调；当前仅 `code=xiaolin` 开发态 |
| user / family / health-record | ✅ 复用 | 接口契约稳定 |
| metric（CRUD + 阈值 + trend） | ✅ 复用 | 11 类指标元数据驱动，前端落库即生效 |
| assessment（start/answer/result） | ✅ 复用 | 已完整 |
| task | ✅ 复用 | 已完整 |
| medication / adherence | ✅ 复用 | 手动录入可用；AI 药识缺（见下） |
| knowledge | ✅ 复用（补校验） | 加 `isPublished` 校验（P3） |
| consultation（SSE 主体） | 🔧 重构 | 按 §2.4 路线 A：后端基本不动，仅确认 SSE 头在小程序下正常；红线引擎已就绪 |
| notification（wechat_subscribe） | 🔧 重构 | 当前 `sendWechatSubscribe()` 仅 mock → 接真实订阅消息（模板 ID + access_token + `subscribeMessage`） |
| ai.recognize-medication / analyze-report | 🔄 替换/新增 | 当前 NEXUS-Medical 1.5B 纯文本返回 `unavailable`；需视觉模型 + `LLM_MULTIMODAL_ENABLED=true` + 上传开启；**建议延后到 P1** |
| upload | 🔧 重构 | 上架前设 `UPLOAD_ENABLED=true` + 配 HTTPS 上传域名（MinIO/CDN） |
| report（PDF 导出） | 🔧 重构 | 已生成 `pdfUrl`，但缺 `PDF_FONT_PATH` 致中文空白 |
| 内容安全（msgSecCheck） | 🆕 新增 | 用户生成内容审核中间件，审核硬性要求 |
| WebSocket Gateway | 🆕 可选 | 仅当选 §2.4 路线 B 时新增 |

### 3.2 前端（结论：逻辑层可平移，视图层必须重写）

| 资产 | 判定 | 落地方式 |
|---|---|---|
| `syncFromBackend()` 流程、全局 `D` 数据结构、API 端点约定、阈值判断逻辑 | ✅ 复用 | 平移为 Taro/uni-app 的 `store`/`hooks`（如 Zustand/Pinia） |
| SoftCare CSS 令牌（`var()`）与组件样式 | ✅ 复用 | WXSS 支持 `var()`，CSS 基本平移；Taro 下用 CSS Modules 或全局样式 |
| 17 屏 `renderXxx()` 视图逻辑 | 🔧 重构 | 改为页面组件 + `setData`/`useState` 声明式渲染 |
| `switchScreen` 路由 | 🔧 重构 | `navigateTo` / `switchTab` / `app.json` pages |
| `fetch` 网络层 `apiFetch` | 🔧 重构 | 封装 `wx.request` 适配器（带 Bearer、错误统一处理、401 刷新） |
| 登录态内存变量 | 🔧 重构 | `wx.setStorageSync('token', jwt)` 持久化 |
| SSE `consultStream`（`fetch`+`ReadableStream`） | 🔧 重构 | §2.4 路线 A：`wx.request({enableChunked:true})` + `onChunkReceived` 解析 |
| 内联 SVG / Lucide 图标 | 🔄 替换 | iconfont 字体或 base64 图片 |
| `document`/`innerHTML`/事件委托 | 🔄 替换 | WXML 数据绑定 + 组件事件 |
| `navigator.getBattery` | 🔄 替换（移除） | 状态栏电量降级去掉 |
| 微信登录 `wx.login` 调用 | ✅ 复用（已预留） | 接入真实 `wechat-login` |
| 文件上传 | 🔄 替换 | `wx.chooseImage` + `wx.uploadFile` |
| 推送 | 🔄 替换 | `wx.requestSubscribeMessage` |

### 3.3 框架选型建议（决策点）

| 路线 | 优点 | 缺点 | 适用 |
|---|---|---|---|
| **Taro（React + TS）** | 业务逻辑用 hooks 平移最自然；TS 与 NestJS 同源；一套出小程序+H5 | 需 build 产物 | ⭐ 推荐终态（团队熟 TS/React） |
| **uni-app（Vue）** | Vue 生态、跨端强 | 与现有 TS 逻辑映射略折 | 团队熟 Vue 时 |
| **原生 WXML/WXSS/JS** | 控制最强、无框架负担 | 重写量最大、无组件复用 | 不推荐为主 |
| **web-view 内嵌现有原型** | 几天可内测 | 非原生体验、BLE/原生能力受限、需业务域名 | **阶段 1 快速验证**用 |

**建议分阶段**：阶段 1 用 `web-view` 包原型跑通登录+核心流程做内测；阶段 2 起用 **Taro** 重写核心页（首页/成员详情/指标/待办/咨询）上架，其余页逐步平移。

---

## 4. 上线前置条件（资质 / 配置 / 审核）

### 4.1 微信开发者工具 & 工程配置
- 安装微信开发者工具，导入项目填 **AppID**（需先注册小程序账号）。
- 若用 Taro：`npm run build:weapp` 生成 `dist/` 再导入；开启「ES6 转 ES5 / 增强编译 / 上传代码时自动压缩」。
- 本地联调：体验版 + 真机预览；**必须真机**验证 `wx.login`/上传/订阅消息（开发者工具部分 API 受限）。

### 4.2 小程序账号与主体
- 注册 `mp.weixin.qq.com`。**医疗健康类目要求企业/个体工商户主体，个人主体不可做**。
- 微信认证 300 元/年（企业主体上架前必做；个人主体免认证但功能受限且不能选医疗类目）。

### 4.3 类目与资质（最高风险项）
- 智医助手定位**非诊疗健康管理**，但提供「AI 健康咨询/自评建议」，极可能被归为**医疗类目**。
- 候选类目：`医疗 - 健康咨询` 或 `工具 - 健康管理`。若选医疗类，需提交：
  - 《互联网医疗保健信息服务许可证》或《医疗机构执业许可证》（视具体类目）
  - 营业执照、法人证件、对公账户
- **审核周期数天~数周**，务必与编码并行启动。
- 备选降风险：以「工具-健康管理」申报，并在全链路强化**非诊疗声明**（现有红线引擎 + `.ai-disclaimer` 已覆盖），避免「诊断/处方/治疗」等敏感词触发医疗定性。

### 4.4 服务器域名 / HTTPS / ICP 备案
- 微信公众平台 → 开发 → 开发设置 → **服务器域名**：
  - `request 合法域名`：API 域名（HTTPS）
  - `uploadFile 合法域名`：MinIO/CDN 域名（HTTPS）
  - `downloadFile 合法域名`：资源域名
  - `socket 合法域名`：若启用 WebSocket
- 所有域名须 **HTTPS + 已 ICP 备案**（国内服务器）。TiDB Cloud / 腾讯云 CloudBase / CVM 均可行。
- 后端移除 `CORS_ORIGINS` 对本地地址依赖；小程序 `wx.request` 不受 CORS 限制，但需上述白名单。

### 4.5 内容安全（审核硬性）
- 用户生成内容（咨询文本、自评反馈、头像、昵称）须过 **微信内容安全 `msgSecCheck`** 或云开发内容安全。
- 后端新增内容安全中间件，拦截违规内容（医疗敏感词/广告/违禁）。

### 4.6 隐私与协议（个保法合规）
- 小程序后台配置《隐私保护指引》，声明收集字段：微信 openid、头像、健康档案（慢病/指标等）。
- 提供《用户协议》《隐私政策》可访问页（登录页已预留协议勾选）。
- 设备数据「解绑即删除」机制（DeviceSync 设计已规划）。

### 4.7 订阅消息
- 公众平台 → 功能 → 订阅消息，申请模板获取 `templateId`。
- 前端 `wx.requestSubscribeMessage` 授权；后端用 `access_token` 调 `subscribeMessage` 真实下发（替换当前 mock）。

---

## 5. 迁移规划（阶段 / 优先级 / 风险）

### 5.1 阶段划分（在既有路线图基础上细化）

| 阶段 | 目标 | 关键交付 | 预估 |
|---|---|---|---|
| **P0 准备（并行）** | 账号/主体/类目资质、域名备案、HTTPS | 小程序账号、企业认证、资质提交、备案域名 | 与编码并行 |
| **Phase 1 后端闭环** | 微信登录真机闭环 + HTTPS/域名 + 内容安全 | `wechat-login` 真 env 联调；内容安全中间件；`UPLOAD_ENABLED` 上架配置 | 1–1.5 周 |
| **Phase 2 外壳 + 核心验证** | `web-view` 包原型 / 或 Taro 首页+登录跑通 | 登录→首页→档案→指标 真机可走 | 2 周（web-view） / 3–4 周（Taro 核心页） |
| **Phase 3 全量页重写** | 17 屏全部原生化（Taro/uni-app） | 全部页面 + 设计 Token 平移 + 路由/存储/网络适配 | 4–6 周 |
| **Phase 4 流式咨询适配** | SSE → `enableChunked` 解析（路线 A）；可选 WS | 咨询打字机体验、红线提示 | 1 周（A）/ +1 周（B） |
| **Phase 5 设备联动** | 微信运动步数 + 厂商 OAuth（华为/小米） | `WeRunAdapter` 立做；厂商 OAuth 延后 | 微信运动 1 周；厂商 3–4 周 |
| **Phase 6 订阅消息 + 审核发布** | 真实订阅下发、提审、发布 | 模板接入、体验版、审核通过、全量发布 | 并行 + 审核周期 |

### 5.2 模块优先级排序

- **P0（必须首发）**：微信登录、家庭档案/成员、健康指标（11 类）、健康自评、AI 咨询（含红线）、用药提醒、待办任务。
- **P1（首发后迭代）**：健康报告导出（PDF 中文修复）、知识库科普、微信订阅消息真实下发、微信运动联动、适老化完整。
- **P2（延后）**：AI 用药识别 / 体检报告 OCR（需视觉模型 + 额度）、厂商 OAuth 深度联动、BLE 实时。

### 5.3 关键风险点

| 编号 | 风险 | 等级 | 触发条件 | 缓解 |
|---|---|---|---|---|
| R1 | 医疗健康类目资质门槛高、周期长 | 🔴 高 | 类目被定为医疗 | 尽早启动资质；以「工具-健康管理」申报 + 强化非诊疗声明 |
| R2 | 个人主体不可做医疗类目 | 🔴 高 | 用个人账号注册 | 必须用企业/个体户主体 + 微信认证 |
| R3 | SSE 流式不兼容（误判必须 WS） | 🟡 中 | 错误预估导致过度重构 | 用 §2.4 路线 A（enableChunked），后端基本不动 |
| R4 | 微信登录闭环（AppSecret/code2session） | 🟡 中 | env 未填 / 真机未联调 | Phase 1 真机验证；密钥绝不进前端 |
| R5 | 内容安全审核不过 | 🟡 中 | 用户健康内容含敏感词 | 后端接 msgSecCheck 中间件 |
| R6 | 域名/HTTPS/ICP 备案阻塞 | 🟡 中 | 未提前备案 | P0 并行备案；用 CloudBase 等免运维 HTTPS |
| R7 | 订阅消息模板未申请 | 🟡 中 | 通知仅 in_app | Phase 6 提前申请模板 ID |
| R8 | 多模态识别（OCR/药识）未实现 | 🟡 中 | UPLOAD_ENABLED 关 + 无视觉模型 | 降为 P2，延后 |
| R9 | LLM 1.5B 过小输出占位符 | 🟡 中 | 复杂 prompt | 换 7B+ 或精简 prompt |
| R10 | PDF 中文渲染缺字体 | 🟢 低 | 未配 `PDF_FONT_PATH` | 上架前配中文字体 |
| R11 | 厂商 OAuth 审核周期长 | 🟡 中 | 华为/小米接入 | 阶段延后，先微信运动 |
| R12 | 主流手表不支持第三方 GATT | 🟡 中 | 押宝 BLE | 以厂商 OAuth 为主路径，BLE 仅可选 |

---

## 6. 立即行动清单（Next Steps）

1. **今天就启动**：小程序企业账号注册 + 微信认证 + 类目资质材料准备 + 域名 ICP 备案（P0，最长前置）。
2. **本周**：Phase 1 后端闭环——填 `WX_APP_ID/SECRET` 真值、真机 `code2session` 联调、加内容安全中间件、确认 `UPLOAD_ENABLED` 上架策略。
3. **框架决策**：确认 Taro（React/TS）为终态框架，阶段 1 可用 `web-view` 快速验证。
4. **设计平移**：将 SoftCare CSS 令牌直接迁入 WXSS（几乎零成本），图标走 iconfont。
5. **流式优先级**：Phase 4 用 `enableChunked` 路线 A，避免过度重构后端。

> 注：本规划已与既有 `WECHAT-MIGRATION-ROADMAP.md` 对齐，修正了「SSE 必改 WebSocket」的判断，并补充了模块依赖图与逐项复用/重构/替换映射。建议以本文件为执行基线，路线图作为背景参考。
