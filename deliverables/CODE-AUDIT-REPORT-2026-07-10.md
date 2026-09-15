# 智医助手 代码全面审查报告（2026-07-10 复查）

**审查日期**: 2026-07-10
**审查范围**: NestJS 后端（13 模块 + `shared/`）+ Prisma schema + 前端原型（~4000 行）+ Mock server + PRD
**审查方式**: 主理人齐活林协调；架构师高见远（未实现功能 / 接口不一致 / 架构层）+ QA 严过关（逻辑错误 / 潜在 Bug / 代码质量）。两人均**独立回读源码**逐 file:line 举证，非采信旧报告。

---

## 一、TL;DR

功能骨架基本打通，但存在一个**根因级架构断裂（事件总线零订阅者）**，叠加多处"声明了却没真实现"的功能与若干安全 / 越权隐患。旧报告标记的 14 项待修复里，**9 项仍原样存在、4 项部分修复、仅 4 项此前已修**。

---

## 二、交叉根因（最该先修）

**C-ROOT · 事件总线"发布-订阅"彻底断裂（P0）**

- 证据：`shared/events/event-bus.service.ts` 提供了 `publish/on/once`；但全仓 `grep @OnEvent | eventBus.on | eventBus.subscribe` **零匹配**。约 17 处 `eventBus.publish(...)`（metric / medication / assessment / consultation / family / health-record）全部被静默丢弃。
- 影响：这是 **通知永不为空（A1/H5）、30 天复评提醒失效（A4）、漏服超 30 分告警失效、连续 3 次异常预警失效** 的统一根因。系统"伪异步"，调用方误以为副作用已发生。

---

## 三、维度 1 · 代码逻辑问题

| # | 位置 | 具体表现 | 影响 | 严重度 |
|---|---|---|---|---|
| L1 | `medication.service.ts:62-90` | `create()` 依次 `plan.create` → `ensureTodayAdherences`（循环 `adherence.create`）→ `cache.invalidate` → `eventBus.publish`，全程无 `$transaction` | 中途 adherence 失败 → plan 已落库、当日记录残缺（即旧 H1） | **P1** |
| L2 | `family.service.ts:146-175` | `addMember` 三段写入（member→recount→healthRecord）无事务，healthRecord.create 失败则 member 已建无档案 | 数据不一致（靠 upsert 兜底） | P2 |
| L3 | `family.service.ts:194-218` | `updateMember` 仅 `ensureMembership`（任意成员），未 `ensureAdmin`，却写 `role: dto.role`（:215） | **任意家庭成员可把自身/他人提权为 admin**（越权） | **P1** |
| L4 | `auth.service.ts:58-62` | `getWxSession` 任何异常（含微信返回错误页）都 `openid = dev_openid_${code}` | 生产配了真实 appid 但微信不可达时，**任意 code 都能"登录"并建 dev 用户**（类 IDOR / 越权登录） | **P1** |
| L5 | `red-line-engine.ts:207,334-339` | `high_fever_child` 含 `ageMax:12`，但 `evaluateRule` 对含 `comboKeywords` 的规则要求"主关键词 AND 组合关键词"同时命中；`ageMax` 仅用于排除超龄，不能单独靠年龄触发 | 儿童(≤12)只说"我发烧了"**不触发紧急就医**，安全关键逻辑缺口 | P2 |
| L6 | `metric.service.ts:137-138`、`report.service.ts:157-158` | `Math.max(...values)` / `Math.min(...values)` 展开大数组 | 指标条目数千条时抛 `RangeError: Maximum call stack size exceeded` → 500 | P2 |
| L7 | `consultation.controller.ts:21`、`consultation.service.ts:214,221,234` | `@Res()` 注入导致 Nest 拦截器 / Transform 失效；客户端断开后向已关闭 `res` 写 `sendSSEEvent` 触发 `EPIPE` 且无监听 | 潜在进程级异常 | P2 |

---

## 四、维度 2 · 潜在运行时 Bug

