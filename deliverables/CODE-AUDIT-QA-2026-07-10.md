# 智医助手 QA 独立验证报告（2026-07-10）

> 审计角色：QA 工程师（第三阶段）  
> 审计范围：`deliverables/backend/nestjs`、`deliverables/frontend`、前两阶段审计报告  
> 原则：只验证和记录，不修改业务源码；不连接、探测或复述疑似真实数据库及外部服务凭据。Prisma 校验仅使用虚构的 `127.0.0.1` URL。

## 1. 结论摘要

当前代码 **构建和 Prisma Schema 静态校验通过，但发布测试门禁不通过**。两轮复跑均得到：安全测试 19/22 通过、3 个失败；默认 Jest 0 个测试进入执行；声明的 Jest e2e 配置不存在。3 个安全测试失败均由当前源码直接支持，Router 全部为 **Engineer**，不是测试断言错误或本机环境噪声。

QA 还通过构建产物隔离调用和纯离线协议脚本复现了：普通家庭成员提权、自评正常答案得到小数 7.8 而 Prisma 字段为 Int、创建家庭不创建 HealthRecord、SSE 跨 chunk 把 `red_line` 错分为 `message`、用药后端字段未经转义进入 `innerHTML`、NaN/负数查询值直接透传 Service。迁移目录实际覆盖 **14 个 Prisma 模型**（前序报告写 13 个，应修正）中的 0 个建表，仅有 1 条索引 SQL，无法建立空库。

**最终路由：Engineer。** 产品和测试基础设施均有未修复问题，不能判定可发布。

## 2. 两轮测试结果

| 门禁/验证 | Round 1 | Round 2 | Router | 结论 |
|---|---:|---:|---|---|
| `npm run build` | PASS | 未重复（源码未变） | NoOne | Nest/TypeScript 构建退出码 0。 |
| 虚构本机 `DATABASE_URL` + `prisma validate` | PASS | 未重复（Schema 未变） | NoOne | 仅解析 Schema，未连接数据库。 |
| `npm run test:security -- --runInBand` | 19/22 | 19/22 | Engineer | 相同 3 项稳定失败。 |
| `npm test -- --runInBand` | FAIL，0 tests | FAIL，0 tests | Engineer | 无 Jest/ts-jest 根配置；TS 被 Babel 当 JS 解析；`dist` 测试又被重复发现。 |
| `npm run test:e2e -- --runInBand` | FAIL，0 tests | FAIL，0 tests | Engineer | `test/jest-e2e.json` 不存在。 |
| `python -m py_compile e2e_extended.py` | PASS | 不适用 | NoOne | Python 语法可编译。 |
| `python -u e2e_extended.py` | 环境阻塞 | 不重试 | NoOne（环境限制） | `localhost:3000` 无隔离 API；登录和 refresh 检查均 `status=0`，随后脚本按设计退出。未启动服务，避免它读取版本化疑似真实 DB 配置。 |

### 2.1 通过率

- 安全回归：**86.36%（19/22）**；Suite 通过率 60%（3/5）。
- 默认 Jest：**0 个测试被执行**，不可计算业务通过率；7/7 suites 在收集/解析阶段失败。
- Jest e2e：**0 个测试被执行**，配置解析即失败。
- 构建与静态 Schema 门禁：2/2 通过。
- 高风险隔离证据：6/6 成功复现源码缺陷。

## 3. Security 三个失败逐项路由

### S-01 开发环境缺失与占位混合凭证仍启用开发身份

- 失败测试：`auth-security.spec.ts` 的“开发环境缺失与占位混合凭证拒绝开发身份”。
- 期望：`WX_APP_ID=''`、`WX_APP_SECRET='your_wx_secret'` 时拒绝，且不读写用户。
- 实际：Promise resolve，返回 access/refresh token 并创建用户。
- 源码证据：`auth.service.ts:53-57` 对两项均调用 `isMissingOrPlaceholder`，空值和占位值都为 true，混合配置满足 fallback；日志明确出现“微信登录使用开发身份模式”。
- 判断：测试符合安全用例名称、源码注释“仅明确的开发占位配置”及 fail-closed 原则。
- **Router: Engineer（源码 Bug）**。建议改为显式开发开关，或严格定义唯一允许组合；混合/部分配置一律拒绝。

### S-02 微信响应体读取不受超时保护

- 失败测试：`auth-security.spec.ts` 的“微信响应体读取仍受配置超时保护”。
- 期望：headers 已返回但 `response.json()` 挂起时，1000ms 后 Unauthorized。
- 实际：`pending`。
- 源码证据：`auth.service.ts:105-119` 的 timer 在 `fetch()` 返回后的 `finally` 清除；`response.json()` 位于 `:122-127`，已不受 AbortController 定时器保护。
- 判断：模拟了合法的流式/慢响应体场景，断言与配置项“请求超时”语义一致。
- **Router: Engineer（源码 Bug）**。建议让计时器覆盖 fetch、状态检查和 body 解析全过程，并统一映射 AbortError。

