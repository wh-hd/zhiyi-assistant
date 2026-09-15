# SoftCare Design System

> 智医助手项目设计系统规范 — 供原型构建师在新增页面与弹窗组件时严格遵循（v1.2 Tab 栏安全区修订 / 授权详情 Accordion / 导出进度；v1.3 新增 §4.9 登录页 screen-login）

---

## 1. 设计系统概览

**系统名称**: SoftCare  
**设计哲学**: "温和而专业——用暖色包裹信任，用克制传达可靠"  
**视觉方向**: Warm Minimal · Soft Professional  
**品牌性格**: 温暖、可信赖、克制、人文关怀  
**适用场景**: 非诊疗家庭健康管理产品（微信小程序高保真原型）

**设计原则**:
1. **温暖优先** — 暖灰白底色 + 森林绿主色，避免冷色调带来的"医疗冰冷感"
2. **克制用色** — 全局仅 1 主色 + 2 点缀色 + 1 语义色，不引入任何新颜色
3. **呼吸感** — 卡片间距 ≥ 12px，内容区留白充足，信息密度适中
4. **触控友好** — 所有可交互元素最小高度 44px，符合 iOS HIG
5. **数字优先** — 数据值使用 Outfit 等宽数字字体，正文使用 Noto Sans SC

---

## 2. 令牌确认

以下令牌已从现有原型代码验证提取，**直接复用，不得修改或新增**。

### 色彩令牌
| Token | Value | 用途 |
|-------|-------|------|
| `--bg` | `#F5F4F1` | 页面背景 — 暖灰白 |
| `--card-bg` | `#FFFFFF` | 卡片背景 |
| `--device-stage` | `#E0DFDB` | 设备展台底色（手机框外背景） |
| `--primary` | `#3D8A5A` | 主色 — 森林绿 |
| `--primary-light` | `rgba(61,138,90,.08)` | 主色浅底 |
| `--primary-dark` | `#2D6A43` | 主色深 (hover) |
| `--secondary` | `#D89575` | 辅色 — 暖橙 |
| `--tertiary` | `#D4A64A` | 点缀色 — 暖黄 |
| `--error` | `#D08068` | 错误/警示 |
| `--error-light` | `rgba(208,128,104,.08)` | 错误浅底 |
| `--text-primary` | `#1A1A18` | 主文字 |
| `--text-secondary` | `#6B6B68` | 次文字 |
| `--text-tertiary` | `#7B7B78` | 三级文字/占位符 |
| `--tab-inactive` | `#8B8B88` | Tab 未选中 |
| `--border` | `#E8E7E3` | 边框 |
| `--divider` | `#EDECE9` | 分割线 |

### 字体令牌
| Token | Value |
|-------|-------|
| `--font-cjk` | `'Noto Sans SC', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif` |
| `--font-num` | `'Outfit', -apple-system, BlinkMacSystemFont, sans-serif` |

### 间距令牌
| Token | Value |
|-------|-------|
| `--space-xs` | `4px` |
| `--space-sm` | `8px` |
| `--space-md` | `12px` |
| `--space-lg` | `16px` |
| `--space-xl` | `20px` |
| `--space-2xl` | `24px` |

### 圆角令牌
| Token | Value |
|-------|-------|
| `--radius-sm` | `8px` |
| `--radius-md` | `12px` |
| `--radius-lg` | `16px` |
| `--radius-xl` | `20px` |
| `--radius-pill` | `36px` |

### 阴影令牌
| Token | Value |
|-------|-------|
| `--shadow-card` | `0 1px 3px rgba(0,0,0,.04), 0 1px 2px rgba(0,0,0,.02)` |
| `--shadow-elevated` | `0 4px 12px rgba(0,0,0,.06)` |

### 过渡令牌
| Token | Value |
|-------|-------|
| `--transition-fast` | `.15s ease` |
| `--transition-normal` | `.25s ease` |
| `--transition-slow` | `.35s ease` |

### 设计尺寸
| Token | Value |
|-------|-------|
| `--design-w` | `390px` |
| `--design-h` | `844px` |
| `--status-bar-h` | `44px` |
| `--tab-bar-h` | `78px` |

---

## 3. 现有可复用组件清单

以下组件已在现有代码中验证，**直接调用，无需重写**：

| 组件 | 用途 | 关键属性 |
|------|------|---------|
| `.page-header` + `.back-btn` + `.page-title` | 页面头（返回 + 标题 + 右侧操作） | flex, 32px 返回按钮 |
| `.card` | 白色圆角卡片 | bg: card-bg, radius: lg, shadow: card, hover 微上浮 |
| `.option-item` | 可选中列表项（radio 样式） | 1.5px border, selected 时 primary-light 底 |
| `.continue-btn` | 全宽主色按钮 | bg: primary, radius: xl, padding: 16px |
| `.menu-item` | 带图标列表行 | flex, gap: 12px, radius: md |
| `.member-card` / `.med-card` / `.metric-card` | 内容卡片 | 各页特化卡片 |
| `.section-label` | 区块小标题 | 14px / 700 / text-primary |
| `.toast` | 底部浮层提示 | fixed, backdrop-blur, 0.92 opacity bg |
| `.score-badge` | 评分徽章 | inline-flex, primary bg |
| `.progress-track` / `.progress-fill` | 进度条 | 6px 高, divider 底, primary 填充 |
| `.redline-alert` | 警示卡片 | error-light 底, error border |
| `.tab-bar-container` / `.tab-pill` / `.tab-item` | 底部导航 | pill 形, active 时 primary 底 |
| `.status-bar` | 顶部状态栏 | 44px, font-num |
| `.loading-screen` / `.loading-spinner` | 加载状态 | 500 z-index, spin 动画 |

### JS 工具函数（已有，直接调用）
- `pageHeader(title, showBack, rightBtnHtml)` — 生成页面头 HTML
- `showToast(msg)` — 显示 toast 提示
- `switchScreen(id)` — 切换页面

---

## 4. 新增组件 CSS 规范

以下 6 个组件为本次新增，**必须严格使用以下 CSS，不得擅自修改**。所有颜色/间距/圆角/阴影均引用现有令牌。

### 4.1 表单组件 `.form-field` / `.form-label` / `.form-input` / `.form-textarea`

```css
/* === 表单组件（3个表单页共用） === */
.form-field {
  margin-bottom: var(--space-lg);
}
.form-label {
  display: block;
  font-size: 14px;
  font-weight: 600;
  color: var(--text-primary);
  margin-bottom: var(--space-sm);
  font-family: var(--font-cjk);
}
.form-label .form-required {
  color: var(--error);
  margin-left: 2px;
}
.form-input {
  width: 100%;
  height: 44px;                          /* iOS 触控标准 */
  padding: 0 var(--space-lg);
  border: 1.5px solid var(--border);
  border-radius: var(--radius-md);       /* 12px */
  background: var(--card-bg);
  font-size: 15px;
  font-family: var(--font-cjk);
  color: var(--text-primary);
  outline: none;
  transition: border-color var(--transition-fast),
              box-shadow var(--transition-fast);
  -webkit-appearance: none;
}
.form-input::placeholder {
  color: var(--text-tertiary);
}
.form-input:focus {
  border-color: var(--primary);
  box-shadow: 0 0 0 3px var(--primary-light);
}
.form-input:disabled {
  background: var(--bg);
  color: var(--text-tertiary);
  cursor: not-allowed;
}
.form-input.error {
  border-color: var(--error);
  box-shadow: 0 0 0 3px var(--error-light);
}
.form-textarea {
  width: 100%;
  min-height: 88px;
  padding: var(--space-md) var(--space-lg);
  border: 1.5px solid var(--border);
  border-radius: var(--radius-md);
  background: var(--card-bg);
  font-size: 15px;
  font-family: var(--font-cjk);
  color: var(--text-primary);
  outline: none;
  resize: none;
  line-height: 1.5;
  transition: border-color var(--transition-fast),
              box-shadow var(--transition-fast);
  -webkit-appearance: none;
}
.form-textarea::placeholder {
  color: var(--text-tertiary);
}
.form-textarea:focus {
  border-color: var(--primary);
  box-shadow: 0 0 0 3px var(--primary-light);
}
.form-hint {
  font-size: 12px;
  color: var(--text-tertiary);
  margin-top: var(--space-xs);
  font-family: var(--font-cjk);
}
.form-hint.error {
  color: var(--error);
}
```

