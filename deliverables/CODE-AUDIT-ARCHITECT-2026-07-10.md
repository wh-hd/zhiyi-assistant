# 智医助手架构与功能覆盖审计（2026-07-10）

> 审计角色：架构师（第一阶段，仅静态分析）  
> 审计范围：`deliverables/backend/nestjs`、`deliverables/frontend`、产品 PRD、后端架构文档及既有审计报告  
> 基准原则：以当前工作区源码为准；既有报告仅作线索，不把已修复事项重复记为当前缺陷。  
> 状态定义：**已验证问题** = 可由当前源码直接证明；**待工程核验** = 需构建、数据库、并发或真实外部服务验证；**已修复无需重复报告** = 旧报告问题已被当前源码修复。

## 1. 执行摘要

当前实现已形成 NestJS 模块化单体骨架，认证、家庭、档案、自评、咨询、用药、指标、通知、知识库、报告和上传均有 HTTP 或内部服务实现；事件总线、Cron、Refresh Token 轮换、管理员阈值保护也已补齐。主要问题已经从“模块缺失”转为“业务链路未闭环、权限粒度不足、单实例状态和多实例竞态”。

### 1.1 当前最高优先级结论

| ID | 状态 | 严重度 | 结论 | 证据 |
|---|---|---:|---|---|
| V-01 | 已验证问题 | Critical | 家庭普通成员可添加成员，并可通过更新成员 `role` 将自己或他人提升为 `admin`。 | `backend/nestjs/src/modules/family/family.service.ts:131-132,195-216`；`family/dto/update-member.dto.ts` 的 `role` 字段 |
| V-02 | 已验证问题 | Critical | Docker Compose 明文包含可用形态的云数据库 URL、Redis/MinIO/JWT 凭据。应按凭据已暴露处理并立即轮换，不能仅修改样例。 | `backend/docker-compose.yml:154-195` |
| V-03 | 已验证问题 | High | 前端“家庭健康自评”完全走本地静态题目和本地报告，没有调用后端提交答案，结果不入库，30 天复评链路无数据来源。 | `frontend/zhiyi-assistant-prototype.html:1466-1531,1960-2026,3716-3720` |
| V-04 | 已验证问题 | High | 用药计划只在创建时生成当天依从记录；后续日期没有生成任务，次日起漏服 Cron 无记录可扫。计划起止日期也未用于今日提醒过滤。 | `medication/medication.service.ts:63-89,177-205,282-302`；`notification/notification-scheduler.service.ts:73-100` |
| V-05 | 已验证问题 | High | PRD 要求的药盒 OCR、微信订阅消息、语音指标、来源标注均未闭环。DTO/部署声明虽出现 OCR/微信/MinIO，但没有识别、发送和可信来源服务。 | `medication/dto/create-medication.dto.ts:70-77`；`notification/notification.service.ts:104-115`；`knowledge/knowledge.service.ts:4-75`；`backend/docker-compose.yml:43-89` |
| V-06 | 已验证问题 | High | 自评完成写 Assessment 与健康档案快照不是事务；第二步失败会留下半完成数据。会话只在进程内 Map，重启/扩容丢失。 | `assessment/assessment.service.ts:145-147,264-293` |
| V-07 | 已验证问题 | High | 指标异常 streak 对乱序回填和并发写不正确；连续异常扫描未按 member+type 去重，多实例 Cron 也无原子领取。 | `metric/metric.service.ts:206-239,247-262`；`notification/notification-scheduler.service.ts:115-135` |
| V-08 | 已验证问题 | High | 上传文件写本地公开静态目录；通用上传无 MIME allowlist/magic-byte/恶意文件扫描，健康文档可凭 URL 无鉴权访问，且与 Compose 的 MinIO 声明不一致。 | `upload/upload.service.ts:18-62`；`main.ts:19-20`；`upload/upload.controller.ts:41` |
| V-09 | 已验证问题 | High | AI SSE 断连只停止上层读取，没有把 AbortSignal 传到底层 fetch 或显式关闭 generator；可能继续消耗 LLM/GPU 资源。 | `consultation/consultation.service.ts:38-42,140-160`；`shared/llm-gateway/ollama.provider.ts:150-221` |
| V-10 | 已验证问题 | High | 前端不保存/轮换 refresh token，`apiFetch` 将所有 HTTP/网络错误吞成 `null`；登录还会在后端不可用时降级为 `dev-token`，导致真实故障伪装成登录成功。 | `frontend/zhiyi-assistant-prototype.html:3331-3349,3531-3555,3718-3734` |

## 2. 当前系统结构

### 2.1 模块和职责

