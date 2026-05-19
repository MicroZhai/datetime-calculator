# 时间计算器

一个轻量级 PWA 日期时间计算工具，支持多段时间链式计算。

## 功能

- **多段时间链**：支持多个时段顺序计算，每段独立设置开始时间和时长
- **双向联动**：开始时间、时长、结束时间三者联动，修改任一自动计算其余
- **置顶卡片**：重要计算器可置顶，始终排在最前
- **计算历史**：自动记录每次保存，支持复用历史计算
- **深色模式**：支持浅色/深色/跟随系统三种主题
- **桌面快捷菜单**：添加到手机主屏幕后长按图标弹出快捷菜单
- **离线可用**：PWA 支持，首次加载后可离线使用

## 技术栈

纯 HTML/CSS/JS，无框架，无构建工具，零依赖。

## 文件结构

```
datetime-calculator/
├── index.html          # 主页面
├── manifest.json       # PWA 清单
├── sw.js               # Service Worker（网络优先缓存策略）
├── README.md
├── css/
│   └── style.css       # 全部样式（CSS 变量主题切换）
├── js/
│   ├── storage.js      # 数据持久化（localStorage）
│   ├── history.js      # 计算历史记录
│   ├── calculator.js   # 时间计算核心
│   ├── theme.js        # 主题切换
│   ├── ui.js           # UI 渲染与交互
│   └── app.js          # 入口与事件绑定
└── icons/              # PWA 图标（72-512px）
```

## 数据存储

所有数据存储在浏览器 localStorage 中：

| 键 | 内容 |
|------|------|
| `dtc_calculators` | 计算器列表 |
| `dtc_history` | 计算历史（最多 50 条） |
| `dtc_duration_history` | 时长输入历史（最多 20 条） |
| `dtc_theme` | 主题设置 |

## 部署

1. 将项目文件夹放到任意 HTTP 服务器
2. 推荐使用 GitHub Pages / Vercel / Netlify 一键部署
3. 需要 HTTPS 才能使用 PWA 功能

## 浏览器支持

所有现代浏览器（Chrome / Edge / Safari / Firefox），移动端完全适配。
