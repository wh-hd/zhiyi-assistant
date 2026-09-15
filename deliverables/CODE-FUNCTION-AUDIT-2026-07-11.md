# 智医助手 — 代码功能测试与完整性审计（2026-07-11）

> 审计人：郝交付（交付总监，独立复核，未采信旧报告结论）
> 方法：构建验证 + jest 单测实跑 + 全模块源码 file:line 复核；未运行的 e2e 已说明原因
> 结论：**无 P0 阻塞；6 项历史 P1 已全部真实落地；仍存在 P1 级「生产不可用/部署阻塞」4~5 项 + P2 缺陷 6 项 + P3 打磨项一批 + 测试门禁失修**

---

## 一、测试执行结果（客观证据）

| 项 | 命令/范围 | 结果 |
|---|---|---|
| 后端编译 | `npx nest build` | ✅ **EXIT 0**，零错误 |
| 单元测试 | `npx jest --config test/jest-security.json` | ⚠️ **27 用例：22 通过 / 5 失败**（auth-security、refresh-token-cleanup 两 suite 红） |
| 真·E2E | `python e2e_extended.py`（BASE=localhost:3000/v1） | ⛔ 未运行——依赖 TiDB Cloud + Redis + Ollama + 真实服务，沙箱不可达 |

**jest 失败根因（非生产缺陷，属测试门禁失修）**：
- `auth-security.spec.ts`：`AuthService.refreshToken` 现调用 `configService.getOrThrow(...)`，而测试 mock `config({JWT_SECRET})` 未实现该方法 → `TypeError`（误报为 UnauthorizedException 失败）。真实 `ConfigService` 具备 `getOrThrow`，生产路径正常。
- `refresh-token-cleanup.spec.ts`：断言 `findMany` 调用 3 次，实现实际 2 次（批量清理边界差异）→ 断言漂移。
- 需补 mock（加 `getOrThrow`）+ 修正批次数断言，恢复 CI 门禁。

---

## 二、已确认完成的功能（历史 6 项 P1 全部真实落地，附证据）

| 编号 | 功能 | 证据（当前源码） |
|---|---|---|
| M3 | 长文本字段 `VarChar(4000)`→`@db.Text` | `prisma/schema.prisma:152-156` 5 字段均 `@db.Text` ✅ |
| U4 | 手术史/家族史/疫苗可写 | `health-record.service.ts:152/175/198` 三方法 + `controller.ts:62/72/82` 三 PATCH ✅ |
| U3 | PDF 真实生成 | `report.service.ts:6` 引 pdfkit；`:134` `generatePdf`；`:139` JSON 降级；`:270` `applyCjkFont` ✅ |
| U6 | 微信投递 worker | `notification.service.ts:135 deliverPendingWechat`、`:159 deliverOne`、`:202 sendWechatSubscribe` + scheduler cron ✅ |
| U7 | AI 识别/OCR 端点 | `ai.controller.ts:65 recognize-medication`、`:98 analyze-report`、`:150 isMultimodalSupported` 降级 ✅ |
| U5 | 前端自评接通后端 | `zhiyi-assistant-prototype.js:293/340/344/453` `assessBackendMode` + `API.startAssessment` 真实调用 ✅ |

> 注：审计报告（CODE-AUDIT-REPORT-2026-07-11.md）写于修复前，仍将以上列为「仍存在」；FIX-SUMMARY 属实，已逐项复核确认。

---

## 三、仍需完善 / 优化的真实缺口（已逐条 file:line 核实）

### P1 级 — 功能声明了但生产仍不可用 / 上线阻塞
1. **M3 迁移未执行**：`schema.prisma` 已改 `@db.Text`，但 DB 未 `prisma migrate dev`。上线前必须执行迁移，否则线上表仍是 `VarChar(4000)`，长病史/过敏 JSON 写入 500 或静默截断。**部署阻塞项。**
2. **U3 PDF 中文渲染**：`applyCjkFont` 仅 `warn` + TODO，未挂 CJK 字体时中文空白；生产需 `PDF_FONT_PATH`。
3. **U6 微信真实下发**：`sendWechatSubscribe()` 仅 mock（打日志），需小程序订阅模板 + 用户授权 + `access_token` 才真发；当前通知仅落 in_app。
4. **U7 多模态识别**：图片 OCR/用药识别现为降级响应（`status:'unavailable'`），需接视觉/多模态模型 + `LLM_MULTIMODAL_ENABLED=true`。
5. **LLM 模型能力**：NEXUS-Medical 1.5B 过小，复杂 prompt 易输出占位符（如 `{response}`）；建议换 7B+ 或在 MVP 明确降级公告。

