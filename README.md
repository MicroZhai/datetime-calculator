# 时间计算器

轻量级 PWA 日期时间计算工具，支持多段时间链式计算。

## 功能

- **多段时间链** — 每段独立设置开始时间和时长，三段联动（开始/时长/结束）
- **计算历史** — 自动记录每次保存，支持复用历史、复制详情
- **置顶卡片** — 右键菜单一键置顶，优先排列
- **折叠展开** — 过程详情默认展开，虚线分隔，竖线时间轴
- **深色模式** — 浅色暖调 / 深色纯黑 / 跟随系统，一键切换
- **微网格纹理** — 全局 20px 圆点网格背景，深浅色自适应
- **毛玻璃弹窗** — 弹窗遮罩 backdrop-filter 模糊效果
- **触觉反馈** — 按钮弹性按压、FAB 波纹、菜单逐项滑入
- **桌面快捷菜单** — PWA 长按图标弹出新建/历史
- **离线可用** — Service Worker 网络优先缓存策略

## 技术栈

纯 HTML/CSS/JS，无框架，无构建工具，零依赖。

## 文件结构

```
datetime-calculator/
├── index.html          # 主页面
├── manifest.json       # PWA 清单（9 尺寸图标 + 快捷菜单）
├── sw.js               # Service Worker
├── README.md
├── css/
│   └── style.css       # CSS 变量主题 + 全部样式
├── js/
│   ├── storage.js      # 计算器 + 主题 + 时长历史持久化
│   ├── history.js      # 计算历史记录（上限 50 条）
│   ├── calculator.js   # 时间计算核心（8 个方法）
│   ├── theme.js        # 浅色/深色/自动 + meta theme-color
│   ├── ui.js           # UI 渲染 + 编辑器 + 联动逻辑
│   └── app.js          # 入口 + 全部事件绑定 + SW 注册
└── icons/              # PWA 图标（192 + 512）
```

## 数据存储

| localStorage 键 | 内容 | 上限 |
|------|------|------|
| `dtc_calculators` | 计算器列表 | — |
| `dtc_history` | 计算历史 | 50 条 |
| `dtc_duration_history` | 时长输入历史 | 20 条 |
| `dtc_theme` | 主题：auto/light/dark | — |

## 部署

将项目文件夹放到任意 HTTP 服务器即可。推荐 GitHub Pages / Vercel。需 HTTPS 才能启用 PWA。

## 浏览器支持

Chrome / Edge / Safari / Firefox 现代版本，移动端完全适配。