| 模块 | Controller / 入口 | Service / 模型 | 当前状态 |
|---|---|---|---|
| System | `AppController.healthCheck` | `AppService.getHealth` | 仅进程健康，不检查 DB/Redis/LLM |
| Auth | `AuthController` | `AuthService`, `RefreshToken`, `JwtStrategy` | Refresh Token 后端闭环；前端未接入 |
| User | `UserController` | `UserService`, `User` | 基础资料 CRUD；守卫写法与其他模块不统一 |
| Family | `FamilyController` | `FamilyService`, `Family`, `FamilyMember` | CRUD 完整；成员写权限存在提权缺陷 |
| HealthRecord | `HealthRecordController` | `HealthRecordService`, `HealthRecord` | 基础/慢病/过敏；手术/家族史/疫苗写接口缺失 |
| Assessment | `AssessmentController` | `AssessmentService`, `Assessment` | 后端流程存在；前端未接入；会话单实例 |
| Consultation | `ConsultationController` | `ConsultationService`, `RedLineEngine`, `LlmGatewayService`, `Consultation` | SSE/红线/持久化存在；取消、多轮上下文与来源不足 |
| Medication | `MedicationController` | `MedicationService`, `MedicationPlan`, `MedicationAdherence` | 当天计划可用；跨日调度、OCR、并发唯一性缺失 |
| Metric | `MetricController` | `MetricService`, `HealthMetric`, `MetricThreshold` | 录入/趋势/阈值存在；乱序并发和预警去重有缺陷 |
| Notification | `NotificationController` | `NotificationService`, Consumer, Scheduler, `Notification` | 站内通知存在；微信发送器缺失；Cron 多实例不安全 |
| Knowledge | `KnowledgeController` | `KnowledgeService`, `Knowledge` | 列表/详情存在；空库返回硬编码内容，无来源/审核/个性化 |
| Report | `ReportController` | `ReportService`, `HealthReport` | 聚合 JSON 报告存在；PDF/OCR 不存在，时间范围查询有误 |
| Upload | `UploadController` | `UploadService` | 本地公开文件；未接 MinIO 和授权下载 |
| AI Status | `AiController.status` | `LlmGatewayService`, `OllamaProvider` | 只验证 Ollama 有任意模型，不验证选定模型推理 |

### 2.2 Controller 接口覆盖矩阵

全局业务前缀为 `/v1`，健康检查除外（`backend/nestjs/src/main.ts:79-82`）。

| 域 | 当前接口 | Service 调用 | 前端动作 | 判断 |
|---|---|---|---|---|
| 健康 | `GET /health` | `AppService.getHealth` | `API.healthCheck` | 部分：非依赖健康检查 |
| 认证 | `POST /auth/wechat-login`, `/refresh-token`, `/logout` | 登录、原子轮换、撤销 | 只调用登录；前端 logout 不请求后端 | 部分闭环 |
| 用户 | `GET/PATCH /users/me`, `GET /users/me/families` | 用户资料/家庭 | 只调用 `GET /users/me` | 部分闭环 |
| 家庭 | `POST/GET /families`, `GET/PATCH /families/:id`, 成员 GET/POST/PATCH/DELETE | 家庭成员 CRUD | 列表、添加、详情 | 后端完整，前端部分 |
| 档案 | `GET/PATCH /health-records/:memberId`，慢病/过敏 PATCH，export GET | 档案读写与导出结构 | 仅读取 | 写入 UI 未闭环 |
| 自评 | start/answer/result/history/manual-review | 会话、评分、落库、复评 | 页面本地运行；仅声明 start/result/history | **调用断裂** |
| 咨询 | POST SSE、redline-check、history、detail、feedback | 红线、LLM、持久化、反馈 | 使用 SSE/history | 主链路存在；feedback 未接 |
| 用药 | 列表、创建、今日、详情、更新、停用、依从记录 | 计划/依从 | 列表、创建、标记 | 当日可用，跨日断裂 |
| 指标 | 查询、单条/批量录入、趋势、阈值 GET/PATCH | 录入/趋势/预警 | 查询、趋势、单条录入 | 手动路径存在；语音缺失 |
| 通知 | 列表、未读、单条/全部已读、删除 | 通知 CRUD | 获取、单条已读声明 | UI 展示路径需动态核验 |
| 知识 | 列表、分类、详情 | DB 或默认文章 | 启动同步列表/分类 | 无来源、个性化和审核 |
| 报告 | 列表、生成、详情 | 聚合 JSON | 声明生成/列表 | UI 未形成完整报告流；无 PDF |
| 上传 | avatar、通用文件 | 本地磁盘 | 只声明头像上传 | 安全与存储实现不达标 |
| AI | `GET /ai/status` | Ollama tags | 无 | 运维辅助接口 |

