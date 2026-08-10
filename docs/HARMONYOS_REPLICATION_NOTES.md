# HarmonyOS / ArkTS 复刻注释索引

这份索引用来辅助把 Web 版本复刻为 HarmonyOS ArkTS/ArkUI。复刻目标是保持同一套状态、算术和交互契约，不是把 DOM 逐个翻译成组件。

## 1. 推荐分层

| 层 | Web 实现 | ArkTS 对应方向 |
|---|---|---|
| 精确算术 | `js/duration-precision.js`、`js/duration-core.js` | 纯计算服务；毫秒使用 `BigInt` 或等价的任意精度整数 |
| 日期映射 | `js/date-mapper.js` | 本地时区日期 Adapter；处理夏令时、闰年、越界和负时长 |
| 历史持久化 | `js/history-store.js` | JSON-safe Store；读取时先迁移和校验，再交给 UI |
| 编辑状态 | `js/calculator-state.js` | Snapshot / restore / undo 状态模型 |
| Web 运行时桥 | `js/calculator-state-runtime.js` | 将共享状态连接到页面渲染和历史恢复 |
| 视觉适配 | `css/display-surface.css`、`css/responsive.css` | ArkUI 布局资源和断点策略 |

## 2. 输入语义

- 数字按钮提交 `data-digit`：`7`、`8`、`9`、`00`、`.` 等。
- 单位按钮提交 `data-unit`：`d`、`h`、`m`、`s`。
- 运算按钮提交 `data-op`：`+`、`-`。
- 功能按钮提交 `data-action`：`clear`、`back`、`colon`、`equals`、`date-toggle`。
- “输入数字后选择单位”是未提交的 `numberBuffer`，不能直接参与计算。
- `=` 才提交当前表达式并保存历史；点击结果只切换显示格式，不改变精确值。

## 3. 显示区尺寸契约

- 默认状态/结束信息行：`36px` 高，字体 `14px`，行高 `18px`。
- 短屏手机：状态行 `32px / 13px / 16px`；极窄屏为 `28px / 12px / 14px`。
- 日期和提示属于同一个状态行：日期左对齐、提示右对齐，禁止自动换行；空间不足时省略文本。
- 输入表达式行：`48px` 高；数字文字使用 `20px / 28px`，上下留白各约 `10px`。
- 结果区的结束日期和辅助结果独立放在底部同一行，使用与顶部相同的元信息节奏。
- 不要给键盘区复用显示区的高度；键盘是独立 Action Surface。

## 4. 键盘和响应式布局

- 键盘固定为四列六个逻辑行，`=` 纵向跨越第 4～6 行。
- 触控目标不低于项目定义的最小尺寸；间距和圆角从统一 token 读取。
- 手机、平板、桌面可以改变容器排列，但不能改变按钮语义和计算状态。
- 顶部/底部安全区必须通过系统 inset 处理；不要把浏览器地址栏高度写入生产布局。

## 5. 日期、清空、历史

- 日期锚点是独立上下文：清空计算表达式不会清除日期；日期按钮才负责添加或移除日期。
- 日期结果只影响结束日期显示，不影响纯时长计算。
- 历史记录保存完整表达式、精确结果和日期上下文；恢复后必须还能继续编辑。
- 所有持久化数据进入 UI 前必须经过 schema migration 和严格校验。

## 6. 语言和主题

- 首次进入使用系统语言判断；之后使用用户在设置中选择并持久化的语言。
- 语言切换必须覆盖按钮文本、动态提示、错误提示、标题、`aria-label` 和 `title`。
- 主题默认跟随系统；用户选择浅色/深色后独立持久化，不与语言设置混用。

## 7. 验证入口

```text
npm test
```

重点共享向量：

- `tests/duration-core-vectors.json`
- `tests/date-edge-vectors.json`
- `tests/cross-platform-conformance-vectors.json`
- `tests/persistence-integrity-vectors.json`
- `tests/schema-migration-vectors.json`

ArkTS 版本应优先复用这些向量，确认状态和结果一致后再做 ArkUI 视觉验收。
