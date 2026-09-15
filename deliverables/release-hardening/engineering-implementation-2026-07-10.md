# 智医助手发布加固工程实现报告

日期：2026-07-10  
工作区：仓库根  
结论：**IS_PASS: NO**（代码实现已显著推进，但本轮最终命令执行被沙箱权限拒绝，Docker daemon 不可用，不能用历史成功或静态扫描替代发布证据）

## 1. T01–T05 状态

| 批次 | 状态 | 已完成 | 未完成/阻塞 |
|---|---|---|---|
| T01 基础设施与安全配置 | 基本完成 | zod 集中校验；access/refresh secret 分离、强度及不相等校验；显式 boolean 字符串解析；生产禁用开发身份/上传；Compose 内部服务及 API 端口默认收口；entrypoint 仅 `prisma migrate deploy` 后启动；严格后端 CSP | Docker daemon 未运行，Compose/image 未实测 |
| T02 Prisma baseline/hardening | 代码完成，实库待验 | 14 模型空库 baseline；保留既有 `202607100001` checksum；baseline 已移除由孤立迁移创建的 `refresh_tokens_expiresAt_idx`，避免重复索引；hardening migration 增加 Decimal、持久自评会话、家庭排序 unique、用药复合 unique、通知幂等键/发送状态、角色审计表；预检和空库验证脚本 | 隔离 MySQL 未启动，未取得 migrate deploy/二次 deploy/drift 实库证据 |
| T03 后端业务加固 | 主要实现完成 | 集中 FamilyPolicyService；普通 member/caregiver 只可写本人；家庭创建 HealthRecord；成员/档案/计数事务；最后 admin 检查、角色更新、审计置于 Serializable 事务；自评改数据库持久 session、严格逐步答题、Decimal(4,1)、完成与档案快照同事务、幂等 start；用药复合 upsert/按日物化；指标按 `recordedAt ASC,id ASC` 全序重算且与单/批写同事务；通知唯一业务键原子 upsert，`deliveryStatus` 与 `readAt` 分离；SSE signal/reader cancel/generator return；认证 3 个根因修复；部分 Query DTO 接入 | 未完成所有 Controller Query DTO 全量清点；家庭 P2034 有限重试尚未加入；Asia/Shanghai 用药日界实库验证未完成 |
| T04 前端安全拆分 | 主要实现完成，运行证据待补 | 完整源重新机械外置 HTML/CSS/JS；严格 CSP；静态扫描无内联 on*/style/script、无 unsafe-inline/eval、无 dev-token/xiaolin；用药动态文本转义；API 错误不再吞掉；refresh promise 单飞、401 仅一次重放、logout 撤销；生产无开发身份回退；SSE 任意 chunk 分帧、JSON 错误上报、cancel/AbortController | 自评 UI 仍主要使用静态题目流程，尚未完整切换为 start/answer/result 状态机；浏览器 Playwright 未取得运行证据；生成脚本只固化部分后续手工 JS 加固，重新生成前需审查差异 |
| T05 测试与回归矩阵 | 部分完成 | Jest 29/ts-jest 29 配置，0 tests 不允许通过；security/e2e 配置；隔离 MySQL Compose；Playwright 配置；新增 RBAC、环境配置、通知幂等、持久会话测试；静态 CSP/secret/skip 扫描入口 | 本轮 npm/Prisma/build/Jest 命令被沙箱权限明确拒绝，不能重试；Docker daemon 和 Playwright 浏览器状态未验证；未形成 3 Critical/13 High 全部动态通过证据 |

## 2. 本次新增/修改文件

### 基础设施/配置
- `deliverables/backend/docker-compose.yml`
- `deliverables/backend/docker-compose.dev.yml`
- `deliverables/backend/.env.example`
- `deliverables/backend/nestjs/.env.example`
- `deliverables/backend/nestjs/.gitignore`
- `deliverables/backend/nestjs/Dockerfile`
- `deliverables/backend/nestjs/docker-entrypoint.sh`
- `deliverables/backend/nestjs/package.json`
- `deliverables/backend/nestjs/package-lock.json`
- `deliverables/backend/nestjs/jest.config.ts`
- `deliverables/backend/nestjs/test/jest-e2e.json`
- `deliverables/backend/nestjs/test/docker-compose.test.yml`

