# 智医助手：微信小程序迁移 + 手表数据动态联动 后续工作思路

> 日期：2026-07-12 ｜ 状态：规划（未开始编码）
> 目标：将当前「浏览器单文件原型 + NestJS 后端」演进为可上架的微信小程序，并实现与手表/穿戴设备的健康数据动态联动。

---

## 一、现状盘点（迁移基线）

**已具备（可直接复用）**
- 后端：NestJS + Prisma + TiDB Cloud MySQL，REST 在 `/v1/*`；已含 `wechat-login`（code 换 openid 雏形）、`/v1/metrics` 指标 CRUD、健康阈值、AI 咨询。
- 数据模型：`HealthMetric`（已支持 11 类指标：血压/体重/BMI/体脂率/血糖/心率/血氧/体温/步数/睡眠/压力）+ `metricThreshold`（状态点）+ `Task`（待办）。指标类型元数据驱动。
- 前端：单文件原型 `zhiyi-assistant-prototype.{html,js,css}`，经典 `<script>`，`syncFromBackend()` 对接后端；已预留 `screen-device-sync` 设备同步占位页与「从智能设备同步」快捷条。

**缺口（必须解决）**
- 前端是浏览器原型，不是小程序原生（无 WXML/WXSS，依赖 `document`/`innerHTML`）。
- AI 咨询用 **SSE 流式**——小程序**不支持**原生 `EventSource`/`fetch` streaming（必须用 WebSocket 或分段轮询）。
- 没有任何真实设备数据摄入适配器（目前设备页只是 UI 占位）。

---

## 二、小程序迁移实现思路

### 2.1 后端适配（改动小，约 3 个文件）
1. **微信登录闭环**：补全 `wechat-login` 的 `code2session`（AppID/AppSecret 走 env，绝不进前端），返回 JWT；小程序端 `wx.login()` 拿 code → 发后端 → `wx.setStorageSync('token', jwt)` 持久化。
2. **域名与协议**：所有后端接口上 **HTTPS**；微信公众平台配置 `request 合法域名`（API）、`uploadFile 合法域名`（MinIO）、`socket 合法域名`（WebSocket）。
3. **AI 咨询流式改造（关键坑）**：
   - 推荐：`wx.connectSocket` 建 WebSocket，后端 AI 网关加 WS 端点，SSE→WS 适配，体验最佳。
   - 降级：前端发咨询→后端立即返回 `consultationId`→前端定时 `GET /v1/ai/consultations/:id/messages` 拉增量。
4. **静态原型下线**：停止从 `public/` 服务 HTML 原型（或保留为 Web 演示），小程序走独立前端包。

### 2.2 前端重写（主要工作量，两条路线可选）
- **路线 A（最快验证）**：用 `web-view` 组件内嵌现有 HTML 原型。优点：几乎不写新代码、几天可内测；缺点：非原生体验、BLE/原生能力受限、`web-view` 需配置业务域名且部分 API 受限。适合 MVP 快速验证。
- **路线 B（推荐终态）**：用 **Taro（React）或 uni-app（Vue）** 重写。组件化、可复用现有业务逻辑（指标看板渲染、Task CRUD 的 state 管理），一套代码出小程序 + H5。把原型 `renderXxx()` 改成 Taro 组件 + `useState`，`syncFromBackend` 改成 `useEffect` 调 API hook。
- **路线 C（纯原生 WXML）**：控制最强但最慢，不推荐除非强定制。

**建议分阶段**：阶段 1 用 `web-view` 跑通登录 + 核心流程做内测；阶段 2 用 Taro 重写核心页（首页/成员详情/指标/待办）上架。

### 2.3 部署与发布
- 后端：保持 NestJS 容器化，可由 Docker Compose 迁到更稳定托管（腾讯云 CloudBase 云托管 / CVM / K8s），保证 HTTPS + 弹性伸缩。
- 小程序：微信开发者工具上传 → 体验版内测 → 提交审核 → 发布。**医疗健康类目需资质**（提前准备《互联网医疗保健信息服务许可证》等）。
- 配置：服务器域名、消息推送（订阅消息）、第三方平台（华为/小米 OAuth 回调）。

