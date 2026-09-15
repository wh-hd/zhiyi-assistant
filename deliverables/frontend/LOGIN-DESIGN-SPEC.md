# 智医助手 · 登录页（screen-login）设计规格

> 供 prototype-builder 落地微信小程序登录/落地页。本规格 100% 复用 SoftCare v1.2 设计系统，**不新增色板、不新增字体**。完整组件 CSS 与 Anti-Slop 注记已同步写入 `DESIGN-SYSTEM.md` §4.9（文档升至 v1.3）。

---

## 1. 设计系统确认

登录页 **100% 复用 SoftCare v1.2**，不新增色板 / 不新增字体。

### 复用核心令牌
| 类别 | 令牌 |
|------|------|
| 颜色 | `--bg`(页面底 #F5F4F1) · `--primary`(主色绿 #3D8A5A) · `--card-bg`(白 #FFFFFF) · `--text-primary`/`--text-secondary`/`--text-tertiary` · `--border` · `--divider` · `--error`(仅异常) |
| 字体 | `--font-cjk`(Noto Sans SC) · `--font-num`(Outfit) |
| 间距 | `--space-xs`(4) ~ `--space-2xl`(24) |
| 圆角 | `--radius-sm`(8) / `-md`(12) / `-lg`(16) / `-xl`(20) / `-pill`(36) |
| 阴影 | `--shadow-card` · `--shadow-elevated` |
| 过渡 | `--transition-fast`(.15s) / `-normal`(.25s) / `-slow`(.35s) |

### ⚠️ 关键类名纠正
任务摘要提到的 **`.btn-primary` 在原型中并不存在**。全宽主色按钮的真实类名是 **`.continue-btn`**（DESIGN-SYSTEM.md §3 已登记，原型 `:root` 后第 403 行定义）。

> **登录主按钮必须复用 `.continue-btn`，不得另建 `.btn-primary`。** 若 prototype-builder 已写了 `.btn-primary`，请直接改用 `.continue-btn` 或将其别名映射到 `.continue-btn`。

---

## 2. 页面布局规范

单屏 390×844，垂直 flex column，**未登录态、不挂 tab-bar**（N6）。

### 垂直分区（上 → 下）
1. **极简 status-bar**（44px，仅时间 + 信号/电量，无 tab-bar）
2. **品牌标识区**（偏上）：Logo 徽标 + 产品名 + 价值主张
3. **中部呼吸留白**（flex:1 弹性空白）
4. **操作区**（偏下）：主登录按钮 → 次操作入口 → 隐私协议区
5. **非诊疗声明**（最底部，弱化）

### 容器与间距
- `.login-content` 覆盖默认 `.content` 的 `--tab-bar-safe` 底部安全区：
  `padding: var(--space-xl) var(--space-xl) var(--space-2xl)`（**不使用 `--tab-bar-safe`**，因无 tab-bar）；`display:flex; flex-direction:column; justify-content:space-between`。
- 最大内容宽度 = 屏宽 − 左右 `--space-xl`（即 390−40 = 350px），所有区块居中。
- 区块间距（用令牌）：
  - 品牌区内部：徽标↔产品名 `--space-sm`，产品名↔主张 `--space-sm`
  - 操作区内部：主按钮↔次操作 `--space-md`，次操作↔协议区 `--space-lg`
  - 协议区↔声明：`--space-xl`
- 整体策略：品牌区偏上、操作区偏下，中部 `flex:1` 留白制造呼吸感。

---

## 3. 专属组件规范

每个组件给出：用途 / DOM 结构建议 / 所用令牌 / 状态。

### 3.1 品牌标识区 `.login-brand`
- **用途**：建立第一印象信任，传达「智医助手 · AI 守护家庭健康」。
- **DOM**：圆形徽标（复用 `.about-logo` 视觉：72px 圆、`--primary` 底、白色 line icon 36px）+ 产品名「智医助手」(20px / 700 / `--text-primary`) + 价值主张「AI 守护每一个家庭的健康」(14px / `--text-secondary`)。
- **令牌**：`--primary` · `--card-bg`(白 icon) · `--text-primary` · `--text-secondary` · `--font-cjk` · `--space-sm` · `--radius-pill`(徽标圆)。
- **状态**：静态。line icon 白色（= `--card-bg`），单色。
- **说明**：徽标复用 `.about-logo`（与「关于」页品牌一致，72px 为系统既有尺寸）；任务摘要所述「`--space-xl` 量级(20px)」作为紧凑 inline 图标尺寸的备选，落地以品牌一致性优先采用 72px 徽标。

### 3.2 主登录按钮「微信一键登录」—— 复用 `.continue-btn`
- **用途**：一键微信登录（主操作，占满宽）。
- **DOM**：`<button class="continue-btn" id="btnWechatLogin">[微信 svg] 微信一键登录</button>`；图标 inline svg `fill:var(--card-bg)`（白），`--space-xl`(20px) 量级，与文字 `gap:var(--space-sm)`。
- **令牌**：`--primary` · `--card-bg`(白字/图标) · `--radius-xl` · `--space-xl` · `--transition-normal` · `--font-cjk`。
- **状态**：
  - 默认：实色 `--primary`、白字、≥44px 高、圆角 `--radius-xl`。
  - **disabled（未勾选协议）**：直接加原生 `disabled` 属性，触发既有 `.continue-btn:disabled{opacity:.5;cursor:not-allowed}` → **无需新 CSS**。
  - **loading**：点击后 `disabled=true` 防重复；按钮内容替换为「白 spinner(`border:2.5px solid var(--card-bg);border-top-color:transparent`，复用既有 `@keyframes spin`) + 文字『登录中…』」；过渡 `--transition-normal`。成功/失败后复位。

### 3.3 次操作「手机号登录」—— 文字按钮
- **用途**：v1.0 占位入口（N：轻提示）。
- **DOM**：`<button class="login-phone-btn">手机号登录</button>`。
- **令牌**：`--text-secondary` · `--font-cjk` · `--space-sm`(padding 撑高使触控 ≥44px)。
- **状态**：默认无背景、`color:var(--text-secondary)`；点击 `showToast('手机号登录即将上线，敬请期待')`，**不跳转**。

### 3.4 隐私协议区
- **用途**：合规勾选，未勾选时禁用主按钮。
- **DOM**：`.login-agree-row`（`<label>`，`min-height:44px`）内含勾选控件 + `.login-agree-text`（「阅读并同意」+ `<a>`《用户协议》《隐私政策》）。
- **令牌**：`--border` · `--card-bg` · `--primary`(选中/链接) · `--text-secondary` · `--text-tertiary` · `--radius-sm` · `--transition-fast` · `--font-cjk`。
- **勾选控件（二选一，均 100% 令牌化）**：
  - **方案 A（推荐，语义最佳）**：方形 `.agree-check`（`--space-2xl` 24px、`--radius-sm`、`1.5px solid --border`，选中 `--primary` 底 + 白 `SVG.check`）。
  - **方案 B（零新 CSS）**：复用 `.toggle-switch`（48×28，开启即视为已同意）。
  - 触控 ≥44px：用外层 `<label>` 的 `padding` 撑出点击区。
- **状态**：未勾选 → 主按钮 `disabled`；勾选 → 启用；《用户协议》《隐私政策》为 `<a>`（`color:var(--primary)`、`text-decoration:none`），点击 `showToast` 占位。

### 3.5 非诊疗声明 —— 复用 `.ai-disclaimer`
- **用途**：合规免责小字。
- **DOM**：`<div class="ai-disclaimer">SVG.shieldInfo + 文案</div>`。
- **令牌**：`--text-tertiary` · `--font-cjk` · `--space-md`(margin-top) · `--radius-sm`(icon)。
- **状态**：静态，11px、居中、弱化。文案示例：「本产品提供健康参考信息，不构成诊疗建议，如有不适请及时就医。」

### 3.6 演示「已登录态」开关（原型专用）—— 复用 `.toggle-switch`
- **用途**：原型模拟已登录态（N2，默认未登录）。
- **DOM**：`.toggle-switch` + label「演示：已登录态」（`--text-tertiary` / 12px）。
- **令牌**：`--border`(关) · `--primary`(开) · `--text-tertiary` · `--radius-pill` · `--transition-normal`。
- **状态**：默认未开启；开启 → 模拟跳过登录直达 home。

---

## 4. 状态与交互映射

逐条映射到视觉表现，**全部使用现有令牌，禁止新颜色 / 新过渡**。

| 交互状态 | 视觉表现 | 实现 |
|---------|---------|------|
| 未勾选协议 | 主按钮 `disabled` → `opacity:.5` + `cursor:not-allowed`；勾选框未填充 | 原生 `disabled` 属性触发 `.continue-btn:disabled` |
| 点击登录 | 按钮 `disabled=true` 防重复；内联白 spinner + 『登录中…』；过渡 `--transition-normal` | loading 态（见 3.2） |
| 登录成功 | 复位按钮 → `switchScreen('home')` | `API.smartLogin()` 成功回调（N4） |
| 登录失败 | 复位按钮（去 disabled）；`showToast('登录失败，请重试')` | `API.smartLogin()` catch |
| 手机号登录 | `showToast('手机号登录即将上线，敬请期待')` 占位 | 次操作点击（见 3.3） |
| 退出登录回 login | 清登录态 → `switchScreen('screen-login')` 并复位勾选/按钮 | N3 |
| 演示已登录态开 | 模拟跳过登录直达 home | `.toggle-switch.active` 状态读取（N2） |

> **导航链路（原型 JS 层，供 prototype-builder）**：
> - N1 启动默认进 `screen-login`，且**不要自动调用** `API.smartLogin()`（当前 `syncFromBackend()` 第 3447 行会自登，需拆出）。
> - N2 新增「已登录态」原型开关，默认未登录。
> - N3 退出登录改为回 `screen-login` 并清登录态。
> - N4 登录成功 `switchScreen('home')`。
> - N5 `screen-login` 注册进 `screenOrder` 首位。
> - N6 登录页不显示 tab-bar。

---

## 5. Anti-Slop 约束（给 prototype-builder 的红线）

- ❌ **不引入任何新颜色**：微信图标 `fill:var(--card-bg)`、对勾 / loading spinner 均用 `--card-bg`(白)；其余一律 `:root` 令牌。
- ❌ **圆角只用** `--radius-sm/md/lg/xl/pill`，不出现 10/14/18px 等游离值。
- ❌ **过渡只用** `--transition-fast/normal/slow`，复用既有 `@keyframes spin`。
- ❌ **不新增字体**；中文 `--font-cjk`，数字（若有）`--font-num`。
- 新增令牌须语义化进 `:root`；本规格仅需一处令牌化小组件 `.agree-check`（其值全部取自现有令牌，非新令牌值）。
- 微信图标 inline svg 单色（白 = `--card-bg`），**不引入新品牌色块**。
- 主色 `--primary` 仅用于：品牌徽标底、主按钮、勾选选中态、链接文字；不铺大面积背景。
- 背景 `--bg`(#F5F4F1) 非纯白；按钮/徽标上的白是 `--card-bg`（既有按钮文字色 `--card-bg`），非页面背景。

---

## 6. 对 DESIGN-SYSTEM.md 的更新（已执行）

- ✅ 新增 **§4.9 登录页（screen-login）**：布局分区、组件复用映射（`.continue-btn` 纠正 `.btn-primary`、协议勾选框令牌化、微信图标 `var(--card-bg)` 白）、交互状态表、Anti-Slop 注记。
- ✅ 文档版本 **v1.2 → v1.3**，页头与页尾变更摘要同步补充。
- ✅ §8 页面-组件映射表新增 `screen-login` 行。
- 设计令牌无新增 / 无变更，仅补充一处令牌化小组件 `.agree-check`（数值全部来自现有令牌）。