## 3. PRD 需求覆盖矩阵

基准：`product-strategy/prd-zhiyi-assistant-2026-07-05.md:214-242`。

| 需求 | 后端 | 前端 | 数据模型 | 覆盖判断 |
|---|---|---|---|---|
| P0-01 家庭健康自评 | 有 start/answer/result/history、评分、复评 Cron | 静态本地题目与固定报告，未提交后端 | `Assessment` + 档案快照 | **部分/主链路断裂**：后端问卷偏个人健康；只输出最低 2 项而非 ≥3 条；无反馈入口/需求信号 |
| P0-02 AI 咨询+红线 | SSE、12 类规则方向、LLM、持久化 | SSE 展示、红线提示 | `Consultation` | **大部分**：无真正多轮上下文；取消和反馈校验不足；响应 SLA 待测 |
| P0-03 家庭健康档案 | 家庭/成员/档案/慢病/过敏 | 家庭列表、详情、添加成员 | `Family*`, `HealthRecord` | **部分**：权限管理缺陷；手术/家族史/疫苗无写接口；前端编辑未闭环 |
| P0-04 用药提醒 | 计划/依从/Cron/站内通知 | 手动添加、今日用药、标记 | `Medication*`, `Notification` | **严重部分**：无 OCR、无微信推送、无次日记录生成、子女权限未细分 |
| P0-05 指标趋势 | 手动/批量/趋势/连续异常 Cron | 手动录入、趋势 | `HealthMetric`, `MetricThreshold` | **部分**：无语音；并发/乱序 streak 不可靠；预警接收者只粗略回退到家庭创建者 |
| P0-06 适老化基础 | 无年龄偏好或模式 API | 有大字号视觉原型，但无 ≥55 自动开启；语音未实现 | 无适老化偏好字段 | **不足** |
| P0-07 需求采集 | 无需求/反馈模型与 API | 自评结果无开放反馈入口 | 无 | **未实现** |
| P0-08 声明+来源 | SSE 含 disclaimer | 展示免责声明 | `Consultation` 无来源结构 | **部分**：无“AI 生成”及信息来源标注 |
| P1-01 体检报告解读 | 仅上传和聚合报告，无 OCR/解读/PDF | 无完整流程 | `HealthReport` | **未实现核心能力** |
| P1-02 个性化科普 | 仅 DB 列表或默认硬编码 | 启动同步 | `Knowledge` | **未实现个性化推荐** |
| P1-03 内容可信体系 | 无来源、审核医生、可信评分 | 无 | Schema 无对应字段 | **未实现** |
| P1-04 适老完整模式 | 无 | 无极简/全语音闭环 | 无 | **未实现** |
| P1-05 反馈完整版 | 无 | 无 | 无 | **未实现** |
| P1-06 微信运动 | 无 | 无 | 指标可容纳 steps 但无接入 | **未实现** |
| P2-01~05 | 未发现日历、协作任务、设备接入、量表/疏导、社区模块 | 未发现完整页面 | 无对应核心模型 | **规划项未实现，符合 P2 阶段但不可宣称覆盖** |

## 4. 已验证问题

### 4.1 权限与数据安全

1. **家庭成员横向管理与角色提权（Critical）**  
   `FamilyService.addMember()` 和 `updateMember()` 只调用 `ensureMembership()`，没有要求 admin；后者直接持久化 `dto.role`。普通 member 可添加成员，并把任意成员改为 admin。删除成员已使用 `ensureAdmin()`，说明预期权限模型明确但实现不一致。  
   证据：`backend/nestjs/src/modules/family/family.service.ts:131-132,195-218,227-228,257-269`；架构设计角色边界见 `backend/zhiyi-assistant-architecture.md:1417-1427`。

2. **部署配置包含明文凭据（Critical）**  
   Compose 中直接保存数据库 URL、Redis 密码、MinIO 密钥和 JWT 开发密钥。云数据库凭据必须轮换并检查访问日志；Redis/MinIO/JWT 同样应替换，并迁移到 secret 管理。  
   证据：`backend/docker-compose.yml:154-195`。报告不复述具体密钥。

3. **上传内容公开、验证不足（High）**  
   `main.ts` 将整个 `public` 静态公开；UploadService 用客户端 MIME/原文件扩展决定保存，通用上传甚至未提供 `allowedPrefix`。无 magic-byte、病毒扫描、内容处置和授权下载。健康报告 URL 泄露即可读取。  
   证据：`backend/nestjs/src/main.ts:19-20`；`modules/upload/upload.service.ts:18-62`；`upload.controller.ts:41-52`。