---

## 三、手表数据动态联动思路

### 3.1 数据源与接入方式（按成本/价值排序）
1. **微信运动 `wx.getWeRunData`（立即可做）**：返回加密步数，后端用 `session_key` 解密 → upsert `HealthMetric(steps)`。零额外授权、覆盖最广。已有占位。
2. **厂商运动健康开放平台 OAuth（华为/小米，主路径）**：用户在小程序内授权（`web-view` 承载厂商 OAuth 页或跳 web 授权），后端换 token 后调厂商 REST（步数/心率/睡眠/血氧/血压）→ 周期拉取/回调 → 写入 `HealthMetric`。对应 `screen-device-sync` 的「厂商 SDK OAuth」占位。
3. **BLE 直连（GATT，实时但设备受限）**：`wx.openBluetoothAdapter` + 扫描/连接支持 GATT 的穿戴（部分手环/血压计/血氧仪），实时读 HR/SpO2。**注意**：Apple Watch、华为 Watch 等主流表不允许第三方小程序任意 GATT，仅少数开放协议设备可行。适合「实时心率」场景。
4. **Apple Watch / HealthKit**：仅 iOS 原生 App 可接，小程序不可达，需另做 App（超出小程序范围，列为例外）。

### 3.2 后端同步引擎（新增 DeviceSyncService）
- **统一摄入层**：每种来源一个 Adapter（`WeRunAdapter` / `HuaweiAdapter` / `BleAdapter`），实现 `pull(externalAccount) → NormalizedMetric[]`。
- **归一化 + 去重**：按 `source + externalId + recordedAt` upsert 到 `HealthMetric`，避免重复写入。
- **触发联动**：写入后跑 `metricThreshold` 校验 → 更新首页状态点/预警；必要时发微信订阅消息（现有 `in_app` 通知需补 `subscribeMessage`）。
- **调度**：厂商数据用定时任务（NestJS `@nestjs/schedule` 或云端 cron）拉取；BLE/微信运动在 App `onShow` 即时触发。

### 3.3 前端动态展示
- 首页「最近指标」大卡片已动态渲染 11 类，手表数据写入后**自动出现**（现有 `buildMetricCards` 无需改）。
- 设备同步页落地真实绑定 UI：显示已授权厂商/设备、最近同步时间、解绑；「从智能设备同步」快捷条触发对应 Adapter 拉取并 toast 进度。
- 实时性：BLE 场景用 WebSocket 推最新值；厂商/微信运动用 `onShow` + 下拉刷新拉取。

### 3.4 数据权属与安全
- 用户明确授权范围；设备数据加密存储；提供「解绑即删除」（个保法合规）。
- 非诊疗声明始终展示（现有红线引擎已覆盖）。

---

## 四、落地路线图（建议顺序）

| 阶段 | 内容 | 预估 |
|------|------|------|
| 1 | 后端补 `code2session` 完整闭环 + HTTPS/域名配置 | 1 周 |
| 2 | `web-view` 包原型 + 微信运动步数摄入（快速验证） | 2 周 |
| 3 | Taro 重写首页/成员/指标/待办（核心页上架） | 4–6 周 |
| 4 | 厂商联动：华为/小米 OAuth Adapter + DeviceSyncService | 3–4 周 |
| 5 | BLE 实时（可选）：GATT 适配器 + WS 推送 | 2–3 周 |
| 6 | 资质准备 + 审核发布 | 并行 |

---

## 五、主要风险与坑
- **SSE→小程序不兼容**：必改 WebSocket 或分段轮询（核心坑，先规划）。
- **医疗健康类目资质门槛**：审核周期长，尽早准备。
- **主流手表不支持第三方 GATT**：别押宝 BLE 全覆盖，厂商 OAuth 才是主路径。
- **厂商 OAuth 回调域名/审核周期长**：华为/小米开放平台接入需注册应用、等审核。
- **`web-view` 业务域名限制**：仅能加载已配置业务域名下的页面。
