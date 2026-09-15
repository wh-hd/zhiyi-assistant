# 智医助手 代码全面审查报告（2026-07-11）

**审查人**：software-engineer（独立回读源码逐 file:line 举证）
**审查范围**：NestJS 后端（`deliverables/backend/nestjs/src/` 全部 94 个 .ts）+ Prisma schema + 前端原型（`zhiyi-assistant-prototype.html` 130 行外壳 + `zhiyi-assistant-prototype.js` ≈2700 行逻辑）+ Mock server（`mock-server/server.js`）+ 旧报告（`CODE-AUDIT-REPORT-2026-07-10.md`）
**审查方式**：本次**独立回读全部源码**，未采信工作记忆或旧报告结论；对旧报告每项均重新核实并标注当前状态。
**严重度标尺**：P0 阻塞/严重 · P1 高（功能缺失/数据风险）· P2 中（质量/健壮性）· P3 低（打磨）。

---

## 一、TL;DR

相比 2026-07-10 旧报告，**安全与架构层已发生实质性修复**：旧报告 5 个 P0（事件总线零订阅 C-ROOT、通知零写入 H5/U1、无定时任务 U2、Refresh Token 无撤销 M6、阈值无管理员守卫 H2）**经回读源码确认均已修复**。前端登录续期（FH2）、SSE 解析（FH4）、`apiFetch` 错误显性化（FH1）、IDOR（C1）、SSE 断连（H4）、登出清态（C2）、用药创建事务（H1）、自评会话归属（M1）、微信 fetch 超时与开发身份降级（M5/L4）**均确已修复**。

但**仍有未修复/新发现问题**，集中在「声明了却未真正打通」与「健壮性」：
- **仍存在的 P1**：PDF 未生成（U3）、手术史/家族史/疫苗不可写（U4 部分）、前端自评流程仍用静态数据未对接后端（U5）、微信订阅消息推送整体缺失（U6）、AI 用药识别/OCR 未实现（U7）、`VarChar(4000)` 仍超长即失败（M3）。
- **仍存在的 P2**：`Math.min/max(...values)` 大数组展开（B3/L6）、缓存 `useClones:false` 共享引用（B5）、DTO 校验缺失（L4 metric inputMethod、Q8 satisfaction）、守卫不统一（Q7/U9）、`enableImplicitConversion:true`（Q3）、裸字符串状态（Q5）。
- **新发现**：15 个领域事件中 **11 个发布后无 `@OnEvent` 订阅者**（静默 no-op，事件总线噪声，P3）；前端 `test_data.js` 被 HTML 引用但文件缺失（P3）。

**结论：已无 P0 级阻塞项；应优先处理 P1 的「功能未打通」类问题。**

---

## 二、维度 1 · 代码逻辑问题

| # | 位置 | 具体表现 | 影响 | 严重度 |
|---|---|---|---|---|
| L5 | `shared/red-line-engine/red-line-engine.ts:202-213` + `:334-339` | `high_fever_child` 规则 `severity:'immediate'` 且要求 `keywords`(发烧) **AND** `comboKeywords`(孩子/宝宝/儿童/婴儿) 同时命中；`ageMax:12` 仅用于排除超龄，不能单独靠年龄触发 | ≤12 岁儿童主诉"发烧 39 度"（未出现"孩子"等组合词）只命中 `persistent_high_fever`（urgent），**紧急就医（immediate）被降级**；安全关键逻辑缺口 | **P2** |
| L1 | `modules/auth/auth.service.ts:226,231` | `JWT_ACCESS_EXPIRES`/`JWT_REFRESH_EXPIRES` 仍带默认字面量 `3600`/`2592000`，虽改由 `configService.get(key, default)` 读取，但默认值散落代码 | 配置化不彻底，轮换密钥/调超时需改代码 | P3 |
| L-new1 | `modules/metric/metric.service.ts:75,99,258` | `record`/`recordBatch`/`recomputeType` 使用 `Prisma.TransactionIsolationLevel.Serializable` 但**未对 P2034（序列化失败）做重试**（auth 的 `rotateRefreshTokenAtomic` 有重试，metric 没有） | 高并发写指标时偶发序列化冲突 → 500 | P3 |
| L-new2 | `modules/metric/metric.service.ts:205-233` `recomputeType` | 每次写入对单个 `metricType` 全量 `findMany`（无上限）重算 `abnormalStreak` | 病史数据量大时单次写放大为全量扫描，性能随数据线性退化 | P3 |

