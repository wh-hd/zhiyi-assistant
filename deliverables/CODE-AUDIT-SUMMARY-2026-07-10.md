# 智医助手全面代码审计总结（2026-07-10）

## TL;DR

当前代码可以构建，Prisma Schema 静态校验通过，但**不满足发布条件**：审计合并得到 28 项问题，其中 3 项 Critical，并且安全回归仅 19/22 通过、默认单测和 Jest E2E 均未执行任何测试。

## 1. 审计范围与方法

- 架构与功能覆盖：模块、Controller、Service、Prisma、前端动作、PRD P0/P1/P2 对照。
- 工程逐文件复核：逻辑、异常、事务、并发、资源生命周期、输入边界、硬编码、空桩及接口调用断裂。
- QA 独立验证：两轮安全回归、构建、Prisma 校验、测试入口检查，以及 6 条高风险路径的隔离复现。
- 安全边界：没有连接、探测或复述疑似真实云凭据；Prisma 仅使用虚构的本机 URL 做 Schema 静态校验。

## 2. 交付与质量门禁

| 项目 | 结果 |
|---|---|
| NestJS 构建 | PASS |
| Prisma Schema validate | PASS（未连接数据库） |
| Security tests | 19/22，86.36%，两轮结果一致 |
| 默认 Jest | FAIL，0 tests；7 个 suite 在收集阶段失败 |
| Jest E2E | FAIL，0 tests；配置文件缺失 |
| `e2e_extended.py` | 语法通过；因无安全隔离 API/数据库未完整运行 |
| 高风险隔离复现 | 6/6 成功复现 |
| 最终 QA 路由 | Engineer |
| 发布门禁 | FAIL |

> 工程报告的 `IS_PASS: YES` 只表示审计证据和分类自洽，不代表产品质量通过。QA 的发布结论是 **不通过**。

## 3. 问题统计

工程审计合并去重后共 **28 项**：

- Critical：3 项
- High：13 项
- Medium：12 项
- Low：作为测试脚本结构和覆盖观察项记录，不单独扩大最终缺陷数

完整的每项位置、表现、触发条件、影响与建议见 `CODE-AUDIT-ENGINEERING-2026-07-10.md` 第 5 节。

## 4. 最高优先级问题

### Critical

1. **普通家庭成员可提权并管理他人**  
   位置：`deliverables/backend/nestjs/src/modules/family/family.service.ts:131-132,195-218,257-269`；`family/dto/update-member.dto.ts:37-40`。  
   表现：添加和更新成员只校验家庭 membership，`role` 可直接写库。  
   影响：普通 member 可把自己或他人提升为 admin，进一步修改家庭健康数据。QA 已通过构建产物隔离调用复现。

2. **版本化部署文件包含敏感配置并扩大暴露面**  
   位置：`deliverables/backend/docker-compose.yml:20-32,51-60,82-87,101-102,154-195`。  
   表现：数据库、JWT、Redis、MinIO 敏感值进入部署文件，Redis、MinIO、Ollama 端口映射到宿主机。  
   影响：仓库或网络暴露时可能导致数据库、缓存、对象存储、模型服务或令牌签名被接管。没有探测这些值是否仍有效，应按已泄露处理并轮换。

3. **Prisma 迁移基线缺失**  
   位置：`deliverables/backend/nestjs/prisma/schema.prisma`；`prisma/migrations/202607100001_add_refresh_token_expires_at_index/migration.sql`。  
   表现：当前 Schema 有 **14 个模型**，迁移 SQL 中 `CREATE TABLE=0`、`CREATE INDEX=1`，且索引依赖既有 `refresh_tokens` 表。  
   影响：新环境、灾备恢复或 CI 空库无法通过 `migrate deploy` 建立系统。

### High