| # | 位置 | 具体表现 | 影响 | 严重度 |
|---|---|---|---|---|
| B1 | `auth.service.ts:94` | `const res = await fetch(url)` 微信 jscode2session **无 `AbortSignal.timeout`**（对比 `ollama.provider.ts` 已加超时） | 微信接口挂起 → 永久阻塞登录链路（即旧 M5） | **P1** |
| B2 | 全仓 16 处 `eventBus.publish` | `publish` 为 async（`event-bus.service.ts:51-68` 内 `await emitAsync`），**调用方全部未 `await`** | 某 listener 抛错 → 未处理 Promise rejection；Node 15+ 默认 `unhandledRejection=throw` 可终止进程 | **P1** |
| B3 | `schema.prisma:127-132,378` | `chronicDiseases/allergies/surgeries/familyHistory/vaccinations/knowledge.tags` 均 `@db.VarChar(4000)` | 病史/过敏条目多时 JSON 超 4000 字，TiDB 严格模式 INSERT 报 500，非严格模式静默截断破坏 JSON（即旧 M3） | **P1** |
| B4 | `consultation.service.ts:39-43,146-165` | 仅靠 `clientClosed` 跳出消费循环，未对 `llmGateway.chatStream` 调 `stream.return()` 或传 `AbortController` | Ollama fetch 在 30s 超时前持续占用 → 资源泄漏（流式未取消） | P2 |
| B5 | `cache.service.ts:18,26-39` | `useClones:false`，`getOrSet` 直接返回内存对象引用 | 调用方若修改返回对象 → 污染全局缓存（共享可变状态 / 并发污染） | P2 |
| B6 | `zhiyi-assistant-prototype.html:3616-3636` | SSE 解析 `currentEvent` 每次 `read()` 重置为 `'message'`，且 `buffer.pop()` 恒把最后一行当"未完成"丢弃 | event/data 落在不同 TCP 批次时类型丢失，`onEvent('message')` 不匹配 → AI 回复偶发静默丢失（即 FH4） | P2 |
| B7 | `zhiyi-assistant-prototype.html:3119-3120` | `sendChat` 仅 `if (!text) return`，无 maxLength | 超长文本直达后端才被 DTO `@MaxLength(1000)` 拦（即 FH5） | P3 |
| B8 | `global-exception.filter.ts:46` + SSE 路径 | 若在 `res.writeHead` 之后抛非 `HttpException`，过滤器 `response.status().json()` 因头已发送而二次抛错 | SSE 路径二次异常 | P3 |
| B9 | `mock-server/server.js:404-414` | SSE `setInterval` 客户端断开后永不 `clearInterval`；且 mock 用 `event: message` 而前端监听 `event:'chunk'` | 仅 mock 资源泄漏 + 原型 AI 文本永不渲染 | P2 |
| B10 | `zhiyi-assistant-prototype.html` | 登录响应含 `refreshToken` 但前端从不存储/使用；access 过期(3600s)后 401，`apiFetch` 静默 `return null`（即 FH2） | 无自动续期 → 用户被静默登出 | P2 |
| B11 | `ollama.provider.ts:144-145` | `tokensUsed: data.prompt_eval_count + data.eval_count || undefined`，`undefined+x=NaN` 已用 `||undefined` 兜底不再外泄，但 `0+0` 仍被误判为 undefined（即 L5） | 已规避，仍有正确性瑕疵 | P3 |

---

## 五、维度 3 · 未实现功能（声明了却缺实现）