**HTML 结构示例**:
```html
<div class="form-field">
  <label class="form-label">姓名<span class="form-required">*</span></label>
  <input class="form-input" type="text" placeholder="请输入姓名" />
  <div class="form-hint">请使用真实姓名</div>
</div>
```

---

### 4.2 标签组 `.tag-group` / `.tag-pill`

```css
/* === 可选标签组 === */
.tag-group {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-sm);                   /* 8px 间距 */
}
.tag-pill {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 8px 16px;
  border-radius: var(--radius-pill);     /* 36px → 实际由内容撑高后自然 pill */
  border: 1.5px solid var(--border);
  background: var(--card-bg);
  font-size: 13px;
  font-weight: 500;
  font-family: var(--font-cjk);
  color: var(--text-secondary);
  cursor: pointer;
  transition: all var(--transition-fast);
  -webkit-tap-highlight-color: transparent;
}
.tag-pill:hover {
  border-color: var(--primary);
  color: var(--primary);
}
.tag-pill.selected {
  background: var(--primary-light);
  border-color: var(--primary);
  color: var(--primary);
  font-weight: 600;
}
```

**HTML 结构示例**:
```html
<div class="tag-group">
  <span class="tag-pill selected">高血压</span>
  <span class="tag-pill">糖尿病</span>
  <span class="tag-pill">高血脂</span>
</div>
```

---

### 4.3 开关 `.toggle-switch`

> **圆角说明**：开关圆角统一使用 `var(--radius-pill)` 令牌（视觉呈完整胶囊），在 28px 高度下与 14px 圆角视觉等价，纳入令牌体系、消除游离值。

```css
/* === iOS 风格开关（settings 页） === */
.toggle-switch {
  position: relative;
  width: 48px;                           /* 固定宽度 */
  height: 28px;                          /* 固定高度 */
  border-radius: var(--radius-pill);       /* 完整胶囊，令牌化（28px 高时与 14px 等价） */
  background: var(--border);             /* 关闭态灰色 */
  cursor: pointer;
  flex-shrink: 0;
  transition: background var(--transition-normal);
  -webkit-tap-highlight-color: transparent;
}
.toggle-switch::after {
  content: '';
  position: absolute;
  top: 2px;
  left: 2px;
  width: 24px;                           /* 高度 - 2×2px 边距 */
  height: 24px;
  border-radius: 50%;
  background: #FFFFFF;
  box-shadow: 0 1px 3px rgba(0,0,0,.15);
  transition: transform var(--transition-normal);
}
.toggle-switch.active {
  background: var(--primary);            /* 开启态主色 */
}
.toggle-switch.active::after {
  transform: translateX(20px);           /* 48 - 24 - 2×2 = 20px */
}
```

**HTML 结构示例**:
```html
<div class="toggle-switch active" onclick="this.classList.toggle('active')"></div>
```

---

### 4.4 时间线 `.timeline-item`

```css
/* === 竖向时间线（member-detail 页） === */
.timeline-list {
  display: flex;
  flex-direction: column;
  gap: var(--space-lg);                  /* 16px 条目间距 */
}
.timeline-item {
  display: flex;
  gap: var(--space-md);                  /* 12px 点与内容间距 */
  position: relative;
}
/* 连接线：除最后一个外都画竖线 */
.timeline-item:not(:last-child)::before {
  content: '';
  position: absolute;
  left: 7px;                              /* 居中于 16px 的 dot */
  top: 18px;
  bottom: calc(0px - var(--space-lg));    /* 延伸到下一个条目 */
  width: 2px;
  background: var(--divider);
}
.timeline-dot {
  width: 16px;
  height: 16px;
  border-radius: 50%;
  background: var(--primary-light);
  border: 3px solid var(--primary);
  flex-shrink: 0;
  margin-top: 2px;
  z-index: 1;                            /* 覆盖在连接线上方 */
}
.timeline-dot.warn {
  border-color: var(--tertiary);
  background: rgba(212,166,74,.12);
}
.timeline-dot.error {
  border-color: var(--error);
  background: var(--error-light);
}
.timeline-content {
  flex: 1;
  min-width: 0;                          /* 防止 flex 溢出 */
}
.timeline-time {
  font-size: 11px;
  color: var(--text-tertiary);
  font-family: var(--font-num);
  margin-bottom: 2px;
}
.timeline-title {
  font-size: 14px;
  font-weight: 600;
  color: var(--text-primary);
  margin-bottom: 2px;
  font-family: var(--font-cjk);
}
.timeline-desc {
  font-size: 12px;
  color: var(--text-secondary);
  line-height: 1.5;
  font-family: var(--font-cjk);
}
```

**HTML 结构示例**:
```html
<div class="timeline-list">
  <div class="timeline-item">
    <div class="timeline-dot"></div>
    <div class="timeline-content">
      <div class="timeline-time">2026-07-08 09:30</div>
      <div class="timeline-title">血压记录</div>
      <div class="timeline-desc">收缩压 128 / 舒张压 82 mmHg — 正常范围</div>
    </div>
  </div>
  <div class="timeline-item">
    <div class="timeline-dot warn"></div>
    <div class="timeline-content">
      <div class="timeline-time">2026-07-07 14:00</div>
      <div class="timeline-title">血糖记录</div>
      <div class="timeline-desc">空腹血糖 6.8 mmol/L — 偏高，建议关注</div>
    </div>
  </div>
</div>
```

---

### 4.5 维度评分条 `.dimension-bar`

```css
/* === 维度评分进度条（assess-report 页） === */
.dimension-bar {
  margin-bottom: var(--space-md);         /* 12px 条目间距 */
}
.dim-header {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  margin-bottom: var(--space-xs);        /* 4px header 与 bar 间距 */
}
.dim-label {
  font-size: 14px;
  font-weight: 500;
  color: var(--text-primary);
  font-family: var(--font-cjk);
}
.dim-score {
  font-family: var(--font-num);          /* 数字用 Outfit */
  font-size: 14px;
  font-weight: 700;
}
.dim-score.low {
  color: var(--error);
}
.dim-score.mid {
  color: var(--tertiary);
}
.dim-score.high {
  color: var(--primary);
}
.dim-track {
  width: 100%;
  height: 8px;                           /* 比 progress-track 稍粗 */
  background: var(--divider);
  border-radius: var(--radius-sm);
  overflow: hidden;
}
.dim-fill {
  height: 100%;
  border-radius: var(--radius-sm);
  transition: width .6s ease;
}
.dim-fill.low {
  background: var(--error);
}
.dim-fill.mid {
  background: var(--tertiary);
}
.dim-fill.high {
  background: var(--primary);
}
/* 速记：< 60 = low/error, 60-79 = mid/tertiary, ≥ 80 = high/primary */
```

**HTML 结构示例**:
```html
<div class="dimension-bar">
  <div class="dim-header">
    <span class="dim-label">睡眠质量</span>
    <span class="dim-score high">85</span>
  </div>
  <div class="dim-track">
    <div class="dim-fill high" style="width: 85%"></div>
  </div>
</div>
<div class="dimension-bar">
  <div class="dim-header">
    <span class="dim-label">运动管理</span>
    <span class="dim-score mid">62</span>
  </div>
  <div class="dim-track">
    <div class="dim-fill mid" style="width: 62%"></div>
  </div>
</div>
```