### S-03 清理竞争时因 `deleteMany.count===0` 提前退出

- 失败测试：`refresh-token-cleanup.spec.ts` 的“竞争实例删掉当前批次后仍继续处理其余过期记录”。
- 期望：首批 50 条已被另一实例删除后继续扫描，最终 `{deleted:1,batches:2}`。
- 实际：`{deleted:0,batches:1}`。
- 源码证据：`refresh-token-cleanup.scheduler.ts:63` 在 `result.count === 0` 时 break。首批是满批但竞争删除为 0，不代表库中没有其他过期记录。
- 判断：这是可复现的并发进度错误；测试 mock 顺序与查询/删除协议一致。
- **Router: Engineer（源码 Bug）**。建议满批竞争为 0 时继续扫描，并加入最大空转/游标策略避免无限循环；多实例任务最好引入租约或单例调度。

## 4. Critical 证据

### C-01 普通成员可将任意成员提升为 admin

- 调用链：`PATCH /families/:familyId/members/:memberId` → `FamilyController.updateMember` → `FamilyService.updateMember` → `ensureMembership` → Prisma `familyMember.update`。
- DTO 允许 `role` 为 admin/caregiver/member；Service 只验证“是成员”，没有调用 `ensureAdmin`。
- 隔离执行构建产物：普通成员 mock 调用 `{role:'admin'}` 后 resolve `{role:'admin'}`，Prisma update 参数为 `where.id='victim', data.role='admin'`。
- **Router: Engineer。** 修复角色策略并补 HTTP/e2e 回归：普通 member 更新自己/他人角色都应 403，admin 合法变更另测最后管理员保护。

### C-02 迁移基线不能创建空库

- `schema.prisma` 实际有 **14 个 model**：User、RefreshToken、Family、FamilyMember、HealthRecord、Assessment、Consultation、MedicationPlan、MedicationAdherence、HealthMetric、MetricThreshold、Notification、Knowledge、HealthReport。
- migrations 仅 1 个目录，SQL 为一条 `CREATE INDEX ... ON refresh_tokens`；离线统计 `CREATE TABLE=0`、`CREATE INDEX=1`。
- 该 SQL 还依赖 `refresh_tokens` 预先存在，所以对真正空库第一步就会失败，更不可能创建 14 模型。未连接任何数据库。
- **Router: Engineer。** 从可信 Schema 生成、审查基线，在一次性本机容器空库验证 deploy/seed/drift。

## 5. High 证据

### H-01 自评小数与 Prisma Int 冲突

- 对构建产物直接调用 `calculateScore`，正常答案 `{q1:1,q2:2,q3:1,q4:2,q5:2,q6:[1,2],q7:2,q8:2}` 得 `totalScore=7.8`，`Number.isInteger=false`。
- `submitAnswer` 将该值原样写 `assessment.totalScore` 与 `healthRecord.lastAssessmentScore`；Schema 两字段均为 `Int?`。
- 因禁止数据库连接，本阶段未触发 Prisma 实库错误；但领域值与持久化契约不一致已动态证明。
- **Router: Engineer。** 明确采用 Decimal/Float 或明确整数化，并补持久化契约测试。

### H-02 新家庭主成员无 HealthRecord，自评又使用 update

- 隔离调用 `FamilyService.create` 捕获 Prisma 参数，`hasHealthRecordCreate=false`，只嵌套创建 member。
- 自评完成后先 `assessment.create`，再 `healthRecord.update({where:{memberId}})`；新家庭若未先触发别处建档，第二步找不到记录，且两步不在事务中。
- **Router: Engineer。** 家庭创建时建档；自评事务内 upsert 快照并做幂等。

### H-03 用药 `innerHTML` 持久化 XSS

- 后端 `medicineName/dosage/dosageUnit/notes` 经同步写入 `D.meds` 和成员详情；`renderMedCard`、`renderMemberDetail` 直接字符串拼接后赋给 `innerHTML`。
- 文件已有 `escapeHtml`，但上述路径未调用。离线 payload `<img src=x onerror=alert(1)>` 与 `<svg onload=alert(2)>` 原样出现在生成 HTML，含可执行事件属性。
- **Router: Engineer。** 动态文本使用 `textContent` 或统一 escape，移除动态内联事件，并以浏览器 DOM 测试恶意字段。

### H-04 SSE parser 跨 chunk 事件错分