---

## 三、维度 2 · 潜在运行时 Bug

| # | 位置 | 具体表现 | 影响 | 严重度 |
|---|---|---|---|---|
| B3/L6 | `modules/metric/metric.service.ts:145-146`（`getTrend`，`values` 无 `take` 上限）+ `modules/report/report.service.ts:157-158`（`summarizeMetrics`） | `Math.min(...values)` / `Math.max(...values)` 展开大数组 | 指标条目数千条时抛 `RangeError: Maximum call stack size exceeded` → 接口 500 | **P2** |
| B5 | `shared/cache/cache.service.ts:18,26-39` | `useClones:false`，`getOrSet` 直接返回 `memoryCache.get()` 的内存对象引用；`health-record.service.ts:34` 等直接返回该引用 | 调用方若修改返回对象 → 污染全局缓存（共享可变状态/并发污染） | **P2** |
| B11/L5-old | `shared/llm-gateway/ollama.provider.ts:147`（`chat`）、`:219-221`、`:241`（`chatStream`） | `tokensUsed: data.prompt_eval_count + data.eval_count \|\| undefined`，`0+0` 仍被 `\|\|undefined` 误判为 undefined | 真实 0 token 场景把用量误报为 undefined，统计失真（不崩溃） | P3 |
| M3 | `prisma/schema.prisma:152-156` | `chronicDiseases/allergies/surgeries/familyHistory/vaccinations` 仍 `@db.VarChar(4000)` | 病史/过敏条目多（含中文）时 JSON 超 4000 字，TiDB 严格模式 INSERT 报 500，非严格模式静默截断破坏 JSON（现 `health-record` 已可写 chronic/allergies） | **P1** |
| B2(残留) | `event-bus.service.ts:56-73` + 各 `eventBus.publish(...)` 调用点均未 `await` | `publish` 内部 `await emitAsync`；调用方未 await，若 `emitAsync` 在监听器注册前 reject 会成未处理 Promise（现有消费者内部已 try/catch 兜底，风险低） | Node15+ `unhandledRejection=throw` 理论上可终止进程（现有消费者已兜底，实际概率低） | P3 |
| B9 | `backend/mock-server/server.js:404-413` | mock 用 `event: message`，而前端 `consultStream` 监听 `event:'chunk'`（`:1944`）；且 `setInterval` 仅在 `done` 时 `clearInterval`（`:406`），客户端中途断开不清理 | **仅开发联调态问题**：mock 的 SSE 文本在前端新解析器下不渲染；真实后端 SSE 已正确处理断连（见 H4 已修复） | P3 |

---

## 四、维度 3 · 未实现功能（声明了却缺实现）