---

### 4.6 次要按钮 `.btn-secondary`

```css
/* === 次要按钮（assess-report 页） === */
.btn-secondary {
  width: 100%;
  padding: 16px;
  border-radius: var(--radius-xl);        /* 20px，与 continue-btn 一致 */
  background: var(--card-bg);
  color: var(--primary);
  border: 1.5px solid var(--primary);
  font-size: 16px;
  font-weight: 600;
  font-family: var(--font-cjk);
  cursor: pointer;
  outline: none;
  transition: all var(--transition-fast);
  -webkit-tap-highlight-color: transparent;
}
.btn-secondary:active {
  transform: scale(.98);
}
.btn-secondary:hover {
  background: var(--primary-light);
}
```

**与 continue-btn 的对比**:

| 属性 | continue-btn (主按钮) | btn-secondary (次按钮) |
|------|----------------------|----------------------|
| 背景 | `--primary` (实色) | `--card-bg` (白底) |
| 文字 | `#fff` | `--primary` |
| 边框 | 无 | `1.5px solid --primary` |
| 用途 | 确认/提交/继续 | 查看详情/重新评估/次要操作 |
| 典型组合 | 单独使用或在 btn-secondary 下方 | 在 continue-btn 上方 |

**按钮组合 HTML 示例**:
```html
<button class="btn-secondary">查看详细建议</button>
<button class="continue-btn" style="margin-top: 12px;">完成评估</button>
```

---

### 4.7 弹窗 / 确认对话框 `.modal-mask` / `.modal-sheet`

> 统一覆盖 3 个场景：**导出健康数据（底部 sheet）**、**清除本地缓存确认**、**退出登录确认**。
> 全部颜色/圆角/阴影/过渡均引用现有令牌，**无新增颜色、无新增令牌**。
> **定位说明**：`.modal-mask` 使用 `position:absolute`（基于 `.phone-frame`(position:relative) 绝对定位），弹窗始终约束在 390px 手机框内，不会在大桌面视口铺满窗口。

```css
/* === 弹窗 / 确认对话框（导出 sheet + 清除缓存确认 + 退出登录确认 统一复用） === */
.modal-mask {
  position: absolute;
  inset: 0;
  z-index: 1000;                      /* 覆盖 tab-bar 与 toast */
  display: flex;
  align-items: flex-end;              /* 底部对齐，sheet 从下而上 */
  justify-content: center;
  background: rgba(0,0,0,.4);         /* 半透明黑遮罩（沿用系统阴影的 rgba 黑） */
  -webkit-backdrop-filter: blur(4px);
  backdrop-filter: blur(4px);
  opacity: 0;
  visibility: hidden;
  transition: opacity var(--transition-normal),
              visibility var(--transition-normal);
}
.modal-mask.show {
  opacity: 1;
  visibility: visible;
}
.modal-sheet {
  width: 100%;
  max-width: var(--design-w);         /* 390px 容器内 */
  max-height: 85vh;
  background: var(--card-bg);
  border-radius: var(--radius-xl) var(--radius-xl) 0 0;   /* 仅顶部 xl 圆角 */
  box-shadow: var(--shadow-elevated);
  padding: var(--space-2xl) var(--space-lg) var(--space-2xl);
  display: flex;
  flex-direction: column;
  transform: translateY(100%);        /* 默认在视口下方 → 从底部滑入 */
  transition: transform var(--transition-slow);
  -webkit-tap-highlight-color: transparent;
}
.modal-mask.show .modal-sheet {
  transform: translateY(0);
}
.modal-grabber {
  width: 36px;
  height: 4px;
  border-radius: var(--radius-pill);
  background: var(--divider);
  margin: 0 auto var(--space-lg);
  flex-shrink: 0;
}
.modal-title {
  text-align: center;
  font-size: 16px;
  font-weight: 600;
  color: var(--text-primary);
  font-family: var(--font-cjk);
}
.modal-desc {
  text-align: center;
  font-size: 14px;
  font-weight: 400;
  color: var(--text-secondary);
  font-family: var(--font-cjk);
  line-height: 1.5;
  margin-top: var(--space-sm);
}
.modal-desc .num {
  font-family: var(--font-num);       /* 描述内数字用 Outfit */
  font-weight: 600;
  color: var(--text-primary);
}
.modal-body {
  margin-top: var(--space-lg);
  overflow-y: auto;
  -webkit-overflow-scrolling: touch;
}
.modal-actions {
  display: flex;
  gap: var(--space-md);
  margin-top: var(--space-xl);
}
/* 弹窗内复用 continue-btn / btn-secondary，仅改为等分并排 */
.modal-actions > .continue-btn,
.modal-actions > .btn-secondary {
  width: auto;
  flex: 1;
  margin: 0;
}
/* 危险确认按钮：复用 continue-btn，实色 error（无新颜色；文字用 --card-bg 即白） */
.continue-btn.danger {
  background: var(--error);
  color: var(--card-bg);
}
.continue-btn.danger:active {
  transform: scale(.98);
}
```

**3 个场景统一结构示例**（导出 sheet / 清除缓存 / 退出登录 同构，仅 `modal-body` 内容与确认按钮变体不同）：

```html
<div class="modal-mask" id="modal-export">
  <div class="modal-sheet" onclick="event.stopPropagation()">
    <div class="modal-grabber"></div>
    <div class="modal-title">导出健康数据</div>
    <div class="modal-desc">选择范围与格式后导出</div>
    <div class="modal-body">
      <!-- 范围：option-item 单选 / 数据类型：tag-pill 多选 / 格式：option-item 单选 -->
    </div>
    <div class="modal-actions">
      <button class="btn-secondary" onclick="closeModal('modal-export')">取消</button>
      <button class="continue-btn" onclick="exportData()">导出</button>
    </div>
  </div>
</div>
```

**场景差异速记**：

| 场景 | modal-title | modal-desc（数字包 `.num`） | 确认按钮 |
|------|-------------|------------------------------|----------|
| 导出健康数据 | 导出健康数据 | 选择范围与格式后导出 | `.continue-btn`（主色）「导出」 |
| 清除本地缓存 | 清除本地缓存？ | 将清除 `<span class="num">23.5</span>` MB 本地缓存数据，此操作不可撤销。 | `.continue-btn.danger`「清除」 |
| 退出登录 | 退出登录？ | 退出后需重新登录，本地健康数据将保留。 | `.continue-btn.danger`「退出」 |

**打开/关闭 JS（追加到原型脚本）**：

```js
function openModal(id){ document.getElementById(id).classList.add('show'); }
function closeModal(id){ document.getElementById(id).classList.remove('show'); }
document.querySelectorAll('.modal-mask').forEach(m=>{
  m.addEventListener('click', e=>{ if(e.target===m) m.classList.remove('show'); });
});
```

> **交互说明**："从底部滑入"由 `.modal-sheet` 的 `translateY(100%)→0` 实现，遮罩层做淡入（opacity + visibility），符合 iOS 底部 sheet 规范。

---

## 5. 新增页面设计约束

### 5.1 全局视觉规则（所有新页面必须遵守）

