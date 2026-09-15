# 智医助手工程代码审计报告（2026-07-10）

> 审计角色：软件工程师（第二阶段，仅审查与验证，不修复业务代码）  
> 审计范围：`deliverables/backend/nestjs`、`deliverables/frontend`、`deliverables/backend/docker-compose.yml`  
> 复核基准：当前工作区源码。架构师报告仅作为待复核清单，结论由源码、构建、测试和离线脚本独立得出。  
> 安全边界：未连接、探测或复述疑似泄露的真实云凭据；Prisma 使用虚构的本机 URL 做纯 Schema 校验。

## 1. 执行结论

当前代码可以完成 TypeScript 构建，Prisma Schema 语法和关系校验通过，但安全测试存在 3 个真实失败，默认单测和 e2e 脚本不可用，数据库迁移无法从空库建立当前 13 个模型。工程复核确认架构报告多数核心问题，并新增 8 项有独立证据的问题，其中最重要的是：

1. 自评评分产生小数，但 Prisma 将 `Assessment.totalScore` 和 `HealthRecord.lastAssessmentScore` 定义为 `Int`，正常答案即可导致最终写入失败。
2. 创建家庭时只嵌套创建主成员，不创建健康档案；若未先读取档案，自评完成的第二步 `healthRecord.update()` 必然失败。
3. 微信登录“缺失 + 占位”混合配置在开发环境仍被当成双占位而启用开发身份，与安全测试及注释不符。
4. 微信登录超时只覆盖 `fetch()`，在开始读取响应体前已清除定时器，响应体挂起可无限占用请求。
5. 前端对后端用药字段存在未转义 `innerHTML` 拼接，家庭成员可构造持久化 XSS。
6. `limit/page/pageSize/days` 等查询参数缺少整数、正数和上限校验，可触发 Prisma 参数错误或大查询。
7. `Notification.status='pending'` 同时被当作站内“未读”，导致所有新站内消息永远处于投递 pending 语义，读取后又覆盖为 read，投递状态与阅读状态混用。
8. Docker Compose 将 Redis、MinIO、Ollama 管理端口绑定宿主机所有网卡，且 Redis/MinIO 使用仓库内固定弱凭据，扩大了凭据泄露后的可达面。

审计证据与分类经全局一致性检查后自洽。

**IS_PASS: YES**

> `YES` 仅表示本报告的证据、分类和边界自洽，不表示产品无缺陷或可发布。

## 2. 实际执行的核验

| 命令/方法 | 结果 | 说明 |
|---|---|---|
| `npm --prefix deliverables/backend/nestjs run build` | PASS，退出码 0 | NestJS/TypeScript 构建成功。 |
| `DATABASE_URL=<虚构本机URL> prisma validate --schema .../prisma/schema.prisma` | PASS，退出码 0 | 纯离线 Schema 校验，未连接数据库。 |
| `npm --prefix ... test -- --runInBand` | FAIL，退出码 1 | `package.json` 未配置 Jest，仓库也无默认 `jest.config.*`；默认测试入口不可用。 |
| `npm --prefix ... run test:security -- --runInBand` | FAIL：19/22 通过，3 失败 | 失败覆盖混合微信占位配置、响应体超时、清理任务竞争继续处理。 |
| `npm --prefix ... run test:e2e -- --runInBand` | FAIL，退出码 1 | `test/jest-e2e.json` 不存在，仓库也无 e2e 测试文件。 |
| Node `vm` 解析 `data.js` 并与 `data.json` 深比较 | PASS | 当前两份静态数据对象完全相等。 |
| Schema/迁移离线统计 | FAIL（覆盖性） | 当前 13 个 Prisma model，仅 1 个迁移目录且 SQL 只有单条索引创建。 |
| 全源码关键字/调用点扫描 | 完成 | 扫描 TODO/FIXME/NotImplemented/`throw new Error`/空 catch/事件发布/控制器路由/声明未调用 API。未发现业务方法空桩或 `NotImplemented`。 |

测试失败不是环境噪声：`test/security-hardening/auth-security.spec.ts:38-58,60-98` 与 `refresh-token-cleanup.spec.ts:39-71` 的失败均能由当前实现直接解释。未生成或保留新的业务代码文件。

## 3. 架构报告 40 项逐项复核

状态定义：`confirmed` 为原结论和严重度基本成立；`refined` 为核心成立但需调整范围、证据或严重度；`rejected` 为当前源码不支持原结论。