### P2 级 — 质量/健壮性（真实代码缺陷）
1. **B3** `Math.min(...values)/Math.max(...values)` 大数组展开 → `RangeError`（`metric.service.ts:145-146`、`report.service.ts:181-182`）。改 `reduce` 求值。
2. **B5** 缓存 `useClones:false` 返回共享引用（`cache.service.ts:18,42`）→ 调用方改对象污染全局缓存（`health-record.service.ts:34` 等直接返回）。`getOrSet` 返回前深拷贝或约定只读。
3. **Q3** 全局 `ValidationPipe` `enableImplicitConversion:true`（`main.ts`）隐式转换掩盖 DTO 类型错误。改 `false` + 显式 `@Type()`。
4. **Q7/U9** `user.controller.ts:9` 用原生 `AuthGuard('jwt')`，其余 12 个控制器统一 `JwtAuthGuard` → 后续加 public 路由时 `isPublic` 元数据失效。改 `JwtAuthGuard`。
5. **Q8** `consultation.dto.ts:43 satisfaction:number` 无 `@Min(1)@Max(5)`；`metric.dto.ts:34/73 inputMethod?:string` 无 `@IsIn(['manual','device','ocr'])` → 越界/非法值入库（其他 DTO 均已加 `@IsIn`）。
6. **L5** 儿童高热 `high_fever_child` 规则需「发烧」AND「孩子/宝宝/儿童/婴儿」组合词才 `immediate`，单说「发烧 39 度」仅 `urgent` → 紧急就医被降级（安全关键逻辑缺口）。按年龄 `ageMax:12` 单独触发或放宽组合词。

### P3 级 — 打磨
- **N3** `knowledge.service.ts:163 getById` 无 `isPublished` 过滤（列表 `:91/:144` 有）→ 未发布文章可经 `/knowledge/:id` 读取。
- **N1** 15 个领域事件中 11 个无 `@OnEvent` 订阅者（静默 no-op，噪声）。
- **N2** 前端 `zhiyi-assistant-prototype.html:10` 引用缺失的 `test_data.js`。
- **N5** `common/decorators/auth.decorator.ts:8 CurrentUser()` 死代码（控制器均用 `@Req()`）。
- **Q1** `event-bus.service.ts:78-81` 未使用的 `on()` 方法（误用会监听器泄漏）。
- **Q6** `consultation.service.ts:68 'Connection':'keep-alive'` 拼写（应为 `keep-alive`）。
- **L-new1** `metric.service.ts:75/99` Serializable 事务无 P2034 重试（auth 有，metric 无）→ 并发写偶发 500。
- **L-new2** `metric.service.ts:205-233 recomputeType` 全量 `findMany` 重算 `abnormalStreak` → 数据量大时写放大。
- **B11** `ollama.provider.ts:147` `0+0||undefined` 把真实 0 token 误报 undefined。
- **测试门禁** jest 5 用例失败（见第一节），需修 mock/断言恢复绿。

### 误报纠正
- 审计报告 Q5 称红线引擎 `severity:'immediate'` 拼写错误 —— **不存在**。`red-line-engine.ts` 全文及单测断言均一致使用正确拼写 `immediate`，系审计报告笔误。无需修。

---

## 四、优化路线图建议

| 优先级 | 动作 | 说明 |
|---|---|---|
| 上线前阻塞 | 执行 M3 迁移 + 配 `PDF_FONT_PATH` | 否则长文本 500 / PDF 中文空白 |
| 上线前 | WeChat / OCR 真实通道 or MVP 降级公告 | 两项现 mock，需在 PRD 明确「开发中」 |
| 本周 | 修 B3 / B5 / Q8 / Q7 / L5 | 真实缺陷，影响健壮性/安全/数据校验 |
| 本周 | 修 jest 失败用例，恢复 CI 门禁 | 测试套件不绿降低发布信心 |
| 下周 | P3 打磨（N1/N2/N3/N5/Q1/Q6/L-new1/L-new2/B11） | 质量债清理 |
| 评估 | LLM 升级 7B+ | 解决占位符输出，提升咨询质量 |

---

*本报告所有结论基于 2026-07-11 实际执行的 `nest build` + `jest` 结果与逐 file:line 源码复核，未采信旧报告或工作记忆结论。*