| # | 位置 / 表现 | 影响 | 严重度 |
|---|---|---|---|
| U3 | `modules/report/report.service.ts:110-122` `generate()` 创建 `healthReport` **未写 `pdfUrl`**；无 pdfkit/puppeteer 依赖；`health-record.service.ts:143-187` `exportRecord` 仅返回数据结构不生成 PDF | PRD Q5「一键导出 PDF」未实现，`list()` 的 `pdfUrl` 永远 null | **P1** |
| U4(部分) | `health-record.controller.ts:37-55` 仅暴露 `chronic-diseases`/`allergies` PATCH；`update-record.dto.ts` 与 `health-record.service.ts` **均无 `surgeries`/`familyHistory`/`vaccinations` 写入路径**；但 `interfaces.ts:62-94` system prompt 与 `health-record.service.ts:179-180` `exportRecord` 均**读取** `familyHistory`/`surgeries` | 手术史/家族史/疫苗声明了却不可写（空壳）；咨询画像 `familyHistory` 恒为空 → 自评/咨询失真 | **P1** |
| U5 | 前端 `zhiyi-assistant-prototype.js:286,305,339`（`assessNext` 仅推进静态 `D.assessment` 题号）、`:780` 报告取自静态 `D.assessReport`；`:2036` `API.startAssessment` 定义但**从未被调用**；后端 `assessment.controller.ts:19-42` `start/answer/result` 接口齐全且正确 | 自评结果不落库，纯前端演示；后端能力闲置（属前端集成缺口，非后端缺失） | **P1** |
| U6 | 全后端**无微信订阅/模板消息发送代码**；`notification.consumer.ts:176-182` `createNotification` 默认 `channel:'in_app'`；无将 `deliveryStatus` 置 `sent` 的投递 worker | PRD P0-04「到点微信订阅消息推送」整体缺失；通知仅落 in-app 列表，schema 默认 `wechat_subscribe` 永未兑现 | **P1** |
| U7 | `modules/ai/ai.controller.ts:26` 仅 `GET /ai/status`；`upload.service.ts:24-54` 仅落盘文件不调 OCR/识别；`medication.service.ts:78-79` 消费 `source`/`ocrImageUrl` 但无端点经 AI 填充 | PRD P0-04「拍照药盒→AI识别」、P1-01「体检报告拍照→AI解读」均未实现，降级为手动录入 | **P1** |
| U8(残留) | 前端 `zhiyi-assistant-prototype.js:1919` `API.startConsult` 定义但未被调用（真实咨询走 `:1920` `consultStream`） | 死代码，易误导（非 bug） | P3 |
| U9/Q7 | `modules/user/user.controller.ts:9` 用 `@UseGuards(AuthGuard('jwt'))`（passport 原生），其余模块统一 `JwtAuthGuard` | 守卫不统一；当前无 public user 路由故功能未破，但后续加 public 路由时 `isPublic` 元数据失效风险 | **P2** |

---

## 五、维度 4 · 代码质量

