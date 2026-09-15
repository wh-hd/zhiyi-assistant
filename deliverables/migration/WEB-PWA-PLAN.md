# 智医助手 Web/PWA 部署方案

> 版本：v1.0.0
> 日期：2026-07-13
> 替代文档：`deliverables/migration/MIGRATION-PLAN.md`（小程序迁移路线）
> 决策动机：规避微信小程序医疗健康类目资质与代码审核，保留"原型即 Web"的最大复用优势

---

## 0. 决策与范围

原规划把"前端原型（HTML/CSS/JS 单文件）"重写为微信小程序。经评估，用户核心诉求是**躲开小程序医疗类目资质 + 每版代码审核**。由于原型本身就是 Web，直接把它**托管成 HTTPS 网站 / PWA** 是改动量最小、且手机桌面通吃的路线——EXE 只是它的桌面子集，故不优先。

本方案结论：**终态采用 PWA（渐进式 Web 应用）**，后端 NestJS 几乎不动，前端仅做"换地址 + 补登录 + 加持久化 + PWA 化"四件事。

---

## 1. 当前资产与 Web 兼容性实测（基于真实代码）

下表每一项都来自对 `deliverables/frontend/zhiyi-assistant-prototype.*` 与 `deliverables/backend/nestjs` 的实测 grep，非推测。

| 能力 | 小程序路线下的限制 | 当前原型的**真实实现** | Web/PWA 适配结论 |
|------|-------------------|------------------------|------------------|
| 网络请求基地址 | 需配域名白名单 | `API_BASE` 取自 `runtimeConfig.apiBaseUrl`（`runtime-config.js`），默认 `http://127.0.0.1:3000/v1` | **零代码改动**：改 `runtime-config.js` 一处即可 |
| CSP | — | HTML `<meta CSP>` 写死 `connect-src 'self' http://127.0.0.1:3000` | **小改动**：CSP 增加 HTTPS 域名 |
| AI 流式咨询 | `wx.request` 不支持原生 SSE，需 `enableChunked` | `consultStream()` 用 `fetch` + `ReadableStream`（`prototype.js:2300-2316`） | **零改动**：浏览器原生支持 fetch 流式 |
| 头像上传 | 需 `wx.uploadFile` | `fetch(API_BASE + '/upload/avatar', FormData)`（`prototype.js:2402`） | **零改动**：浏览器原生 fetch 上传 |
| 图标 | 不支持内联 SVG | 未发现 Lucide/CDN 图标依赖（grep `lucide/iconfont/.svg` 均无命中），为内联/Unicode 渲染 | **零改动**：浏览器全支持 |
| 设计令牌 | WXSS 支持 `var()` | CSS 自定义属性（SoftCare 令牌） | **零改动**：浏览器原生 |
| 登录 | 需 `wx.login` | `smartLogin()` 在非小程序环境直接 `reject("生产环境禁止开发身份回退")`（`prototype.js:2247-2261`） | **❌ 需新增 Web 登录分支** |
| Token 持久化 | 需 `wx.setStorageSync` | 仅内存变量（`authToken/refreshToken`），grep 无 `localStorage` | **❌ 需加 localStorage 持久化** |
| 后端登录端点 | 需 `wechat-login` | `auth` 模块仅有 `wechat-login` / `refresh-token` / `logout`，**无 Web 登录端点** | **❌ 后端需新增 Web 登录端点** |
| 订阅消息 | `wx.requestSubscribeMessage` | `notification` 模块 channel 为 `wechat_subscribe`（mock） | **需替换为 Web Push / 邮件 / 站内** |

**结论**：17 个页面 + 3 个 Modal 的业务逻辑、数据流（`window.API`）、阈值判断、设计系统全部可平移；真正要写代码的点只有 **4 个**（地址配置、CSP、登录、Token 持久化），且后端仅新增 1 个登录端点。

---

## 2. 目标技术架构（部署拓扑）

```
┌──────────────────────────────────────────────────────────────┐
│  浏览器 / 手机浏览器 / 桌面 (PWA "添加到主屏幕")                │
│  ┌────────────────────────────────────────────────────────┐  │
│  │ 前端静态资源 (HTML/CSS/JS + manifest.json + sw.js)       │  │
│  │ 源: zhiyi-assistant-prototype.html + .js (零重写)        │  │
│  │ CDN / 对象存储 / CloudBase 静态托管                       │  │
│  └───────────────────────────┬────────────────────────────┘  │
│                               │ HTTPS (CORS 放行前端域名)      │
└───────────────────────────────┼──────────────────────────────┘
                                 ▼
┌──────────────────────────────────────────────────────────────┐
│  NestJS 容器 (CVM / CloudBase / 任意云)                        │
│  /v1 API  +  /health  +  /public/test.html                    │
│  ├─ auth (新增 /auth/login 或 /auth/wechat-mp-login)          │
│  ├─ consultation (SSE: fetch 流式, 原生支持)                  │
│  ├─ family / health-record / assessment / metric / task ...   │
│  └─ 红线引擎 (18 条规则, 本地 <5ms)                            │
└───┬───────────┬────────────┬────────────┬─────────────────────┘
    ▼           ▼            ▼            ▼
 TiDB Cloud  Redis      MinIO(头像)   Ollama (NEXUS-Medical, GPU)
 (MySQL)     (缓存/会话)  (对象存储)   (本地 LLM, 云端需 GPU)
```

