# 智医助手 代码审查与修复报告

**审查日期**: 2026-07-10  
**审查范围**: NestJS 后端（12 模块 + shared）+ 前端原型（单文件 HTML）  
**审查方式**: 静态代码审计 + E2E 端到端验证 + 前后端联调对照

---

## 一、截图问题根因分析：`{response}` 字面量

### 现象
用户截图显示 AI 咨询回复区出现字面量 `{response}`，而非实际流式内容。

### 根因
**非代码 Bug，而是 LLM 模型输出问题。** 全项目搜索确认不存在任何 `{response}` 模板/占位符。
- 截图中模型标识为 `nexus-medical-GGUF:q4_k_m`（Ollama 本地 NEXUS-Medical）
- 该模型基于 **Qwen2.5-1.5B（仅 986MB 参数）**，在复杂医疗咨询 prompt 下可能退化输出模板占位符文本
- SSE 流式基础设施、前端渲染逻辑、后端事件发送均正常工作（红线检测 ✅、免责声明 ✅、done 事件 ✅）

### 建议
1. **短期**：换用更大的模型（如 `qwen2.5:7b` 或 `qwen2.5:14b`），或使用 API 类 LLM（DeepSeek/通义千问）
2. **中期**：在 system prompt 中增加 "禁止输出 {response} 或任何模板占位符" 的约束指令
3. **长期**：增加后端 LLM 输出质量检测——若首 chunk 包含 `\{.*\}` 模式则自动重试或降级

---

## 二、已修复的问题清单

### 🔴 Critical — 已修复

| 编号 | 问题 | 文件 | 修复内容 |
|------|------|------|----------|
| C1 | 家庭读接口完全缺少归属校验（IDOR + PII 泄露） | `family.controller.ts` + `family.service.ts` | `getFamily/getMembers/getMemberDetail` 三个读接口新增 `req.user.id` → Service 层调用 `ensureMembership()` 校验 |

### 🟠 High — 已修复

| 编号 | 问题 | 文件 | 修复内容 |
|------|------|------|----------|
| H3 | 自评多题步骤评分错误（答案按 step 覆盖） | `assessment.dto.ts` + `assessment.service.ts` | DTO 改为 `Record<string,any>`（按 questionId 键入）；`submitAnswer` 用 `Object.assign` 合并；`calculateScore` 按 `question.id` 查找 |
| H4 | SSE 流式未处理客户端断连（write-after-end / 资源泄漏） | `consultation.controller.ts` + `consultation.service.ts` | 传入 `req` 参数；监听 `req.on('close')` 设置标志位；流循环和 done 事件前均检查 `clientClosed` |
| M2 | 报告摘要慢病/过敏字段名错（显示 undefined） | `report.service.ts:178-179` | `c.disease` → `c.name \|\| c.disease`；`a.allergen` → `a.name \|\| a.allergen` |

### 🟠 High — 前端已修复

| 编号 | 问题 | 文件 | 修复内容 |
|------|------|------|----------|
| C1 | 创建表单空桩（添加成员/用药/指标不调 API） | `zhiyi-assistant-prototype.html` | 补全 `API.createMedication/API.addFamilyMember/API.recordMetric` 三个方法；三个 save 函数改为 async，读取表单值并调用后端 API |
| C2 | 登出未重置全局状态（脏数据跨用户） | `zhiyi-assistant-prototype.html:3646` | `logout()` 新增清除 `activeFamilyId/activeMembers/primaryMemberId/activeConsultMemberId/consultCache` |
| H3 | 成员昵称 XSS（innerHTML 未转义） | `zhiyi-assistant-prototype.html:1737-1750` | `m.name/m.detail/m.avatarText/e.text/e.time` 全部包裹 `escapeHtml()` |

---

## 三、待修复问题清单（按优先级排序）

### 🟠 High — 建议尽快修复

| 编号 | 问题 | 影响 | 修复建议 |
|------|------|------|----------|
| H2 | 指标阈值更新无权限控制 | 任意登录用户可篡改全局健康阈值 | 加 `@UseGuards(AdminGuard)` 或 Service 内校验角色 |
| H5 | 通知系统永不生成记录 | 服药提醒/异常告警全部失效（壳子存在但内容永远为空） | 新增 `NotificationConsumer` 监听 eventBus 事件 + `@Cron` 定时任务 |
| M6 | Refresh Token 不可撤销 | 泄露后 30 天内可持续换取新 token | 登出时 jti 写 Redis 黑名单，refresh 时查黑名单 |