| # | 位置 | 问题 | 严重度 |
|---|---|---|---|
| Q3 | `main.ts:71-78` | 全局 `ValidationPipe` 的 `transformOptions.enableImplicitConversion:true` 隐式转换可能把意外字符串转数字/布尔，掩盖 DTO 类型错误、削弱 `@IsInt` 等 | **P2** |
| Q5 | 多处裸字符串状态：`consultation.service.ts:195` `responseType:'cancelled'/'red_line_advice'/'health_advice'`；`assessment` 状态 `'in_progress'/'completed'/'expired'`；`notification` type/channel `'in_app'`；`red-line-engine.ts:31` `severity:'immediate'`（拼写应为 `immediate`）；`metric` status `'pending'/'taken'/'missed'` | 裸字符串散落，拼写漂移（如 `immediate`）无编译期约束 | **P2** |
| Q7/U9 | `user.controller.ts:9` vs 其它模块 | 守卫不统一（见 U9） | **P2** |
| Q8 | `consultation/dto/consultation.dto.ts:42-43` `FeedbackDto.satisfaction` 仅 `@ApiProperty`（swagger metadata）**无 `@IsInt/@Min(1)/@Max(5)`**；`metric/dto/metric.dto.ts:31-34,70-73` `inputMethod` 仅 `@IsString()` **无 `@IsIn(['manual','device','ocr'])`** | 越界/非法值绕过校验入库（如 `satisfaction:99`、`inputMethod:'hacked'`） | **P2** |
| Q2 | `medication.service.ts:19` `FREQUENCY_TIMES` 魔法映射；`consultation.service.ts:145-147` `0.7/2048/30000` 字面量；`notification-scheduler.service.ts` cron 表达式字面量 | 配置未集中 | P3 |
| Q6 | `consultation.service.ts:68` `'Connection':'keep-alive'`（应为 `keep-alive`） | 无效响应头（浏览器忽略），仅拼写错误 | P3 |
| Q1(残留) | `shared/events/event-bus.service.ts:78-81` `on()` 手动注册仍保留（现消费者改用 `@OnEvent`，该方法已不被使用） | 若误用 `on` 无清理 → 监听器泄漏/重复触发 | P3 |
| N1(新) | 15 个 `eventBus.publish` 中 **11 个无 `@OnEvent` 订阅者**：`assessment.service.ts:264` `ASSESSMENT_COMPLETED`、`family.service.ts:55/114/275`、`consultation.service.ts:208`、`health-record.service.ts:81/104/131`、`metric.service.ts:239/243`、`medication.service.ts:241` | 静默 no-op，事件总线噪声（关键 red_line/missed_dose 已订阅；review/连续异常由 cron 覆盖，故非功能缺陷） | P3 |
| N2(新) | 前端 `zhiyi-assistant-prototype.html:10` 引用 `test_data.js`，但 `deliverables/frontend/` 目录**无此文件**（仅有 `data.js`/`data.json`） | 开发态静态数据兜底链路断裂（浏览器 404，不影响真后端联调） | P3 |
| N3(新) | `knowledge.service.ts:162-170` `getById` 对找到的文章 `readCount+1` 返回，**未校验 `isPublished`** | 未发布文章也可经 `/knowledge/:id` 读取 | P3 |
| N4(新) | `metric.service.ts:75,99` Serializable 事务无 P2034 重试（见 L-new1） | 并发写偶发 500 | P3 |
| N5(新) | `common/decorators/auth.decorator.ts:8` `CurrentUser()` 参数装饰器已定义但**未被任何控制器使用**（均用 `@Req() req` + `req.user.id`） | 死代码 | P3 |
| N6(新) | `config/env.validation.ts:39` 生产环境 `UPLOAD_ENABLED` 被 `superRefine` **强制禁止**（"until private storage is implemented"） | 上传（头像/OCR 图）在生产永久关闭，与 U7 互证 OCR 路径不可达 | P3(设计) |

---

## 六、旧报告「待修复项」当前状态核实（逐项独立回读）