| ID | 复核 | 结论摘要 |
|---|---|---|
| V-01 | confirmed | 普通成员可 POST 添加成员、PATCH 任意成员，并直接写 `role` 完成提权。 |
| V-02 | refined | 明文敏感配置确认；“是否仍有效”未探测。另确认端口公开和固定弱凭据扩大暴露面。 |
| V-03 | confirmed | 自评页面只改本地索引，报告读取静态对象，无 `/assessments/answer` 调用。 |
| V-04 | confirmed | 仅创建日物化 adherence，次日起 Cron 无记录可扫，today 未按起止日过滤。 |
| V-05 | confirmed | OCR/微信发送/语音/可信来源均无实现闭环。 |
| V-06 | confirmed | Assessment 与档案快照非事务，会话为进程内 Map；新增发现 Int/小数类型冲突和主成员档案缺失。 |
| V-07 | confirmed | streak 前驱查询无时间限制，并发无串行化；扫描不按业务键去重。 |
| V-08 | confirmed | 上传写公开本地目录，通用上传无内容验证和授权下载。 |
| V-09 | confirmed | 断连未贯通 AbortSignal，未调用 generator `return()`，底层 fetch/reader 可继续。 |
| V-10 | confirmed | 前端无 refresh token，统一吞错为 null，登录空结果生成 `dev-token`。 |
| V-11 | refined | “家庭成员复合写非事务”确认；创建家庭本身是嵌套原子写，但未建健康档案是新增独立缺陷。 |
| V-12 | confirmed | Assessment create 后再 healthRecord update；失败可留下半完成数据。 |
| V-13 | confirmed | adherence 仅 `findFirst` 后 create/update，无数据库唯一约束。 |
| V-14 | confirmed | batch createMany 与逐条 streak 后处理非事务；子项自带 groupId 会漏查。 |
| V-15 | confirmed | 报告指标只有 `gte periodStart`，无 `lte periodEnd`。 |
| V-16 | confirmed | 跨日记录缺失及 today 起止日过滤缺失均存在。 |
| V-17 | confirmed | 回填历史记录可把未来记录当 prev；并发写会丢失 streak 递增。 |
| V-18 | confirmed | `findConsecutiveAbnormal()` 把最多 50 条全部 push，未分 member+type。 |
| V-19 | confirmed | 三类 Cron 都是查、创建通知、置位三步，缺少原子领取/幂等键。 |
| V-20 | confirmed | 多处 `eventBus.publish()` 未 await，异步拒绝未观察。 |
| V-21 | refined | 无消费者事件确认；“事件必须有消费者”取决于设计，但当前发布不产生业务副作用且错误不可观察。 |
| V-22 | confirmed | NotificationModule 直接再次 provider 三个领域 Service，Assessment Map 被分裂为两个实例。 |
| V-23 | confirmed | SSE 断连只 break 上层循环，未取消底层 reader/fetch。 |
| V-24 | confirmed | `res.write()` 未检查 `destroyed/writableEnded`；全局异常过滤器也不检查 headersSent。 |
| V-25 | confirmed | 前端每次 read 重置 `currentEvent`，跨 chunk 拆分时事件类型丢失。 |
| V-26 | confirmed | sessionId 仅持久化分组，调用 LLM 前未读取同 session 历史。 |
| V-27 | confirmed | `/api/tags` 任意模型即 available，响应却展示配置模型并声明可调用。 |
| V-28 | confirmed | 自评 type/step/answers 缺少枚举、整数、必答题和选项值校验。 |
| V-29 | confirmed | satisfaction 无任何 class-validator，任意值可落库。 |
| V-30 | confirmed | 用药时间仅 IsString，custom 不强制非空；非法时间可生成 Invalid Date。 |
| V-31 | confirmed | 指标类型/单位/方式/数值范围/batch 大小均缺少领域边界。 |
| V-32 | confirmed | 五类 JSON 健康字段均为 `VarChar(4000)`。 |
| V-33 | refined | 展开运算风险成立，但当前接口默认上限较小；由于 limit/days 无上限，仍可由调用方放大。严重度维持 Low。 |
| V-34 | confirmed | Redis 依赖/容器未被 CacheService 使用，NodeCache `useClones:false` 返回共享引用。 |
| V-35 | confirmed | `/health` 仅进程信息；Docker 只探测端口。 |
| V-36 | confirmed | 前后端自评双实现互不相连，API 对象无 submitAnswer。 |
| V-37 | confirmed | 问卷覆盖与 PRD 不同，关注项仅取最低 2 项，未实现反馈/需求信号。 |
| V-38 | confirmed | 只有 in_app DB 记录，无微信 token、模板发送、重试投递和 sentAt 更新。 |
| V-39 | confirmed | OCR/语音仅为字段或展示文案，无识别服务和路由。 |
| V-40 | confirmed | 空库返回硬编码文章，模型无来源、审核、版本、可信评分；默认详情阅读量不持久化。 |