4. **自评小数分数与 Prisma Int 冲突**：`assessment.service.ts:436-470,264-289` 与 `schema.prisma:139-141,163-165`；QA 复现正常答案得到 `7.8`，可能导致写库失败或失真。
5. **创建家庭不建 HealthRecord，自评完成又非事务 update**：`family.service.ts:28-47`、`assessment.service.ts:264-293`；可能留下半完成 Assessment 并导致重试重复。
6. **家庭成员复合写和排序非事务**：`family.service.ts:142-170,236-243`；失败或并发时可能产生计数漂移、无档案成员和重复排序。
7. **用药跨日、有效期与并发唯一性未闭环**：`medication.service.ts:63-89,177-205,215-243,282-302`；次日起漏服任务缺失，并发确认可产生重复记录。
8. **指标 streak、批量写和告警领取不一致**：`metric.service.ts:77-105,206-264`、`notification-scheduler.service.ts:115-139`；乱序、并发和多实例会造成漏报、重复告警或 streak 错误。
9. **上传文件公开且内容验证不足**：`main.ts:19-20`、`upload.service.ts:18-62`；健康文件 URL 泄露即可匿名读取，且缺少 magic-byte/恶意内容扫描。
10. **后端 SSE 生命周期不安全**：`consultation.service.ts:37-43,140-176,399-400`、`ollama.provider.ts:150-222`；断连未取消底层读取，可能继续消耗 LLM/GPU 并触发 write-after-close。
11. **前端 SSE 跨 chunk 错分事件**：`prototype.html:3602-3638`；QA 复现 `red_line` 被识别为 `message`，红线提示可能失效。
12. **自评前后端没有连接且 DTO 校验不足**：前端 `prototype.html:1463-1531,1960-2026,3716-3720` 与 `assessment.dto.ts:4-26`；结果不入库，空/伪造答案可推进流程。
13. **前端认证降级和 refresh 闭环缺失**：`prototype.html:3331-3349,3529-3577,3716-3734`；故障会伪装成 dev 登录成功，access token 过期后静默失效，logout 不撤销服务端 token。
14. **微信开发身份与响应体超时回归**：`auth.service.ts:50-134,252-255`；安全测试两项稳定失败，混合配置错误启用开发身份，`response.json()` 可无限挂起。
15. **用药数据存在持久化 XSS 面**：`prototype.html:1782-1793,1928-1934,3770-3887`；后端药名、剂量、备注未经转义进入 `innerHTML`，QA 已证明恶意标签原样进入 sink。
16. **DTO/查询参数边界系统性不足**：多个 Controller/DTO 直接转换 `limit/page/pageSize/days`；QA 复现 NaN、负数直接传入 Service，可能导致 500、大查询和脏数据。

## 5. 主要 Medium 问题

- 报告历史时间窗缺少 `periodEnd` 上界，可能混入区间后的数据。
- 档案、用药、指标、自评写权限只校验家庭 membership，角色和本人权限粒度不足。
- 多个领域事件未 `await/catch`，部分事件无消费者，关键副作用可能静默丢失。
- `NotificationModule` 重复实例化领域 Service，导致 Assessment 的进程内 session Map 分裂。
- Redis/MinIO 已部署，但缓存仍为 NodeCache、上传仍为本地公开目录，部署声明与实际实现不一致。
- `Notification.status` 同时承载投递状态和阅读状态，未来接入微信后状态机会冲突。
- `/health` 只反映 Node 进程存活，不能代表 DB、存储、Redis、LLM 就绪。
- 前端吞掉所有 HTTP/网络错误，并混用硬编码健康分、咨询数和成员状态，用户无法区分真实数据与演示数据。
- 健康档案多个 JSON 字段使用 `VARCHAR(4000)`，长期数据可能写失败或截断。
- 生产配置只对部分安全项 fail-fast，JWT 缺失仍可能回退默认弱值。
- 默认 Jest 与 E2E 配置缺失，关键授权、SSE、并发、上传和 XSS 缺乏可信回归门禁。

## 6. 尚未实现或没有形成闭环的功能

