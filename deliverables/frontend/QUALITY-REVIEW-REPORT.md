# 质量审查报告 — 智医助手「设置页及子功能」原型

> 审查对象：`zhiyi-assistant-prototype.html`（单文件高保真原型）
> 重点范围：screen-auth-manage、screen-change-pwd、3 个 modal（export/clear/logout）、改写后的设置页交互、新增 CSS 4.7 合集
> 对照规范：DESIGN-SYSTEM.md v1.1 | 审查官：严过审（Yan）

---

## 一、5 维度评分

| 维度 | 评分 | 说明 |
|------|------|------|
| 设计哲学 (Philosophy) | **4 / 5** | 延续 SoftCare「暖灰白 + 森林绿」语言，文案温和（"您""请""本地健康数据将保留"），无命令式。扣 1 分仅因个别细节未完全 token 化（见 P2），非哲学偏离。 |
| 视觉层次 (Hierarchy) | **4 / 5** | 设置页/授权页/改密页/弹窗均有清晰 `section-label → 行项 → 次级说明` 三级，字号/字重/颜色分级正确。扣 1 分因 auth-manage 数据类型行整行带 `cursor:pointer` 但仅 toggle 可点，略具误导性。 |
| 执行质量 (Execution) | **4 / 5** | 数据驱动 `actionToOnclick`，5 个设置条目全部正确映射（screen/modal），弹窗开关/撤销/实时校验逻辑可用，组件严格复用令牌。扣 1 分因若干体验细节（撤销空态、原密码提示、弹窗定位，见 P2）。 |
| 特异性 (Specificity) | **4 / 5** | 贴合"家庭健康"：授权项含血压/血糖/用药/档案，第三方为微信运动/智能血压计/体检中心，弹窗 23.5MB / 导出类型具体。扣 1 分因改密页本身为通用表单（不可避免）。 |
| 克制 (Restraint) | **4 / 5** | 无新颜色，主色仅用于按钮/选中态/激活开关，危险操作用 `--error`，无多余装饰。扣 1 分因 toggle `14px` 游离圆角 + `#FFFFFF` 旋钮未用 `var(--card-bg)`。 |

**总分：20 / 25**（各维度均 ≥ 3）
**结论：PASS（初评 REVISE，复评已修正通过）** — 初评 Anti-Slop 的 2 项 FAIL 已由 prototype-builder 全部修复，审查官独立复核文件实证通过，详见文末「六、复评记录」。

---

## 二、Anti-Slop 门控检查（逐项）