说明：架构报告正文编号 1-40 与摘要 V-01~V-10 并非同一编号体系。本表按正文 40 项顺序复核；其结论覆盖报告第 4 节全部条目。

## 4. 架构报告 15 个待核验项

| ID | 状态 | 工程结论 |
|---|---|---|
| E-01 | 环境无法验证 | 禁止探测真实云凭据；只确认敏感值存在于版本化 Compose。轮换和云审计日志需凭据所有者执行。 |
| E-02 | confirmed | 13 个模型只有 1 个索引迁移，空库 `migrate deploy` 不可能建立业务表。未连接数据库即可确定。 |
| E-03 | confirmed（静态） | HTTP 复现因无隔离数据库未执行；Controller 暴露 PATCH，Service 只校验 membership 并写 role，利用链完整。 |
| E-04 | refined/环境无法动态验证 | 双实例未启动；查-写-置位非原子已静态确认，重复通知概率和频率未量化。 |
| E-05 | refined/环境无法动态验证 | 50 并发未连接数据库执行；Schema 无 unique 且 findFirst/create 分离，竞态成立。 |
| E-06 | refined/环境无法动态验证 | 乱序算法错误静态确认；真实数据库并发次数未测。 |
| E-07 | refined/环境无法动态验证 | 未调用 Ollama；取消信号缺失静态确认，GPU/CPU 实际持续时间未测。 |
| E-08 | confirmed（代码路径） | parser 状态在每个 read 内初始化，事件/数据跨 chunk 时必然退化为 message；未启动浏览器代理。 |
| E-09 | refined/环境无法动态验证 | Filter 无 `headersSent` 保护、SSE write 无可写检查静态确认；具体 Express 错误形态未注入。 |
| E-10 | refined | 空值产生 `['']`，表现为无正常 Origin 可匹配，属于跨域不可用的 fail-closed 配置错误，不是 CORS 全开放。 |
| E-11 | rejected | Swagger 文档在设置 global prefix 后生成；Nest 默认包含全局前缀。`addServer` 为根地址时与 `/v1/...` paths 组合正确，无证据表明 Try it out 必然 404。 |
| E-12 | completed/failed gate | build PASS；security 19/22；默认 test FAIL（无配置）；e2e FAIL（配置不存在）。 |
| E-13 | refined | 生产只对安全告警 webhook fail-fast；JWT 占位/弱值不拒绝启动。WX 占位会使登录 fail-closed，但不是启动 fail-fast。 |
| E-14 | 环境无法验证 | 未连接 TiDB/MySQL，未提交边界数据；Schema 明确为 4000 字符，超限行为依 SQL mode 而异。 |
| E-15 | rejected/current PASS | 离线深比较 `data.js` 的 `window.APP_DATA` 与 `data.json`，当前完全一致。仍存在双份维护漂移风险。 |

## 5. 最终发现清单

以下为合并去重后的最终工程发现。每项均列出严重度、维度、位置、表现、触发、影响和建议。

### F-01 普通家庭成员可提权并管理他人（Critical）

- 维度：授权 / 越权
- 位置：`deliverables/backend/nestjs/src/modules/family/family.service.ts:131-132,195-218,257-269`；`family/dto/update-member.dto.ts:37-40`
- 表现：添加和更新仅要求家庭 membership；`role` 直接写库。
- 触发条件：攻击者是任一家庭普通 member，调用成员 POST/PATCH。
- 影响：可将自己或他人提升为 admin，修改家庭成员资料，并进一步调用管理员能力。
- 建议：建立统一 policy；添加/角色变更仅 admin；普通成员只能更新本人允许字段；角色变更写审计日志并保护最后一个 admin。

### F-02 版本化部署文件包含敏感配置并扩大服务暴露面（Critical）

