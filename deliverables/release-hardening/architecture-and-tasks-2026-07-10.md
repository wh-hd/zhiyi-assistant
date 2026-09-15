# 智医助手发布加固：增量架构与有序实施任务

- **设计日期**：2026-07-10
- **设计角色**：高见远（软件架构师）
- **适用基线**：`deliverables/backend/nestjs`、`deliverables/frontend/zhiyi-assistant-prototype.html`、`deliverables/backend/docker-compose.yml`
- **上游输入**：`incremental-prd-2026-07-10.md`、`CODE-AUDIT-SUMMARY-2026-07-10.md`、`CODE-AUDIT-ENGINEERING-2026-07-10.md`、`CODE-AUDIT-QA-2026-07-10.md`
- **当前结论**：NO-GO。本设计是工程实施蓝图，不代表缺陷已修复，也不代表真实平台凭据已轮换。

## 0. 源码回读结论与设计边界

设计前已回读当前源码，以下符号和文件是本方案的直接落点：

- 配置入口：`src/app.module.ts::ConfigModule.forRoot()` 当前读取 `.env` 与 `.env.example`；`src/main.ts::bootstrap()` 仅对生产安全告警做部分 fail-fast。
- JWT：`AuthModule`、`JwtStrategy`、`AuthService.generateTokens()/refreshToken()` 当前共用 `JWT_SECRET`，refresh secret 由字符串拼接得到，且有 `dev-secret` 回退。
- 家庭：`FamilyService.addMember()/updateMember()` 只调用 `ensureMembership()`；`removeMember()` 虽要求 admin，但没有“最后管理员”保护；复合写不是同一事务。
- 自评：`AssessmentService.sessions` 是进程内 `Map`；`submitAnswer()` 先 `assessment.create()` 再 `healthRecord.update()`；`calculateScore()` 可得到 `7.8`；Schema 的两个分数字段仍是 `Int?`。
- 用药：`MedicationService.ensureTodayAdherences()` 仅创建当天记录；`markAdherence()` 是 `findFirst + create/update`；Schema 只有普通索引，没有 `[planId, scheduledAt]` 唯一键。
- 指标与告警：`MetricService.afterRecord()` 的 prev 查询没有 `recordedAt < 当前记录`；批量写后处理不在事务内；`NotificationSchedulerService` 是“查→创建通知→置位”的非原子流程。
- SSE：`ConsultationService.startSSE()` 只设置 `clientClosed`；没有向 `LlmGatewayService/OllamaProvider` 传 `AbortSignal`；Ollama reader 最终只 `releaseLock()`；`GlobalExceptionFilter` 不检查 `headersSent`。
- 前端：`prototype.html::apiFetch()` 把 HTTP/网络错误都吞成 `null`；`smartLogin()` 可生成 `dev-token`；没有 refresh 单飞和服务端 logout；`consultStream()` 每个 chunk 重置 `currentEvent`；`renderMedCard()/renderMemberDetail()` 把后端文本拼入 `innerHTML`。
- 上传：`main.ts` 对整个 `public` 开静态服务，`UploadController` 仍可写公开本地目录；当前没有私有对象存储授权下载闭环。
- 测试：`package.json` 使用 Jest 30 + ts-jest 29；没有根 Jest 配置和 `test/jest-e2e.json`；现有 security 配置仅收集 5 个 suite。
- 迁移：Schema 当前有 14 个模型；唯一迁移 `202607100001_add_refresh_token_expires_at_index` 只对既有 `refresh_tokens` 建索引，空库第一步即失败。

### 必须固化的安全默认

1. 生产缺任何必需 Secret 立即退出，禁止弱值/占位值/默认值。
2. `JWT_ACCESS_SECRET` 与 `JWT_REFRESH_SECRET` 独立、高熵、不得相等；不再支持 `JWT_SECRET` 隐式兼容生产。
3. 生产无开发身份、无 `dev-token`、无浏览器测试 code fallback。
4. 降级/删除最后一个家庭 admin 返回 409，事务零变化。
5. 当前没有“照护授权关系”模型，因此 caregiver **按 member 收紧**：只可写本人允许字段，不能写他人健康数据、不能增删成员、不能改角色。
6. 自评分数数据库精确保留一位小数。
7. 私有上传未完成前，生产 `UPLOAD_ENABLED=false`，入口、路由和静态公开目录同时关闭。
8. 非法分页、days、batch、limit、日期区间等在 Controller/DTO 层返回 400，不能进入 Service。

---

# Part A：系统设计

## 1. 实现方案

### 1.1 架构模式

保持现有 NestJS 分层模块架构，不在本轮引入微服务：

- **Controller/DTO 层**：认证、参数转换、有限整数/枚举/时间窗校验；非法输入统一 400。
- **Policy 层**：新增集中式 `FamilyPolicyService`，表达 actor-role-resource-action-target，避免各 Service 各写一套 membership 判断。
- **Application Service 层**：事务编排、幂等、重算、物化、SSE 生命周期。
- **Prisma/DB 层**：唯一约束作为并发正确性的最终防线；关键复合写使用事务和可重试的 Serializable 冲突处理。
- **前端**：仍保留无构建的静态原型，但把 CSS/JS 从单文件外置，并建立 `ApiClient + AuthState + SSEParser + ViewState` 的轻量状态机。此轮不强行迁移 React，以避免把发布加固变成重写项目。
- **通知调度**：不引入新的分布式任务平台。以数据库唯一 `idempotencyKey` 的插入作为原子领取；只有领取成功的实例执行源记录置位。该方案适合当前 MySQL/TiDB 兼容基线，后续可替换 outbox/任务平台。

### 1.2 核心难点与决策

#### A. 配置、Secret 注入与 Compose 网络收口

- 使用现有 `@nestjs/config` + `zod` 新增 `validateEnvironment(raw)`；`ConfigModule.forRoot({ validate, ignoreEnvFile: NODE_ENV==='production' })`。
- 生产必需：`DATABASE_URL`、`JWT_ACCESS_SECRET`、`JWT_REFRESH_SECRET`、微信配置（若微信登录启用）、安全告警 webhook（若 channel=webhook）。Redis/对象存储只在对应能力启用时必需。
- access/refresh secret 最少 64 字符，拒绝常见占位前缀，拒绝相等；日志只打印配置项“已配置/能力启用”，不打印值或 URL。
- `docker-entrypoint.sh` 删除 `prisma db push --accept-data-loss` 和“失败后继续”；只允许 `prisma migrate deploy`，失败即退出。seed 不在每次生产启动自动执行，由发布步骤显式执行。
- 基础 Compose 作为生产安全基线：API 仅 `expose: 3000` 给 ingress 网络；Redis、MinIO、Ollama 无宿主 `ports`，仅内部网络；开发 override 最多绑定 `127.0.0.1`。
- Compose 文件只引用 `${VAR:?required}` 或平台 Secret 文件，不放真实值。真实轮换、旧值撤销、访问日志审查是平台任务，不伪装为代码任务。
- `main.ts` 生产不再 `useStaticAssets(public)` 暴露 uploads。未实现私有对象存储前，`UploadAvailabilityGuard` 对生产上传返回 503/404（产品选择固定一种，建议 503 `CAPABILITY_DISABLED`），前端隐藏入口。

#### B. 家庭 RBAC、审计与事务

统一动作矩阵：

| 资源/动作 | admin | caregiver（当前无授权模型） | member |
|---|---|---|---|
| 家庭改名 | 允许 | 禁止 | 禁止 |
| 新增/删除成员 | 允许 | 禁止 | 禁止 |
| 任意角色变更 | 允许，但保护最后 admin | 禁止 | 禁止 |
| 修改本人昵称/头像/年龄/性别 | 允许 | 允许 | 允许 |
| 修改他人成员资料 | 允许 | 禁止 | 禁止 |
| 写本人健康档案/自评/用药/指标 | 允许 | 允许 | 允许 |
| 写他人健康档案/自评/用药/指标 | 允许 | 禁止 | 禁止 |
| 读取同家庭数据 | 保持现状允许 | 保持现状允许 | 保持现状允许 |