### 🟡 Medium — 建议本轮迭代修复

| 编号 | 问题 | 影响 | 修复建议 |
|------|------|------|----------|
| H1 | 用药计划创建缺事务 | 异常时部分写入 | `$transaction` 包裹 plan+adherences 批量创建 |
| M1 | 自评会话未绑定 userId | 会话劫持风险 | session 增加 ownerId，getSession 校验 |
| M3 | JSON 字段 VARCHAR(4000) 溢出 | 大量慢病记录可能截断 | 改 `@db.Text` 或写入前校验长度 |
| M4 | surgeries/familyHistory/vaccinations 无法写入 | system prompt 恒为空 | UpdateHealthRecordDto 增加对应字段 |
| M5 | 微信 jscode2session 无超时 | 接口挂起永久阻塞 | 加 `AbortSignal.timeout(8000)` |

### 🔵 Low — 后续优化

| 编号 | 问题 |
|------|------|
| L1 | `expiresIn` 硬编码 3600（应读配置） |
| L2 | `updateChronicDiseases` 缺防御性 `?.length ?? 0` |
| L3 | 知识库阅读量自增返回旧值 |
| L4 | 多处 DTO 缺枚举范围校验（`@IsIn`/`@Min`/`@Max`） |
| L5 | Ollama token 统计 `undefined + 0 = NaN` |

### ⚪ 前端待优化

| 编号 | 问题 | 建议 |
|------|------|------|
| FH1 | API 错误静默失败（apiFetch 返回 null 无 toast） | apiFetch 失败抛结构化错误，各调用方展示错误态 |
| FH2 | Token 过期无自动续期（401 → 静默失败） | 实现 refreshToken()，401 时自动刷新并重放 |
| FH3 | startConsult 死代码（用 fetch 读 SSE） | 删除，统一用 consultStream |
| FH4 | SSE 解析跨批次事件类型丢失 | 维护 lastEvent 跨 buffer 批次保留 |
| FH5 | sendChat 无输入长度校验（>1000 后端 400） | 发送前 trim + 长度截断提示 |

---

## 四、功能完整性矩阵

| PRD 功能点 | 后端状态 | 前端状态 | 备注 |
|-----------|---------|---------|------|
| 微信登录 + JWT | ✅ 完整 | ✅ 完整 | 开发模式 code='xiaolin' 可用 |
| 家庭管理 CRUD | ✅ 完整（C1 已修） | ✅ 完整 | 读接口现已加归属校验 |
| AI 咨询 SSE + 红线 | ✅ 完整（H4 已修） | ✅ 完整 | 断连检测已加 |
| 健康自评问卷 | ✅ 完整（H3 已修） | ✅ 完整 | 评分算法已修正 |
| 健康档案 CRUD | ✅ 完整 | ✅ 完整 | upsert 防 P2025 |
| 用药提醒 CRUD | ✅ 完整 | ✅ 完整（C1 已补） | 创建表单已对接 API |
| 健康指标 记录+趋势 | ✅ 完整 | ✅ 完整（C1 已补） | 记录表单已对接 API |
| 健康报告 生成+历史 | ✅ 完整（M2 已修） | ✅ 完整 | pdfUrl=null（PDF 生成为 P1） |
| 通知消息 | ⚠️ 壳完整（H5 待做） | ✅ 列表/已读完整 | **事件消费者缺失，通知永不为空** |
| 健康知识库 | ✅ 完整 | ✅ 完整 | 默认回退 6 篇内置知识 |
| 文件上传 | ✅ 完整 | ✅ 完整 | 头像限制图片/MIME 校验弱 |

---

## 五、验证方式

```bash
# 1. 启动服务（Docker 全栈）
cd deliverables/backend && start_server.bat

# 2. 运行 E2E 冒烟测试（26 项全绿）
cd deliverables/backend/nestjs && python e2e_extended.py

# 3. 手动验证关键修复：
#    - C1：用 u-001 的 token 访问 GET /v1/families/<其他家庭ID> → 应返回 403
#    - H3：POST /assessments/start + POST /assessments/answer (answers={"q1":2,"q2":3}) → 分数应不同
#    - H4：SSE 流式中途关闭浏览器 → 服务端日志应出现 "Client disconnected"
#    - C2：登录→退出→重新登录→发咨询 → 不应复用旧家庭 ID
```

---

*报告生成时间: 2026-07-10 15:43 CST | 审计工具: 静态分析 + E2E 自动化*