- 维度：凭据 / 部署安全
- 位置：`deliverables/backend/docker-compose.yml:20-32,51-60,82-87,101-102,154-195`
- 表现：数据库连接、JWT、Redis、MinIO 固定敏感值直接入库；Redis、MinIO API/Console、Ollama 均映射宿主机端口。
- 触发条件：仓库、构建日志或主机网络可被非授权方访问。
- 影响：可能导致数据库、缓存、对象存储、模型服务和令牌签名被接管。真实有效性未探测。
- 建议：立即轮换并审计访问日志；使用 secrets；端口绑定 `127.0.0.1` 或不映射；设置防火墙；JWT 使用高熵独立 secret。

### F-03 Prisma 迁移基线缺失（Critical）

- 维度：发布 / 数据库
- 位置：`deliverables/backend/nestjs/prisma/schema.prisma:21-425`；`prisma/migrations/202607100001_add_refresh_token_expires_at_index/migration.sql:1`
- 表现：13 个模型只有一个“给既有表加索引”的迁移，无建表基线。
- 触发条件：新环境、灾备恢复或 CI 空库执行 `prisma migrate deploy`。
- 影响：部署直接失败，服务无法启动；Schema 与数据库历史不可审计。
- 建议：从可信 Schema 生成并审查基线迁移；在空 MySQL/TiDB 兼容库做 deploy、seed、drift 回归。

### F-04 自评正常评分与 Prisma Int 字段冲突（High）

- 维度：运行时 / 数据模型
- 位置：`assessment/assessment.service.ts:436-470,264-289`；`prisma/schema.prisma:139-141,163-165`
- 表现：加权评分保留 1 位小数，但 `totalScore` 和 `lastAssessmentScore` 均为 Int。
- 触发条件：答案组合产生非整数总分，这是正常且常见路径。
- 影响：Prisma/数据库写入拒绝或发生非预期取整，自评最终提交失败或结果失真。
- 建议：字段改 Float/Decimal 并迁移，或在领域层明确整数化；补小数分数持久化测试。

### F-05 新家庭主成员无健康档案且自评完成非事务（High）

- 维度：事务 / 数据一致性
- 位置：`family/family.service.ts:28-47`；`assessment/assessment.service.ts:264-293`
- 表现：创建家庭只创建 FamilyMember；自评先创建 Assessment，再对必须存在的 HealthRecord 执行 update。
- 触发条件：用户新建家庭后未先调用会自动建档的 `GET /health-records/:memberId`，直接完成自评；或快照更新失败。
- 影响：留下 completed Assessment 但无快照，session 未清理，重试重复创建。
- 建议：家庭创建时嵌套建档；自评使用事务并 `healthRecord.upsert`；增加幂等键。

### F-06 家庭成员复合写和排序非事务（High）

- 维度：事务 / 竞态
- 位置：`family/family.service.ts:142-170,236-243`
- 表现：member、memberCount、healthRecord 分三次写；删除与计数分离；sortOrder 以 max+1 计算。
- 触发条件：任一步失败或并发添加/删除。
- 影响：无档案成员、计数漂移、重复 sortOrder、缓存与数据库不一致。
- 建议：使用事务；计数尽量查询派生或原子维护；排序使用可冲突重试的唯一约束/序列策略。

### F-07 用药跨日、有效期与并发唯一性均未闭环（High）

- 维度：业务正确性 / 竞态
- 位置：`medication/medication.service.ts:63-89,177-205,215-243,282-302`；`prisma/schema.prisma:276-294`
- 表现：只生成创建当天记录，today 不过滤 start/end；确认用 findFirst 后 create，Schema 无 `[planId,scheduledAt]` unique。
- 触发条件：第二天运行、未来/过期计划、并发确认同一时间点。
- 影响：漏服不告警、展示不该生效的提醒、重复依从记录和统计失真。
- 建议：每日幂等物化或按需物化；过滤有效期；添加复合唯一键并用真正 upsert。

### F-08 指标 streak、批量写和告警领取存在一致性错误（High）

- 维度：时序算法 / 事务 / 竞态
- 位置：`metric/metric.service.ts:77-105,206-264`；`notification/notification-scheduler.service.ts:115-139`
- 表现：prev 不限早于当前时间；批量写后处理非事务且 groupId 可漏查；异常列表不分组；Cron 查-通知-置位非原子。
- 触发条件：历史回填、并发录入、批量子项自带 groupId、多实例 Cron。
- 影响：streak 错误、漏告警或重复告警、部分记录永久保留默认值。
- 建议：定义乱序重算策略；按 member+type 串行或事务锁；批量同事务；每业务键只取最新；原子领取并加通知幂等键。

