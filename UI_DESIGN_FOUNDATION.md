# 时间计算器 UI Design Foundation

> 基线：Zhai Design Language v1.2 / Universal Template v1.3 / Platform Patterns v1.1。
>
> 本文件只记录本项目长期设计规则；页面级临时判断不在这里扩张为通用规则。

## 1. Platform / Window Profile

- 产品形态：可安装、可离线使用的 Web PWA。
- 主要设备：手机竖屏，触控优先；同时支持平板、电脑、横屏与分屏窗口。
- 次要输入：桌面 / 平板浏览器的键盘与鼠标。
- 主题：提供 `跟随系统 / 浅色 / 深色` 三种模式；默认跟随系统，手动选择持久化；Light / Dark 保持相同层级和交互职责。
- Width 使用 Zhai min-width：xs `<320`、sm `≥320`、md `≥600`、lg `≥840`、xl `≥1440`。
- Height 仍使用 Regular `≥820` / Compact `680–819` / Short `<680` 作为语义 Profile，但常见窗口尺寸通过 `clamp()` 流体变化，避免跨阈值突变。
- xs / sm：默认手机 Stack；空间不足优先让 Expression 内部滚动，不把 Keypad 推出视区。
- md `600–839`：正常 / 高窗口保持单任务居中 Stack，并设置舒适工作区高度上限；短窗口转 Split。
- lg `≥840`：允许同一计算任务使用左右 Split；不新增 SideBar、Card 或第二业务工作区。
- 响应式判断不按手机 / 平板 / PC 型号分支，而由实际窗口宽度、高度、方向和输入上下文决定。

## 2. Core Task

用户的核心任务是：

1. 快速输入一个或多个时长；
2. 可选加入一个“基准日期时间”，将持续时间结果映射为结束日期时间；
3. 使用 `+ / −` 形成连续表达式；
4. 实时确认当前结果；
5. 必要时编辑已输入的行、片段、运算符或基准时间；
6. 按 `=` 结算并进入历史；
7. 从历史恢复完整表达式与基准时间继续编辑。

核心算术始终使用“持续时间”语义。基准日期时间是表达式的可选锚点，只负责把时长结果映射到具体日期时间，不作为普通时长片段参与排序或加减。

## 3. Primary Focus

单一最高视觉重点是**当前计算结果**。

表达式是结果的直接上下文，保持第二层级；键盘是高频操作区，但静止时不与结果竞争视觉焦点；基准时间、结束时间、页面标题、状态说明、历史入口均为低一级信息。

## 4. Regions / Relations

页面只保留四个稳定区域：

1. `Title Region`：页面定位 + 主题 / 历史入口；
2. `Expression / Result Region`：表达式、行内基准时间、编辑状态、规范化提示、结果、结束时间、错误；
3. `Keypad Region`：日期、单位、数字、运算与结算；
4. `History Overlay`：低频次级历史，通过 Sheet 保持原任务上下文。

默认关系：

`Expression → Result → Keypad`

md+ 短窗或 lg+ 允许：

`Expression / Result | Keypad`

这仍是同一任务的关系重排，不生成新的业务 Region。历史不是常驻导航，不占主页面 Rail。

## 5. Signature / Dials

共同气质：克制、清晰、紧凑、精确、安静。

项目默认 Dials：

- Density：中高；
- Expression：低；
- Surface：低；
- Color：低；
- Motion：低；
- Media：0。

不使用装饰性渐变、光球、玻璃、无职责阴影或多层 Card。

## 6. Surface / Hierarchy

- 页面 Canvas 使用 `bg`。
- 结果区不使用 Card；依靠空间、排版和稳定轴线建立层级。
- 键盘按键作为真实可操作 Surface，可使用 `card / cardAlt`。
- `=` 是当前唯一 Primary，使用 Accent 填充。
- `日期`、单位键、数字键和工具键不得同时使用高饱和填充、描边与阴影叠加强调。
- `日期` 是中性 Immediate Action，不因为已启用就升级为第二个 Primary。
- 历史连续记录使用列表节奏，不“一条一卡”。
- Sheet 是真实浮层，可使用较强 Surface 与 Elevation。

## 7. Typography / Alignment

- Page Title：18px / Medium。
- 核心结果：正常窗口最高 38px / Bold；短窗口可流体降级，但不牺牲识别。
- 表达式：20px，数字使用 tabular numerals。
- 基准时间 / 结束时间：Metadata 层级，使用 tabular numerals；默认单行显示，不主动拆成“日期一行 + 时间一行”。
- 正常控件文字：14px；说明 / Metadata：12px。
- 只使用 Regular 400 / Medium 500 / Bold 700，避免页面级临时 650 / 680 等近似字重。
- 表达式、结果、规范化提示统一按逻辑 End 对齐。
- 重复运算行共享运算符列、值列、操作列。
- 第一排输入使用五等分语义组 `日期 / 天 / 时 / 分 / 秒`；其余计算键保持稳定四列，不用随机 offset 强行对齐。

## 8. Tokens

来自 Zhai Design：

- Spacing：4 / 8 / 12 / 16 / 20 / 24 / 32。
- Radius：4 / 6 / 12 / 16 / 20 / 32 / full。
- Touch Target：最小 40，推荐 48。
- Press Scale：0.95。
- Transition：200ms，standard curve。
- Accent：Light `#0A59F7` / Dark `#317AF7`。
- Canvas：Light `#F1F3F5` / Dark `#000000`。
- Surface：Light `#FFFFFF` / Dark `#1D1D1E`。