4. **前端开发降级可能掩盖认证失败（High）**  
   任何登录空结果或后端不可用都会生成 `dev-token/dev-user` 并 resolve 成功，且未按构建环境禁用。真实环境可能显示“已登录”但后续 API 全部失败。  
   证据：`frontend/zhiyi-assistant-prototype.html:3531-3555`。

5. **家庭内数据授权粒度过粗（Medium，产品权限相关）**  
   多数档案、用药、指标服务只验证“是家庭成员”，未区分 admin/caregiver/member，也未限制 member 只能操作本人。这与架构文档角色权限不一致。  
   证据：`family.service.ts:257-269`；`medication.service.ts` 的 `verifyMemberAccess` 调用；`metric.service.ts` 的 `verifyMemberAccess` 调用；设计基准 `zhiyi-assistant-architecture.md:1424-1427`。

### 4.2 事务与一致性

6. **家庭成员复合写非事务（High）**  
   添加成员、更新 memberCount、创建健康档案分三次提交；任一步失败可留下无档案成员或计数漂移。删除成员与重算 memberCount 同样非事务。并发添加还会产生相同 sortOrder。  
   证据：`family.service.ts:142-170,236-243`。

7. **自评完成复合写非事务（High）**  
   Assessment 先创建，再 `healthRecord.update()`。档案缺失或第二步失败时，Assessment 已落库但 session 未清理、快照未更新；重试可能重复创建。应在事务内 upsert 快照并加幂等键。  
   证据：`assessment.service.ts:264-293`。

8. **依从记录并发去重无数据库保证（High）**  
   代码注释称 upsert，实际是 `findFirst` 后 create/update；Schema 只有普通索引，没有 `@@unique([planId, scheduledAt])`。并发确认可插入重复记录。  
   证据：`medication.service.ts:215-243`；`prisma/schema.prisma:276-293`。

9. **指标批量写与 streak 后处理非事务（High）**  
   `createMany` 提交后再逐条更新 streak；中途失败会留下部分默认 streak。查回记录使用 groupId，但调用方可为子项提供不同 groupId，导致部分新记录未后处理。  
   证据：`metric.service.ts:77-105`。

10. **报告时间窗口错误（Medium）**  
    生成历史区间报告时指标只限制 `recordedAt >= periodStart`，没有 `<= periodEnd`，会把区间结束后的数据混入。  
    证据：`report.service.ts:48-51,69-74`。

### 4.3 调度、并发与事件

11. **用药跨日链路中断（High）**  
    创建计划时只调用 `ensureTodayAdherences()`；没有每日预生成或 Cron 动态物化次日记录。`getTodayReminders()` 虽可虚拟展示 pending，但漏服 Cron 只扫描数据库 adherence，因此次日不会告警。未来开始/已经结束的计划也没有在 today 查询中过滤。  
    证据：`medication.service.ts:63-89,177-205,282-302`。

12. **指标 streak 不支持乱序与并发（High）**  
    `afterRecord()` 查询上一条时不限制 `recordedAt < 当前记录时间`，回填历史数据会读取未来记录；并发写可同时读取同一 prev 而丢失递增。  
    证据：`metric.service.ts:206-229`。

13. **连续异常查询与注释不一致（High）**  
    注释要求每 member+metricType 只返回最新一条，实际每阈值直接 `take: 50` 并全部 push，未分组去重。旧的未标记记录会重复进入。  
    证据：`metric.service.ts:243-262`。

14. **Cron 去重不是原子领取（High）**  
    Scheduler 先查询未通知记录，再创建 Notification，再更新标志。多实例或任务重叠时可同时领取同一记录，产生重复通知。需要条件更新/租约、唯一幂等键或作业队列。  
    证据：`notification-scheduler.service.ts:73-100,115-135`。

15. **多数领域事件 fire-and-forget（Medium）**  
    `EventBusService.publish()` 内部 `await emitAsync`，但 Family/HealthRecord/Assessment/Consultation/Metric/Medication 部分调用未 await。监听器若抛错会形成未观察 Promise rejection，且业务返回时副作用状态不确定。用药计划创建是少数显式 await/catch 的正确范例。  
    证据：`shared/events/event-bus.service.ts` 的 `publish`；发布点见 `family.service.ts:50,109,174,246`、`assessment.service.ts:296`、`consultation.service.ts:95,203`、`metric.service.ts:233,237`、`medication.service.ts:248-250`。

16. **事件覆盖仍不完整（Medium）**  
    当前只有 `MEDICATION_MISSED`、`CONSULTATION_REDLINE_TRIGGERED`、`MEDICATION_PLAN_CREATED`、`FAMILY_MEMBER_ADDED` 四类订阅。`ASSESSMENT_COMPLETED`、`METRIC_ABNORMAL`、`MEDICATION_TAKEN`、`CONSULTATION_COMPLETED` 等没有消费者；部分由 Cron 替代，但事件本身没有闭环副作用。  
    证据：`notification/notification.consumer.ts:60,94,125,148`；发布点清单见上一项。