### F-09 上传文件可公开访问且内容验证不足（High）

- 维度：文件安全 / 隐私
- 位置：`main.ts:19-20`；`upload/upload.service.ts:18-62`；`upload/upload.controller.ts:41-53`
- 表现：所有 public 文件匿名静态暴露；通用上传不限制 MIME，扩展名和 MIME 均来自客户端，无 magic byte/恶意内容扫描。
- 触发条件：已认证用户上传恶意或健康文件，URL 被猜中/泄露。
- 影响：敏感健康文档越权读取；托管恶意内容；本地盘多实例不一致。
- 建议：私有对象存储、授权下载/短期签名 URL、内容嗅探与扫描、随机不可枚举键、上传用途 allowlist。

### F-10 SSE 生命周期和响应状态不安全（High）

- 维度：资源泄漏 / 流式协议
- 位置：`consultation/consultation.service.ts:37-43,140-176,399-400`；`shared/llm-gateway/ollama.provider.ts:150-222`；`global-exception.filter.ts:15-58`
- 表现：断连未传 AbortSignal、未 `stream.return()`；底层 finally 只 releaseLock 不 cancel；写入不检查响应状态；异常过滤器不检查 headersSent。
- 触发条件：客户端中途断开、超时与写入竞态、headers 已发后抛异常。
- 影响：LLM/GPU 继续消耗、write-after-close、二次写响应和客户端悬挂。
- 建议：贯通 AbortController；断连时 cancel reader/return generator；统一安全 write/end；Filter 在 headersSent 时交给底层关闭。

### F-11 前端 SSE 解析器跨 chunk 丢事件且无法取消（High）

- 维度：前端协议 / 资源
- 位置：`frontend/zhiyi-assistant-prototype.html:3602-3638`
- 表现：`currentEvent` 在每次 read 内重置；JSON parse 错误空 catch；无 AbortController。
- 触发条件：`event:` 与 `data:` 被网络分到不同 chunk，或页面退出/切换成员。
- 影响：红线、免责声明、chunk、done 被误分类或丢失；后台连接继续占用资源。
- 建议：按完整 SSE frame 解析并跨 read 保持状态；解析失败上报；暴露 cancel 并在页面生命周期调用。

### F-12 自评前后端未连接且输入校验不足（High）

- 维度：功能闭环 / 输入校验
- 位置：`frontend/...prototype.html:1463-1531,1960-2026,3716-3720`；`assessment/dto/assessment.dto.ts:4-26`
- 表现：UI 全走本地问题和静态报告，无 answer 调用；DTO 不限制 type、step、必答题和选项。
- 触发条件：用户完成页面自评，或直接提交空/伪造 answers。
- 影响：结果不入库、30 天复评无数据；后端评分可被空答案绕过。
- 建议：前端使用 start/answer/result 状态机；后端按服务端题库逐题校验并拒绝空答案。

### F-13 前端认证故障降级与 refresh 闭环缺失（High）

- 维度：认证 / 故障处理
- 位置：`frontend/...prototype.html:3331-3349,3529-3577,3716-3734`
- 表现：所有错误转 null；登录空结果生成 `dev-token`；不保存/轮换 refresh token，logout 不调用后端。
- 触发条件：后端不可用、401、网络异常、access token 到期。
- 影响：故障伪装为登录成功；后续静默失败；服务器 refresh token 不撤销。
- 建议：生产构建彻底禁用 fallback；结构化抛错；实现单飞刷新、重放保护和服务端 logout。

### F-14 微信开发身份判定与响应体超时存在回归（High）

- 维度：认证 / 超时
- 位置：`auth/auth.service.ts:50-80,93-134,252-255`；`test/security-hardening/auth-security.spec.ts:38-98`
- 表现：空值与占位值都被 `isMissingOrPlaceholder` 判 true，混合配置也启用开发身份；fetch 返回后立即 clearTimeout，`response.json()` 不再受超时保护。
- 触发条件：development 中一项缺失一项占位；微信返回 headers 后响应体挂起。
- 影响：意外启用伪身份；登录请求无限挂起耗尽连接。对应安全测试失败。
- 建议：只有“两项均严格为空”或显式开关才允许开发身份；超时覆盖 fetch + body 读取全过程。