- `FamilyPolicyService.authorize(context)` 返回允许或抛 403；Service 不再只依赖 `ensureMembership()`。
- 添加成员仅 admin；传入 role 时仍由 admin 决定，默认 member。
- 角色变更与 `FamilyRoleAudit` 创建同一事务；审计仅含 familyId、actorUserId、targetMemberId、oldRole/newRole、action、requestId、时间，不含健康内容。
- 最后 admin：Serializable 事务内重新读取角色/计数并更新；冲突 P2034 有限重试。删除与角色降级均复用同一规则。
- `FamilyMember` 增加 `@@unique([familyId, sortOrder])`。添加时事务内读取 max+1，唯一冲突重试；member、HealthRecord、memberCount 一次提交。删除同样事务内重算 count。
- 创建家庭用嵌套写同时创建 Family、admin 主成员和 HealthRecord。

#### C. 完整 Prisma 基线与孤立索引迁移

采用“两条路径、禁止猜测”的策略：

**空库路径（CI、新环境、灾备）**

1. 保留现有迁移目录和 SQL **不改内容**，避免可能已部署环境出现 checksum 冲突。
2. 新建时间更早的 `202607100000_baseline/migration.sql`，覆盖审定的原 14 模型、表、外键、唯一键和除 `refresh_tokens(expiresAt)` 外全部索引。
3. 让现有 `202607100001_add_refresh_token_expires_at_index` 在 baseline 之后正常创建该索引，解决“孤立迁移依赖不存在表”的问题。
4. 新建 `202607100002_release_hardening/migration.sql`，加入本轮增量：Decimal 分数、FamilyRoleAudit、Assessment 会话/幂等字段、成员排序唯一键、用药复合唯一键、Notification 幂等字段/索引等。
5. 空库只执行 `prisma migrate deploy`，然后最小 seed、核心 CRUD、第二次 deploy、drift 检查。

**既有库路径（共享/生产）**

- 先备份和 DBA schema diff，禁止直接 deploy 试错。
- 若 `_prisma_migrations` 已记录孤立索引迁移：仅在数据库结构被证明与“原 14 模型基线 + 该索引”一致后，允许 `prisma migrate resolve --applied 202607100000_baseline`，再 deploy 增量。
- 若业务表来自 `db push`/手工创建且无可信历史：先用 `prisma migrate diff --from-url ... --to-schema-datamodel ... --script` 和独立 schema dump 审核。只有完全匹配才 resolve baseline；索引已存在则同时 resolve 现有孤立迁移，索引不存在则让它实际执行。
- 若差异无法解释，默认方案是“新库完整 migrate + 受控数据迁移 + 校验 + 切换”，不得盲目 resolve。
- 禁止修改已可能执行的孤立迁移 SQL、禁止 `db push`、禁止为了加唯一键删除重复健康数据。预检发现重复即停止写入并人工裁决。

> 本轮目标 Schema 将因新增 `FamilyRoleAudit` 成为 15 个模型；baseline 仍完整创建审计时确认的原 14 个模型，增量迁移创建第 15 个模型。门禁必须同时验证最终全部模型。

#### D. 自评 Decimal、数据库会话、幂等和前端状态机

- 选择 `Decimal(4,1)` 而不是 Float：分数范围 0.0–10.0，精确一位小数，不受二进制浮点持久化误差影响。
- `Assessment.totalScore`、`HealthRecord.lastAssessmentScore` 改 `Decimal? @db.Decimal(4,1)`；Service 写 `new Prisma.Decimal(result.totalScore.toFixed(1))`，API 显式序列化为 JSON number，同时响应包含 `scoreScale: 1`。
- 不再用进程 `Map`。复用 `Assessment` 作为持久会话：`status=in_progress`、`ownerUserId`、`currentStep`、`rawAnswers`、`expiresAt`、`requestKey @unique`。start 创建记录并返回其 id 作为 `sessionId`。
- answer 在事务中按 owner、status、currentStep 做条件更新；按服务端题库严格校验当前 step 的必答题、题型、选项集合、数组去重/非空，越权 403、过期/不存在 404、非法答案 400、步骤冲突 409。
- 最后一步同一事务：锁定/条件更新会话、写 completed Assessment 字段、upsert HealthRecord 快照。重试同一个 session 返回已完成结果，不新增第二条记录。
- 前端状态机：`idle → starting → answering → completing → completed`；任意网络/400/403/409 进入带原因的 `error`，仅可按规则重试；结果页始终 GET `/assessments/:id/result`，刷新可恢复。

接口保持：

- `POST /v1/assessments/start`：新增可选 `Idempotency-Key` header；返回 `{sessionId,currentStep,totalSteps,questions}`。
- `POST /v1/assessments/answer`：未完成返回下一步；完成返回 `{assessmentId,completed:true,totalScore,scoreScale:1,...}`；重复最终提交返回同一 assessmentId。
- `GET /v1/assessments/:id/result`：Decimal 显式转 number，不暴露 raw session owner 字段。

#### E. 用药按日物化、唯一键和 upsert

- 新增 `@@unique([planId, scheduledAt], map: "medication_adherence_plan_scheduled_uq")`。
- `materializeForDate(memberId, businessDate, tx)`：只选 `isActive=true AND startDate < 次日 AND (endDate IS NULL OR endDate >= 当日开始)` 的计划；按 Asia/Shanghai 生成当天 UTC `scheduledAt`。
- `GET /medications/today?memberId=&date=YYYY-MM-DD` 先在事务内幂等物化，再读取；date 可选且只允许受限日期（建议今天±7天），非法 400。
- Cron 在扫描漏服前先物化当天；多实例重复执行通过复合唯一键 + `upsert`/`createMany(skipDuplicates)` 幂等。
- `markAdherence()` 直接以 `planId_scheduledAt` 做 Prisma `upsert`，禁止 `findFirst + create`。同一时间点 50 并发最终只有一行；状态更新采用“最后一次已认证操作生效”，记录 `confirmedBy/takenAt`。
- 计划起止日期、HH:mm、自定义 schedule 非空和去重在 DTO/领域层校验。

#### F. 指标乱序重算和告警幂等/多实例领取

- 单条和批量写均使用 Serializable 事务；同一 `(memberId, metricType)` 发生冲突时有限重试。
- 写入后按 `recordedAt ASC, id ASC` 读取该 member+type 的全部记录并从头重算 `abnormalStreak`。MVP 数据规模可接受，优先保证乱序正确；后续再优化为受影响后缀。
- 批量记录强制所有条目使用服务端批次 `groupId`，禁止子项覆盖导致查不回；插入、重算全部在同一事务，任何一步失败整批回滚。
- 事件只在事务提交后 await/catch 发布，不能影响数据库原子性，也不能产生未观察 Promise。
- `Notification` 新增 `idempotencyKey String? @unique`、`deliveryStatus`，阅读仍用 `readAt`。业务键：
  - 指标：`metric:{memberId}:{metricType}:{windowStartId}:{windowEndId}`；
  - 漏服：`missed:{adherenceId}`；
  - 复评：`assessment-review:{assessmentId}`。
- Scheduler 为每个候选开启短事务：创建 `deliveryStatus='claimed'` 的 Notification（唯一键即领取）并置位源记录；唯一冲突 P2002 代表已被其他实例领取，安全跳过。发送/站内可见在领取后推进为 delivered；不再用 `status` 同时表示已读和发送。
- `findConsecutiveAbnormal()` 每个 member+type 只返回最新合格窗口，避免同一 streak 多条候选。