| # | 检查项 | 结果 | 证据 / 说明 |
|---|--------|------|------------|
| 1 | 无新增 `#` 硬编码颜色 | ✅ PASS | 新增 CSS(775-839) 与 HTML(972-1045) 仅用 `var()` 及 `rgba(0,0,0,.4)`（规范 sanction 遮罩黑）；SVG 用 `#1A1A18/#3D8A5A/#fff` 均属令牌色值。 |
| 2 | 主色未大面积铺色（<15%） | ✅ PASS | `--primary` 仅出现在按钮实色、激活开关、选中态，均为小面积。 |
| 3 | 按钮只用 `.continue-btn`/`.btn-secondary`(含.danger) | ✅ PASS | 含 `.auth-item .btn-secondary.danger` 内联变体（属既有类修饰，非自创样式）。 |
| 4 | 输入框 44px + 聚焦光环 | ✅ PASS | `.form-input{height:44px}`，`:focus{box-shadow:0 0 0 3px var(--primary-light)}`（行 632-634）。 |
| 5 | 圆角只用令牌值（无 10/14/18px） | ❌ **FAIL** | `.toggle-switch{border-radius:14px}`（行 650）为非令牌值。虽为 DESIGN-SYSTEM 4.3 规范原文，但与 Anti-Slop「圆角统一：新组件不沿用 14px」条款冲突 → 需规范对齐。 |
| 6 | 过渡只用令牌（无 0.3s/0.5s） | ✅ PASS | modal 用 `var(--transition-normal/slow)`；唯一 `0.5s` 在既有 `.progress-fill`(行 368)，非新增。 |
| 7 | 数字用 `var(--font-num)` / `.num` | ✅ PASS | modal-clear `23.5` 包 `<span class="num">`（行 1026），`.num` 已设 `font-family:var(--font-num)`。 |
| 8 | 危险操作按钮用 `--error` | ✅ PASS | 清除/退出=`.continue-btn.danger`（`background:var(--error)`）；撤销/退登=`.btn-secondary.danger`（`color/border:var(--error)`）。 |
| 9 | 页面结构完整 | ✅ PASS | 两新屏均为 `.screen > .status-bar + .content + .tab-bar-container`（行 972-983）。 |
| 10 | 文案温暖、非命令式 | ✅ PASS | "请输入您当前使用的登录密码""退出后需重新登录，本地健康数据将保留"等，语气温和。 |
| 11 | ⚠️ 文本对比度 WCAG AA | ❌ **FAIL** | 新增 `.auth-scope` 用 `var(--text-tertiary)`(#9B9B98) 于白卡，对比度约 **2.8:1**，未达 AA(4.5:1)。同 `settings-value` 既有模式亦如此，属系统性问题，但直接影响新页 scope 文案。 |

**Anti-Slop 结论（初评）：2 项 FAIL（#5 圆角、#11 对比度）→ REVISE；复评均已修复，现 11/11 PASS（见第六节）。**

---

## 三、问题清单与修复建议（按优先级）

### P1（建议修复，影响品质 / 触发门控）

**P1-1 · 文本对比度不达标（新页 scope 文案）**
- 位置：行 838 `.auth-item .auth-scope { color:var(--text-tertiary); }`
- 问题：`--text-tertiary`(#9B9B98) 在白卡上对比度 ≈2.8:1，低于 WCAG AA 4.5:1。
- 修复：改为 `color:var(--text-secondary);`（#6B6B68，对比度升至 ≈5.3:1，过 AA）。若希望保留视觉层级，可同步全局将 `--text-tertiary` 调深至约 `#8A8A87`（≈3.5:1，仍不足，故首选改 scope 用 secondary）。

**P1-2 · toggle-switch 游离圆角 14px（规范内部矛盾）**
- 位置：行 650 `.toggle-switch { border-radius:14px; }`
- 问题：非令牌值，触发 Anti-Slop「圆角统一」条款；但 4.3 规范原文即写 14px，属文档自相矛盾。
- 修复：实现侧改 `border-radius:var(--radius-pill);`（36px，对 28px 高元素渲染等价全圆，且 100% 令牌合规）。同时请设计系统专家在 DESIGN-SYSTEM 4.3 与 Anti-Slop「圆角统一」两条规则间消除矛盾（明确 14px 为受控例外，或统一改用令牌）。

### P2（可选优化，建议顺手处理）

**P2-3 · 撤销最后一项不回显空状态**
- 位置：`revokeAuth`（行 2239-2246）撤销后仅 `item.remove()`，未复渲染；初渲染空态（行 2259-2261 "暂无已授权的第三方应用"）在撤销最后一项后不出现。
- 修复：撤销后调用 `renderAuthManage();` 复渲染（或判断剩余为 0 时插入空态节点）。

**P2-4 · 原密码字段无错误提示文案**
- 位置：`submitChangePwd`（行 2479-2516），oldEl 为空时仅加 `.error` 红框，但 `pwd-old` 无对应 hint 元素，用户不知为何报错。
- 修复：为 `pwd-old` 增加 `<div class="form-hint" id="pwd-old-hint">` 并在校验失败时填"请输入当前密码"。

**P2-5 · 弹窗遮罩在桌面宽屏下铺满视口**
- 位置：`.modal-mask{position:fixed;inset:0}`（行 781），依赖 viewport 定位；在桌面演示时遮罩会盖住手机框外部整个浏览器，弹窗 sheet 虽 `max-width:390px` 居中但整体观感溢出设备。
- 修复：将 `.phone-frame` 设为 `position:relative;overflow:hidden`，遮罩改 `position:absolute` 限定在设备内；或保持 fixed 但接受当前行为（演示多在设备宽度下）。

**P2-6 · toggle 旋钮颜色未用令牌**
- 位置：行 651 `.toggle-switch::after{background:#FFFFFF;}`。
- 修复：改 `background:var(--card-bg);`，统一令牌引用（系统级一致性，非引入新颜色）。

**P2-7 · 清除缓存数字硬编码、与数据源两处**
- 位置：行 1026 modal 文案 "将清除 `<span class="num">23.5</span> MB`" 为静态硬编码，`clearCache` 后 settings 值改 '0MB'（行 2420-2421）；data.json `清除本地缓存.value="23.5MB"` 为同源第二处。
- 修复：由 JS 在打开 modal 时注入 `D.settings.data` 中对应 value，保证单一数据源。

**P2-8 · data.json 残留死 toast 字段**
- 位置：privacy[0]/data[0]/account[0] 仍保留 `"toast":"...功能开发中"`，现已被 `action` 覆盖永不触发，易误导后续维护。
- 修复：删除这 3 处冗余 `toast` 字段（action 优先分支已忽略 toast）。

---

## 四、交互模拟与数据映射核验

| 设置条目 | data.json action | 解析结果 | 目标存在 | 结论 |
|---------|-----------------|---------|---------|------|
| 健康数据授权管理 | `screen:auth-manage` | `switchScreen('auth-manage')` | ✅ screen-auth-manage | 正确 |
| 修改密码 | `screen:change-pwd` | `switchScreen('change-pwd')` | ✅ screen-change-pwd | 正确 |
| 导出健康数据 | `modal:export` | `openModal('modal-export')` | ✅ modal-export | 正确 |
| 清除本地缓存 | `modal:clear` | `openModal('modal-clear')` | ✅ modal-clear | 正确 |
| 退出登录 | `modal:logout` | `openModal('modal-logout')` | ✅ modal-logout | 正确 |

- 改密页：3 个 44px 输入框、`oninput` 实时校验正则 `^(?=.*[A-Za-z])(?=.*\d).{8,}$`、`submitChangePwd` 全量校验后 `switchScreen('settings')` 返回 —— 逻辑可用。
- 弹窗：3 个 `.modal-mask` 均绑定点击遮罩关闭（行 2398-2400），`openModal/closeModal` 增删 `.show` 类，动画用 `translateY(100%→0)` + 遮罩淡入 —— 符合 iOS 底部 sheet 规范。
- 授权页：数据类型 toggle 调 `toggleDataType` 出 toast；第三方 `revokeAuth` 从数据与 DOM 双删 —— 逻辑正确（仅缺空态回显，见 P2-3）。

---

## 五、总判定

**REVISE（需修正，非重做）。**

- 5 维度均 ≥ 3（总分 20/25），实现质量整体优秀，组件严格复用 SoftCare 令牌，5 个设置子单元映射齐全、交互可用。
- Anti-Slop 门控 **2 项 FAIL**：#5 toggle 14px 游离圆角（规范内部矛盾，P1-2）、#11 auth-scope 三级文字对比度不足（P1-1）。依规则判 REVISE。
- 两处 FAIL 均为**低危、快速可修**：P1-1 改 1 行颜色；P1-2 改 1 个值并请规范作者消歧。建议 prototype-builder 修复 P1-1/P1-2 后可直接转 PASS；P2 项可一并顺手处理。

> 备注：本审查聚焦 Phase 3 新增/改写内容；#11 对比度隐患源于既有 `--text-tertiary` 令牌在白底上的系统性偏弱，建议设计系统专家在下一轮统一评估该令牌值，惠及全站而非仅新页。

---

## 六、复评记录（REVISE → PASS）

prototype-builder 应用 8 项修正后，审查官**独立复核文件实际状态**（非仅采信声明），确认如下：

| 原问题 | 文件实证 | 复评 |
|--------|---------|------|
| P1#1 auth-scope 对比度 | 行 838 已改 `color:var(--text-secondary)`（#6B6B68，白底 ≈5.3:1，过 WCAG AA） | ✅ 通过 |
| P1#2 toggle 14px 圆角 | 行 650 已改 `border-radius:var(--radius-pill)`（令牌合规；28px 高元素上渲染等价全圆，开关视觉/translateX(20px) 不变） | ✅ 通过 |
| P2#3 撤销空态 | 行 2453-2464 `revokeAuth` 末项时调 `renderAuthManage()` 复现「暂无已授权的第三方应用」 | ✅ 通过 |
| P2#4 原密码提示 | 行 2277 新增 `#pwd-old-hint`；`submitChangePwd` 空提交时置错误态并填「请输入当前密码」 | ✅ 通过 |
| P2#6 旋钮颜色 | 行 651 已改 `background:var(--card-bg)`（统一令牌引用） | ✅ 通过 |
| P2#7 清缓存数字 | 行 1026 改 `<span id="clear-cache-size">`；`openModal('modal-clear')` 调 `fillClearCacheSize()`（行 2397/2403）从 data.json 注入 | ✅ 通过 |
| P2#8 死 toast | data.json / data.js 中 privacy[0]/data[0]/data[1]/account[0] 占位 toast 已删；全文无 `功能开发中`；仅余 about.contacts 3 个真实 toast | ✅ 通过 |
| P2#5 弹窗定位 | 依初评备注「可选、保持现状」未改（position:fixed），不影响移动端演示，不阻 PASS | ⚪ 豁免 |

**复评 Anti-Slop：** #5 圆角、#11 对比度两项 FAIL 均已消除，**11/11 检查项 PASS**。
**复评 5 维度：** 仍均 ≥3（哲学 4 / 层次 4 / 执行 4 / 特异性 4 / 克制 4）。
**最终判定：PASS** —— 可交付 team-lead。

> 遗留项复核（已关闭）：初评曾提 DESIGN-SYSTEM.md 4.3 与 Anti-Slop「圆角统一」矛盾（border-radius:14px）。经 design-system-expert 提示并审查官独立复核**当前** DESIGN-SYSTEM.md —— 4.3 行 281 已为 `var(--radius-pill)` 并附圆角说明，Anti-Slop 圆角统一 行 776 已显式点名「开关类 28px 高元素用 --radius-pill 属令牌合规」；全文 grep `border-radius:14px` **零命中**。确认 规范 = Anti-Slop = 代码 三者一致，初判系基于修复前快照的误报，无需任何返工。
