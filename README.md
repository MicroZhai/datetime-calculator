# 时间计算器

一个可安装、可离线使用的 PWA 时长算术计算器。

2026-08-09 起，项目已完成一次产品方向重构：旧版“多时段日期时间计算器”不再作为主产品，访问主页后直接进入新的时长算术计算器。

## 核心交互

- 数字后选择 `天 / 时 / 分 / 秒`，例如 `2 → 天` 得到 `2天`
- 支持 `H:MM` / `H:MM:SS` 冒号快捷输入，小时可超过 24
- 显式单位允许自由顺序、重复输入并自动规范化
- 支持多行 `+ / −` 连续运算，`=` 只负责结算
- 支持点击已提交行、时间片段与运算符继续编辑
- 支持负时长结果
- 支持天时分秒 / 总小时 / 总分钟结果切换
- 历史保存完整结构化表达式，可恢复后继续编辑
- PWA 可安装到桌面，并通过 Service Worker 离线使用

## 当前文件结构

```text
datetime-calculator/
├── index.html
├── manifest.json
├── sw.js
├── README.md
├── css/
│   └── duration-calculator.css
├── js/
│   ├── duration-core.js
│   ├── duration-ui.js
│   └── duration-app.js
└── icons/
    ├── icon-192.png
    └── icon-512.png
```

- `duration-core.js`：结构化表达式、时长运算、历史数据与核心状态
- `duration-ui.js`：显示、输入、编辑、边界处理
- `duration-app.js`：事件绑定、历史入口和 PWA 启动逻辑

## 部署

GitHub Pages 使用仓库 `master` 分支根目录：

`https://microzhai.github.io/datetime-calculator/`

原地址保持不变，因此原浏览器书签和已安装 PWA 不需要更换入口。

旧版代码仍可通过 Git 历史查看。
