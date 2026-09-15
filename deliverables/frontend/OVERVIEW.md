# 智医助手 · 设置页及子功能原型 — 交付概览

> 设计引擎团队（design-engine-settings）交付物 · 2026-07-10

## 一、任务背景
用户提供设置页截图，要求：① 按截图补齐设置页；② 核查现有原型中"未实现"的功能，全部设计实现为原型。

核查结论：现有 14 页原型已有 `screen-settings` 骨架，但 **5 个子功能均为 `showToast('功能开发中')` 占位**，需落地为真实原型。

## 二、本次交付内容（原 5 占位 → 真实原型）

| # | 功能 | 形态 | 关键交互 |
|---|------|------|---------|
| 1 | 健康数据授权管理 | 独立子页面 `screen-auth-manage` | 数据类型授权 toggle 列表 + 第三方应用授权撤销列表（末项撤销回显空态） |
| 2 | 导出健康数据 | 底部 sheet 弹窗 `modal-export` | 范围/格式单选 + 数据类型多选 → 导出 toast |
| 3 | 清除本地缓存 | 确认弹窗 `modal-clear` | 显示缓存大小（数据驱动）→ 清除 toast + 同步归零 |
| 4 | 修改密码 | 独立子页面 `screen-change-pwd` | 3 个 44px 密码框 + 实时校验（强度/两次一致） |
| 5 | 退出登录 | 确认弹窗 `modal-logout` | 危险按钮 → 退出 toast |

## 三、设计决策
- **设计系统**：100% 复用既有 **SoftCare**（v1.0 → v1.1），零新增颜色/令牌。
- **关键补全**：设计系统原缺 modal / confirm-dialog 组件，本轮新增 **4.7 Modal** 规范（`modal-mask` / `modal-sheet` / `modal-title` / `modal-desc` / `modal-actions` + `.auth-item`），覆盖导出、清缓存、退登三类场景；危险操作统一用 `--error`。

## 四、质量审查（Phase 4）
- **一轮 REVISE** → 2 项 Anti-Slop FAIL（开关圆角 14px 非令牌、授权作用域文字对比度 2.8:1 不达标）
- **修正后二轮 PASS**：11/11 Anti-Slop 通过，5 维度均 4 分（哲学/层次/执行/特异性/克制）
- 报告：`QUALITY-REVIEW-REPORT.md`

## 五、文件清单
| 文件 | 说明 |
|------|------|
| `zhiyi-assistant-prototype.html` | **主交付物**（3,532 行，≈160KB，含 14 原页 + 2 新页 + 3 弹窗） |
| `data.json` / `data.js` | 数据驱动配置（settings.action、authManage 等），两文件同步 |
| `DESIGN-SYSTEM.md` | v1.1，含 4.7 Modal 组件规范 |
| `QUALITY-REVIEW-REPORT.md` | 5 维评审 + Anti-Slop 门控报告 |

## 六、预览方式
- 本地预览：`http://localhost:8080/zhiyi-assistant-prototype.html`（python http.server 8080 后台运行中）
- 离线分发：将 `zhiyi-assistant-prototype.html` + `data.js` 置于同目录，双击 HTML 即可（字体走系统回退；动态业务数据需连接 NestJS 后端）

## 七、已知边界（非阻塞）
- 原型依赖同目录 `data.js` 注入静态配置，非纯单文件（随静态服务共置，独立可运行）；动态业务数据经 NestJS 后端 `syncFromBackend()` 填充。
- 中文字体走 Google Fonts CDN，离线自动回退系统字体（PingFang / 微软雅黑），版式不破。