#### G. 单文件原型的 XSS 与 CSP 可落地迁移

不提出“加一个 CSP 就完成”的空方案。当前文件约 4000 行，含一个大 `<style>`、一个大内联 `<script>` 和大量静态/动态 `onclick/style`。严格 CSP 必须同时做机械外置与事件改造：

1. 把 `<style>` 外置为 `zhiyi-assistant-prototype.css`，把主 `<script>` 外置为 `zhiyi-assistant-prototype.js`；保留可信静态 `data.js` 外链。
2. 删除 HTML 和字符串模板中的内联 `on*`，改为 `data-action/data-*`，在外部 JS 根节点统一事件委托。药品索引、成员索引只作为 data 值，经解析/范围检查后调用固定函数，不能拼接可执行代码。
3. 后端来源文本默认以 `textContent`/`document.createTextNode` 渲染。`renderMedCard`、`renderMemberDetail` 改为返回 DOM 节点；药名、剂量、单位、备注、模型名、家庭成员名等绝不进入 HTML 字符串。
4. SVG 和固定 UI 骨架是仓库可信常量，可通过 `<template>` 克隆；不接受后端 HTML。当前没有必须展示的富文本需求，因此本轮不引入 DOMPurify；`fullAnalysis` 先按纯文本展示。未来如启用 Markdown，再单点引入 allowlist sanitizer。
5. 把静态/动态内联 style 迁为有限 CSS class；动态进度、颜色只允许映射到预定义 class。移除 Google Fonts 外链，改用系统字体，减少 CSP 外域。
6. HTML 增加 meta CSP 便于直接静态托管；Nest/反向代理同时发 header CSP。目标至少：`default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data: blob:; connect-src 'self' <API_ORIGIN>; object-src 'none'; base-uri 'none'; form-action 'self'`，不含 `unsafe-inline`、`unsafe-eval`。`frame-ancestors` 必须由 HTTP header 设置。
7. Playwright 用恶意 medicineName/dosageUnit/notes 验证 DOM 中仅有文本，无 img/svg/script/onerror 节点，无网络外发，且收集到的 CSP violation 为 0。

#### H. SSE AbortSignal 端到端闭环

- `LLMOptions` 新增 `signal?: AbortSignal`；`LlmGatewayService.chatStream()` 和 `OllamaProvider.chatStream()` 逐层传递。
- `ConsultationService.startSSE()` 创建 request `AbortController`，监听 `req.aborted`/`close`，在 close 时 abort；超时和客户端 signal 用 Node 22 `AbortSignal.any()` 合并。
- 上层 `finally` 必须 `await stream.return()`；Ollama `finally` 在未自然完成时 `await reader.cancel(reason)`，然后 `releaseLock()`。
- `sendSSEEvent()` 先检查 `res.destroyed || res.writableEnded`，返回 boolean；写失败触发 abort，不再继续持久化“完整回答”。取消场景可保存 `responseType='cancelled'` 和已生成片段，但不发送 done。
- `GlobalExceptionFilter` 若 `headersSent`：只记录 requestId/异常类型；若连接仍可写则安全 `end()`，否则交由底层关闭，绝不再 `.status().json()`。
- 前端 `SSEParser` 跨 read 保存 buffer、eventName、多行 data；仅遇空行才分发完整 frame。JSON 失败调用 `onError` 并 abort，不得空 catch。
- `consultStream()` 返回 `{cancel(), signal}`；切屏、切成员、再次发送、超时、logout 时统一 cancel。测试要求底层 1 秒内观察到取消。

#### I. 前端 refresh 单飞、logout 与微信认证

- `ApiError` 分类：401、403、4xx、5xx、network、timeout、protocol；`apiFetch` 不再返回 null。
- 内存保存 access/refresh token；`refreshPromise` 全局单飞。普通请求首次 401 时等待同一个 `POST /auth/refresh-token`，保存轮换后 token，并仅重放一次；refresh 请求本身、已重放请求不再递归刷新。
- refresh 失败原子清空两种 token、用户、家庭/咨询缓存，cancel SSE，切登录页。
- logout 先尽力调用 `POST /auth/logout` 撤销 refresh token；无论网络结果如何，本地 `finally` 必须清理并提示“已退出/服务端撤销待确认”。
- 前端生产只允许真实 `wx.login()` code；浏览器开发身份必须由显式 `runtime-config.js::allowDevIdentity=true` 且非 production 双重条件开启，默认 false。删除 demo logged-in 生产入口。
- 后端同样只在 `NODE_ENV=development && ALLOW_DEV_IDENTITY=true && WX_APP_ID/WX_APP_SECRET 均为空` 时允许开发身份；混合空/占位一律拒绝。生产无论开关值均拒绝。
- 微信 timeout 覆盖 fetch、HTTP 状态和 `response.json()` 全过程；finally 最后才 clear timer；日志不含 code、secret、session_key、openid。
- `RefreshTokenCleanupScheduler` 使用游标/最大空转次数；竞争实例删除 count=0 时若本批满，继续扫描，不把“竞争删除”误判为结束。

#### J. 查询边界与上传能力门禁

- 新增复用 DTO：`PaginationQueryDto(page 1..100000,pageSize 1..100)`、`DateRangeQueryDto`、`LimitQueryDto(1..500)`、`DaysQueryDto(1..365)`。
- 所有 Controller 直接接收 DTO，不再 `Number(query)`；`@Type(() => Number)+@IsInt()+@Min()+@Max()` 确保 NaN、小数、负数、超限均 400。
- 时间范围要求 ISO 且 `from <= to`；batch `ArrayMinSize(1)+ArrayMaxSize(50)`；Service 假定输入已合法但仍保留关键领域不变量检查。
- `UPLOAD_ENABLED` 生产默认 false；未实现私有对象存储时不提供“临时公开 URL”兼容。头像如仍需本地开发，仅 dev 且 localhost 可用。

### 1.3 框架与库选择

- 保留 NestJS 11、Prisma 6、MySQL/TiDB provider：减少发布前迁移范围。
- 使用现有 zod 做启动配置 Schema，不再增加一套配置库。
- 使用 Prisma `$transaction`、数据库 unique、P2002/P2034 有限重试，不依赖 MySQL 专属 `GET_LOCK`，以保留 TiDB 兼容可能性。
- Jest 对齐到 29.x 与 ts-jest 29.x；Nest 11 不要求 Jest 30。
- Playwright 仅用于浏览器 XSS/CSP/SSE 协议回归；不引入 React/Vite 重写现有原型。

---

## 2. 完整相对文件列表

以下路径均相对仓库根；“新建/修改/删除发布引用”是工程批次的完整预期范围。

### 2.1 配置、部署与入口

- `deliverables/backend/docker-compose.yml`（修改：去秘密、无内部服务宿主端口、安全网络）
- `deliverables/backend/docker-compose.dev.yml`（新建：仅 localhost 的开发 override）
- `deliverables/backend/.env.example`（修改：无效模板，access/refresh 分离，能力开关）
- `deliverables/backend/nestjs/.env.example`（修改：同上）
- `deliverables/backend/nestjs/.gitignore`（新建或修改：忽略 `.env*`，保留 example）
- `deliverables/backend/nestjs/package.json`（修改：脚本与 Jest/Playwright 依赖）
- `deliverables/backend/nestjs/package-lock.json`（修改）
- `deliverables/backend/nestjs/Dockerfile`（修改：不打包开发上传与敏感 env，健康检查调整）
- `deliverables/backend/nestjs/docker-entrypoint.sh`（修改：仅 migrate deploy，失败退出）
- `deliverables/backend/nestjs/src/app.module.ts`（修改：Config validate、生产 ignoreEnvFile）
- `deliverables/backend/nestjs/src/main.ts`（修改：集中配置、CSP、上传静态门禁）
- `deliverables/backend/nestjs/src/config/env.validation.ts`（新建）
- `deliverables/backend/nestjs/src/config/env.types.ts`（新建）
- `deliverables/backend/nestjs/src/modules/upload/upload-availability.guard.ts`（新建）
- `deliverables/backend/nestjs/src/modules/upload/upload.controller.ts`（修改）
- `deliverables/backend/nestjs/src/modules/upload/upload.module.ts`（修改）

