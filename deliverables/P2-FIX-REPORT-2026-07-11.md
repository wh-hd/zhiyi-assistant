# P2 缺陷修复 + 测试门禁恢复报告（2026-07-11）

> 流程：先修 M3 迁移 + jest 测试门禁（恢复 CI 信心）→ 再清 P2 六个真实缺陷

## 门禁结果（客观证据）

| 检查项 | 命令 | 结果 |
|--------|------|------|
| 类型编译 | `npx nest build` | EXIT 0，零错误 |
| 单元测试 | `npx jest --config test/jest-security.json` | 8 suites / **27 tests 全绿**（原 5 失败已清零） |
| 红线引擎 | `npx ts-node src/shared/red-line-engine/red-line-engine.test.ts` | **25/25 全绿**（含 L5 新用例，性能 0.03ms） |
| Schema 校验 | `npx prisma validate` | valid |

## 阶段一：M3 迁移 + jest 门禁

- **M3 迁移**：`schema.prisma:152-156` 五字段已 `@db.Text`；迁移 `20260711000000_fix_long_text_fields/migration.sql` 正确，`prisma validate` 通过。所谓"损坏迁移 `202607100002_release_hardening`" SQL 语法正常，仅 `migrate dev` 需 shadow DB；生产用 `migrate deploy` 按序应用即可，无需改代码。
- **jest 门禁**（前轮已修 + 本轮复核）：
  - `auth-security.spec.ts`：补 `config().getOrThrow` mock + 默认 JWT 密钥。
  - `refresh-token-cleanup.spec.ts`：批次数断言 3→2（`deleteExpiredInBatches` 末批不足即 break）。
  - `auth-security.spec.ts` 微信超时用例：`Promise.race` 对 `Promise.resolve('pending')` 竞态偶发失败 → 改为 `await expect(login).rejects.toBeInstanceOf(UnauthorizedException)`。生产 `wechatLogin` 超时确抛 401，非缺陷。

## 阶段二：P2 六个真实缺陷（file:line 实证）

| 缺陷 | 文件 | 修复 |
|------|------|------|
| **B3** 大数组 `Math.min(...values)` RangeError | `metric.service.ts:145-146`、`report.service.ts:181-182` | 改用 `values.reduce((m,v)=>v<m?v:m, values[0])` 安全聚合 |
| **B5** 缓存 `useClones:false` 共享引用污染 | `cache.service.ts` | 保留写入性能，新增 `clone()`（`structuredClone`）在 `getOrSet`/`get` 读取时深拷贝 |
| **Q7** `UserController` 鉴权不统一 | `user.controller.ts:9` | `@UseGuards(AuthGuard('jwt'))` → `JwtAuthGuard`，移除 `@nestjs/passport` 导入 |
| **Q8** DTO 缺校验 | `consultation.dto.ts`（satisfaction）、`metric.dto.ts`（inputMethod×2） | satisfaction 加 `@IsInt@Min(1)@Max(5)`；inputMethod 加 `@IsIn(['manual','device','ocr'])`（补 `IsIn` 导入） |
| **L5** 儿童高热须组合词才触发 immediate | `red-line-engine.ts` evaluateRule | `age ≤ ageMax(12)` 即视为已具儿童上下文，组合词可省略；新增 Test 5c |
| **Q3** 全局 `enableImplicitConversion:true` | `main.ts:76` | 改为 `false`（防类型混淆）；已验证所有 @Query 数值 DTO 含 `@Type`，consultation 仍 `+page` 兜底，无回归 |

## 当前质量基线

- P0 / P1（6 项）/ P2（6 项）**全部清零**。
- 仅余 P3 打磨项：B11 / FH5 / Q6 / N1 / N2 / N3 / N5。
- 已知降级（非缺陷）：PDF 中文需 `PDF_FONT_PATH`；微信订阅推送 / AI-OCR 为 mock 实现；LLM 1.5B 过小（建议换 7B+）。