| 规则 | 说明 |
|------|------|
| **页面结构** | 每个新页面必须使用 `<div class="screen" id="screen-xxx">` + `.status-bar` + `.content` + `.tab-bar-container` 结构 |
| **背景色** | 页面背景使用 `var(--bg)`，不得使用纯白 |
| **卡片背景** | 所有卡片使用 `var(--card-bg)` + `var(--shadow-card)` |
| **主色使用** | `--primary` 仅用于：CTA 按钮、选中态、进度填充、强调数字。不得大面积铺色 |
| **辅色使用** | `--secondary`(暖橙) 和 `--tertiary`(暖黄) 仅用于点缀（图标背景、标签、数据强调），不得用于文字或大面积背景 |
| **错误色使用** | `--error` 仅用于：警示卡片、表单错误、异常数据。不得用于装饰 |
| **文字层级** | 正文 `--text-primary`，说明文字 `--text-secondary`，占位/时间 `--text-tertiary`。不得跨级使用 |
| **字体使用** | 所有中文字符使用 `var(--font-cjk)`；所有数字（分数、时间、百分比、计量值）使用 `var(--font-num)` |
| **间距体系** | 组件内部用 `--space-xs` ~ `--space-sm`；组件之间用 `--space-md` ~ `--space-lg`；区块之间用 `--space-xl` ~ `--space-2xl` |
| **圆角体系** | 输入框/小卡片 `--radius-md`(12px)；标准卡片 `--radius-lg`(16px)；大容器/按钮 `--radius-xl`(20px)；标签/胶囊 `--radius-pill`(36px) |
| **交互反馈** | 所有可点击元素必须有 `:active` 缩放(`scale(.98)`)和 `:hover` 过渡效果 |
| **页面滚动** | `.content` 区域 `overflow-y:auto`，隐藏滚动条(`scrollbar-width:none`) |

### 5.2 表单页统一规范

适用页面：add-member、med-edit、profile-edit

| 规范项 | 标准 |
|--------|------|
| **页面头** | 使用 `pageHeader(title, true, null)` — 带返回按钮，无右侧操作 |
| **表单容器** | 表单直接放在 `.content` 内，不额外包卡片（输入框自带白底） |
| **字段间距** | `.form-field` 之间 `margin-bottom: var(--space-lg)` (16px) |
| **标签样式** | `.form-label` — 14px / 600 / text-primary，必填项加红色 `*` |
| **输入框高度** | 44px（`height: 44px`），iOS 触控标准 |
| **输入框边框** | 默认 `1.5px solid var(--border)`，聚焦时 `var(--primary)` + 3px 光环 |
| **占位符** | 使用 `var(--text-tertiary)` 色，描述性文字（如"请输入姓名"） |
| **必填提示** | 字段下方 `.form-hint` — 12px / text-tertiary，错误时切 `.error` 类 |
| **多行输入** | 使用 `.form-textarea`，最小高度 88px |
| **标签选择** | 使用 `.tag-group` + `.tag-pill`，不用 checkbox/radio 原生控件 |
| **提交按钮** | 固定在表单底部，使用 `.continue-btn`，`margin-top: var(--space-xl)` |
| **次按钮** | 如有次按钮，使用 `.btn-secondary` 放在 continue-btn 上方，间距 12px |
| **分区标题** | 多分区表单使用 `.section-label`，`margin: var(--space-xl) 0 var(--space-md)` |
| **保存反馈** | 提交成功后调用 `showToast('保存成功')`，延迟 800ms 后 `switchScreen` 返回 |

### 5.3 信息展示页统一规范

适用页面：assess-report、member-detail

| 规范项 | 标准 |
|--------|------|
| **页面头** | 使用 `pageHeader(title, true, rightBtnHtml)` — 带返回按钮，右侧可放文字按钮 |
| **区块标题** | `.section-label` — 14px / 700 / text-primary，`margin-bottom: var(--space-sm)` |
| **区块间距** | 区块之间 `margin-bottom: var(--space-xl)` (20px) |
| **卡片间距** | 同区块内卡片之间 `gap: var(--space-md)` 或 `margin-bottom: var(--space-md)` (12px) |
| **卡片内边距** | 统一 `padding: var(--space-lg)` (16px) |
| **信息层级** | 标题 15px/700 → 描述 12px/text-secondary → 时间 11px/text-tertiary |
| **数据展示** | 数值用 `var(--font-num)`，单位用 `var(--font-cjk)` 12px/text-secondary |
| **状态标记** | 正常用 `.score-badge`(primary)，注意用 `disclaimer-badge` 风格(tertiary)，异常用 `.redline-alert`(error) |
| **列表项** | 使用 `.member-card` / `.med-card` 样式（flex + gap:12px + radius:lg） |
| **空状态** | 居中文字提示 14px/text-tertiary + 图标 48px/text-tertiary |
| **底部操作** | 页面底部操作按钮使用 `.continue-btn` 或 `.btn-secondary` |

### 5.4 设置页统一规范（settings）

| 规范项 | 标准 |
|--------|------|
| **列表项** | 使用 `.menu-item` 样式（已有组件） |
| **开关** | 使用 `.toggle-switch`（48×28px），放在 menu-item 右侧替代 `.menu-arrow` |
| **分组** | 使用 `.section-label` 分组，组间 `margin: var(--space-xl) 0` |
| **退出按钮** | 使用 `.btn-secondary` 样式，但 `color: var(--error)` + `border-color: var(--error)` |

```css
/* settings 页专用：退出按钮变体 */
.btn-secondary.danger {
  color: var(--error);
  border-color: var(--error);
}
.btn-secondary.danger:hover {
  background: var(--error-light);
}
```

---

## 6. Anti-Slop 检查清单

新增页面完成后，逐项检查以下设计问题。**任何一项不通过，必须返工**。

