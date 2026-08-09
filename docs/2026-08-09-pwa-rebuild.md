# 2026-08-09 PWA 重构记录

## 决策

`MicroZhai/datetime-calculator` 从旧版“多时段日期时间计算器”直接重构为新的“时长算术计算器”。

继续使用原 GitHub Pages 地址和 PWA 安装入口，不再保留旧版 UI/业务代码作为运行路径。

## 当前产品基线

- 持续时间语义，不解释为钟表时刻
- 数字后选择 `天 / 时 / 分 / 秒`
- `H:MM` / `H:MM:SS` 冒号快捷输入，小时允许超过 24
- 显式单位支持小数、自由顺序、重复输入和规范化
- 多行 `+ / −` 运算
- `=` 只结算，不创建空行
- 已提交行、时间片段和运算符均可编辑
- 允许负结果
- 支持天时分秒、总小时、总分钟三种结果格式
- 历史保存结构化表达式快照，恢复后以独立副本继续编辑

## PWA

GitHub Pages：

`https://microzhai.github.io/datetime-calculator/`

部署源保持：`master` 分支仓库根目录。

Service Worker 使用新的缓存命名空间，激活时清理旧缓存，避免旧版资源长期残留。

## 当前运行文件

- `index.html`
- `manifest.json`
- `sw.js`
- `css/duration-calculator.css`
- `js/duration-core.js`
- `js/duration-ui.js`
- `js/duration-app.js`
- `icons/icon-192.png`
- `icons/icon-512.png`

## 已淘汰运行代码

以下旧模块不再属于当前运行架构：

- `js/calculator.js`
- `js/history.js`
- `js/notification.js`
- `js/storage.js`
- `js/theme.js`
- `js/ui.js`
- `js/ui-render.js`
- `js/ui-sheet.js`
- `js/ui-history.js`
- `js/app.js`

旧实现仍保留在 Git 历史中用于追溯。