### 2.2 Prisma、迁移与数据库验证

- `deliverables/backend/nestjs/prisma/schema.prisma`（修改）
- `deliverables/backend/nestjs/prisma/migrations/202607100000_baseline/migration.sql`（新建）
- `deliverables/backend/nestjs/prisma/migrations/202607100001_add_refresh_token_expires_at_index/migration.sql`（保留原样）
- `deliverables/backend/nestjs/prisma/migrations/202607100002_release_hardening/migration.sql`（新建）
- `deliverables/backend/nestjs/prisma/seed.ts`（修改：最小、幂等、无固定秘密）
- `deliverables/backend/nestjs/scripts/db/preflight-existing.ts`（新建：重复值、列/索引、迁移历史预检，只读）
- `deliverables/backend/nestjs/scripts/db/verify-empty-baseline.ts`（新建：模型/约束/最小 CRUD/二次 deploy 断言）

### 2.3 授权、认证与通用参数

- `deliverables/backend/nestjs/src/common/dto/query.dto.ts`（新建）
- `deliverables/backend/nestjs/src/common/policies/family-policy.types.ts`（新建）
- `deliverables/backend/nestjs/src/common/policies/family-policy.service.ts`（新建）
- `deliverables/backend/nestjs/src/common/policies/family-policy.module.ts`（新建）
- `deliverables/backend/nestjs/src/modules/family/family.module.ts`（修改）
- `deliverables/backend/nestjs/src/modules/family/family.controller.ts`（修改）
- `deliverables/backend/nestjs/src/modules/family/family.service.ts`（修改）
- `deliverables/backend/nestjs/src/modules/family/dto/add-member.dto.ts`（修改）
- `deliverables/backend/nestjs/src/modules/family/dto/update-member.dto.ts`（修改）
- `deliverables/backend/nestjs/src/modules/health-record/health-record.service.ts`（修改：统一策略）
- `deliverables/backend/nestjs/src/modules/auth/auth.module.ts`（修改）
- `deliverables/backend/nestjs/src/modules/auth/auth.service.ts`（修改）
- `deliverables/backend/nestjs/src/modules/auth/auth.controller.ts`（修改）
- `deliverables/backend/nestjs/src/modules/auth/strategies/jwt.strategy.ts`（修改）
- `deliverables/backend/nestjs/src/modules/auth/refresh-token-cleanup.scheduler.ts`（修改）
- `deliverables/backend/nestjs/src/modules/consultation/consultation.controller.ts`（修改：Query DTO）
- `deliverables/backend/nestjs/src/modules/knowledge/knowledge.controller.ts`（修改：Query DTO）
- `deliverables/backend/nestjs/src/modules/notification/notification.controller.ts`（修改：Query DTO）
- `deliverables/backend/nestjs/src/modules/report/report.controller.ts`（修改：Query DTO）

### 2.4 自评、用药、指标、通知、SSE

- `deliverables/backend/nestjs/src/modules/assessment/assessment.module.ts`（修改）
- `deliverables/backend/nestjs/src/modules/assessment/assessment.controller.ts`（修改）
- `deliverables/backend/nestjs/src/modules/assessment/assessment.service.ts`（修改）
- `deliverables/backend/nestjs/src/modules/assessment/dto/assessment.dto.ts`（修改）
- `deliverables/backend/nestjs/src/modules/medication/medication.controller.ts`（修改）
- `deliverables/backend/nestjs/src/modules/medication/medication.service.ts`（修改）
- `deliverables/backend/nestjs/src/modules/medication/dto/create-medication.dto.ts`（修改）
- `deliverables/backend/nestjs/src/modules/medication/dto/update-medication.dto.ts`（修改）
- `deliverables/backend/nestjs/src/modules/medication/dto/mark-adherence.dto.ts`（修改）
- `deliverables/backend/nestjs/src/modules/metric/metric.controller.ts`（修改）
- `deliverables/backend/nestjs/src/modules/metric/metric.service.ts`（修改）
- `deliverables/backend/nestjs/src/modules/metric/dto/metric.dto.ts`（修改）
- `deliverables/backend/nestjs/src/modules/notification/notification.module.ts`（修改：导入领域 Module，不重复 provider）
- `deliverables/backend/nestjs/src/modules/notification/notification.service.ts`（修改）
- `deliverables/backend/nestjs/src/modules/notification/notification-scheduler.service.ts`（修改）
- `deliverables/backend/nestjs/src/modules/consultation/consultation.service.ts`（修改）
- `deliverables/backend/nestjs/src/shared/llm-gateway/interfaces.ts`（修改）
- `deliverables/backend/nestjs/src/shared/llm-gateway/llm-gateway.service.ts`（修改）
- `deliverables/backend/nestjs/src/shared/llm-gateway/ollama.provider.ts`（修改）
- `deliverables/backend/nestjs/src/common/filters/global-exception.filter.ts`（修改）

### 2.5 前端原型安全与状态机

- `deliverables/frontend/zhiyi-assistant-prototype.html`（修改：只保留结构/外链/CSP，无内联 handler/script/style）
- `deliverables/frontend/zhiyi-assistant-prototype.css`（新建：从单文件外置并消除 inline style）
- `deliverables/frontend/zhiyi-assistant-prototype.js`（新建：交互、状态机、安全 DOM、API 客户端）
- `deliverables/frontend/runtime-config.js`（新建：环境/能力开关，无秘密）
- `deliverables/frontend/data.js`（修改仅在需要移除可执行字符串 action 时）

### 2.6 测试与门禁

- `deliverables/backend/nestjs/jest.config.ts`（新建）
- `deliverables/backend/nestjs/test/jest-security.json`（修改）
- `deliverables/backend/nestjs/test/jest-e2e.json`（新建）
- `deliverables/backend/nestjs/test/docker-compose.test.yml`（新建：隔离 MySQL，随机/一次性值，不暴露公网）
- `deliverables/backend/nestjs/test/global-setup.ts`（新建）
- `deliverables/backend/nestjs/test/global-teardown.ts`（新建）
- `deliverables/backend/nestjs/test/helpers/test-app.ts`（新建）
- `deliverables/backend/nestjs/test/helpers/test-data.ts`（新建）
- `deliverables/backend/nestjs/test/security-hardening/auth-security.spec.ts`（修改）
- `deliverables/backend/nestjs/test/security-hardening/refresh-token-cleanup.spec.ts`（修改）
- `deliverables/backend/nestjs/test/security-hardening/family-rbac.spec.ts`（新建）
- `deliverables/backend/nestjs/test/security-hardening/assessment-consistency.spec.ts`（新建）
- `deliverables/backend/nestjs/test/security-hardening/medication-idempotency.spec.ts`（新建）
- `deliverables/backend/nestjs/test/security-hardening/metric-alert-idempotency.spec.ts`（新建）
- `deliverables/backend/nestjs/test/security-hardening/sse-lifecycle.spec.ts`（新建）
- `deliverables/backend/nestjs/test/e2e/release-hardening.e2e-spec.ts`（新建）
- `deliverables/frontend/playwright.config.js`（新建）
- `deliverables/frontend/tests/xss-csp.spec.js`（新建）
- `deliverables/frontend/tests/sse-auth.spec.js`（新建）

---

## 3. 数据结构与接口

### 3.1 Schema 关键变化