17. **NotificationModule 重复实例化领域 Service（Medium）**  
    模块直接 provider `AssessmentService/MedicationService/MetricService`，而不是由领域模块导出后导入；这会生成第二组实例。AssessmentService 含内存 session Map，导致同一进程内也存在两个会话状态边界。  
    证据：`notification/notification.module.ts:7-23`；`assessment.service.ts:145`。

### 4.4 AI、SSE 与资源

18. **SSE 客户端取消未传递到底层（High）**  
    断连后只 break 上层 loop，没有 `stream.return()`，也没有 AbortController 从 ConsultationService 传到 OllamaProvider。底层 reader/fetch 可能继续到超时。  
    证据：`consultation.service.ts:38-42,140-160`；`ollama.provider.ts:150-221`。

19. **SSE 写入缺少响应状态保护（Medium）**  
    `sendSSEEvent` 直接 `res.write()`，没有检查 `destroyed/writableEnded`。断连事件与写入竞态时可能 write-after-close。headers 已发送后抛错也无法再安全返回全局 JSON 错误。  
    证据：`consultation.service.ts:61-67,399-400`；`common/filters/global-exception.filter.ts:15-58`。

20. **前端 SSE parser 跨 chunk 丢失 event 类型（High）**  
    `currentEvent` 在每次 `read()` 中重置为 `message`。当 `event:` 行和 `data:` 行被拆到不同网络 chunk 时，下一次读取会把 data 当作 message，红线/disclaimer/chunk/done 回调可能失效。还没有 AbortController 供页面退出时取消请求。  
    证据：`frontend/zhiyi-assistant-prototype.html:3613-3638`。

21. **对话 sessionId 不是多轮上下文（Medium）**  
    客户端可传任意 sessionId，服务端只用于持久化分组；发起咨询时没有加载同 session 历史加入 messages。因此“继续对话”并不具备语境连续性。  
    证据：`consultation.service.ts:58,140-144,182-208,317-325`。

22. **AI 可用性端点语义偏弱（Low）**  
    `isAvailable()` 只检查 `/api/tags` 返回任意模型；`AiController` 报告的是配置模型名。配置模型缺失但存在其他模型时会返回 available=true。  
    证据：`ai/ai.controller.ts:26-43`；`llm-gateway/ollama.provider.ts:86-96`。

### 4.5 DTO、数据模型与资源边界

23. **自评 DTO 可接受无效步骤/空答案（High）**  
    `type` 未限制枚举，`step` 无 `@IsInt/@Min`，answers 仅 `@IsObject`，未验证题目 ID、必答项和选项值；空对象可推进步骤。  
    证据：`assessment/dto/assessment.dto.ts:4-26`。

24. **满意度评分无运行时校验（Medium）**  
    Swagger 写 1-5，但 `FeedbackDto.satisfaction` 无 class-validator 装饰器。  
    证据：`consultation/dto/consultation.dto.ts:41-46`。

25. **用药时间和 custom 条件校验不足（High）**  
    `time` 只验证字符串，不保证 HH:mm；custom frequency 不强制 customSchedule 非空。非法时间可能生成 Invalid Date 或错误提醒。  
    证据：`medication/dto/create-medication.dto.ts:8-11,49-58`。

26. **指标输入边界不足（Medium）**  
    metricType/unit/inputMethod 是任意字符串；value 没有领域范围；batch 没有数组条数上限。可污染维度、放大数据库/CPU 负载。  
    证据：`metric/dto/metric.dto.ts:8-33,46-98`。

27. **健康档案 JSON 使用 VARCHAR(4000)（Medium）**  
    慢病、过敏、手术、家族史、疫苗均 JSON stringify 存入 4000 字符字段，增长后可能写失败；也无法高效检索和约束。  
    证据：`prisma/schema.prisma:120-133`。

28. **趋势与报告使用参数展开计算极值（Low/容量相关）**  
    `Math.min(...values)/Math.max(...values)` 在高频设备数据或大时间窗可能超过 JS 参数上限。  
    证据：`metric.service.ts:138-143`；`report.service.ts:152-158`。

29. **缓存和部署声明不一致（Medium）**  
    `ioredis` 和 Redis 容器存在，但 CacheService 只使用进程内 NodeCache，`useClones:false` 还会向调用方返回共享可变引用。多实例缓存不一致，架构文档 L3 Redis 未实现。  
    证据：`shared/cache/cache.service.ts:4-19`；`package.json:45-46`；`backend/docker-compose.yml:14-42`。