| 编号 | 旧结论 | 本次核实（file:line） | 状态 |
|---|---|---|---|
| H2 | P0 阈值无守卫/租户隔离 | `metric.controller.ts:75-83` `@UseGuards(AdminGuard)`；`common/guards/admin.guard.ts` 校验 `ADMIN_USER_IDS` | **已修复**（安全面）；阈值仍全局无租户隔离（设计取舍，P3） |
| H5 | P0 通知零写入/事件零订阅 | `notification.consumer.ts:60,95,127,151` 四个 `@OnEvent`；`notification.service.ts:104` `createNotification` upsert 写入 | **已修复** |
| M6 | P0 refresh 无撤销 | `auth.service.ts:163-209` `rotateRefreshTokenAtomic` 事务+`revokedAt`；`:212-220` `logout` 撤销；`refresh-token-cleanup.scheduler.ts:28` 过期清理 cron | **已修复** |
| M4 | P1 DTO 无 surgeries/familyHistory/vaccinations | `update-chronic.dto.ts`+`update-allergy.dto.ts` 新增；`health-record.controller.ts:37-55` 暴露 chronic/allergies；但 surgeries/familyHistory/vaccinations **仍无写入路径** | **部分修复（P1，剩 3 字段不可写）** |
| M1 | P1 会话 Map 无 ownerId | `assessment.service.ts:147-194` `start` 落库 `ownerUserId`；`:197-272` `submitAnswer` 校验 `ownerUserId===userId` | **已修复** |
| M3 | P1 VarChar(4000) | `prisma/schema.prisma:152-156` 仍为 `@db.VarChar(4000)` | **仍存在（P1）** |
| M5 | P1 wx fetch 无超时 | `auth.service.ts:95-132` `AbortController` + `getBoundedInteger` 超时（默认 8000ms，1000–30000） | **已修复** |
| H1 | P1 medication 无事务 | `medication.service.ts:65-92` `create` 包 `$transaction`（plan + ensureTodayAdherences） | **已修复** |
| L1 | P2 expiresIn 硬编码 | `auth.service.ts:226,231` 改 `configService.get(key, default)` 配置驱动 | **部分修复**（默认字面量改为从配置读取） |
| L2 | P2 空数组防御不一致 | `health-record.service.ts:57-77` 统一 `dto.x !== undefined && {...}` 守卫 | **已修复** |
| L4 | P2 开发身份越权登录 | `auth.service.ts:56-83` `developmentFallbackAllowed` 须 `development`+`ALLOW_DEV_IDENTITY`+appId/appSecret 均为空；占位符经 `isMissingOrPlaceholder` 抛错 | **已修复** |
| L5 | P2 ollama 0+0→undefined | `ollama.provider.ts:147,219-221,241` `\|\| undefined` 兜底仍在 | **仍存在（P3）** |
| FH1 | P1 apiFetch 静默 return null | `zhiyi-assistant-prototype.js:1684-1692` 现 `throw apiError`（含 `status`/`message`/`body`） | **已修复** |
| FH2 | P2 refreshToken 未存储/续期 | `zhiyi-assistant-prototype.js:1634,1647-1648` 存储；`:1651-1667` `refreshAccessToken`；`:1680-1682` 401 自动续期重放 | **已修复** |
| FH4 | P2 SSE currentEvent 重置+末行丢弃 | `zhiyi-assistant-prototype.js:1937-1946` 现按 `\n\n` 分块、每块解析 `event:`、保留末块 | **已修复** |
| FH5 | P3 sendChat 无 maxLength | `zhiyi-assistant-prototype.js:1439` 仍仅 `if(!text) return` | **仍存在（P3）** |
| C1 | 已修复（IDOR） | `notification.service.ts:59-62,84-87` 校验 `notification.userId`；`consultation/family/metric/report` 均 `verifyMember*` 归属校验 | **已修复（独立核实）** |
| H3 | 已修复（评分） | `assessment.service.ts:423-458` `calculateScore` 加权聚合 | **已修复** |
| H4 | 已修复（SSE 断连） | `consultation.service.ts:38-48` `AbortController`+`clientClosed`；`:169-171` `stream.return()`；`global-exception.filter.ts:18` `headersSent` 守卫 | **已修复** |
| C2 | 已修复（登出清态） | `zhiyi-assistant-prototype.js:1890-1897` `logout` 撤销 refreshToken 并置空 | **已修复** |
| U1 | P0 通知零写入 | 同 H5 | **已修复** |
| U2 | P0 无定时任务 | `notification-scheduler.service.ts:37,74,117` 三个 `@Cron`；`app.module.ts:58` `ScheduleModule.forRoot()` | **已修复** |
| U5 | P1 前端自评未对接 | `zhiyi-assistant-prototype.js:286,339,780` 仍用静态 `D.assessment`；`:2036` `startAssessment` 未调用 | **仍存在（P1）** |
| U9/Q7 | 守卫不统一 | `user.controller.ts:9` 仍用 `AuthGuard('jwt')` | **仍存在（P2）** |
| Q6 | keep-alive 拼写 | `consultation.service.ts:68` `'Connection':'keep-alive'` | **仍存在（P3）** |
| Q8 | DTO 校验缺失 | `consultation.dto.ts:42-43` satisfaction 仍无 `@Min/@Max`；`metric.dto.ts:31-34,70-73` inputMethod 仍无 `@IsIn`（consultation `inputType` 已加 `@IsIn`） | **部分修复（P2）** |
| B3/L6 | Math spread | `metric.service.ts:145-146`；`report.service.ts:157-158` | **仍存在（P2）** |
| B5 | cache useClones | `cache.service.ts:18` | **仍存在（P2）** |
| B11/L5-old | ollama tokens | `ollama.provider.ts:147` | **仍存在（P3）** |
| B9 | mock SSE | `mock-server/server.js:404-413` | **仍存在（mock 仅开发联调；真实后端 SSE 已修复，事件名 mock 用 `message` 与前端 `chunk` 不匹配为开发态问题）** |