| 模型 | 变化/约束 |
|---|---|
| FamilyMember | `@@unique([familyId, sortOrder])`；角色仍限 admin/caregiver/member（DTO+领域保证） |
| FamilyRoleAudit（新增） | actor/target/oldRole/newRole/action/requestId/createdAt；禁止健康字段 |
| HealthRecord | `lastAssessmentScore Decimal? @db.Decimal(4,1)` |
| Assessment | `totalScore Decimal? @db.Decimal(4,1)`；新增 ownerUserId/currentStep/expiresAt/requestKey(unique)，status 支持 in_progress/completed |
| MedicationAdherence | `@@unique([planId, scheduledAt])`；复合键供 upsert |
| Notification | 新增 `idempotencyKey @unique`、`deliveryStatus`；`readAt` 独立表达阅读状态 |

### 3.2 类图

```mermaid
classDiagram
  class FamilyMember {
    +String id
    +String familyId
    +String userId
    +String role
    +Int sortOrder
  }
  class FamilyRoleAudit {
    +String id
    +String familyId
    +String actorUserId
    +String targetMemberId
    +String oldRole
    +String newRole
    +String action
    +String requestId
    +DateTime createdAt
  }
  class HealthRecord {
    +String id
    +String memberId
    +Decimal lastAssessmentScore
    +String lastAssessmentId
  }
  class Assessment {
    +String id
    +String memberId
    +String ownerUserId
    +String status
    +Int currentStep
    +String rawAnswers
    +Decimal totalScore
    +String requestKey
    +DateTime expiresAt
  }
  class MedicationPlan {
    +String id
    +String memberId
    +DateTime startDate
    +DateTime endDate
    +String frequency
    +Boolean isActive
  }
  class MedicationAdherence {
    +String id
    +String planId
    +DateTime scheduledAt
    +String status
    +String confirmedBy
  }
  class HealthMetric {
    +String id
    +String memberId
    +String metricType
    +Float value
    +Int abnormalStreak
    +DateTime recordedAt
  }
  class Notification {
    +String id
    +String idempotencyKey
    +String deliveryStatus
    +DateTime readAt
  }
  class FamilyPolicyService {
    +authorize(ctx PolicyContext) void
    +canWriteTarget(actor FamilyMember, target FamilyMember) boolean
    +assertAdmin(actor FamilyMember) void
  }
  class FamilyService {
    +create(userId String, dto CreateFamilyDto) Family
    +addMember(familyId String, userId String, dto AddMemberDto) FamilyMember
    +updateMember(familyId String, memberId String, userId String, dto UpdateMemberDto) FamilyMember
    +removeMember(familyId String, memberId String, userId String) Success
  }
  class AssessmentService {
    +start(userId String, dto StartAssessmentDto, requestKey String) AssessmentStep
    +submitAnswer(userId String, dto SubmitAnswerDto) AssessmentStepOrResult
    +getResult(id String, userId String) AssessmentResult
    -validateStep(assessment Assessment, answers AnswerMap) void
    -calculateScore(answers AnswerMap) Decimal
  }
  class MedicationService {
    +materializeForDate(memberId String, date LocalDate) Int
    +getTodayReminders(memberId String, userId String, date LocalDate) ReminderList
    +markAdherence(planId String, dto MarkAdherenceDto, userId String) MedicationAdherence
  }
  class MetricService {
    +record(dto RecordMetricDto, userId String) HealthMetric
    +recordBatch(dto BatchRecordMetricDto, userId String) BatchResult
    -recomputeSeries(tx Transaction, memberId String, metricType String) void
  }
  class NotificationSchedulerService {
    +handleReviewReminders() void
    +handleMissedDoses() void
    +handleConsecutiveAbnormal() void
    -claimAndCreate(key String, sourceId String) Notification
  }
  class ConsultationService {
    +startSSE(userId String, dto StartConsultationDto, res Response, req Request) void
    -sendSSEEvent(res Response, event String, data Object) boolean
  }
  class LlmGatewayService {
    +chatStream(messages ChatMessageArray, options LLMOptions) AsyncGenerator
  }
  class OllamaProvider {
    +chatStream(messages ChatMessageArray, options LLMOptions) AsyncGenerator
  }
  class ApiClient {
    -String accessToken
    -String refreshToken
    -Promise refreshPromise
    +request(path String, options RequestOptions) Promise
    +refreshOnce() Promise
    +logout() Promise
  }
  class SSEParser {
    -String buffer
    -String eventName
    -StringArray dataLines
    +push(chunk Uint8Array) EventArray
    +finish() EventArray
  }

  FamilyMember "1" --> "0..1" HealthRecord : owns
  FamilyMember "1" --> "0..*" Assessment : assessed
  FamilyMember "1" --> "0..*" MedicationPlan : uses
  MedicationPlan "1" --> "0..*" MedicationAdherence : materializes
  FamilyMember "1" --> "0..*" HealthMetric : records
  FamilyMember "1" --> "0..*" FamilyRoleAudit : target
  FamilyService --> FamilyPolicyService : authorizes
  AssessmentService --> Assessment : persists_session
  MedicationService --> MedicationAdherence : upserts
  MetricService --> HealthMetric : recomputes
  NotificationSchedulerService --> Notification : unique_claim
  ConsultationService --> LlmGatewayService : streams
  LlmGatewayService --> OllamaProvider : delegates
  ApiClient --> SSEParser : consumes
```

### 3.3 主要接口错误语义

| 场景 | HTTP/前端语义 |
|---|---|
| DTO/Query 非法、答案题型/选项非法 | 400 `VALIDATION_ERROR` |
| access token 过期 | 401；前端仅触发一次 refresh + 一次重放 |
| 非家庭成员/非 admin/写他人资源 | 403 `FORBIDDEN` |
| session/资源不存在或已过期 | 404 |
| step 冲突、最后 admin、状态冲突 | 409（统一采用 409，避免同类不变量时而 422） |
| 上传能力关闭 | 503 `CAPABILITY_DISABLED` |
| SSE 已发 headers 后异常 | SSE `error` 或安全结束；不得再写 JSON |
| refresh 重放/失败 | 401 + 服务端撤销；前端清空并回登录 |

---

## 4. 程序调用流程