### F-15 前端存在后端数据到 innerHTML 的持久化 XSS 面（High）

- 维度：前端安全 / XSS
- 位置：`frontend/...prototype.html:1782-1793,1928-1934,3770-3887`
- 表现：后端 `medicineName/dosage/notes` 被写入 `D.meds/memberDetails` 后，在用药卡和详情中直接拼接 HTML；同文件虽提供 `escapeHtml`，这些路径未使用。
- 触发条件：家庭成员通过 API 创建包含 HTML/事件属性的药名或备注，其他家庭成员打开相关页面。
- 影响：在同源页面执行脚本，读取内存 JWT、发起家庭健康数据请求或篡改展示。
- 建议：所有动态文本统一 textContent/escape；禁止动态内联 onclick；部署 CSP 并补恶意字符串回归。

### F-16 DTO 和查询参数边界系统性不足（High）

- 维度：输入校验 / 可用性
- 位置：`consultation/dto/consultation.dto.ts:41-49`；`medication/dto/create-medication.dto.ts:8-11,49-58`；`metric/dto/metric.dto.ts:7-103`；`metric.controller.ts:20-58`；`assessment.controller.ts:43-57`；`notification.controller.ts:17-29`；`knowledge.controller.ts:17-29`
- 表现：评分无 1-5 校验；时间无 HH:mm；指标无枚举/范围/batch 上限；分页、limit、days 直接 Number 转换，无整数、正数、最大值。
- 触发条件：恶意或错误查询/请求，如负 page、NaN、超大 take/days/batch。
- 影响：500、数据库大扫描、CPU/内存放大和脏数据。
- 建议：查询 DTO + ValidationPipe；统一 `IsInt/Min/Max`；领域枚举、数值范围和数组上限；校验 periodStart <= periodEnd。

### F-17 报告时间窗会混入结束日之后数据（Medium）

- 维度：业务正确性
- 位置：`report/report.service.ts:48-74`
- 表现：指标只限制 `recordedAt >= periodStart`，未限制 `<= periodEnd`；自评和用药也未按报告区间过滤。
- 触发条件：生成历史区间报告。
- 影响：报告摘要与指定时间窗不符，健康趋势判断失真。
- 建议：所有聚合数据统一使用闭区间/半开区间；校验起止顺序；加历史窗口测试。

### F-18 领域写权限普遍只有家庭 membership（Medium）

- 维度：授权模型
- 位置：`health-record/health-record.service.ts:191-209`；`medication/medication.service.ts:376-390`；`metric/metric.service.ts:267-280`；`assessment/assessment.service.ts:158-169`
- 表现：任一家庭成员可为任一成员改档案、用药、指标和发起自评，未区分 admin/caregiver/member 或本人。
- 触发条件：普通家庭成员调用写接口操作他人。
- 影响：敏感健康数据被篡改；审计责任不清。
- 建议：形成角色-资源-动作矩阵并集中执行；照护授权可撤销、可审计。

### F-19 事件发布语义与覆盖不可靠（Medium）

- 维度：异步事件 / 异常处理
- 位置：`shared/events/event-bus.service.ts:53-73`；Family/HealthRecord/Assessment/Consultation/Metric/Medication 各 publish 点；`notification.consumer.ts:60,94,125,148`
- 表现：publish 注释称不阻塞，实际 await emitAsync；调用方大多不 await/catch；多类事件无消费者；consumer 内 notify 捕获后只记日志。
- 触发条件：listener 抛错、进程退出、无订阅者事件。
- 影响：未观察 Promise rejection，业务已返回但副作用未知，通知静默丢失。
- 建议：明确同步或 outbox 语义；所有调用 await/catch；关键通知持久化 outbox、重试和死信。

### F-20 NotificationModule 重复实例化领域服务（Medium）

- 维度：依赖注入 / 状态一致性
- 位置：`notification/notification.module.ts:7-23`；`assessment/assessment.service.ts:143-147`
- 表现：NotificationModule 再次 provider Assessment/Medication/Metric Service，而非导入导出实例。
- 触发条件：同进程 Controller 与 Scheduler 分别解析服务。
- 影响：Assessment 会话 Map 分裂；状态和监控边界不一致。
- 建议：领域 Module 导出 Service，NotificationModule 导入领域 Module；会话迁移到共享持久化存储。