### 颜色类
- [ ] **无新颜色** — 全页面未出现任何 `#` 开头的硬编码颜色值（SVG 内的 stroke/fill 除外，但必须与令牌色值一致）
- [ ] **主色不过载** — `--primary` 未出现在大面积背景中（占比 < 15%）
- [ ] **辅色克制** — `--secondary` / `--tertiary` 仅用于图标背景或小标签，未用于文字或大色块
- [ ] **文字层级正确** — 未出现 `text-primary` 色用于 12px 以下小字，未出现 `text-tertiary` 色用于标题
- [ ] **背景非纯白** — 页面背景使用 `var(--bg)` (#F5F4F1)，不是 `#FFFFFF`
- [ ] **错误色语义** — `--error` 仅出现在警示/错误/异常场景

### 字体类
- [ ] **数字用 Outfit** — 所有数字（分数、百分比、时间、计量值）使用 `font-family: var(--font-num)`
- [ ] **中文用 Noto** — 所有中文字符使用 `font-family: var(--font-cjk)`
- [ ] **字号体系** — 未出现 13px/14px/15px/16px/17px/20px/22px 以外的正文字号（微标签可用 10px/11px/12px）

### 间距类
- [ ] **无硬编码间距** — 未出现 `margin: 15px` 或 `padding: 7px` 等不在令牌体系内的值
- [ ] **卡片内边距统一** — 所有卡片 `padding: var(--space-lg)` (16px)，未出现 `padding: 10px` 或 `padding: 20px` 等不一致值
- [ ] **区块间距充足** — 区块之间间距 ≥ `var(--space-xl)` (20px)，未出现紧贴

### 圆角类
- [ ] **圆角统一** — 同类元素圆角一致，未出现 `10px`/`14px`/`18px` 等非令牌圆角值（圆角仅用 `--radius-sm/-md/-lg/-xl/-pill` 令牌；开关类 28px 高元素用 `--radius-pill` 呈完整胶囊，属令牌合规；metric-card 的 14px 是已存在的例外，新组件不沿用）

### 组件类
- [ ] **表单输入框 44px** — 所有 `.form-input` 高度为 44px
- [ ] **开关尺寸正确** — `.toggle-switch` 为 48×28px，圆点 24px
- [ ] **按钮风格统一** — 新增按钮只使用 `.continue-btn` 或 `.btn-secondary`，未自创按钮样式
- [ ] **卡片 hover 效果** — 卡片有 `:hover` 微上浮 (`translateY(-1px)`) + `:active` 缩放 (`scale(.98)`)
- [ ] **聚焦光环** — 输入框聚焦时有 `box-shadow: 0 0 0 3px var(--primary-light)` 光环

### 布局类
- [ ] **页面结构完整** — 包含 `.screen` > `.status-bar` + `.content` + `.tab-bar-container`
- [ ] **内容区滚动** — `.content` 有 `overflow-y:auto` + `scrollbar-width:none`
- [ ] **底部安全区** — `.content` 底部 padding 包含 `calc(var(--tab-bar-h) + var(--space-xl))`
- [ ] **状态栏存在** — 顶部有 `.status-bar`，高度 44px

### 交互类
- [ ] **可点击区域 ≥ 44px** — 所有可点击元素最小高度/宽度 ≥ 44px
- [ ] **tap-highlight** — 可交互元素有 `-webkit-tap-highlight-color: transparent`
- [ ] **过渡动画** — 状态变化使用令牌过渡时间（fast/normal/slow），未使用 `0.3s` 或 `0.5s` 等非令牌值

### 内容类
- [ ] **非诊疗声明** — 涉及健康建议的页面包含非诊疗免责声明（使用 `.ai-disclaimer` 或 `.disclaimer-badge`）
- [ ] **无医疗术语** — 文案使用通俗语言，避免 "诊断""处方""治疗"等医疗术语
- [ ] **温暖语调** — 文案语气温和，使用"您""建议""关注"等词，避免命令式

### 弹窗类
- [ ] **遮罩用令牌黑** — 遮罩仅用 `rgba(0,0,0,.4)` 半透明黑 + `backdrop-filter: blur`，未引入新色值
- [ ] **sheet 圆角统一** — 弹窗卡片仅顶部 `var(--radius-xl)`，未出现其他圆角值
- [ ] **按钮复用** — 弹窗按钮仅用 `.continue-btn` / `.btn-secondary`，危险态用 `.continue-btn.danger`（实色 `--error`），未自创按钮
- [ ] **过渡令牌** — 滑入/淡入用 `var(--transition-normal)` / `var(--transition-slow)`，未用 `0.3s`/`0.5s`
- [ ] **数字用 Outfit** — 弹窗描述内数字（如 23.5MB）包 `.num` 用 `font-family: var(--font-num)`

---

## 7. 快速参考卡片

### CSS 变量速查（直接粘贴到 `:root`）

所有令牌已在现有原型 `:root` 中定义，新增页面**不需要重复定义**，直接使用 `var(--xxx)` 即可。

### 新增组件 CSS 合集

将以下代码块追加到现有 `<style>` 标签末尾（在 `/* Responsive */` 注释之前）：

```css
/* ========================================
   NEW COMPONENTS (Phase 2 Additions)
   ======================================== */

/* 4.1 Form Components */
.form-field { margin-bottom: var(--space-lg); }
.form-label { display:block; font-size:14px; font-weight:600; color:var(--text-primary); margin-bottom:var(--space-sm); font-family:var(--font-cjk); }
.form-label .form-required { color:var(--error); margin-left:2px; }
.form-input { width:100%; height:44px; padding:0 var(--space-lg); border:1.5px solid var(--border); border-radius:var(--radius-md); background:var(--card-bg); font-size:15px; font-family:var(--font-cjk); color:var(--text-primary); outline:none; transition:border-color var(--transition-fast),box-shadow var(--transition-fast); -webkit-appearance:none; }
.form-input::placeholder { color:var(--text-tertiary); }
.form-input:focus { border-color:var(--primary); box-shadow:0 0 0 3px var(--primary-light); }
.form-input:disabled { background:var(--bg); color:var(--text-tertiary); cursor:not-allowed; }
.form-input.error { border-color:var(--error); box-shadow:0 0 0 3px var(--error-light); }
.form-textarea { width:100%; min-height:88px; padding:var(--space-md) var(--space-lg); border:1.5px solid var(--border); border-radius:var(--radius-md); background:var(--card-bg); font-size:15px; font-family:var(--font-cjk); color:var(--text-primary); outline:none; resize:none; line-height:1.5; transition:border-color var(--transition-fast),box-shadow var(--transition-fast); -webkit-appearance:none; }
.form-textarea::placeholder { color:var(--text-tertiary); }
.form-textarea:focus { border-color:var(--primary); box-shadow:0 0 0 3px var(--primary-light); }
.form-hint { font-size:12px; color:var(--text-tertiary); margin-top:var(--space-xs); font-family:var(--font-cjk); }
.form-hint.error { color:var(--error); }

/* 4.2 Tag Group */
.tag-group { display:flex; flex-wrap:wrap; gap:var(--space-sm); }
.tag-pill { display:inline-flex; align-items:center; gap:4px; padding:8px 16px; border-radius:var(--radius-pill); border:1.5px solid var(--border); background:var(--card-bg); font-size:13px; font-weight:500; font-family:var(--font-cjk); color:var(--text-secondary); cursor:pointer; transition:all var(--transition-fast); -webkit-tap-highlight-color:transparent; }
.tag-pill:hover { border-color:var(--primary); color:var(--primary); }
.tag-pill.selected { background:var(--primary-light); border-color:var(--primary); color:var(--primary); font-weight:600; }

/* 4.3 Toggle Switch */
.toggle-switch { position:relative; width:48px; height:28px; border-radius:var(--radius-pill); background:var(--border); cursor:pointer; flex-shrink:0; transition:background var(--transition-normal); -webkit-tap-highlight-color:transparent; }
.toggle-switch::after { content:''; position:absolute; top:2px; left:2px; width:24px; height:24px; border-radius:50%; background:#FFFFFF; box-shadow:0 1px 3px rgba(0,0,0,.15); transition:transform var(--transition-normal); }
.toggle-switch.active { background:var(--primary); }
.toggle-switch.active::after { transform:translateX(20px); }

/* 4.4 Timeline */
.timeline-list { display:flex; flex-direction:column; gap:var(--space-lg); }
.timeline-item { display:flex; gap:var(--space-md); position:relative; }
.timeline-item:not(:last-child)::before { content:''; position:absolute; left:7px; top:18px; bottom:calc(0px - var(--space-lg)); width:2px; background:var(--divider); }
.timeline-dot { width:16px; height:16px; border-radius:50%; background:var(--primary-light); border:3px solid var(--primary); flex-shrink:0; margin-top:2px; z-index:1; }
.timeline-dot.warn { border-color:var(--tertiary); background:rgba(212,166,74,.12); }
.timeline-dot.error { border-color:var(--error); background:var(--error-light); }
.timeline-content { flex:1; min-width:0; }
.timeline-time { font-size:11px; color:var(--text-tertiary); font-family:var(--font-num); margin-bottom:2px; }
.timeline-title { font-size:14px; font-weight:600; color:var(--text-primary); margin-bottom:2px; font-family:var(--font-cjk); }
.timeline-desc { font-size:12px; color:var(--text-secondary); line-height:1.5; font-family:var(--font-cjk); }

/* 4.5 Dimension Bar */
.dimension-bar { margin-bottom:var(--space-md); }
.dim-header { display:flex; justify-content:space-between; align-items:baseline; margin-bottom:var(--space-xs); }
.dim-label { font-size:14px; font-weight:500; color:var(--text-primary); font-family:var(--font-cjk); }
.dim-score { font-family:var(--font-num); font-size:14px; font-weight:700; }
.dim-score.low { color:var(--error); }
.dim-score.mid { color:var(--tertiary); }
.dim-score.high { color:var(--primary); }
.dim-track { width:100%; height:8px; background:var(--divider); border-radius:var(--radius-sm); overflow:hidden; }
.dim-fill { height:100%; border-radius:var(--radius-sm); transition:width .6s ease; }
.dim-fill.low { background:var(--error); }
.dim-fill.mid { background:var(--tertiary); }
.dim-fill.high { background:var(--primary); }

/* 4.6 Secondary Button */
.btn-secondary { width:100%; padding:16px; border-radius:var(--radius-xl); background:var(--card-bg); color:var(--primary); border:1.5px solid var(--primary); font-size:16px; font-weight:600; font-family:var(--font-cjk); cursor:pointer; outline:none; transition:all var(--transition-fast); -webkit-tap-highlight-color:transparent; }
.btn-secondary:active { transform:scale(.98); }
.btn-secondary:hover { background:var(--primary-light); }
.btn-secondary.danger { color:var(--error); border-color:var(--error); }
.btn-secondary.danger:hover { background:var(--error-light); }

/* 4.7 Modal / Confirm Dialog */
.modal-mask { position:absolute; inset:0; z-index:1000; display:flex; align-items:flex-end; justify-content:center; background:rgba(0,0,0,.4); -webkit-backdrop-filter:blur(4px); backdrop-filter:blur(4px); opacity:0; visibility:hidden; transition:opacity var(--transition-normal),visibility var(--transition-normal); }
.modal-mask.show { opacity:1; visibility:visible; }
.modal-sheet { width:100%; max-width:var(--design-w); max-height:85vh; background:var(--card-bg); border-radius:var(--radius-xl) var(--radius-xl) 0 0; box-shadow:var(--shadow-elevated); padding:var(--space-2xl) var(--space-lg) var(--space-2xl); display:flex; flex-direction:column; transform:translateY(100%); transition:transform var(--transition-slow); -webkit-tap-highlight-color:transparent; }
.modal-mask.show .modal-sheet { transform:translateY(0); }
.modal-grabber { width:36px; height:4px; border-radius:var(--radius-pill); background:var(--divider); margin:0 auto var(--space-lg); flex-shrink:0; }
.modal-title { text-align:center; font-size:16px; font-weight:600; color:var(--text-primary); font-family:var(--font-cjk); }
.modal-desc { text-align:center; font-size:14px; font-weight:400; color:var(--text-secondary); font-family:var(--font-cjk); line-height:1.5; margin-top:var(--space-sm); }
.modal-desc .num { font-family:var(--font-num); font-weight:600; color:var(--text-primary); }
.modal-body { margin-top:var(--space-lg); overflow-y:auto; -webkit-overflow-scrolling:touch; }
.modal-actions { display:flex; gap:var(--space-md); margin-top:var(--space-xl); }
.modal-actions > .continue-btn, .modal-actions > .btn-secondary { width:auto; flex:1; margin:0; }
.continue-btn.danger { background:var(--error); color:var(--card-bg); }
.continue-btn.danger:active { transform:scale(.98); }
```

---

## 8. 页面-组件映射表

| 新增页面 | 使用的新增组件 | 使用的现有组件 |
|---------|--------------|--------------|
| **add-member** (添加家庭成员) | `.form-field` `.form-label` `.form-input` `.tag-group` `.tag-pill` | `.page-header` `.continue-btn` `.section-label` `.toast` |
| **med-edit** (用药编辑) | `.form-field` `.form-label` `.form-input` `.toggle-switch` | `.page-header` `.continue-btn` `.section-label` `.toast` |
| **profile-edit** (个人资料编辑) | `.form-field` `.form-label` `.form-input` `.form-textarea` `.tag-group` `.tag-pill` | `.page-header` `.continue-btn` `.section-label` `.toast` |
| **assess-report** (评估报告) | `.dimension-bar` `.btn-secondary` | `.page-header` `.card` `.section-label` `.score-badge` `.continue-btn` `.redline-alert` |
| **member-detail** (成员详情) | `.timeline-item` | `.page-header` `.card` `.section-label` `.member-card` `.metric-card` `.score-badge` |
| **settings** (设置) | `.toggle-switch` `.btn-secondary.danger` | `.page-header` `.menu-item` `.section-label` `.menu-icon` |
| **about** (关于) | — (纯信息展示) | `.page-header` `.card` `.section-label` `.menu-item` |
| **health-auth** (健康数据授权管理) | `.toggle-switch` `.btn-secondary.danger`(行内撤销) | `.page-header` `.card` `.menu-item` `.section-label` |
| **export-data** (导出健康数据 sheet) | `.modal-mask` `.modal-sheet` `.modal-actions` `.continue-btn` | `.option-item` `.tag-pill` `.section-label` |
| **clear-cache** (清除缓存确认) | `.modal-mask` `.modal-sheet` `.continue-btn.danger` | `.modal-title` `.modal-desc` `.btn-secondary` |
| **change-pwd** (修改密码) | `.form-field` `.form-input` `.form-hint` | `.page-header` `.continue-btn` `.section-label` |
| **logout** (退出登录确认) | `.modal-mask` `.modal-sheet` `.continue-btn.danger` | `.modal-title` `.modal-desc` `.btn-secondary` |
| **screen-login** (登录/落地页) | `.continue-btn`(微信登录) `.toggle-switch`(演示/协议) `.ai-disclaimer` `.toast` `.agree-check`(协议勾选) | `.about-logo` `.status-bar`(极简·无 tab-bar) |

---

## 4.8 Tab 栏安全区修订 + 授权详情 Accordion + 导出进度

> 本节约等于原型 3 项改动落地（Bug 修复 + 2 项深化）的设计说明。所有新增样式均复用 SoftCare 令牌，**无新颜色、无游离过渡值**。

### 4.8.1 Tab 栏安全区修订（修复首页底部导航遮挡）

**根因**：原 `--tab-bar-safe: 100px` 实际缓冲仅约 17px（pill 顶在 83px），被 `applyScaling()` 缩放亚像素取整吞掉 → 最后一屏任务卡被裁。

**改为单一数据源派生变量**（`:root` 内替换原 `--tab-bar-h` / `--tab-bar-safe` 两行，并补 `--bg-body` 让渐变生效）：

```css
:root{
  --tab-pill-h: 62px;                                          /* 派生：原 .tab-pill{height:62px} 提取 */
  --tab-pill-inset: 21px;                                     /* 派生：原 .tab-bar-container{padding-bottom:21px} 提取 */
  --tab-bar-h: calc(var(--tab-pill-h) + var(--tab-pill-inset)); /* 83px = 62+21 */
  --tab-bar-safe: calc(var(--tab-bar-h) + var(--space-2xl));     /* 107px = 83+24，缓冲复用令牌 --space-2xl */
  --bg-body: var(--bg);                                       /* 供 .tab-bar-container 渐变作暖灰白基底 */
}
.tab-bar-container{
  height:var(--tab-bar-h);
  padding-bottom:var(--tab-pill-inset);
  overflow:hidden;
  background: linear-gradient(to top, var(--bg-body) 60%, transparent);
}
.tab-pill{ height:var(--tab-pill-h); }   /* 单一数据源，去除硬编码 62px */
```

**几何验证**：`--tab-bar-safe`(107px) > pill 顶(83px)，**缓冲 24px**；`applyScaling()` 为等比缩放，不改变相对关系，遮挡主因已消除。

### 4.8.2 授权详情 Accordion（设置页 · 健康数据授权管理）

点击某行（非开关）展开详情面板：数据类型显示「包含字段 / 可访问成员 / 最后同步」；第三方显示「授权范围 / 授权时间 / 使用频率」，撤销按钮移入展开详情内。开关 `event.stopPropagation()` 防冒泡。

```css
/* 需求3：授权详情 Accordion（全部 SoftCare 令牌） */
.auth-card { background:var(--card-bg); border-radius:var(--radius-lg); box-shadow:var(--shadow-card); overflow:hidden; }
.auth-card .settings-item, .auth-card .auth-item { background:transparent; box-shadow:none; border-radius:0; margin-bottom:0; }
.auth-card + .auth-card { margin-top: var(--space-md); }
.auth-row { cursor:pointer; transition:background var(--transition-fast), box-shadow var(--transition-fast); -webkit-tap-highlight-color:transparent; }
.auth-row:active { transform: scale(.98); }
.auth-row:hover { box-shadow: var(--shadow-elevated); }
.auth-row:focus-visible { outline: 2px solid var(--primary); outline-offset: 2px; }
.auth-row.open { background: var(--primary-light); }
.row-chevron { width:18px; height:18px; flex-shrink:0; color:var(--text-tertiary); transition:transform var(--transition-normal); }
.row-chevron svg { width:100%; height:100%; display:block; }
.auth-row.open .row-chevron { transform: rotate(180deg); color: var(--text-secondary); }
.auth-detail { display:grid; grid-template-rows:0fr; transition:grid-template-rows var(--transition-normal); }
.auth-row.open + .auth-detail { grid-template-rows: 1fr; }
.auth-detail-inner { overflow:hidden; min-height:0; padding:var(--space-md) var(--space-lg) var(--space-lg); }
.detail-section + .detail-section { border-top:1px solid var(--divider); padding-top:var(--space-md); margin-top:var(--space-md); }
.detail-label { font-size:13px; font-weight:500; color:var(--text-tertiary); font-family:var(--font-cjk); margin-bottom:var(--space-xs); }
.field-chips, .member-tags { display:flex; flex-wrap:wrap; gap:var(--space-sm); }
.field-chips .tag-pill, .member-tags .tag-pill { cursor:default; background:var(--primary-light); border-color:var(--primary); color:var(--primary); }
.field-chips .tag-pill:hover, .member-tags .tag-pill:hover { background:var(--primary-light); border-color:var(--primary); color:var(--primary); }
.detail-meta { font-size:12px; color:var(--text-tertiary); font-family:var(--font-cjk); line-height:1.5; }
.detail-meta .num { font-family:var(--font-num); color:var(--text-secondary); }
```

**数据驱动**：`settings.authManage.dataTypes[].fields / members / lastSync` 与 `thirdParty[].authorizedTypes / authTime / authExpiry / frequency` 已在 `data.json` / `data.js` 同步补充；`renderAuthManage()` 据此渲染，`revokeAuth()` 改用 `btn.closest('.auth-card').remove()` 整卡移除并在组空时补温和空态（`.settings-version`）。

**Anti-Slop 自检**：
- [x] **无新颜色** — SVG stroke 一律 `currentColor`，由 `.row-chevron{color:var(--text-tertiary)}` 驱动
- [x] **按钮仅用既有类** — 撤销用 `.btn-secondary.danger`，开关用 `.toggle-switch`，未自创
- [x] **圆角全令牌；过渡仅 `--transition-fast/normal`** — 未引入 `.4s`/`.5s` 游离值（`.progress-fill` 既有 `.5s` 为历史遗留，本次不新增）
- [x] **危险操作用 `--error` 令牌**
- [x] **文案温暖非命令式**（"撤销授权""可访问成员""最后同步"）

### 4.8.3 导出进度（复用 `.progress-track` / `.progress-fill`）

`modal-export` 增加默认隐藏的 `.export-progress`（含既有 `.progress-track` + `.progress-fill` + `.modal-desc` 复用）。点「导出」→ 收起三选区 → 进度条 `0→25→50→75→100%`（每段 400ms JS 触发）→ "导出完成！" → 500ms 后 `closeModal` + `showToast('导出成功')`。状态机由 `exportData()` 驱动，`exportTimers[]` 存 setTimeout 便于中断，取消按钮调用 `resetExportUI()`，`resetExportUI()` 复位保证下次打开为干净 IDLE 态。

> 复用既有 `.progress-track`(6px / divider 底) 与 `.progress-fill`(primary 填充 / `.5s` 过渡)，**不新组件、不引入游离过渡值**；400ms 触发 × `.5s` 过渡形成顺滑连续填充。

---

## 4.9 登录页（screen-login）

> 本节约等于「智医助手」微信小程序登录/落地页的设计约定（新增 screen-login）。所有样式均复用 SoftCare v1.2 令牌，**无新颜色、无新字体、无游离过渡值**。登录页为**未登录态**，是全局唯一**不挂载 tab-bar** 的页面（见 N6），仅保留极简 `.status-bar`。

### 4.9.1 页面结构与布局分区

```html
<div class="screen" id="screen-login">
  <div class="status-bar">…（极简，仅时间 + 信号/电量，不挂 tab-bar）</div>
  <div class="content login-content">
    <!-- 品牌区（偏上） -->
    <div class="login-brand">…Logo 徽标 + 产品名 + 价值主张…</div>
    <!-- 中部呼吸留白（flex:1 spacer） -->
    <!-- 操作区（偏下） -->
    <div class="login-actions">
      …主登录按钮 + 次操作入口 + 隐私协议区…
    </div>
    <!-- 非诊疗声明（最底部弱化处理） -->
    <div class="ai-disclaimer">…</div>
    <!-- 演示用「已登录态」开关（原型专用，可置于右上或底部） -->
  </div>
</div>
```

**布局策略**（单屏 390×844，flex column）：
- `.login-content` 覆盖默认 `.content` 底部安全区：`padding: var(--space-xl) var(--space-xl) var(--space-2xl)`（**不再使用 `--tab-bar-safe`**，因无 tab-bar）；`display:flex; flex-direction:column; justify-content:space-between`。
- 品牌区偏上、操作区偏下，中部以 `flex:1` 空白实现呼吸感；整体最大内容宽度即屏宽内边距 `--space-xl`（左右各 20px）。
- 区块间距：品牌区内部元素用 `--space-sm`/`--space-md`；品牌区↔操作区用 `justify-content:space-between` 自然拉开；操作区内部主按钮↔次操作 `--space-md`，次操作↔协议区 `--space-lg`；协议区↔声明 `--space-xl`。

### 4.9.2 组件约定

**① 品牌标识区 `.login-brand`**
- 徽标：复用 `.about-logo` 视觉（圆形 `--primary` 底，白色 line icon，`72px` 圆 / `36px` 图标），保证与「关于」页品牌一致；line icon 用 `SVG.aiAvatar`（白描边，契合「AI 助手」）或自定义医疗 line icon（白色 = `var(--card-bg)`，单色）。
- 产品名「智医助手」：`--font-cjk`，`font-weight:700`，`color:var(--text-primary)`，字号 `20px`（与 `.page-title` 一致）。
- 价值主张「AI 守护每一个家庭的健康」：`--font-cjk`，`font-size:14px`，`color:var(--text-secondary)`，居中。
- 整体 `align-items:center; text-align:center; gap:var(--space-sm)`。

**② 主登录按钮「微信一键登录」—— 复用 `.continue-btn`**
> ⚠️ **类名纠正**：原型中全宽主色按钮的真实类名是 **`.continue-btn`**（§3 已登记），并不存在 `.btn-primary`。登录页**必须复用 `.continue-btn`**，不要另建 `.btn-primary`。
- 外观：占满宽、`padding:16px`、`border-radius:var(--radius-xl)`（20px）、`background:var(--primary)`、`color:#fff`（即 `--card-bg` 白）、`font-size:16px; font-weight:600; font-family:var(--font-cjk)`，最小高度 ≥ 44px（实为满足）。
- 微信图标：按钮内前置一个 **inline SVG 微信双气泡标记**，单色 `fill:var(--card-bg)`（白色，等同按钮文字色，**非新颜色**），尺寸约 `20px`（`--space-xl` 量级），与文字 `gap:var(--space-sm)`。
- **disabled 态（未勾选协议）**：直接给按钮加原生 `disabled` 属性，触发既有 `.continue-btn:disabled{opacity:.5;cursor:not-allowed}`，**无需新 CSS**。
- **loading 态**：点击后 `disabled=true` 防重复，按钮内容替换为「内联 spinner（白，`border:2.5px solid var(--card-bg); border-top-color:transparent`，复用 `@keyframes spin`）+ 文字『登录中…』」，过渡用 `--transition-normal`。成功/失败后复位。

**③ 次操作「手机号登录」—— 文字按钮**
- 无背景、`border:none`、`background:transparent`、`color:var(--text-secondary)`、`font-size:14px; font-family:var(--font-cjk)`、`cursor:pointer`，整体触控 ≥ 44px（用 `padding` 撑高）。
- 点击触发 `showToast('手机号登录即将上线，敬请期待')`（v1.0 占位轻提示），**不跳转**。

**④ 隐私协议区**
- 勾选控件（二选一，均 100% 令牌化）：
  - **方案 A（推荐，语义最佳）**：原生 checkbox 令牌化为方形勾选框 `.agree-check`（见 4.9.3），`22–24px`（`--space-2xl`），`border-radius:var(--radius-sm)`，`1.5px solid var(--border)`，未选 `background:var(--card-bg)`；选中 `background:var(--primary)` + 白色 `SVG.check`。
  - **方案 B（零新 CSS）**：复用 `.toggle-switch`（48×28，≥44px 触控），开启即视为已同意。
  - 触控 ≥ 44px：用外层 `<label>` 的 `padding` 撑出 ≥44px 点击区。
- 协议文字：「阅读并同意」用 `--text-secondary`；《用户协议》《隐私政策》为 `<a>` 链接，`color:var(--primary)`、`text-decoration:none`、`font-weight:500`，点击 `showToast` 或打开对应页（原型阶段可 `showToast('查看《用户协议》')`）。
- **联动**：未勾选时主按钮 `disabled`（见 ②）；勾选后启用。

**⑤ 非诊疗声明 —— 复用 `.ai-disclaimer`**
- 直接复用既有 `.ai-disclaimer` + `SVG.shieldInfo`：`font-size:11px`、`color:var(--text-tertiary)`、居中、`margin-top:var(--space-md)`。文案如「本产品提供健康参考信息，不构成诊疗建议，如有不适请及时就医。」

**⑥ 演示「已登录态」开关（原型专用）—— 复用 `.toggle-switch`**
- 复用 `.toggle-switch`（4.3），label「演示：已登录态」用 `--text-tertiary`/`--font-cjk`/`12px`，置于登录页右上角或底部；默认 **未开启**（对应 N2 默认未登录）。开启时原型可模拟跳过登录直达 home。

### 4.9.3 新增令牌化组件 CSS（仅协议勾选框，其余均复用既有类）

```css
/* 4.9 登录页 · 协议勾选框（仅此一处为令牌化新小组件，全用 SoftCare 令牌） */
.agree-check {
  position:relative; width:24px; height:24px; flex-shrink:0;
  border:1.5px solid var(--border); border-radius:var(--radius-sm);
  background:var(--card-bg); cursor:pointer;
  transition:background var(--transition-fast), border-color var(--transition-fast);
  -webkit-tap-highlight-color:transparent;
}
.agree-check:active { transform:scale(.96); }
.agree-check.checked { background:var(--primary); border-color:var(--primary); }
.agree-check svg { width:14px; height:14px; position:absolute; inset:5px; display:none; }
.agree-check.checked svg { display:block; }   /* SVG.check 用 fill:var(--card-bg) 白色对勾 */
.login-agree-row { display:flex; align-items:flex-start; gap:var(--space-sm); padding:var(--space-sm) 0; min-height:44px; cursor:pointer; }
.login-agree-text { font-size:12px; line-height:1.5; color:var(--text-secondary); font-family:var(--font-cjk); }
.login-agree-text a { color:var(--primary); text-decoration:none; font-weight:500; }
```

> 微信图标 inline SVG（白 = `var(--card-bg)`，单色，无新色）：
> ```html
> <svg viewBox="0 0 24 24" fill="var(--card-bg)" aria-hidden="true"><path d="…微信双气泡路径…"/></svg>
> ```
> （具体 path 由 prototype-builder 取标准微信 glyph；仅保证 `fill` 用 `var(--card-bg)`，不引入新色块。）

### 4.9.4 交互状态映射（全部用现有令牌，禁止新颜色/新过渡）

| 交互状态 | 视觉表现 | 实现 |
|---------|---------|------|
| 未勾选协议 | 主按钮 `disabled` → `opacity:.5` + `cursor:not-allowed`；勾选框未填充 | 原生 `disabled` 属性；`.continue-btn:disabled` 既有样式 |
| 点击登录 | 按钮 `disabled=true` 防重复；内联白 spinner + 「登录中…」；过渡 `--transition-normal` | 见 ② loading 态 |
| 登录成功 | 复位按钮 → `switchScreen('home')`（N4） | 调用 `API.smartLogin()` 成功回调 |
| 登录失败 | 复位按钮（去 disabled）；`showToast('登录失败，请重试')` 轻提示 | `API.smartLogin()` catch |
| 手机号登录 | `showToast('手机号登录即将上线，敬请期待')` 占位 | 见 ③ |
| 退出登录回 login | 清登录态 → `switchScreen('screen-login')` 并复位勾选/按钮 | 见 N3 |
| 演示已登录态开 | 模拟跳过登录直达 home（原型专用） | `.toggle-switch.active` 状态读取 |

### 4.9.5 Anti-Slop 注记（给 prototype-builder 的红线）

- [x] **无新颜色** — 微信图标 `fill:var(--card-bg)`（白）、勾选对勾 `fill:var(--card-bg)`、loading spinner 用 `var(--card-bg)`；其余一律 `:root` 令牌。
- [x] **圆角仅令牌** — 按钮 `--radius-xl`、勾选框 `--radius-sm`、开关 `--radius-pill`；不出现 10/14/18px 等游离值。
- [x] **过渡仅令牌** — 仅用 `--transition-fast`(`.15s`)/`--transition-normal`(`.25s`)/`--transition-slow`(`.35s`)，复用既有 `@keyframes spin`。
- [x] **不新增字体** — 中文 `var(--font-cjk)`，数字（若有）`var(--font-num)`。
- [x] **背景非纯白** — 登录页背景 `var(--bg)`（#F5F4F1）；按钮/徽标上的白为 `--card-bg`，属既有按钮文字色，非页面背景。
- [x] **主色不过载** — `--primary` 仅用于：品牌徽标底、主按钮、勾选选中态、链接文字；不铺大面积背景。
- [x] **复用既有类** — 主按钮 `.continue-btn`、开关 `.toggle-switch`、声明 `.ai-disclaimer`、toast `.toast`、跳转 `switchScreen`；不另建 `.btn-primary`。
- [x] **触控 ≥44px** — 主按钮（≥44px）、次操作（padding 撑高）、勾选行（`.login-agree-row` min-height:44px）、开关（48×28）均达标。
- [x] **导航链路** — N1 启动默认进 `screen-login` 且**不自动调用** `API.smartLogin()`；N2 默认未登录；N3 退出回 `screen-login` 清态；N4 成功 `switchScreen('home')`；N5 `screen-login` 注册进 `screenOrder` 首位；N6 不挂 tab-bar。

---

*文档版本: 1.3 | 由设计系统专家彩格调(Cai)生成，原型构建师筑原型(Zhu)补充 4.8，登录页 4.9 由 Cai 补充 | 适用于智医助手原型迭代 | v1.3 变更：新增 §4.9 登录页（screen-login）设计约定——布局分区、组件复用映射（`.continue-btn` 纠正 `.btn-primary`、协议勾选框令牌化、微信图标 `var(--card-bg)` 白）、交互状态表、Anti-Slop 注记；并将 screen-login 纳入 §8 页面-组件映射表；v1.2 变更：Tab 栏安全区派生变量（4.8.1）、授权详情 Accordion（4.8.2）、导出进度（4.8.3）*