```mermaid
sequenceDiagram
  autonumber
  participant FE as PrototypeApp/ApiClient
  participant Auth as AuthService
  participant Policy as FamilyPolicyService
  participant Family as FamilyService
  participant Assess as AssessmentService
  participant Med as MedicationService
  participant Metric as MetricService
  participant Sched as NotificationSchedulerService
  participant Consult as ConsultationService
  participant LLM as LlmGatewayService
  participant Ollama as OllamaProvider
  participant DB as Prisma/MySQL

  rect rgb(242,247,244)
    Note over FE,DB: 初始化与认证 refresh 单飞
    FE->>Auth: POST /auth/wechat-login(code)
    Auth->>Auth: 校验生产配置/开发身份开关/全程 timeout
    Auth->>DB: 创建或读取 User，签 access 与 refresh 独立 secret
    Auth-->>FE: accessToken + refreshToken
    par 多请求 access 过期
      FE->>FE: request A 收到 401
      FE->>FE: request B 等待同一个 refreshPromise
    end
    FE->>Auth: POST /auth/refresh-token(refreshToken)
    Auth->>DB: 事务消费旧 refresh + 创建轮换 token
    Auth-->>FE: 新 access/refresh
    FE->>FE: A/B 各最多重放一次
  end

  rect rgb(250,246,238)
    Note over FE,DB: 家庭 CRUD、RBAC、最后管理员与审计
    FE->>Family: POST /families/:id/members
    Family->>Policy: authorize(admin, member:create, target)
    Policy-->>Family: allow/403
    Family->>DB: Serializable tx 创建 member+HealthRecord+重算 count
    DB-->>Family: commit（sortOrder unique）
    Family-->>FE: member
    FE->>Family: PATCH member role
    Family->>Policy: authorize(admin, role:update)
    Family->>DB: tx 读取 admin 数/更新角色/写 FamilyRoleAudit
    alt 最后一个 admin
      DB-->>Family: rollback
      Family-->>FE: 409 LAST_ADMIN_PROTECTED
    else 合法变更
      DB-->>Family: commit
      Family-->>FE: updated member
    end
  end

  rect rgb(239,246,252)
    Note over FE,DB: 自评持久会话、严格校验、幂等完成
    FE->>Assess: POST /assessments/start + Idempotency-Key
    Assess->>Policy: authorize(write assessment target)
    Assess->>DB: create Assessment(status=in_progress, owner, step=0)
    Assess-->>FE: sessionId + step1 questions
    loop 每一步
      FE->>Assess: POST /assessments/answer(sessionId, step, answers)
      Assess->>Assess: 按服务端题库校验必答/题型/选项
      alt 非最终步
        Assess->>DB: 条件更新 currentStep/rawAnswers
        Assess-->>FE: next step
      else 最终步
        Assess->>DB: tx 条件完成 Assessment + upsert HealthRecord
        DB-->>Assess: 同一 session 唯一完成
        Assess-->>FE: assessmentId + totalScore(1位小数)
      end
    end
    FE->>Assess: GET /assessments/:id/result
    Assess-->>FE: 可刷新结果
  end

  rect rgb(247,241,250)
    Note over FE,DB: 用药按日物化与原子 upsert
    FE->>Med: GET /medications/today?memberId&date
    Med->>Policy: authorize(read target)
    Med->>DB: tx 查询日期内有效计划
    Med->>DB: createMany skipDuplicates / composite upsert
    Med->>DB: 查询当天 adherence
    Med-->>FE: reminder list
    FE->>Med: POST /medications/:planId/adherence
    Med->>DB: upsert where planId_scheduledAt
    Med-->>FE: 唯一 adherence
  end

  rect rgb(252,244,244)
    Note over FE,DB: 指标乱序重算与告警唯一领取
    FE->>Metric: POST /metrics 或 /metrics/batch
    Metric->>Policy: authorize(write target)
    Metric->>DB: Serializable tx 插入 + 按 recordedAt,id 全序重算 streak
    DB-->>Metric: commit 或冲突重试
    Metric-->>FE: 记录结果
    par 两个实例扫描
      Sched->>DB: insert Notification(idempotencyKey=业务窗口键)
      Sched->>DB: insert 同一 idempotencyKey
    end
    DB-->>Sched: 一个成功，一个 P2002
    Sched->>DB: 成功实例置位源记录并推进 deliveryStatus
  end

  rect rgb(240,248,248)
    Note over FE,Ollama: SSE 取消闭环
    FE->>Consult: POST /consultations(signal)
    Consult->>LLM: chatStream(options.signal)
    LLM->>Ollama: chatStream(options.signal)
    Ollama->>Ollama: fetch + reader 使用合并 AbortSignal
    loop 完整 SSE frame
      Ollama-->>Consult: token chunk
      Consult-->>FE: event/data/空行
      FE->>FE: SSEParser 跨 chunk 组帧
    end
    alt 切页/断连/超时
      FE-xConsult: AbortController.abort()
      Consult-xLLM: stream.return() + abort
      LLM-xOllama: generator.return()
      Ollama-xOllama: reader.cancel() + releaseLock()
    else 正常完成
      Consult-->>FE: done
    end
  end
```

---

## 5. 不明确事项、假设与待平台事项

### 5.1 已采用安全默认、无需阻塞编码

- caregiver 因无授权关系模型按 member 收紧。
- 自评分数 Decimal(4,1)，API number + `scoreScale=1`。
- 上传私有化未完成，因此生产关闭，不在本轮临时做公开 URL。
- 最后管理员统一返回 409。
- 所有非法查询统一 400。
- 时区统一 `Asia/Shanghai`；数据库存 UTC DateTime，API 用 ISO 8601 UTC。

### 5.2 必须由平台/DBA 确认，不能伪装成代码任务

1. 目标生产引擎和版本（MySQL 8.x 或 TiDB 具体版本）；未确认前只宣称“现生产引擎门禁 + MySQL 8 隔离验证”，不宣称双兼容。
2. 既有库是否由 db push/手工建表、是否存在 `_prisma_migrations`、孤立索引迁移是否执行。DBA 必须提供 schema dump/diff 和备份恢复证据。
3. TiDB/MySQL、Redis、MinIO、微信、告警 Webhook 的真实轮换负责人；必须轮换、撤销旧值、审查访问日志并留不含秘密的证据。
4. Git 历史、镜像层、CI 日志、远端制品和开发者克隆的传播范围；安全负责人决定是否 history rewrite。无论是否 rewrite，都先轮换。
5. 生产 ingress/网络平台如何接入 Compose `edge` 网络，是否支持 10% 灰度和快速回退。
6. CSP 的最终 API origin/上报 endpoint，由部署域名决定；代码默认 self，跨域必须显式 allowlist。

---

# Part B：任务分解

## 6. 依赖包变化

### 保留并使用

- `@nestjs/config@^4.0.2`：配置注入。
- `zod@^3.25.0`：启动时环境 Schema/fail-fast。
- `class-validator@^0.14.2` + `class-transformer@^0.5.1`：DTO/Query 400 边界。
- `@prisma/client@^6.17.0` + `prisma@^6.17.0`：迁移、Decimal、事务与复合 upsert。
- `helmet@^8.1.0`：生产 CSP/安全 header。
- `supertest@^7.1.0`：Nest E2E。

### 版本调整/新增（devDependencies）

- `jest@^29.7.0`：从 30.x 降到 ts-jest 已支持的稳定主版本。
- `@types/jest@^29.5.14`：与 Jest 29 对齐。
- `ts-jest@^29.2.6`：TypeScript Jest transform。
- `@types/supertest@^6.0.3`：E2E 类型。
- `@playwright/test@^1.53.0`：浏览器 XSS/CSP/SSE/auth 状态机测试。

### 明确不引入

- 不引入 React/Vite：本轮不是前端重写。
- 不引入 DOMPurify：当前动态内容按纯文本呈现，无富文本必要；避免“净化后仍误用”的双轨。
- 不引入分布式锁/任务平台：数据库 unique claim 足够闭合当前多实例告警。

---

## 7. 按批次任务列表（不超过 5 个，按依赖排序）

### T01：项目基础设施与安全配置基线

- **优先级**：P0
- **依赖**：无
- **目标**：先让生产配置 fail-fast、Secret 分离、Compose 默认不可公网达、启动路径不再 db push；建立可工作的 Jest 根版本基线。
- **源文件（至少 3，完整见 2.1/2.6）**：
  - `deliverables/backend/docker-compose.yml`
  - `deliverables/backend/docker-compose.dev.yml`
  - `deliverables/backend/.env.example`
  - `deliverables/backend/nestjs/.env.example`
  - `deliverables/backend/nestjs/.gitignore`
  - `deliverables/backend/nestjs/package.json`
  - `deliverables/backend/nestjs/package-lock.json`
  - `deliverables/backend/nestjs/Dockerfile`
  - `deliverables/backend/nestjs/docker-entrypoint.sh`
  - `deliverables/backend/nestjs/src/app.module.ts`
  - `deliverables/backend/nestjs/src/main.ts`
  - `deliverables/backend/nestjs/src/config/env.validation.ts`
  - `deliverables/backend/nestjs/src/config/env.types.ts`
  - `deliverables/backend/nestjs/src/modules/upload/upload-availability.guard.ts`
  - `deliverables/backend/nestjs/src/modules/upload/upload.controller.ts`
  - `deliverables/backend/nestjs/src/modules/upload/upload.module.ts`
  - `deliverables/backend/nestjs/jest.config.ts`