> 注：工作记忆所述「前端创建链路接通」**仅部分属实**——登录续期（FH2）、SSE 解析（FH4）、错误显性化（FH1）确已修复；但**自评流程（U5）仍用静态数据未对接后端**，属未打通。

---

## 七、建议修复顺序

**P0（本次已无，仅列基线）**：2026-07-10 的 5 个 P0 均已修复，无需紧急项。

**P1（本周，功能未打通 / 数据风险）**
1. **U5 前端自评接通**：`zhiyi-assistant-prototype.js` 的 `assessNext()` 改为调用 `API.startAssessment` → 按返回 `sessionId` 逐题 `submitAnswer` → `getAssessResult` 渲染；后端接口已就绪，纯前端接线。
2. **M3 `VarChar(4000)`→`@db.Text`**：`schema.prisma:152-156` 5 个 JSON 字段改 `@db.Text`（TiDB MySQL 长文本），消除超长病史 500/截断。
3. **U4 补齐写入路径**：`update-record.dto.ts` 增加 `surgeries`/`familyHistory`/`vaccinations` 数组字段 + 对应 service/controller PATCH 端点，使咨询画像 `familyHistory` 不再恒空。
4. **U3 PDF 生成**：引入 `pdfkit` 或在 `generate`/`exportRecord` 中异步生成 `pdfUrl`（至少返回可下载的结构化数据 URL）。
5. **U6 通知投递**：新增投递 worker（cron 或队列）将 `deliveryStatus` 置 `sent`；微信订阅推送按 `channel` 分派（至少实现 in-app 已读/已投递语义，微信端留接口）。
6. **U7 AI 识别/OCR**：`ai.controller.ts` 增加识别/解读端点，或 `upload` 落盘后异步调用 LLM 解析并回填 `medication`/`healthRecord`。

**P2（质量/健壮性）**
- B3：`getTrend`/`summarizeMetrics` 用 `reduce` 求 min/max 替代 `Math.min(...values)` 展开。
- B5：`getOrSet` 返回前深拷贝，或调用方约定只读。
- Q3：`enableImplicitConversion` 改为 `false`（配合 `@Type()` 显式转换）。
- Q5：抽状态枚举（ResponseType/AssessmentStatus/NotificationType/Severity），修正 `immediate` 拼写。
- Q7/U9：`user.controller.ts:9` 改 `JwtAuthGuard`。
- Q8：补 `@IsInt()@Min(1)@Max(5)`（satisfaction）、`@IsIn(['manual','device','ocr'])`（metric inputMethod）。

**P3（打磨）**
- L1/Q2：超时/频率等抽配置常量。
- L5/B11：tokens 0 用 `?? 0` 而非 `|| undefined`；`Math.max` 展开替换。
- Q6：`keep-alive` 拼写。
- Q1/N1：清理无订阅者的 orphan 事件或补消费者；移除未使用的 `eventBus.on()`。
- N2：`test_data.js` 补回或删除 HTML 引用。
- N3：`knowledge.getById` 增加 `isPublished` 校验。
- N5：移除/启用 `CurrentUser()` 装饰器。
- U8：移除死代码 `API.startConsult`（或接真后端）。

