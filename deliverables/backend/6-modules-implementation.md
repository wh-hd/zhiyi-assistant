# 智医助手后端 — 6 个空壳模块完整实现

## 背景
之前 Medication / Metric / Notification / Knowledge / Report / Upload 6 个模块的 Controller 与 Service 仅有构造函数（空壳），前端原型无法对接。本次补全全部业务逻辑与 HTTP 端点，并完成端到端验证。

## 实现清单（NestJS + Prisma + TiDB Cloud）

| 模块 | 端点 | 关键逻辑 |
|---|---|---|
| **Medication** | GET/POST /medications, GET /medications/today, GET/PATCH/DELETE /medications/:id, POST/GET /medications/:id/adherence | 用药计划 CRUD（软删 isActive=false）、今日提醒、依从记录 upsert（planId+scheduledAt）、频率→服药时间点映射、本地红线事件发布 |
| **Metric** | GET/POST /metrics, POST /metrics/batch, GET /metrics/trend, GET/PATCH /metrics/thresholds/:type | 单条/批量记录、趋势+阈值异常评估（normal/high/low）、阈值按 metricType upsert |
| **Notification** | GET /notifications, GET /notifications/unread-count, POST /:id/read, POST /read-all, DELETE /:id | 分页列表、未读计数、标记已读/全部已读 |
| **Knowledge** | GET /knowledge, GET /knowledge/categories, GET /knowledge/:id | 库空时回退内置 6 篇默认文章；详情自增 readCount |
| **Report** | GET /reports, POST /reports/generate, GET /reports/:id | 聚合健康记录+自评+指标+用药生成 dataJson + summary |
| **Upload** | POST /upload/avatar, POST /upload | multer 内存存储 + fs 落盘到 public/uploads/<subdir>/<uid>/，大小/类型校验 |

## 数据模型新增
- `Knowledge`、`HealthReport` 模型（含 Family/FamilyMember 反向关系）
- `MetricThreshold.metricType` 改为 `@unique`（支持按类型 upsert）

## 前端对接
- `zhiyi-assistant-prototype.html` 已对接全部新端点（频率枚举、trend `type=` 参数、snake_case metricType 均与后端对齐）
- `public/test.html` API 测试面板新增 6 个模块侧栏 + 端点卡片 + 文件上传卡片；修复登录 token 取值路径 bug

## 验证结果
- `npm run build` 干净通过；`prisma db push` 已创建 knowledge / health_reports 表 + 唯一约束
- 本地独立运行 `node dist/main`（仅依赖 TiDB Cloud，CacheService 为内存实现），端到端 E2E **27 项全部通过，0 失败**
- 修复：`medications/today` 因 adherence where 缺 `scheduledAt` 包装导致 500（已修）

## 关键约定（供后续开发参考）
- memberId 来源：登录响应无 families/members，需 `GET /v1/families` → `GET /v1/families/:fid/members`
- Metric trend 查询参数 `type=`（非 metricType）；batch body 用 `metrics:[...]`；阈值更新字段 `minNormal/maxNormal/alertConsecutiveCount`
- Dockerfile 用 `npm ci`，禁止新增 npm 依赖；Upload 用 `declare module 'multer'` shim 绕过缺失 @types
- 重启前务必释放 3000 端口（`netstat -ano | grep :3000` → `taskkill /F /PID`）