- **验收要点**：生产缺 DB/access secret/refresh secret 明确失败；两 secret 相同/弱值失败；无 dev fallback；生产上传关闭；Redis/MinIO/Ollama 无宿主端口；entrypoint 无 db push。
- **验证命令**：

```bash
cd deliverables/backend/nestjs
npm ci
npm run build
DATABASE_URL='mysql://u:p@127.0.0.1:3306/x' JWT_ACCESS_SECRET='aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa' JWT_REFRESH_SECRET='bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb' npx prisma validate
NODE_ENV=production npm run start:prod  # 预期：缺 Secret 时非 0 fail-fast
cd ..
docker compose config
# 审查 config：redis/minio/ollama 无 ports；不得输出真实秘密
```

### T02：完整 Prisma 基线、增量约束与空库/既有库策略工具

- **优先级**：P0
- **依赖**：T01
- **目标**：建立可从空库 deploy 的正式迁移链，保留孤立索引迁移 checksum；加入本轮数据约束和预检工具。
- **源文件**：
  - `deliverables/backend/nestjs/prisma/schema.prisma`
  - `deliverables/backend/nestjs/prisma/migrations/202607100000_baseline/migration.sql`
  - `deliverables/backend/nestjs/prisma/migrations/202607100001_add_refresh_token_expires_at_index/migration.sql`（只核对、不修改）
  - `deliverables/backend/nestjs/prisma/migrations/202607100002_release_hardening/migration.sql`
  - `deliverables/backend/nestjs/prisma/seed.ts`
  - `deliverables/backend/nestjs/scripts/db/preflight-existing.ts`
  - `deliverables/backend/nestjs/scripts/db/verify-empty-baseline.ts`
  - `deliverables/backend/nestjs/test/docker-compose.test.yml`
- **验收要点**：空库创建原 14 模型及新增审计模型；第二次 deploy 幂等；Decimal、复合唯一键、审计表、通知幂等键存在；重复/非法数据预检不做破坏性修改。
- **验证命令**：

```bash
cd deliverables/backend/nestjs
docker compose -f test/docker-compose.test.yml down -v
docker compose -f test/docker-compose.test.yml up -d --wait
export DATABASE_URL='mysql://test:test@127.0.0.1:3307/zhiyi_test'
npx prisma validate
npx prisma migrate deploy
npx prisma db seed
node --require ts-node/register scripts/db/verify-empty-baseline.ts
npx prisma migrate deploy  # 预期 No pending migrations
npx prisma migrate diff --from-url "$DATABASE_URL" --to-schema-datamodel prisma/schema.prisma --exit-code
node --require ts-node/register scripts/db/preflight-existing.ts
```

> 既有库只运行只读 preflight/diff；`migrate resolve` 必须由 DBA 审批后按 1.2.C 的分支执行，不进入自动代码任务。

### T03：后端授权、事务、幂等、SSE 与认证闭环

- **优先级**：P0
- **依赖**：T02
- **目标**：一次实现家庭 RBAC/最后 admin/审计、家庭复合事务、自评持久会话与 Decimal、用药按日物化、指标乱序重算、通知唯一领取、SSE AbortSignal、微信和 refresh 清理、Query DTO。
- **源文件**：第 2.3 与 2.4 节列出的全部文件，核心包括：
  - `src/common/policies/family-policy.*`
  - `src/common/dto/query.dto.ts`
  - `src/modules/family/{family.controller.ts,family.service.ts,family.module.ts}`
  - `src/modules/health-record/health-record.service.ts`
  - `src/modules/assessment/{assessment.controller.ts,assessment.service.ts,dto/assessment.dto.ts}`
  - `src/modules/medication/{medication.controller.ts,medication.service.ts,dto/*.ts}`
  - `src/modules/metric/{metric.controller.ts,metric.service.ts,dto/metric.dto.ts}`
  - `src/modules/notification/{notification.module.ts,notification.service.ts,notification-scheduler.service.ts}`
  - `src/modules/auth/{auth.module.ts,auth.controller.ts,auth.service.ts,refresh-token-cleanup.scheduler.ts,strategies/jwt.strategy.ts}`
  - `src/modules/consultation/{consultation.controller.ts,consultation.service.ts}`
  - `src/shared/llm-gateway/{interfaces.ts,llm-gateway.service.ts,ollama.provider.ts}`
  - `src/common/filters/global-exception.filter.ts`
  - 其他使用分页 Query 的 Controller（knowledge/notification/report）
- **验收要点**：普通成员提权/写他人零变化；最后 admin 409；自评 7.8 精确持久化且重试同 ID；用药跨日/50 并发一行；乱序等价顺序写；双实例业务键一通知；断连一秒内 reader cancel；非法 Query 400；微信 3 个现有失败修复。
- **验证命令**：

```bash
cd deliverables/backend/nestjs
npm run build
npm test -- --runInBand
npm run test:security -- --runInBand
npm run test:e2e -- --runInBand
```

### T04：前端原型安全拆分、CSP、真实自评与认证/SSE 状态机

- **优先级**：P0
- **依赖**：T01（按本文接口契约可与 T03 后半并行；最终联调需要 T03）
- **目标**：在不迁移框架的前提下，机械外置 CSS/JS、移除内联事件/样式、动态文本安全 DOM、严格 CSP；接通自评 start/answer/result；实现 refresh 单飞、logout、无生产 dev 身份、SSE 完整帧解析和 cancel。
- **源文件**：
  - `deliverables/frontend/zhiyi-assistant-prototype.html`
  - `deliverables/frontend/zhiyi-assistant-prototype.css`
  - `deliverables/frontend/zhiyi-assistant-prototype.js`
  - `deliverables/frontend/runtime-config.js`
  - `deliverables/frontend/data.js`（仅清理可执行 action 字符串时）
- **验收要点**：无内联 script/style/on*；CSP 不含 unsafe-inline/eval；药品恶意字段仅文本；API error 可区分；多 401 只有一次 refresh；logout 必调后端且本地必清；SSE 任意字节拆包正确；切页 cancel；自评结果来自 API 且可刷新。
- **验证命令**：

```bash
# 静态检查（从仓库根）
rg -n "<script>(?!.*src=)|<style|on[a-z]+=|javascript:" deliverables/frontend/zhiyi-assistant-prototype.html deliverables/frontend/zhiyi-assistant-prototype.js
rg -n "unsafe-inline|unsafe-eval|dev-token" deliverables/frontend
# 上述命中必须为 0（测试载荷文件除外）
cd deliverables/frontend
npx playwright test
```

### T05：隔离测试基础设施、Critical/High 矩阵与发布证据集成

- **优先级**：P0
- **依赖**：T02、T03、T04
- **目标**：确保默认 Jest、security、Jest E2E、Playwright 都实际收集用例；用隔离 MySQL 执行迁移和并发测试；把 3 Critical、13 High 全部映射到自动化用例/能力禁用证据。
- **源文件**：第 2.6 节全部文件，至少包括：
  - `jest.config.ts`、`test/jest-security.json`、`test/jest-e2e.json`
  - `test/global-setup.ts`、`test/global-teardown.ts`、`test/helpers/*.ts`
  - `test/security-hardening/*.spec.ts`
  - `test/e2e/release-hardening.e2e-spec.ts`
  - `frontend/playwright.config.js`
  - `frontend/tests/xss-csp.spec.js`、`frontend/tests/sse-auth.spec.js`
- **验收要点**：排除 dist/coverage/node_modules；任何 0 tests 非 0 退出；无 `.only`、无未解释 skip；隔离 DB 每轮重建；全部矩阵通过后才交 QA 两轮独立回归。
- **验证命令**：