30. **健康检查不能代表服务就绪（Medium）**  
    `/health` 不检查数据库、Redis、存储或 LLM；Docker HEALTHCHECK 只检查端口。数据库不可用时可能端口存活却无法服务。  
    证据：`app.controller.ts:10-13`；`shared/prisma/prisma.service.ts:20-22`；`Dockerfile:61-62`。

### 4.6 产品声明与实际实现偏差

31. **自评前后端双实现且互不相连（High）**  
    页面从 `D.assessment` 读取题目，`assessNext` 只切换本地索引，报告来自静态 `D.assessReport`，完成按钮只是 toast。API 对象没有 `submitAnswer`。  
    证据：`frontend/zhiyi-assistant-prototype.html:1466-1531,1960-2026,3716-3720`。

32. **自评产出不满足 PRD（High）**  
    后端问卷偏个人生理状态，不是完整家庭基本情况/成员健康/关注点/行为模式；评分只 `.slice(0, 2)`，PRD 要求关注清单 ≥3 条；无开放反馈入口和需求信号字段。  
    证据：`assessment.service.ts` 的 `ASSESSMENT_QUESTIONS` 和 `calculateScore`；`assessment.service.ts:449-457`；PRD `:214,220`。

33. **微信通知未实现（High）**  
    当前只创建 `channel='in_app'`、`status='pending'` 的 DB 记录，没有微信 token、模板消息发送器、重试、送达状态或 sentAt 更新。Schema 默认 `wechat_subscribe` 与 Service 默认 `in_app` 也不一致。  
    证据：`notification.service.ts:104-115`；`prisma/schema.prisma:351-372`。

34. **OCR/语音输入只是字段或文案（High）**  
    Medication DTO 有 `source='ocr'`/`ocrImageUrl`，但无 OCR endpoint/service；Metric 无语音识别 endpoint/service。  
    证据：`medication/dto/create-medication.dto.ts:70-77`；Controller 路由清单；PRD `:217-218`。

35. **知识库默认内容无来源与审核（Medium）**  
    空库返回 6 篇硬编码文章，模型只有标题/内容/tags/readCount，无来源 URL、机构、审核医生、版本和可信评分。默认详情阅读量也不持久化。  
    证据：`knowledge/knowledge.service.ts:4-75,100-176`；`prisma/schema.prisma:381-395`。

36. **报告并非 PDF，上传也未接 MinIO（Medium）**  
    HealthRecord export 返回 PDF 数据结构；Report 只存 JSON，`pdfUrl` 从未生成。Compose 启动 MinIO，但 UploadService 写本地 public。  
    证据：`health-record/health-record.controller.ts:57`；`report.service.ts:110-121`；`upload.service.ts:18-50`；`backend/docker-compose.yml:43-89`。

37. **前端错误静默（Medium）**  
    `apiFetch` 对所有非 2xx/网络错误返回 null，不抛异常；多个按钮随后只“不更新”或继续用旧静态数据。用户无法区分无数据、无权限、过期登录和系统失败。  
    证据：`frontend/zhiyi-assistant-prototype.html:3331-3349`。

38. **前端展示含硬编码业务指标（Low/可信度）**  
    健康评分 82、记录数 28、咨询次数 12、成员状态等由转换器硬编码，不来自后端。容易让原型看似已经实现分析能力。  
    证据：`frontend/zhiyi-assistant-prototype.html:3354-3403`。

39. **Refresh Token 后端有能力但前端完全未接（High）**  
    登录结果只保存 accessToken/user，不保存 refreshToken；401 不刷新；logout 只清内存，不调用后端撤销接口。access token 过期后会整体失效。  
    证据：`frontend/zhiyi-assistant-prototype.html:3531-3540,3721-3734`；后端接口 `auth.controller.ts:20-33`。

40. **配置/文档技术栈漂移（Medium）**  
    架构文档采用 PostgreSQL+TimescaleDB+Redis Streams+Elasticsearch+S3；当前 Schema/provider 是 MySQL/TiDB，缓存是 NodeCache，事件是进程内 EventEmitter，上传是本地盘。不是问题本身，但所有容量、HA 和一致性结论必须以现实现重做，文档不可作为已落地证明。  
    证据：`backend/zhiyi-assistant-architecture.md:124-130,2294-2300`；`prisma/schema.prisma` provider；`cache.service.ts`；`event-bus.service.ts`；`upload.service.ts`。

## 5. 待工程核验

这些事项不能仅凭静态源码判定最终运行结果，后续工程阶段应保留证据执行。