### F-21 缓存、事件、上传与部署声明不一致（Medium）

- 维度：架构一致性 / 多实例
- 位置：`shared/cache/cache.service.ts:4-20`；`shared/events/event-bus.service.ts:44-73`；`upload/upload.service.ts:18-50`；`docker-compose.yml:14-89`
- 表现：Redis/MinIO 已部署但缓存为 NodeCache、事件为进程内 emitter、上传为本地 public；NodeCache 返回共享可变引用。
- 触发条件：多实例、重启、调用方修改缓存对象。
- 影响：缓存不一致、事件丢失、文件不可见或丢失、缓存对象被意外篡改。
- 建议：实现 Redis/私有对象存储/可靠消息，或删除未实现声明；缓存值不可变或开启 clone。

### F-22 通知投递状态与阅读状态混用（Medium）

- 维度：数据模型 / 状态机
- 位置：`notification/notification.service.ts:48-76,104-115`；`prisma/schema.prisma:346-373`
- 表现：新 in_app 通知状态为 pending，未读统计定义为 status != read，阅读后把 status 改 read；同一 status 又承载发送 pending/retry/sent 语义。
- 触发条件：创建任意站内通知并读取，或未来接入微信投递。
- 影响：无法区分未发送、已发送未读、发送失败、已读；重试和统计互相覆盖。
- 建议：拆为 deliveryStatus 与 readAt/readStatus；in_app 创建即 delivered；微信使用独立投递记录。

### F-23 健康检查不代表服务就绪（Medium）

- 维度：运维 / 可用性
- 位置：`app.service.ts:8-15`；`Dockerfile:61-62`
- 表现：HTTP health 只返回进程 uptime，Docker 仅检查 3000 端口。
- 触发条件：数据库、存储、Redis或模型不可用但 Node 进程仍监听。
- 影响：编排器继续转发不可服务实例，故障发现延迟。
- 建议：区分 liveness/readiness；readiness 检查关键依赖并设置合理超时，LLM 可按降级策略标注非关键。

### F-24 知识、报告、OCR、语音和微信能力未达到声明（Medium/High 产品缺口）

- 维度：功能覆盖 / 可信内容
- 位置：`knowledge/knowledge.service.ts:4-176`；`prisma/schema.prisma:380-425`；`report/report.service.ts:110-121`；相关 Controller 路由清单；`notification.service.ts:104-115`
- 表现：默认知识无来源审核；报告只存 JSON、不产 PDF；上传未接 MinIO；OCR/语音无服务；微信无 sender。
- 触发条件：用户使用 PRD 对应入口或团队宣称能力已交付。
- 影响：关键 P0/P1 链路无法使用，医疗内容不可追溯，产品声明误导。
- 建议：按能力逐项实现验收闭环；未实现前从生产 UI/文档移除承诺。

### F-25 前端静默错误与硬编码健康结论混淆真实数据（Medium）

- 维度：前端可靠性 / 可信展示
- 位置：`frontend/...prototype.html:3331-3403,3742-3923`
- 表现：HTTP/网络错误统一返回 null，部分同步继续保留旧静态数据；健康分 82、记录数 28、咨询 12、成员“健康良好”等为硬编码。
- 触发条件：后端无数据、无权限、401 或故障。
- 影响：用户无法区分真实、缓存和演示数据，可能据此做健康判断。
- 建议：显式 loading/empty/error/stale 状态；演示数据显著隔离；健康结论只由可追溯后端数据产生。

### F-26 健康 JSON 字段容量和结构不可控（Medium）

- 维度：数据模型 / 容量
- 位置：`prisma/schema.prisma:128-133`；`health-record/health-record.service.ts:87-135`
- 表现：五类结构数据 stringify 到 VARCHAR(4000)，无数据库 JSON 约束和可查询字段。
- 触发条件：长期病史、过敏、疫苗等增长接近 4000 字符。
- 影响：写失败或按 SQL mode 截断，无法高效检索和验证。
- 建议：拆规范化表或使用原生 JSON/Text 并做应用 Schema 校验；明确长度限制和迁移。

### F-27 认证生产配置只部分 fail-fast（Medium）

- 维度：配置安全
- 位置：`main.ts:23-43`；`auth/auth.module.ts:17-21`；`auth/auth.service.ts:140,237`
- 表现：生产仅校验安全告警 webhook；JWT 缺失会退到 `dev-secret`，弱值/占位值不阻止启动。
- 触发条件：生产环境遗漏 JWT_SECRET 或误用占位值。
- 影响：攻击者可伪造访问/refresh token。
- 建议：启动前集中验证所有必需配置、最小长度/熵、禁止默认值；不同 token 使用独立 secrets。