```bash
cd deliverables/backend/nestjs
npm run build
npx prisma validate
npm test -- --runInBand --listTests
npm test -- --runInBand
npm run test:security -- --runInBand
npm run test:e2e -- --runInBand
cd ../../frontend
npx playwright test
# 仓库级门禁
rg -n "\.only\(|describe\.skip|it\.skip|test\.skip" deliverables/backend/nestjs/src deliverables/backend/nestjs/test deliverables/frontend/tests
```

---

## 8. Shared Knowledge（跨批次共享约定）

1. 成功响应继续使用现有 `{success:true,data,meta}`；失败 `{success:false,error:{code,message,details},meta}`，不要在本轮无必要改成另一套包络。
2. 日期存 ISO 8601 UTC；用药“哪一天”和 Cron 时区以 `Asia/Shanghai` 解释，边界使用 `[start, nextStart)` 半开区间。
3. 自评分数数据库 Decimal(4,1)，Service 写入前 `toFixed(1)`；API 显式转 number 并附 `scoreScale:1`。
4. 幂等首先由数据库唯一键保证，应用层 `findFirst` 不能替代 unique；P2002 是可识别的“已领取/已存在”，不是 500。
5. Serializable 事务遇 P2034 最多重试 3 次并带抖动；超过后返回 409/503，不无限循环。
6. 事务内只做数据库操作；缓存失效、事件发布放提交后并 await/catch。安全审计与角色变更例外：审计本身必须在同一 DB 事务。
7. caregiver 当前按 member，直到产品和数据模型明确“照护授权关系”。不得靠前端隐藏按钮代替后端授权。
8. 生产无开发身份；测试身份仅隔离环境显式开关，且测试 DB/Secret 为一次性虚构值。
9. access/refresh secrets 永不复用；日志、测试快照、错误响应不得包含 token、微信 code/secret/session_key、数据库 URL。
10. 上传未私有化则生产关闭；不得继续返回本地 public URL 伪装为已加固。
11. 前端后端动态文本默认 textContent；只有仓库内可信固定 SVG/template 可作为 HTML 克隆。
12. SSE 事件固定为 `red_line/disclaimer/chunk/done/error`；多行 data 按 SSE 规范用 `\n` 合并；解析失败显式失败。
13. 所有 Query DTO 的非法整数、NaN、小数、负数、超限和倒置时间窗返回 400，不调用 Service。
14. 构建产物 `dist` 不纳入 Jest 搜索；门禁必须证明 collected tests > 0。

### 8.1 Critical/High 自动化测试矩阵

| 审计项 | 自动化证据 |
|---|---|
| C-01 家庭提权 | family-rbac unit + E2E member/admin/last-admin/DB zero-change |
| C-02 凭据与暴露 | env validation unit + compose config 静态断言 + secret scan；真实轮换另由平台签字 |
| C-03 迁移基线 | 空库 deploy/seed/CRUD/二次 deploy/drift |
| H-01 自评小数 | 实库 Decimal 7.8 round-trip |
| H-02 建档/自评事务 | 故障注入 rollback + 重试同 assessmentId |
| H-03 家庭复合写 | 并发 add/delete、档案/计数/排序约束 |
| H-04 用药一致性 | 三日物化 + 有效期 + 50 并发 upsert |
| H-05 指标/告警 | 乱序重算 + batch rollback + 双实例唯一领取 |
| H-06 上传公开 | 生产 capability disabled + public uploads 不可达 |
| H-07 后端 SSE | 断连 signal/reader.cancel/headersSent |
| H-08 前端 SSE | 任意字节边界、多行 data、cancel |
| H-09 自评前后端 | Playwright start/answer/result/刷新/非法答案 |
| H-10 前端认证 | 无 dev fallback、refresh single-flight、一次重放、logout |
| H-11 微信与 cleanup | 修复现有 3 个 security 失败并保留断言 |
| H-12 XSS | Playwright 恶意药品字段 + CSP violation=0 + 无外发 |
| H-13 Query 边界 | 表驱动 HTTP E2E：NaN/负数/小数/超上限/倒置范围均 400 |

> 审计汇总为 3 Critical、13 High；其中凭据真实轮换不能自动化，代码侧自动验证“无硬编码/安全注入/fail-fast/网络收口”，平台侧必须另附撤销与日志审查证据。

---

## 9. 任务依赖图

```mermaid
graph TD
  T01[T01 项目基础设施与安全配置基线]
  T02[T02 Prisma 基线与增量迁移]
  T03[T03 后端授权/事务/幂等/SSE/认证]
  T04[T04 前端安全/CSP/API 状态机]
  T05[T05 隔离测试与发布门禁]
  T01 --> T02
  T02 --> T03
  T01 --> T04
  T03 --> T05
  T04 --> T05
  T02 --> T05
```

---

## 10. 回滚与兼容策略

### 10.1 应用与配置

- 发布制品绑定 Git SHA；保留上一稳定前后端制品。
- Secret 轮换后**绝不恢复旧泄露值**。新应用配置失败时修复注入或签发另一组新 Secret；旧 JWT 失效接受全员重新登录。
- access/refresh 环境变量切换是破坏旧配置的安全变更：预发布先部署支持新变量的候选并在隔离环境验证，生产缺新变量必须 fail-fast，不能回退读取 `JWT_SECRET`。
- 上传能力开关默认 false，回滚时保持 false；不能因回滚恢复 public uploads。

### 10.2 数据库

- baseline 只用于空库或经 DBA 验证后 resolve；不对既有生产库盲目标记。
- 加 unique 前必须运行重复预检；发现冲突停止迁移并冻结对应写入口，人工合并语义，不删除健康记录。
- Decimal 迁移会允许新小数写入，旧应用 Schema 为 Int，**新写入发生后不支持直接回滚旧后端**。触发故障时先关闭自评写入口、保留新 Schema、以前向修复应用恢复；只有尚无新写入且备份验证通过时才允许整体恢复。
- 新增表/列/索引均采用 expand-first；不要在本轮删除旧 Notification.status 等字段，可保留一个发布窗口由新代码停止写旧语义，下个版本再 contract。
- 上线前做加密备份与恢复演练；迁移失败、drift、唯一约束异常立即停止灰度。

### 10.3 API 与前端

- 保留现有 endpoint；新增字段向后兼容。自评 sessionId 仍为 string，只是从内存 ID 变为 Assessment.id。
- success/error 包络不变。Decimal 在 API 显式变 number，避免 Prisma Decimal 对旧前端产生字符串惊喜。
- 前端新制品只依赖现有 refresh/logout endpoint；若后端回滚导致协议不兼容，应整体回退前端并强制重新登录，不允许恢复 dev fallback。
- SSE 新 parser兼容现有合法 event/data；后端新增安全取消不改变事件名。

### 10.4 灰度触发回滚阈值

任一越权/XSS、迁移失败/drift、核心写不一致、refresh 大面积失败、SSE 断连后资源持续活动、通知重复、500/认证失败显著高于基线，立即停止 10% 灰度。回退后执行登录、家庭只读、健康数据完整性、token 安全状态、通知唯一键和迁移状态检查。

---

## 11. 最终交付与平台门禁

工程师在一个工作回合按 T01→T02→T03 与并行 T04→T05 完成代码与自动化证据；随后 QA 在固定 SHA 上独立执行两轮。以下事项不属于“工程代码已完成”的替代品：

- 各真实凭据轮换、旧值撤销、访问日志审查；
- 既有生产库 schema/迁移历史鉴定与 resolve 审批；
- 生产网络不可达验证、Ingress/CSP 域名配置；
- 备份恢复、10% 灰度、值班人和回滚演练；
- 产品、安全、工程、QA、平台所有者签字。

上述任一证据缺失，Release Gate 仍为 FAIL。