- 解析器在每次 `reader.read()` 回调内部重置 `currentEvent='message'`。
- 离线按两个 chunk 输入 `event: red_line\n` 和 `data: {...}\n\n`，实得事件 `message`，而不是 `red_line`。
- **Router: Engineer。** 跨 read 保存事件/数据状态，按完整 SSE frame 分发；补任意边界拆包参数化测试和取消测试。

### H-05 NaN、负数和超大分页/窗口值无边界

- `MetricController` 将 `Number(limit/days)` 直接传 Service；隔离调用证明 `limit='NaN'` 传入 NaN（JSON 显示 null）、`limit='-5'` 传 -5、`days='-30'` 传 -30。
- Assessment/Notification 也直接用一元 `+`/`Number` 转 page/pageSize，无 `IsInt/Min/Max`。
- **Router: Engineer。** 统一 Query DTO；非法值返回 400，并设置合理最大值。

## 6. Medium / Low 与测试盲区

### Medium

- 默认 `npm test` 没有 TS transform/root 配置，还扫描 `dist`；7 个 suite 全在收集阶段失败。**Router: Engineer（测试基础设施缺陷）**。
- `test:e2e` 指向不存在的 `test/jest-e2e.json`。**Router: Engineer（测试基础设施缺陷）**。
- 扩展 E2E 自称“无外部依赖”，但实际硬依赖 `localhost:3000`、种子 ID `u-001/f-001/m-001`、开发登录码、可写数据库及 AI SSE。说明与运行前提不一致。

### Low

- `e2e_extended.py` 语法可编译，但并非可被 pytest/unittest 收集的 26 个独立测试；它是顶层顺序脚本，前置登录失败即 `SystemExit(1)`，后续覆盖全部丢失，统计也会把“跳过”当失败。
- 脚本源中静态可数的是 23 个无条件主断言，另有 3 个条件分支断言，最大路径可显示约 26 项，因此“26 项”是场景日志数，不是独立、隔离、可维护的测试用例数。

### `e2e_extended.py` 当前覆盖盲区

- 不测家庭普通成员提权/横向写权限，也只有一个用户 token。
- 不测自评 start/answer/result、小数持久化、无档案完成和事务回滚。
- 不测 refresh token 正常轮换、重放、logout；只测裸 userId 返回 400。
- 不测 XSS、上传 MIME/magic byte/匿名读取。
- 不测 SSE 任意 chunk 边界、断连取消、headersSent/write-after-close；只读取 `event:` 行，且不校验 data 内容、顺序和 done。
- 不测分页 NaN/负数/超大值、DTO 领域边界。
- 不测用药跨日、有效期、并发 adherence 唯一性。
- 不测指标乱序/并发 streak、双实例 Cron 去重。
- 不测新家庭建档、迁移 deploy、readiness、通知状态机。

## 7. 未验证项与安全边界

- 未连接 TiDB/MySQL，未执行 migrate deploy、字段超长行为、Prisma 小数写 Int 的具体错误文本。
- 未启动 Nest 服务，因为默认配置文件含疑似真实数据库/外部服务信息；没有获得明确隔离环境变量清单和一次性本机数据库。
- 未调用微信、Ollama、MinIO、Redis 或任何外部服务；未验证真实 SSE 资源消耗和 GPU 行为。
- 未做浏览器 DOM 执行，只证明危险标记进入 `innerHTML` sink；实际 CSP/浏览器执行效果待隔离浏览器环境验证。
- 未量化并发重复行/重复通知，只验证源码算法和已有并发 mock 的确定性失败。

## 8. 最终智能路由

| 失败/门禁 | Router | 原因 |
|---|---|---|
| Security 混合微信配置 | Engineer | 源码错误启用开发身份。 |
| Security 微信 body timeout | Engineer | 定时器在 body 读取前被清除。 |
| Security cleanup 竞争 | Engineer | `count===0` 提前退出遗漏后续记录。 |
| 默认 `npm test` | Engineer | Jest/TS 配置缺失且错误扫描 dist；不是环境随机失败。 |
| 声明的 Jest e2e | Engineer | 配置文件缺失。 |
| `e2e_extended.py` 本机未跑完 | NoOne（环境限制） | 安全边界内没有隔离 API/数据库；不可用真实凭据强行启动。脚本本身的结构和覆盖不足另路由 Engineer。 |
| Build / Prisma validate / py_compile | NoOne | 均通过。 |

**总判定：Engineer。** 两轮上限已用尽，3 个安全源码缺陷和测试门禁问题仍在；Critical/High 风险有独立运行证据。QA 没有发现需要通过修改断言来修复的测试 Bug，因此无 `Router=QA` 项。修复后应由工程师提供隔离本机数据库与完整 Jest 配置，再执行下一次回归。