### Prisma/数据库
- `deliverables/backend/nestjs/prisma/schema.prisma`
- `deliverables/backend/nestjs/prisma/migrations/202607100000_baseline/migration.sql`
- `deliverables/backend/nestjs/prisma/migrations/202607100002_release_hardening/migration.sql`
- `deliverables/backend/nestjs/scripts/db/preflight-existing.ts`
- `deliverables/backend/nestjs/scripts/db/verify-empty-baseline.ts`

### 后端
- `src/config/env.types.ts`
- `src/config/env.validation.ts`
- `src/app.module.ts`
- `src/main.ts`
- `src/common/policies/family-policy.types.ts`
- `src/common/policies/family-policy.service.ts`
- `src/common/policies/family-policy.module.ts`
- `src/common/dto/query.dto.ts`
- `src/common/filters/global-exception.filter.ts`
- `src/modules/family/family.service.ts`
- `src/modules/family/dto/add-member.dto.ts`
- `src/modules/assessment/assessment.service.ts`
- `src/modules/assessment/assessment.controller.ts`
- `src/modules/assessment/dto/assessment.dto.ts`
- `src/modules/medication/medication.service.ts`
- `src/modules/metric/metric.service.ts`
- `src/modules/metric/metric.controller.ts`
- `src/modules/metric/dto/metric.dto.ts`
- `src/modules/health-record/health-record.service.ts`
- `src/modules/notification/notification.service.ts`
- `src/modules/notification/notification.consumer.ts`
- `src/modules/notification/notification-scheduler.service.ts`
- `src/modules/notification/notification.controller.ts`
- `src/modules/notification/dto/create-notification.dto.ts`
- `src/modules/auth/auth.module.ts`
- `src/modules/auth/auth.service.ts`
- `src/modules/auth/strategies/jwt.strategy.ts`
- `src/modules/auth/refresh-token-cleanup.scheduler.ts`
- `src/modules/upload/upload-availability.guard.ts`
- `src/modules/upload/upload.controller.ts`
- `src/modules/upload/upload.module.ts`
- `src/modules/consultation/consultation.service.ts`
- `src/shared/llm-gateway/interfaces.ts`
- `src/shared/llm-gateway/llm-gateway.service.ts`
- `src/shared/llm-gateway/ollama.provider.ts`

### 前端
- `deliverables/frontend/harden-prototype.py`
- `deliverables/frontend/zhiyi-assistant-prototype.html`
- `deliverables/frontend/zhiyi-assistant-prototype.css`
- `deliverables/frontend/zhiyi-assistant-prototype.js`
- `deliverables/frontend/runtime-config.js`
- `deliverables/frontend/playwright.config.js`
- `deliverables/frontend/tests/xss-csp.spec.js`
- `deliverables/frontend/tests/sse-auth.spec.js`

### 测试
- `test/e2e/release-hardening.e2e-spec.ts`
- `test/security-hardening/family-rbac.spec.ts`
- `test/security-hardening/env-validation.spec.ts`
- `test/security-hardening/notification-idempotency.spec.ts`
- `test/security-hardening/assessment-session-owner.spec.ts`
- `test/security-hardening/medication-transaction.spec.ts`
- `test/security-hardening/auth-security.spec.ts`

## 3. 实际命令结果

### 已取得的历史同工作区证据（中断前）
- `npm install`：退出码 0，npm audit 报告 0 vulnerabilities；safe-delete shim 阻止清理若干临时目录。
- `prisma validate`：使用虚构本机 URL，PASS。
- `prisma generate`：旧 client 目录改名为 `client-pre-hardening` 后退出码 0。
- `npm run build`：一次退出码 0；该成功发生在本次后续改动之前，**不作为当前 HEAD 通过证据**。
- 隔离 MySQL Compose：失败，Docker Desktop Linux daemon 未运行。

### 本轮
- 计划命令：`npm --prefix ... run prisma:generate && ... prisma:validate && ... run build`
- 结果：沙箱执行被用户明确拒绝，退出码 1。按工具约束未重试等价命令。
- 前端**产物属性**限定静态扫描（HTML/CSS）：无 `unsafe-inline`、`unsafe-eval`、`dev-token`、`xiaolin`、HTML 内联 `on*`、HTML 内联 `<style>`、无 src 的 `<script>`。JS 源码含 HTML 模板字面量中的历史 `onclick/style` 文本；浏览器生成 DOM 后由迁移流程转换为 `data-handler`，但仍需 Playwright DOM 扫描作为最终证据。
- 后端限定扫描：`src` 无 `JWT_SECRET`、`dev-secret`、`accept-data-loss`、`db push`。
- 测试限定扫描：无 `.only` 和 skip。