| ID | 核验项 | 方法 | 关联位置 |
|---|---|---|---|
| E-01 | Compose 中数据库凭据是否仍有效、是否已有异常访问 | 立即轮换；查云数据库审计日志与仓库历史 | `backend/docker-compose.yml:160` |
| E-02 | Prisma migration 是否完整覆盖现有 Schema | 空库执行 migrate deploy，再做 schema drift；当前 migrations 目录只看到 refresh expiresAt 索引 SQL | `prisma/migrations/202607100001.../migration.sql` |
| E-03 | 家庭普通成员提权是否可通过 HTTP 复现 | 两用户同家庭，以 member token PATCH 自己 role=admin，再调用 admin-only 删除 | `family.controller.ts`, `family.service.ts:195-218` |
| E-04 | Cron 多实例重复通知 | 启动两 API 实例同时执行漏服/异常任务，统计相同业务键通知数 | `notification-scheduler.service.ts` |
| E-05 | 并发依从确认重复行 | 50 并发 POST 同 planId/scheduledAt，查询重复数 | `medication.service.ts:215-243` |
| E-06 | 指标乱序/并发 streak | 顺序、乱序和并发录入相同 member/type，核对 streak 与预警次数 | `metric.service.ts:206-262` |
| E-07 | SSE 断连后的 Ollama 请求是否继续 | 大响应中途断开客户端，观察 Ollama 活跃请求、GPU/CPU、服务日志 | `consultation.service.ts`, `ollama.provider.ts` |
| E-08 | 前端 SSE 跨 chunk 解析 | 代理人为拆分 `event:`/`data:` 行，验证 red_line/chunk/done 事件 | `prototype.html:3613-3638` |
| E-09 | 全局异常过滤器在 SSE headers 已发送后行为 | LLM 流中注入异常，检查二次写、进程错误、客户端结束状态 | `global-exception.filter.ts`, `consultation.service.ts` |
| E-10 | CORS 空配置行为 | 不提供 CORS_ORIGINS 启动，测试浏览器 origin；当前 `''.split(',')` 为 `['']` | `main.ts:53-60` |
| E-11 | Swagger Try it out 路径 | 检查生成文档 server 是否缺 `/v1` 导致请求 404 | `main.ts:84-95` |
| E-12 | 构建、单测、安全测试、e2e | `npm run build`, `npm test`, `npm run test:security`, `npm run test:e2e`；本阶段未执行 | `package.json:7-18` |
| E-13 | 生产配置 fail-fast 与 secret 强度 | 用 production 环境启动，验证告警 webhook、JWT/WX placeholder 拒绝策略 | `main.ts:23-43`, `auth.service.ts` |
| E-14 | 健康档案 4000 字符边界 | 提交接近/超过字段上限的中文 JSON，确认 TiDB/MySQL 错误/截断行为 | `schema.prisma:129-133` |
| E-15 | 前端 data.js/data.json 漂移 | 自动解析比较两个静态数据对象；当前维护两份同源配置 | `frontend/data.js`, `frontend/data.json` |

## 6. 已修复无需重复报告

以下旧报告结论已由当前源码修复。后续工程师应做回归验证，但不要继续以“实现缺失”报同一问题。

| 旧结论 | 当前证据 | 当前判断 |
|---|---|---|
| 事件总线零订阅者、通知永不生成 | `notification.consumer.ts` 有 4 个 `@OnEvent`；`NotificationService.createNotification` 已存在 | 已修复基础生产链；事件覆盖和真实微信发送仍是新问题 |
| 没有 Cron 定时任务 | `notification-scheduler.service.ts:37,73,115`；`app.module.ts` 注册 ScheduleModule | 已修复；多实例原子性仍是新问题 |
| Refresh Token 不持久化、不可撤销 | `auth.service.ts:138-220,230-249`；`RefreshToken` 模型和清理索引 | 已修复后端；前端未接是新问题 |
| 微信 jscode2session 无超时 | `auth.service.ts:105-106` AbortController | 已修复 |
| 生产微信失败会回退任意 dev 用户 | `AuthService` 已限制仅 development+占位配置使用开发身份 | 已修复后端；前端仍有 dev-token 降级是独立问题 |
| 自评 session 未绑定用户，可越权提交 | session 含 ownerId，`getSession` 校验 userId | 已修复；内存状态仍有可用性问题 |
| 阈值更新无管理员权限 | `metric.controller.ts:67-68` 使用 AdminGuard | 已修复 |
| Family/HealthRecord/Consultation 读取 IDOR | 当前服务均先校验家庭 membership/member 归属 | 已修复读取面；写权限粒度仍不足 |
| 用药创建 plan 和 adherence 非事务 | `medication.service.ts:63-90` 使用 `$transaction` | 已修复创建原子性；跨日与唯一性仍是新问题 |
| NotificationService 没有内部创建方法 | `notification.service.ts:104-115` | 已修复 |
| @nestjs/schedule / event-emitter 依赖缺失 | `package.json:30,34` 且 lockfile 有对应条目 | 已修复 |