关键：**前端与后端完全解耦**。前端是纯静态文件，后端只暴露 `/v1`。这与现有 `docker-compose.yml` 4 服务编排（Redis+MinIO+Ollama+API）天然契合，数据库已是外部 TiDB Cloud。

---

## 3. 前端改造清单（精确到文件/行，工作量极小）

| # | 改动 | 文件 | 说明 | 工作量 |
|---|------|------|------|--------|
| F1 | API 基地址 | `runtime-config.js` | `apiBaseUrl: 'https://api.zhiyi.com/v1'`（改一处，零代码改动） | 5 min |
| F2 | CSP 放行 | `zhiyi-assistant-prototype.html:7` | `connect-src 'self' https://api.zhiyi.com` | 5 min |
| F3 | Web 登录分支 | `zhiyi-assistant-prototype.js:2247` `smartLogin()` | 非小程序环境不再 `reject`，改为调用新增的 Web 登录端点（手机号/账号密码/公众号授权） | 中 |
| F4 | Token 持久化 | `zhiyi-assistant-prototype.js` auth 模块 | 登录成功 `localStorage.setItem('zhiyi_tokens', ...)`；启动时 `restoreTokens()` 读回，替代纯内存变量 | 小 |
| F5 | PWA 化 | 新增 `manifest.json` + `sw.js` | 可"添加到主屏幕"、离线壳缓存静态资源 | 中 |
| F6 | 推送替代 | 通知相关 UI | 订阅消息 UI 改为 Web Push 授权 / 邮件提醒提示 | 小 |

> F3/F4 是仅有的"逻辑改动"，其余均为配置。原型 17 屏的 WXML→浏览器渲染、DOM 操作、SVG/Unicode 图标在浏览器中**原生可用**，无需重写。

---

## 4. 后端改造清单（极轻）

| # | 改动 | 位置 | 说明 |
|---|------|------|------|
| B1 | **新增 Web 登录端点** | `src/modules/auth/` | 新增 `/auth/login`（手机号+验证码 或 账号密码）或 `/auth/wechat-mp-login`（公众号 `code2session` web 版）。当前仅有小程序 `wechat-login`（`auth.controller.ts:12`），Web 不可用 |
| B2 | CORS 配置 | `src/main.ts:66-68` | `CORS_ORIGINS` 环境变量已支持，仅填入前端域名即可，**无需改代码** |
| B3 | 通知 channel | `src/modules/notification/` | `wechat_subscribe` → 增加 `webpush` / `email` / `in_app`；Web Push 用 VAPID 密钥 |
| B4 | 内容安全 | 自选 | 不强制 `msgSecCheck`（无平台审核）；建议保留敏感词过滤（自管，责任在己） |
| B5 | 静态资源 | `src/main.ts:98` | 前端独立托管时后端只管 `/v1`；`/public/test.html` 保留作测试面板 |
| — | **不需要做** | — | `enableChunked` SSE（fetch 流式原生）、`wx.uploadFile`（fetch+FormData 原生）、微信小程序登录改造 |

> 后端 12 个业务模块、Prisma 12 表、红线引擎、SSE 流式、RefreshToken 轮换——全部直连复用，约 **95% 不动**。

---

## 5. 登录方案选型（需拍板）

| 方案 | 实现 | 第三方依赖 | 复杂度 | 是否保留微信身份 |
|------|------|-----------|--------|------------------|
| A 手机号+短信验证码 | `/auth/login` + 短信服务商 | 短信服务商（实名） | 中 | 否 |
| B 账号密码 | `/auth/login` 邮箱/手机+密码 | 无 | **最低** | 否 |
| C 公众号网页授权 | `/auth/wechat-mp-login` + `code2session`(web) | 公众号（认证 300/年） | 中 | **是** |

**建议**：MVP 用 **B（账号密码）** 最快上线、零第三方；想保留微信身份用 **C**；A 体验好但多接一家合规服务商。注意小程序 `wechat-login`（`jscode2session`）是小程序专用，Web 不可用，必须新增端点。

---

## 6. 合规清单（Web 路线 vs 小程序）