## 4. QA 精确入口

在 `deliverables/backend/nestjs`：

```bash
npm ci
npm run prisma:generate
DATABASE_URL=mysql://zhiyi:zhiyi_test_password@127.0.0.1:3307/zhiyi_test npm exec prisma validate
npm run build
npm test -- --runInBand
npm run test:security -- --runInBand
npm run test:e2e -- --runInBand
```

隔离数据库：

```bash
docker compose -f test/docker-compose.test.yml up -d --wait
DATABASE_URL=mysql://zhiyi:zhiyi_test_password@127.0.0.1:3307/zhiyi_test npm exec prisma migrate deploy
DATABASE_URL=mysql://zhiyi:zhiyi_test_password@127.0.0.1:3307/zhiyi_test npm run prisma:seed
DATABASE_URL=mysql://zhiyi:zhiyi_test_password@127.0.0.1:3307/zhiyi_test npm exec ts-node scripts/db/verify-empty-baseline.ts
DATABASE_URL=mysql://zhiyi:zhiyi_test_password@127.0.0.1:3307/zhiyi_test npm exec prisma migrate deploy
```

在 `deliverables/frontend`：

```bash
npx playwright test --config playwright.config.js
```

静态扫描目标：`zhiyi-assistant-prototype.html/js/css`，禁止 `unsafe-inline|unsafe-eval|dev-token|xiaolin|on*=|<style>|无 src 的 script`。

## 5. 发布平台阻塞/待办

以下只能由平台/安全负责人完成，代码团队未宣称完成：
1. 轮换、撤销审计中暴露过的数据库、Redis、MinIO、JWT、微信等真实凭据。
2. 检查相关平台访问日志、异常来源和历史制品/镜像泄漏。
3. 注入生产 access/refresh 高熵且不同的 secret、微信配置、安全告警 webhook。
4. 配置真实生产 API runtime-config，而不是提交环境 secret。
5. 启动隔离 Docker daemon 并执行空库迁移证据链。
6. 安装/缓存 Playwright 浏览器并执行 UI 回归。

## 6. 全局一致性审查

### 第一轮发现并修复
- baseline 重复创建孤立迁移负责的 refresh token expiresAt 索引：已从 baseline 删除。
- Zod `z.coerce.boolean()` 会把字符串 `false` 当真值：改为显式字符串解析。
- Assessment 内存 Map、Int、非事务：改数据库 session、Decimal、严格答案、Serializable 完成事务、幂等 start。
- Notification 将发送和阅读混在 `status`：改 `deliveryStatus` + `readAt`，唯一键 upsert。
- Metric 乱序导致 streak 错误、batch 事务外：改全序全量重算并纳入事务。
- 前端破损半迁移、开发身份 fallback、错误吞掉：恢复完整源外置并实现严格认证/SSE/XSS处理。

### 第二轮发现并修复
- 家庭最后 admin 检查在事务外：移入角色变更/删除的 Serializable 事务。
- HealthRecord/Medication/Metric/Assessment 普通成员可写同家庭他人：写路径接入 FamilyPolicyService。
- 用药初次依从记录仍 create：改复合唯一 upsert。
- 前端 refresh 路由写成 `/auth/refresh`：修正为后端实际 `/auth/refresh-token`。
- 原 security Assessment 测试仍依赖已删除的内存 Map：改为数据库会话 mock。

### 审查结论
- 跨文件接口与主要数据流已对齐到当前 Prisma schema。
- 当前无法取得重新 generate/build/test 的执行证据，且 T04 自评真实状态机、全部 Query DTO、数据库/浏览器动态验证仍有缺口。
- 补充静态复核发现 JS 源码仍含历史 HTML 模板 `onclick/style` 字面量；尽管 HTML 产物和迁移后的浏览器 DOM目标为 `data-handler`，在 Playwright DOM 证据前不可声称该项动态通过。
- 因此工程结论必须保持：**IS_PASS: NO**。
- 该结论不等于 QA 发布门禁结果；待 QA 按上述入口取得证据后判定。