| # | 位置 / 表现 | 影响 | 严重度 |
|---|---|---|---|
| U1 | **通知系统永不生成记录**。`notification.service.ts` 全文无 `create` 方法，仅 list/unreadCount/markRead…；`NotificationService` 仅本模块引用（grep 确认无其它 import），**没有任何代码写入 notification 表** | PRD P0-04「漏服超 30 分通知」、P0-05「连续 3 次异常预警」、US-2/US-4 提醒**全部失效，列表永远为空**（即 H5/A1） | **P0** |
| U2 | **无任何定时任务**。`grep @Cron|ScheduleModule|setInterval|SchedulerRegistry` 全 src **零匹配** | ① 自评 `nextReviewAt` 已设但无 cron → 「30 天后自动复评」永不触发；② 漏服仅靠 `markAdherence` 发事件（无消费者、无可轮询 cron）；③ 指标 `alertConsecutiveCount` 已落库但**从未被读取** | **P0** |
| U3 | **PDF 报告未生成**，`pdfUrl` 恒为 null。`report.service.ts:110-122` `healthReport.create` 未写 `pdfUrl`，无 pdfkit/puppeteer 依赖；`list()` 的 `pdfUrl` 永远 null | PRD Q5「一键导出 PDF」未实现 | P1 |
| U4 | **手术史/家族史/疫苗接种无法写入**（M4 仍在）。`update-record.dto.ts` 仅 5 字段，无 surgeries/familyHistory/vaccinations；service 无对应写入方法 | PRD P0-03 档案维度缺失；致 consultation `systemPrompt` 的 `familyHistory` 恒为空 | P1 |
| U5 | **前端自评流程未对接后端，结果不落库**。`renderAssess/assessNext`（html:1466-1532）用本地 `D.assessment`（静态题），全文无 `API.startAssessment/submitAnswer` 调用；`completeAssessReport()` 仅 `showToast("报告已保存")` | 已实现的后端自评接口被前端绕开，结果不落库（即旧 M1 相关） | P1 |
| U6 | **微信订阅消息推送整体缺失**。全后端无微信订阅/模板消息发送代码；`medication.create` 仅靠手动录入（`source:'manual'`） | PRD P0-04「到点微信订阅消息推送」、US-2 跨代提醒声明了但未实现 | P1 |
| U7 | **AI 用药识别 / 体检报告 OCR 未实现**。`ai.controller.ts` 仅 `GET /ai/status`，无识别端点；medication 无 OCR 字段消费 | P0-04「拍照药盒→AI识别」降级为手动；P1-01「体检报告拍照→AI解读」整体缺失 | P1 |
| U8 | **`startConsult` 死代码**（FH3 仍在）。`API.startConsult` 定义 html:3601 全文无调用，真实咨询走 `consultStream` | 维护包袱易误导 | P2 |
| U9 | **守卫不统一**。`user.controller.ts:9` 用 `@UseGuards(AuthGuard('jwt'))`（passport），其余统一 `JwtAuthGuard`；两套守卫 `req.user` 形状需一致，否则 user 模块取 `req.user.id` 可能 undefined | 潜在越权/认证失败 | P2 |

> 其余前端调用（`/families`、`/medications`、`/metrics/trend`、`/notifications`、`/knowledge`、`/reports/generate`、`/consultations`、`/ai/status` 等）与后端路由逐一比对**均匹配**，无方法/路径错位；`/v1` 前缀前后一致。

---

## 六、维度 4 · 代码质量

| # | 位置 | 问题 | 严重度 |
|---|---|---|---|
| Q1 | 16 处 `eventBus.publish` | 重复"发即弃"模式，错误被静默吞掉（与 B2 同源），无重试/死信 | P1 |
| Q2 | `auth.service.ts:144`、`medication.service.ts:17-23`、`consultation.service.ts:140-142` | 硬编码魔法数字（3600、FREQUENCY_TIMES、0.7/2048/30000 散落），应集中到配置/常量（即 L1） | P2 |
| Q3 | `main.ts:49` | 全局 `enableImplicitConversion: true` 隐式转换可能把意外字符串转数字/布尔，掩盖 DTO 类型错误、削弱 `@IsInt` 等 | P2 |
| Q4 | `event-bus.service.ts:73-76`、`app.module.ts:48` | `EventBusService.on` 手动 `.on` 注册监听无清理，模块重建/测试中易重复注册造成泄漏/重复触发 | P2 |
| Q5 | consultation/notification 多处 | `type/status`（`'manual'/'ocr'`、`'pending'/'taken'`、`'red_line_advice'` 等）裸字符串散落，应抽枚举防拼写漂移 | P2 |
| Q6 | `consultation.service.ts:63`、`mock-server.js:397` | 响应头 `'Connection':'keep-alive'` 拼写错误（应为 `keep-alive`），该头无效 | P3 |
| Q7 | `user.controller.ts:9` vs 其它模块 | 守卫不统一：user 用 `@UseGuards(AuthGuard('jwt'))`（passport），其余统一 `JwtAuthGuard` | P2 |
| Q8 | `consultation.dto.ts:41-43`、`metric.dto.ts:30-33,73-76` | 校验缺失：`FeedbackDto.satisfaction` 仅 `ApiProperty` 无 `@Min/@Max`；`inputMethod` 仅 `@IsString()` 无 `@IsIn`（即 L4） | P2 |
| Q9 | `health-record.service.ts:93 vs 104` | 空数组 guard 风格不一致（:93 用 `?? []`，:104 却 `dto.diseases.length` 无 `?.`），DTO 放松即抛 TypeError（即 L2） | P3 |

---

## 七、旧报告「待修复项」当前状态核实