### F-28 测试入口和安全回归不健康（Medium）

- 维度：质量门禁
- 位置：`package.json:12-18`；`test/jest-security.json:1-18`；缺失 `test/jest-e2e.json`
- 表现：build 通过，但默认 test 无配置，e2e 配置缺失，security 3/22 失败；关键家庭提权、SSE、并发、上传和 XSS 无测试。
- 触发条件：CI/开发者执行仓库声明的测试脚本。
- 影响：流水线无法形成可信发布门禁，安全回归可进入主干。
- 建议：补 root Jest 配置和 e2e 配置；修复 3 个失败；覆盖本报告 Critical/High 路径并在 CI 强制通过。

## 6. 误报、旧问题与环境限制

### 6.1 误报/不成立项

1. E-11 Swagger 必然缺 `/v1`：拒绝。当前调用顺序和 Nest Swagger 默认行为会包含 global prefix。
2. E-15 当前 `data.js`/`data.json` 已漂移：拒绝。离线解析深比较完全一致。
3. CORS 空配置会“放开跨域”：不成立。当前 `['']` 更接近拒绝正常浏览器 Origin；问题是配置导致不可用和语义含混。
4. `throw new Error` 扫描命中的生产告警 fail-fast、webhook 上游错误和 Ollama HTTP 错误是有意错误传播，不是空桩。
5. JSON parse 的部分空 catch（健康历史字段、LLM 行解析）属于降级策略；其中 LLM 行解析会丢坏行但未发现直接崩溃。前端 SSE parse 空 catch 已因协议数据丢失纳入 F-11。

### 6.2 已修复旧问题回归判断

- 事件总线已有 4 个 NotificationConsumer 订阅：基础通知生产链已存在；覆盖不足仍见 F-19。
- Cron 已注册复评、漏服、连续异常和 refresh 清理：缺失问题已修复；多实例原子性仍未修。
- Refresh Token 已持久化、轮换、撤销并有过期索引：基础后端链路存在；前端未接和安全测试失败为当前问题。
- 微信 `fetch()` 已有 AbortController：连接阶段超时已修；响应体阶段仍未覆盖，见 F-14。
- 后端生产微信失败不再回退任意用户：成立；但开发混合占位判定错误且前端仍生成 dev-token。
- Assessment session 已绑定 owner：相关测试通过；单实例 Map 和重复 provider 仍存在。
- 指标阈值 PATCH 已挂 AdminGuard：回归测试通过。
- Family/HealthRecord/Consultation 读取均有 membership 校验：基础 IDOR 已修；写权限粒度仍过粗。
- 用药创建 plan + 当日 adherence 使用同一事务：对应事务测试通过；跨日和并发唯一性仍存在。
- schedule/event-emitter 依赖已声明并可构建。

### 6.3 因环境或安全边界无法验证

- 疑似真实云数据库凭据有效性、异常访问和历史泄露范围。
- TiDB/MySQL 空库 migrate deploy、Schema drift、4000 字符截断/报错行为。
- 双 API 实例 Cron 重复通知、50 并发 adherence、并发 metric 的实际重复数量。
- Ollama SSE 断连后的真实 GPU/CPU 持续时间和模型 SLA。
- 浏览器代理拆包、SSE headersSent 异常注入的具体运行时表现。
- 微信订阅消息、对象存储和真实生产网络，因为当前并无可验证实现且不得使用真实凭据。

## 7. 全局一致性审查

已交叉检查 Controller → DTO → Service → Prisma、前端 API 声明 → 实际调用、事件发布 → 消费者、Cron 查询 → 去重字段、Compose 声明 → 运行时代码，并核对构建、Prisma、测试和静态数据结果。

一致性结论：

- 所有 Critical/High 结论都有当前源码路径和触发链支持。
- 静态可证明与必须依赖外部环境的结论已分离。
- 未把真实凭据有效性当作已验证事实，也未在报告中复述凭据值。
- 未把已修复旧问题重复表述为“完全缺失”，而是保留其尚未闭环的当前风险。
- 40 项和 15 项复核结果与最终合并发现无实质矛盾。

**IS_PASS: YES**
