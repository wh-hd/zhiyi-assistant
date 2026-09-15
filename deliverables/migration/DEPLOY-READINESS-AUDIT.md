# 智医助手 · 部署就绪度审计（Deployment Readiness Audit）

> 版本：v1.0.0
> 日期：2026-07-19
> 审计人：郝交付（交付总监）
> 依据：实际文件核查（`nestjs/public/`、`deliverables/frontend/`、`docker-compose.yml`、`WEB-PWA-PLAN.md`、共享内存池已知问题）
> 结论：**当前距生产部署仍有 5 项 P0 硬阻塞 + 6 项 P1 应有项 + 2 项 P2 可选**。其中「前端部署副本未同步」是最隐蔽、最致命的坑，会直接导致上线即故障。

---

## 0. 结论速览

| 分级 | 数量 | 含义 |
|------|------|------|
| **P0 硬阻塞** | 2（P0-1/P0-2/P0-4 已解决；剩余 P0-3 生产环境、P0-5 TiDB 白名单属私有化自访可接受/手动项） | 不解决则上线即故障 / 数据丢失 / 无法启动 |
| **P1 上线前应有** | 6 | 强烈建议首发前解决，否则合规或核心体验缺位 |
| **P2 可选增强** | 2 | 不阻塞首版，后续迭代 |
| **P3 噪声** | 6 | 非缺陷，仅代码整洁度，可并行顺手清理 |

> 好消息：原 `WEB-PWA-PLAN.md` 预设的「前端独立 CDN 托管」已被现状简化——前端已随 NestJS `/public` 同源托管（`runtime-config.js` 的 `apiBaseUrl: '/v1'`），**单容器 + Nginx HTTPS 反代即可上线**，无需单独的对象存储/CDN。

---

## 1. P0 硬阻塞（上线前必须清零）

### P0-1 ⛔ 前端部署副本不同步（最致命）
- **证据**：
  - 源文件 `deliverables/frontend/zhiyi-assistant-prototype.js` 已含账号密码方案：`ensureAuthenticated()`（L2870）、`localStorage` 持久化（L2101/2107/2118）、`API.register`/`loginWithPassword`（L2420/2925/2945），`ensureMemberContext` 走 `ensureAuthenticated()`（L1846）。
  - 部署副本 `deliverables/backend/nestjs/public/zhiyi-assistant-prototype.js` 仍是旧版：L2848 仍 `API.smartLogin()`，grep **无任何** `ensureAuthenticated`/`localStorage`/`API.register`/`loginWithPassword`，且行号结构比源文件旧约 1000 行。
  - `prototype.html`（public）脚本引用 `./zhiyi-assistant-prototype.js?v=2026071229`，记中的 `?v=2026071323` 缓存破坏参数**未落到磁盘**。
- **影响**：容器 build 上下文是 `./nestjs`，实际跑 `public/` 旧版 → 上线后：① 无注册/登录界面；② 仍走 `smartLogin()`→`/auth/wechat-login` 401 → `syncFromBackend` 降级离线，全站只读空壳。
- **动作**：
  1. 将 `deliverables/frontend/` 下最新前端（`.html`/`.css`/`.js`/`runtime-config.js`）完整同步到 `deliverables/backend/nestjs/public/`；
  2. 统一 `public/prototype.html` 入口，bump 脚本版本号（如 `?v=2026071901`）强制用户拉新版；
  3. 部署副本 `runtime-config.js` 设 `environment:'production'`、`allowDevIdentity:false`（见 P0-3）。

> ✅ **已解决（2026-07-19，私有化部署语境）**：实际合并方式与原始动作不同——两份前端是**分叉演进**（`frontend/` 是 7-13 账号密码修复版、缺 6 个新页面；`public/` 是 7-12 功能全版、含 6 新屏但无账号密码）。故以 `public/.js`（功能全）为基底，将 `frontend/.js` 的账号密码逻辑（`ensureAuthenticated`/`showAuthOverlay`/`localStorage` 三件套/`API.register`/`API.loginWithPassword`）合并进 `public/.js`，并把两处 `API.smartLogin()` 调用（咨询模块 + `syncFromBackend` Step1）改为 `ensureAuthenticated()`；`prototype.html` 脚本版本号 bump 至 `?v=2026071901`。`node --check` 通过，grep 确认旧调用零残留。HTML/CSS/`runtime-config.js`(`/v1` 同源) 保留 `public/` 版。

### P0-2 ✅ M3 健康档案 TEXT 迁移（已自动化解决）
- **现状**：schema 中 `health_records` 五字段与 `knowledge.tags` 均为 `@db.Text`（仅 `tags` 曾残留 `VARCHAR(4000)`，已改）。因历史损坏迁移 `202607100002_release_hardening`，`prisma migrate dev` 不可用。
- **解决方式**：API 容器入口脚本 `docker-entrypoint.sh` 改为以 `prisma db push --accept-data-loss`（带 30 次重试）作为唯一事实来源，每次启动自动把库结构对齐为 TEXT。**超长病史/过敏写入不再 500，无需手动跑 SQL**。`nestjs/prisma/M3-text-migration.sql` 保留作离线兜底。
- **影响**：消除了之前"需手动连库执行 ALTER"的摩擦，属于私有化自访的代码层已闭环项。