## 7. 关键调用链

### 7.1 登录与 Token

`prototype.smartLogin` → `POST /v1/auth/wechat-login` → `AuthService.wechatLogin` → 微信 `jscode2session` 或受限 dev identity → User upsert/find → `generateTokens` → RefreshToken hash 入库。  
断点：前端只保留 access token，不调用 refresh/logout 后端接口。

### 7.2 家庭自评

当前前端：`renderAssess` → `assessNext` → `renderAssessReport` → `completeAssessReport`，全部本地。  
预期后端：`POST assessments/start` → 内存 session → `POST assessments/answer` 多步 → calculateScore → Assessment create → HealthRecord snapshot → event → 30 天 Cron。  
断点：前端没有 submitAnswer；后端复合写非事务、建议只有 2 项。

### 7.3 AI 咨询

`sendChat` → `API.consultStream` → `ConsultationController.startConsultation` → membership 校验 → health profile → RedLineEngine → SSE disclaimer/redline → LlmGateway → Ollama stream → Consultation create → done。  
风险点：跨 chunk parser、取消传播、write-after-close、多轮历史未加载、事件未 await、无来源标注。

### 7.4 用药提醒

`saveAddMed` → `POST medications` → 事务创建 plan + 当日 adherence → `MEDICATION_PLAN_CREATED` → NotificationConsumer → in-app Notification。  
漏服：Cron → `findOverdueAdherences` → Notification create → `missedNotified=true`。  
断点：次日 adherence 不生成；微信发送器缺失；Cron 原子领取缺失。

### 7.5 指标预警

前端单条录入 → Metric create → `afterRecord` → threshold evaluate → abnormalStreak → `METRIC_ABNORMAL`。  
每天 08:30 Cron → `findConsecutiveAbnormal` → Notification create → `abnormalAlerted=true`。  
风险点：乱序、并发、未分组、Cron 重复领取；METRIC_ABNORMAL 事件本身无 consumer。

## 8. 后续工程师重点文件与核查顺序

1. **先封堵权限和凭据**：`backend/docker-compose.yml`、`family/family.service.ts`、`family/dto/update-member.dto.ts`。轮换凭据；定义 admin/caregiver/member 权限表；所有写操作使用统一 policy/guard。
2. **打通 P0 自评**：`frontend/zhiyi-assistant-prototype.html`、`assessment.controller.ts`、`assessment.service.ts`、DTO。前端接 start/answer/result；session 改 Redis 或持久化；完成写事务化；建议 ≥3；增加反馈/需求信号。
3. **修复用药跨日和通知投递**：`medication.service.ts`、Schema、Scheduler、NotificationService。增加 `[planId, scheduledAt]` 唯一键；每日幂等物化；过滤 start/end；作业原子领取；实现微信 sender 状态机。
4. **重构指标 streak**：`metric.service.ts`、Schema、Scheduler。按 recordedAt 前驱计算；明确乱序重算策略；串行化 member+type 写；查询按业务键去重。
5. **收紧 SSE 生命周期**：`consultation.service.ts`、`llm-gateway/interfaces.ts`、`ollama.provider.ts`、前端 parser。贯通 AbortSignal；安全 close；保留 parser 状态；加载有限历史；加入来源结构。
6. **统一基础设施**：Cache 使用 Redis；上传使用私有 MinIO/COS 和签名下载；健康检查覆盖 DB/Redis/storage/LLM；清除与实现不符的架构承诺。
7. **补 DTO 与容量边界**：自评、咨询反馈、用药时间、指标类型/范围/batch 上限；分页 page/pageSize 统一上下限。
8. **建立回归矩阵**：至少覆盖普通成员提权、IDOR、refresh replay、并发依从、乱序 streak、双实例 Cron、SSE 断连、恶意上传、access token 过期刷新。

## 9. 审计边界与结论

本报告是静态架构审计，没有修改业务代码，也没有在本阶段执行构建、测试、迁移或真实微信/Ollama/TiDB 动态验证。可由源码直接证明的事项已标为“已验证问题”；依赖运行环境和并发时序的事项已放入“待工程核验”。

整体判断：系统已经具备可演示的模块化后端和部分真实前后端联调，但尚不能视为 P0 端到端完成。发布前的硬门槛是：凭据轮换、家庭角色提权修复、自评真实落库、用药跨日+微信通知闭环、指标并发正确性、上传私有化、refresh 前端闭环和 SSE 取消传播。