| 需求/声明 | 当前状态 | 影响 |
|---|---|---|
| P0 家庭健康自评 | 前端本地静态执行，未调用后端 answer/result，结果不入库 | 30 天复评和家庭健康运营无真实数据来源 |
| P0 用药 OCR | 仅有 `source='ocr'`/图片字段，无 OCR 服务或接口 | 宣称入口不可用 |
| P0 微信订阅消息 | 只有站内 Notification 记录，无 token、模板 sender、重试、送达状态 | 真实提醒无法触达微信用户 |
| P0 指标语音录入 | 无语音识别服务/接口 | 适老化核心路径不完整 |
| P0 需求反馈采集 | 无反馈模型、API 和结果页入口 | 无法沉淀用户需求信号 |
| P0 AI 来源标注 | 有免责声明，无来源结构和“AI 生成”可信标注 | 健康内容不可追溯 |
| 健康档案扩展写入 | 手术史、家族史、疫苗史缺少完整写接口/UI | 档案能力不完整 |
| 真正多轮 AI 上下文 | sessionId 仅用于分组，未加载历史进入 LLM | “继续对话”无语境连续性 |
| P1 体检报告 OCR/解读/PDF | 报告仅保存 JSON，`pdfUrl` 未生成 | 核心能力未实现 |
| P1 个性化科普/可信内容 | 默认硬编码文章，无来源、审核、版本、可信评分或推荐 | 内容可信体系未落地 |
| 私有对象存储 | Compose 有 MinIO，但代码写本地 public | 隐私与多实例能力不达标 |
| Redis 缓存/可靠消息 | 依赖和容器存在，代码仍用进程内缓存/EventEmitter | 扩容后状态不一致 |

P2 规划项（日历、协作任务、设备接入、心理量表/疏导、社区等）未发现核心实现，现阶段可以不做，但不能宣称已覆盖。

## 7. 三个安全测试失败的路由

| 失败 | 根因 | Router |
|---|---|---|
| 微信混合缺失/占位配置 | 源码把空值与占位值都视为可开发降级 | Engineer |
| 微信响应体超时 | timer 在 `response.json()` 前被清除 | Engineer |
| Refresh 清理竞争 | `deleteMany.count===0` 过早退出，遗漏后续记录 | Engineer |

没有 `Router=QA` 项；测试断言本身成立。默认 Jest、E2E 配置缺失也路由 Engineer。

## 8. 修复顺序建议

1. **立即处置**：轮换部署文件中全部敏感凭据、检查访问日志、限制 Redis/MinIO/Ollama 暴露；同时封堵家庭角色提权。
2. **建立可部署基线**：生成并审查完整 Prisma 基线迁移，在隔离 MySQL/TiDB 兼容空库验证 deploy/seed/drift。
3. **修复数据正确性**：自评分数类型、家庭建档、自评事务、用药唯一键/跨日物化、指标乱序与幂等告警。
4. **修复客户端安全和生命周期**：XSS、SSE 拆包/取消、前端错误模型、refresh/logout 闭环。
5. **恢复质量门禁**：补 Jest/ts-jest 根配置和 E2E 配置，修复 3 个安全失败，为 Critical/High 路径建立隔离测试。
6. **再补产品闭环**：自评真实落库、微信通知、OCR/语音、可信来源、私有对象存储。

## 9. 详细报告索引

- 架构与功能覆盖：`deliverables/CODE-AUDIT-ARCHITECT-2026-07-10.md`
- 工程逐文件复核（28 项完整清单）：`deliverables/CODE-AUDIT-ENGINEERING-2026-07-10.md`
- QA 两轮独立验证：`deliverables/CODE-AUDIT-QA-2026-07-10.md`

## 10. 审计边界

未验证疑似真实凭据是否有效；未连接 TiDB/MySQL；未量化双实例 Cron、并发依从记录和指标并发的实际重复数；未调用微信、Ollama、MinIO、Redis；未在浏览器执行 XSS，只证明危险输入进入 `innerHTML` sink。上述事项均已保留为隔离环境中的后续动态验证项。