### P0-3 ⛔ 生产环境变量未配置/未收紧
- **证据**（`docker-compose.yml` api 服务）：`ALLOW_DEV_IDENTITY: "true"`、`UPLOAD_ENABLED: "false"`、`CORS_ORIGINS: ${CORS_ORIGINS:?required}`、`NODE_ENV: ${NODE_ENV:?required}`、`JWT_ACCESS_SECRET/JWT_REFRESH_SECRET`（测试期复用临时密钥）、`SECURITY_ALERT_CHANNEL: ${SECURITY_ALERT_CHANNEL:?required}`。
- **影响**：开发身份未关 → 任何人可伪造身份；JWT 弱密钥 → 可被破解；CORS 未填真实源 → 跨域被拦；NODE_ENV 非 production → 泄露堆栈/关闭生产优化。
- **动作**：准备独立生产 `.env`：`NODE_ENV=production`、`ALLOW_DEV_IDENTITY=false`、≥64 字符随机 JWT 密钥、`CORS_ORIGINS` 填前端实际源（同源单容器场景可留空/同源）、`SECURITY_ALERT_WEBHOOK_URL` 配齐；`UPLOAD_ENABLED` 视是否启用头像上传决定。

### P0-4 ✅ Ollama GPU 依赖（已自动化解决）
- **解决方式**：GPU 不再硬编码在基础 `docker-compose.yml`。基础 ollama 默认 CPU 运行（任何机器都能 `up`）；新建 `docker-compose.gpu.yml` 仅放 GPU 预留。启动器（`start_server.bat` / `start-zhiyi.sh`）自动探测 `nvidia-smi`——有 GPU 就自动合并 gpu 覆盖文件把 GPU 透传进容器，无则自动 CPU。**无需手动改配置**。
- **注意**：容器实际用上 GPU 仍需宿主机装 NVIDIA 驱动 + nvidia-container-toolkit；NEXUS-Medical 1.5B 模型质量偏弱属模型选型问题，非部署阻塞。

### P0-5 ⛔ TiDB Cloud 数据库白名单
- **证据**：当前本地开发机可连 TiDB Cloud；云端服务器出口 IP 未加白。
- **影响**：上线后 Nest 容器无法连库，全站 500。
- **动作**：在 TiDB Cloud 控制台将生产服务器出口 IP 加入 IP 访问名单（或改用 VPC 对等/私有端点）。

---

## 2. P1 上线前应有（强烈建议首发前解决）

| # | 项 | 现状 | 动作 |
|---|----|------|------|
| P1-1 | 域名 + ICP 备案 | 未启动（最长周期） | **立即注册域名并提交备案**（Web 路线仅需 ICP，无需医疗类目许可——转 Web 的核心收益）。可与 P0 并行 |
| P1-2 | HTTPS 终止 | 无反代 | Nginx/Caddy 反代容器 3000 + 免费 TLS 证书；Helmet `connect-src` 收紧为真实源 |
| P1-3 | 隐私政策页 + 非诊疗免责声明 | 红线引擎有逻辑，前端无独立页面出口 | 新增 `/privacy` 与免责声明页（个保法要求，自管无审核员卡） |
| P1-4 | 通知 channel 替换（U6） | 仍 `wechat_subscribe`（mock） | 改为 `in_app` + 邮件兜底；Web Push 用 VAPID（iOS 弱，邮件兜底） |
| P1-5 | PDF 报告生成（U3） | `pdfUrl` 恒 null | 配 `PDF_FONT_PATH`（中文），接通报告生成；否则首版下线报告入口 |
| P1-6 | AI 用药识别/体检 OCR（U7） | 生产 `UPLOAD_ENABLED=false` 禁用 | 启用上传 + 接视觉模型，或首版明确不在范围内 |

---

## 3. P2 可选增强（不阻塞首版）

- **P2-1 PWA 三件套缺失**：`manifest.json` + `sw.js` + Service Worker 注册（F5）**文件完全不存在**（已 Glob 确认）。影响「添加到主屏幕」与离线壳。响应式 Web 站本身可用，可首版后补。
- **P2-2 CSP 收紧**：当前 `connect-src https:` 过宽（实测为兼容放开），生产可收窄到具体 API 域名。

---

## 4. P3 噪声（非缺陷，可顺手清理）
- B11 ollama 0 token 误判 undefined；FH5 `sendChat` 无 maxLength；Q6 keep-alive 拼写；N1 11/15 领域事件无订阅者（仅日志噪声）；N3 `knowledge.getById` 未校验 isPublished；N5 `CurrentUser()` 装饰器死代码。

---

## 5. 建议执行顺序（交付总监拍板）

1. **立即（同日）**：启动域名注册 + ICP 备案（最长周期，并行）；拍板 Ollama GPU vs API 网关（P0-4）。
2. **本周阻塞清零**：P0-1 同步前端副本 + bump 版本；P0-2 执行 TEXT 迁移；P0-3 生产 .env；P0-5 TiDB 白名单。
3. **发布前**：P1-2 HTTPS 反代；P1-3 隐私/免责页；P1-4 通知兜底；P1-5/P1-6 决定首发范围。
4. **首版后迭代**：P2-1 PWA 化；P2-2 CSP 收窄；P3 清理。

---

## 6. 决策日志
- [2026-07-19] Phase 审计 - 发现前端部署副本（public/）与源（frontend/）不同步，旧版含 wechat-login 降级 bug - 原因：历史改动只在 frontend/ 落盘，未同步到 Nest build 上下文 - 影响：若直接 docker build 上线即故障，P0-1 必须先行
- [2026-07-19] Phase 审计 - 确认 runtime-config.js apiBaseUrl 已为同源 '/v1' - 部署拓扑可简化为单容器 + Nginx 反代，无需独立前端 CDN - 影响：降低部署复杂度，但生产须置 environment:production / allowDevIdentity:false