| 编号 | 旧结论 | 当前核实（file:line） | 状态 |
|---|---|---|---|
| H2 | 待修复 | `metric.controller.ts:66` + `metric.service.ts:162` 无守卫/角色；阈值全局无租户隔离 | **仍存在（P0）** |
| H5 | 待修复 | `notification.service` 无 create；EventBus 零订阅者（C-ROOT） | **仍存在（P0）** |
| M6 | 待修复 | `auth.service.ts:105-129` 无黑名单/jti/撤销 | **仍存在（P0）** |
| M4 | 待修复 | `update-record.dto` 无 surgeries/familyHistory/vaccinations | **仍存在（P1）** |
| M1 | 待修复 | `assessment.service:143` Map 无 ownerId；`getSession` 无 userId 校验 | **仍存在（P1）** |
| M3 | 待修复 | `schema.prisma` 仍 `@db.VarChar(4000)` | **仍存在（P1）** |
| M5 | 待修复 | `auth.service.ts:94` fetch 无 timeout | **仍存在（P1）** |
| H1 | 待修复 | `medication.service.ts:62-90` 无 `$transaction` | **仍存在（P1）** |
| L1 | Low | `auth.service.ts:144` expiresIn 硬编码 | **仍存在（P2）** |
| L2 | Low | :93 用 `??[]`，:104 未防御 | 部分修复（P3） |
| L4 | Low | medication/consultation 已加 `@IsIn`；metric 仍缺 | 部分修复（P2） |
| L5 | Low | ollama.provider 加 `||undefined` 兜底，NaN 不再外泄；`0+0` 仍误判 | 已规避/部分（P3） |
| FH1 | — | `apiFetch` 任何 HTTP 错误 `console.warn + return null` | **仍存在（P1）** |
| FH2 | — | 前端无 `refreshToken/expiresIn` 引用 | **仍存在（P2）** |
| FH4 | — | `currentEvent` 每 read 重置 + 末行恒丢弃 | **仍存在（P2）** |
| FH5 | — | 仅 `!text` 空值校验，无 maxLength | 部分修复（P3） |
| C1/H3/H4/C2 | 已修复 | 越权/评分/SSE 断连/登出状态 经核实确已修复 | ✅ 已修复 |

---

## 八、建议修复顺序

**P0（立即，根因优先）**
1. 修事件总线订阅（C-ROOT）：新增 `NotificationConsumer`（`@OnEvent` 或 `onModuleInit` 注册），消费 `MEDICATION_MISSED` / `METRIC_ABNORMAL` / `assessment.completed` / `consultation.redline.triggered` 等并写入 notification 表 → 一并解决 H5/U1。
2. 引入 `@nestjs/schedule`：实现 30 天复评提醒、漏服超 30 分扫描、指标连续 3 次异常聚合（用 `alertConsecutiveCount`）→ 解决 U2。
3. `updateThreshold` 加 `@UseGuards(AdminGuard)` + 引入用户管理员角色；阈值按家庭隔离 → 解决 H2。
4. Refresh Token 加 `jti` + Redis 黑名单，登出写入 → 解决 M6。

**P1（本周）**
- 事务包裹（H1/L1）、微信 fetch 超时 + 降级收紧（M5/L4 反向 L3 越权）、`AssessmentService` 会话迁 Redis 并绑 `ownerId`（M1）、`VarChar(4000)`→`@db.Text`（M3/B3）、前端自评接通 `start/answer/result`（U5）、`pdfUrl` 真实生成（U3）、DTO 枚举校验（L4）、安全越权 L3/L4、SSE 跨批次类型修复（FH4）、前端 `apiFetch` 错误显性化（FH1）。

**P2/P3（后续）**
- 硬编码配置化（L1/Q2）、抽枚举（Q5）、删死代码 startConsult（U8）、统一守卫（Q7）、`keep-alive` 拼写（Q6）、前端续期（FH2）+ 长度校验（FH5）。

---

## 九、值得肯定的（已做对的地方）

- XSS：用户输入均经 `escapeHtml` / `textContent` 渲染，安全。
- 全局 `ValidationPipe` 严格（`whitelist:true` + `forbidNonWhitelisted:true`）。
- 全局 `ThrottlerGuard` 限流、全局异常过滤器不向客户端泄露堆栈。
- Prisma 正确实现 `onModuleDestroy` 断开连接；红线引擎保守设计含心理危机优先检测。
- 此前会话已修的 4 项（C1 越权 / H3 评分 / H4 SSE 断连 / C2 登出清态）经本次回代码确认**确实已修复**。

---

*本报告由主理人齐活林协调，架构师高见远与 QA 严过关独立审查并交叉印证。严重度标尺：P0 阻塞/严重 · P1 高 · P2 中 · P3 低。*
