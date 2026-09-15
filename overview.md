# 智医助手 2026-07-19 修复摘要

## 修复内容
- **修复"退出登录"按钮无响应**：
  - 根因：`deliverables/backend/nestjs/public/zhiyi-assistant-prototype.js` 的"我的"页渲染退出登录按钮时使用了 `data-handler="logout()"`，但项目内没有代码解析该属性，导致点击无反应。
  - 修复：改为与其他按钮一致的 `onclick="logout()"` 内联事件。
- **退出后自动回到登录/注册界面**：
  - `logout()` 函数在清除 token 后增加 `setTimeout(..., 800); window.location.reload()`；刷新后因 token 已清，`ensureAuthenticated()` 自动弹出登录/注册浮层，露出邮箱注册入口。
- **修复 `toggleTask` 未定义**：
  - 事件委托白名单 `allowed` 对象中误写 `toggleTask: toggleTask`（函数不存在），已改为 `toggleTaskDone: toggleTaskDone`。
- **防止浏览器旧 HTML/JS 缓存**：
  - `prototype.html` 的脚本版本号由 `v=2026071229` 提升到 `v=2026071922`。
  - 后端 `main.ts` 对 `public` 目录静态资源加 `Cache-Control`：HTML 文件 `no-cache, no-store, must-revalidate`；JS/CSS 长期缓存并通过 `?v=` 版本号失效。避免再出现"HTML 入口缓存导致引用旧 JS"的情况。
- **修复 M3 `Knowledge.tags` TEXT 默认值导致 API 无法启动**：
  - 根因：`tags` 字段设为 `@db.Text` 但保留 `@default("[]")`，TiDB/MySQL 不允许 TEXT 列有默认值，`prisma db push` 无限失败，API 容器 unhealthy。
  - 修复：`prisma/schema.prisma` 中 `tags` 改为 `String? @db.Text`（无默认值），并重新 build 容器。服务已成功启动。
- **修复新注册用户首页显示"晓琳"**（上一轮）：
  - 根因：`syncFromBackend` 只拿到 `authUserId`，`transformUser` 因无 `nickname` 回退到硬编码默认值 `'晓琳'`。
  - 修复：
    - 新增全局 `authUser` 变量，在 `ensureAuthenticated`、登录/注册成功时保存真实用户对象。
    - `syncFromBackend` 中主动调用 `API.getMe()` 获取完整用户信息后再 `transformUser`。
    - 默认昵称兜底由 `'晓琳'` 改为 `'用户'`。
    - 清空 token 时同步清空 `authUser`。
  - 重新 build 容器后，`public/.js` 中已无"晓琳"，线上 HTML 版本号 bump 至 `v=2026071923`。
- **修复自评后首页评分回显错误**（当前轮）：
  - 根因：
    - 制式不统一：后端 `lastAssessmentScore` 是 10 分制（8.3），前端直接按 100 分制判断（`score >= 80`），导致 `Math.round(8.3)=8` 被误判为"需关注"，显示为 8 分而非 83 分。
    - 缓存未失效：自评提交后只清除了 `member:*` 缓存，但首页用的是 `family:${familyId}:members` 缓存（2 分钟 TTL），导致回显延迟。
  - 修复：
    - 前端 `transformHome` 中把分数乘以 10 换算为 100 分制（`score100 = Math.round(score * 10)`），再按 >=80/60 判断等级。
    - 后端 `assessment.service.ts` 自评完成时增加 `family:${familyId}:*` 缓存失效。
    - `prototype.html` 版本号 bump 至 `v=2026071925`。
  - 重新 build 容器并验证通过。

## 邮箱注册入口确认
- 登录/注册浮层 (`AUTH_OVERLAY_HTML`) 已包含"登录"和"注册"两个 tab：
  - 注册字段：邮箱（必填）、昵称（可选）、密码（至少 8 位）、确认密码。
  - 提交后调用 `/v1/auth/register` → 后端用 bcrypt 哈希写 `users` 表；邮箱已存在时返回 409。

## 验证结果（已实测）
- `http://localhost:3000/health` → 返回 OK
- 容器内 `public/zhiyi-assistant-prototype.js` 已无"晓琳"字符串
- 线上 HTML 引用版本号为 `v=2026071925`
- 之前已验证：邮箱注册真实落库、重复邮箱返回 409
- 本次验证：自评后首页评分换算为 100 分制并立即刷新缓存

## 现在即可使用
1. 浏览器访问 `http://localhost:3000/prototype.html`（普通刷新即可）。
2. 若看到登录/注册浮层，直接点"注册" tab，用新邮箱 + 8 位以上密码注册。
3. 若仍显示已登录首页，点"我的" → "退出登录"，刷新后会出现注册浮层。

## 改动文件
- `deliverables/backend/nestjs/public/zhiyi-assistant-prototype.js`（退出按钮事件、logout 刷新、toggleTask 修复、authUser 真实昵称、首页评分引导与回显换算）
- `deliverables/backend/nestjs/public/prototype.html`（版本号 bump 至 2026071925）
- `deliverables/backend/nestjs/src/main.ts`（静态资源缓存头）
- `deliverables/backend/nestjs/prisma/schema.prisma`（Knowledge.tags 去掉 TEXT 默认值）
- `deliverables/backend/nestjs/src/modules/family/family.service.ts`（成员 healthRecord 增加 lastAssessmentScore 等字段）
- `deliverables/backend/nestjs/src/modules/assessment/assessment.service.ts`（自评完成后失效 family 缓存）