| 事项 | Web/PWA 是否需要 | 小程序是否需要 | 说明 |
|------|------------------|----------------|------|
| 域名 ICP 备案 | ✅ 需要 | （含在平台） | 最长周期，立即启动 |
| HTTPS | ✅ 需要 | ✅ 需要 | 免费证书即可 |
| 隐私政策页（个保法） | ✅ 需要 | ✅ 需要 | 自管，无审核员卡 |
| 非诊疗免责声明 | ✅ 建议 | ✅ 建议 | 红线引擎已内置 |
| 医疗健康类目许可证 | ❌ **不需要** | ✅ 强制（个人主体不可做） | **这是转 Web 的核心收益** |
| 每版代码审核 | ❌ **不需要** | ✅ 强制 | 发版自由 |
| `msgSecCheck` 强制 | ❌ 不强制 | ✅ 强制 | 自管敏感词 |
| 服务器域名类目白名单 | ❌ 不需要 | ✅ 需要 | 仅 ICP 备案 |
| 公众号认证（若选 C） | 选 C 时需要 | — | 300/年 |

---

## 7. 部署步骤（具体可落地）

1. **后端上云**：复用现有 `docker-compose.yml`，部署到 CVM / CloudBase；Nginx/Caddy 做 HTTPS 终止 + 反向代理 `/v1`；`CORS_ORIGINS` 填前端域名。
2. **数据库白名单**：TiDB Cloud 放开云端出口 IP（当前已用 TiDB Cloud，仅加 IP）。
3. **前端托管**：原型已是静态 HTML/JS，直接传对象存储 / CDN / CloudBase 静态网站；无需打包器（如需可用 Vite 可选）。
4. **本地联调**：`deliverables/backend/start_server.bat` 已带全栈 Docker + `test.html` 测试面板，先把 `runtime-config.js` 指向本地即可验证。
5. **PWA**：加 `manifest.json` + `sw.js`，注册 Service Worker。

---

## 8. 阶段划分与优先级

| 阶段 | 内容 | 优先级 | 依赖 |
|------|------|--------|------|
| **P0 准备（并行）** | 注册域名 + 提交 ICP 备案；确定登录方案；起草隐私政策 | P0（最长周期） | 无 |
| **Phase 1 后端** | B1 新增 Web 登录端点；B2 CORS 配置；B3 通知 channel | P0 | P0 |
| **Phase 2 前端壳** | F1 地址 + F2 CSP + F3 Web 登录 UI + F4 localStorage 持久化 | P0 | Phase 1 |
| **Phase 3 联调** | 浏览器真机验证全 17 屏 + 流式咨询 + 上传 | P0 | Phase 2 |
| **Phase 4 PWA 化** | F5 manifest + sw，"添加到主屏幕" | P1 | Phase 3 |
| **Phase 5 推送替代** | F6 Web Push / 邮件 / 站内信 | P1 | Phase 3 |
| **Phase 6 发布** | 隐私政策上线 + 备案完成 + 正式发布 | P0 | P0/P3/P6 |

---

## 9. 与小程序路线工作量对比

| 维度 | 小程序路线 | Web/PWA 路线（本方案） |
|------|-----------|------------------------|
| 前端重写 | 17 屏 WXML 全重写 | 仅改地址/CSP/登录/持久化（4 处） |
| 流式 AI | 改 `enableChunked` + `onChunkReceived` | **零改动**（fetch 流式） |
| 后端登录 | 微信登录真机闭环 | 新增 1 个 Web 端点 |
| 资质 | 医疗类目许可证 + 审核 | 仅域名备案 |
| 上线周期 | 长（资质+审核） | 短（备案即可） |
| 微信生态 | 完整（分享/运动/订阅） | 缺失（战略取舍） |

---

## 10. 关键风险点

| 等级 | 风险 | 缓解 |
|------|------|------|
| 高 | 失去微信生态（分享/微信运动/裂变获客） | 战略取舍；若需微信身份选登录方案 C（公众号网页授权） |
| 中 | iOS PWA 推送能力弱 | 关键通知用邮件/站内信兜底 |
| 中 | 失去应用商店发现 | 靠 SEO + 口碑 + 二维码落地页 |
| 中 | Ollama 本地 LLM 上云需 GPU 成本 | 沿用 TiDB Cloud 同云区；评估 7B+ 模型费用 |
| 中 | 内容安全自管责任（无平台兜底） | 保留敏感词过滤 + 红线引擎 + 人工复核通道 |
| 低 | 短信/账号体系合规（若选 A/B） | 个保法授权 + 数据最小化 |

---

## 11. 立即行动清单（执行基线）

1. **今天**：注册域名 + 提交 ICP 备案（最长周期，先启动）；把 `runtime-config.js` 的 `apiBaseUrl` 改成测试域名，本地联调跑通 17 屏。
2. **本周**：后端新增 `/auth/login`（选方案 B 最快）；前端补 `localStorage` 持久化 + Web 登录 UI；CSP 放行域名。
3. **两周内**：浏览器真机全链路验证（含流式咨询、头像上传）；起草隐私政策页。
4. **可选**：PWA 化（manifest + sw）；若需微信身份，申请公众号认证并接入网页授权（方案 C）。

---

> 附：本方案建立在 `WECHAT-MIGRATION-ROADMAP.md` 与 `MIGRATION-PLAN.md` 的资产盘点之上，修正了其中"前端必须重写"的结论——在 Web 路线下该结论不成立。小程序医疗类目资质仍是最高风险项，转 Web 后该风险消除。