设计库颜色 Token 使用 ARGB 记法；落到 CSS 时透明色必须转换为 CSS RGBA / RRGGBBAA，不能直接复制 8 位 ARGB。

## 9. Interaction

- 数字、单位、运算符、格式切换属于 Immediate Action，结果即时更新，不额外提示“成功”。
- `日期` 也是 Immediate Action：点击后直接使用设备“此刻”的本地年月日 + 时分作为基准，不先弹选择器、不额外 Toast。
- 已有基准时间时，再点 `日期` 表示“重新设为此刻”。
- 第一行左侧只在已有基准时间时显示 `YYYY/MM/DD HH:mm`；点击这段时间才进入日期时间修改。
- 空闲状态提示可说明“点击左侧时间可修改”，但不新增独立说明区域。
- 结束时间与时长结果共享结果行；结束时间保持单行、低强调，不与核心时长结果竞争。
- `=` 是 Commit 点：结算并保存结构化历史；结果已经可见，不重复弹成功 Toast。
- 本地可逆删除与“清空”采用：先执行 → 提供撤销。
- 错误优先就地显示；Toast 只补充轻量、短暂信息。
- 历史使用 Sheet，不跳转独立页面。
- 恢复历史后回到主任务，并保留完整表达式与基准时间继续编辑。

## 10. Keyboard / Focus

支持：

- `0–9`、`.`、`:`；
- `+ / −`；
- `Enter / =`；
- `Backspace`；
- `D / H / M / S` 对应天 / 时 / 分 / 秒；
- `Ctrl/Cmd + Z` 撤销最近一次可恢复操作；
- `Esc` 退出当前行/片段选择；
- History Sheet 中 `Esc` 关闭，`Tab` 焦点限制在浮层内。

日期时间修改使用平台原生日期时间选择行为；不重新发明一套自绘选择器。Sheet 关闭后焦点回到原触发位置。

## 11. Accessibility

- 不禁止浏览器缩放。
- 所有 icon-only 操作必须有 Accessibility Name。
- 所有交互触控区 ≥40，关键操作优先 48。
- Focus 状态必须明显可见。
- Disabled 不能只靠透明度；同时使用语义属性。
- 错误使用持久行内文字，不能只靠颜色或 Toast。
- `prefers-reduced-motion` 下去除非必要动画，状态仍可理解。
- 字体放大后允许 Reflow，不通过禁止缩放维持版式。
- 日期键和行内基准时间必须分别说明“设为此刻”与“修改基准时间”的可访问语义。
- 响应式不能以缩小到低于 40px 的触控区换取“一屏全见”。

## 12. Content Language

固定术语：

- 页面：`时间计算器`
- 基准动作：`日期`
- 基准显示：`基准时间`
- 结果映射：`结束时间`
- 次级入口：`计算历史`
- 结算：`=` / Accessibility Name `计算`
- 删除表达式：`删除行`
- 删除历史：`删除`
- 恢复操作：`撤销`
- 显示方式：`天时分秒 / 小时 / 分`

文案保持短、准、直接；不增加欢迎语、营销语或重复说明。

## 13. Responsive / Window Transform

详细矩阵见 `RESPONSIVE_LAYOUT_PLAN.md`。长期规则：

- 空余高度进入 Display Workspace，不允许在 Keypad 下方留下无职责大空洞。
- 常见手机高度使用流体尺寸：Topbar、Result、Keypad row、Gap 与 Expression min-height 通过 `clamp()` 平滑变化。
- Compact `<=819px`：隐藏底部说明并压缩底部 Padding；空的规范化 / 错误区不占位。
- Short Phone `<680px`：Expression 最大约 96px，更多行只在 Expression 内滚动；不得把 Keypad 推出视区。
- Extreme Short Phone `<580px`：次级 `HH:MM:SS` 可隐藏；Keypad row 约 42px，但实际触控区仍 ≥40px。
- md 竖屏高窗口：工作区高度约 650px 上限，避免大平板内部出现巨大无意义空洞。
- md+ 短窗与 lg+：允许 `Stack → Split`，左侧 Expression / Result，右侧 Keypad；不新增第二业务工作区。
- 正常窗口目标是“不滚动整个页面即可完成核心计算”；字体放大、浏览器缩放和极端窗口允许必要 Reflow / 页面滚动。

## 14. Review Gate

每次 UI 修改至少检查：

- 是否仍只有一个最高视觉重点；
- 是否新增了没有职责的 Card / Border / Shadow / Accent；
- 是否出现非 Token 间距、随机 offset 或近似字重；
- 重复行轴线是否稳定；
- 基准时间与结束时间是否保持紧凑单行、且没有抢过核心结果；
- 日期入口是否仍是中性 Immediate Action，而不是第二个 Primary；
- State 是否在不改变几何的情况下清楚表达；
- 可逆删除是否仍可撤销；
- Light / Dark 是否语义等价；
- 至少覆盖 320×568、347×610、360×640、360×780、390×844、600×600、768×1024、840×480、1024×768、1440×900；
- Empty 与 Busy（至少 3 行表达式 + 基准时间）都必须检查文档是否溢出、Keypad 是否完整可见；
- 长表达式是否只滚动 Expression；
- 字体放大、浏览器缩放、键盘 Focus、Reduce Motion 下是否仍可完成核心任务。