---

## 八、值得肯定的（已做对的地方）

- **事件总线根因已修复**：`@nestjs/event-emitter` + `events.constants.ts` 单一事实源 + 四个 `@OnEvent` 消费者，且 publish 字符串与 `EVENTS.*` 逐字对齐，杜绝了旧报告的点/下划线错配。
- **通知系统真正落地**：`NotificationConsumer`（事件驱动）+ `NotificationSchedulerService`（30 天复评/15 分钟漏服/每日连续异常三 cron），幂等键 `idempotencyKey` 防重。
- **Refresh Token 安全模型扎实**：原子轮换（`tokenHash`+`revokedAt`）、登出撤销、重放检测（`security-alert.service.ts` 限流+webhook）、过期清理 cron。
- **配置校验大幅强化**：`config/env.validation.ts` 用 Zod，JWT 密钥强制 ≥64 位且 access/refresh 不同，生产环境强制微信凭证与安全 webhook。
- **权限模型收敛**：`FamilyPolicyService` 统一 `assertAdmin`/`canWriteTarget`，family 成员/角色/健康写均经策略校验；自评会话 DB 化且绑定 `ownerUserId`。
- **SSE 健壮性**：`AbortController` 信号贯穿 LLM 流式、`stream.return()` 释放、`clientClosed` 守护写、`global-exception.filter` 的 `headersSent` 守卫避免二次写头。
- **LLM 网关有熔断降级**：`llm-gateway.service.ts` 失败计数 + 30s 半开熔断 + canned 兜底，Ollama 不可达时不雪崩。
- **DTO 校验显著改善**：`role`/`status`/`inputType`/`relation`/`gender` 均加 `@IsIn`；全局 `ValidationPipe` `whitelist+forbidNonWhitelisted`；`ThrottlerGuard` 限流；XSS 经 `escapeHtml`/`textContent` 渲染。
- **自评评分算法合理**：`calculateScore` 分类加权 + 雷达图 + 关注领域 Top2，非诊疗声明完整。

---

## 附录 · 领域事件发布/订阅矩阵（回读核实）

发布点（15）| 订阅者 | 说明
---|---|---
`FAMILY_MEMBER_ADDED` (family:174) | ✅ consumer:151 | 系统通知
`CONSULTATION_REDLINE_TRIGGERED` (consultation:99) | ✅ consumer:95 | 红线预警（关键）
`MEDICATION_PLAN_CREATED` (medication:101) | ✅ consumer:127 | 计划创建提醒
`MEDICATION_MISSED` (medication:243) | ✅ consumer:60 | 漏服告警（关键）
`ASSESSMENT_COMPLETED` (assessment:264) | ❌ 无 | review 由 cron 覆盖
`FAMILY_CREATED`/`FAMILY_UPDATED`/`FAMILY_MEMBER_REMOVED` (family:55/114/275) | ❌ 无 | 无需副作用
`CONSULTATION_COMPLETED` (consultation:208) | ❌ 无 | 历史已落库
`HEALTH_RECORD_UPDATED`/`_CHRONIC_UPDATED`/`_ALLERGIES_UPDATED` (health-record:81/104/131) | ❌ 无 | 无需副作用
`METRIC_RECORDED`/`METRIC_ABNORMAL` (metric:239/243) | ❌ 无 | 连续异常由 cron 覆盖
`MEDICATION_TAKEN` (medication:241) | ❌ 无 | 无需副作用

> 结论：旧 P0「零订阅」已解（4 个关键事件已订阅）；剩余 11 个 orphan 事件均为「无需副作用」或「已被 cron 覆盖」，非功能缺陷，仅建议清理（N1/P3）。

*本报告所有结论均基于 2026-07-11 实际读取的源码证据，未采信旧结论或工作记忆。*
