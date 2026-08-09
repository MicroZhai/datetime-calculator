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
- Height 使用 Regular `≥820` / Compact `680–819` / Short `<680` 作为语义 Profile；常见尺寸通过 `clamp()` 流体变化，避免跨阈值突变。
- xs / sm：默认手机 Stack；空间不足优先让 Expression 内部滚动，不把 Keypad 推出视区。
- md `600–839`：正常 / 高窗口保持单任务居中 Stack，并设置舒适工作区高度上限；短窗口转 Split。
- lg `≥840`：允许同一计算任务使用左右 Split；不新增 SideBar 或第二业务工作区。
- 响应式判断不按手机 / 平板 / PC 型号分支，而由实际窗口宽度、高度、方向和输入上下文决定。

## 2. Core Task

用户的核心任务是：

1. 快速输入一个或多个时长；
2. 可选加入一个“基准日期时间”，将持续时间结果映射为结束日期时间；
3. 使用 `+ / −` 形成连续表达式；
4. 实时确认当前结果；
5. 必要时编辑已输入的行、片段、运算符或基准时间；
6. 切换结果显示方式；
7. 按 `=` 结算并进入历史；
8. 从历史恢复完整表达式与基准时间继续编辑。

核心算术始终使用整数毫秒的“持续时间”语义。基准日期时间只负责把时长结果映射到具体日期时间；显示格式只改变表示，不改变计算值。

## 3. Primary Focus

单一最高视觉重点是**当前计算结果**。

表达式是结果的直接上下文，保持第二层级；Display Surface 建立任务边界但不与结果竞争；Keypad 是高频操作区，但静止时不升级为第二视觉焦点；基准时间、结束时间、页面标题、状态说明、历史入口均低一级。

## 4. Regions / Relations

页面保留四个稳定区域：

1. `Title Region`：页面定位 + 主题 / 历史入口；
2. `Display Region`：基准时间、状态、表达式、编辑状态、结果、结束时间、显示格式；
3. `Keypad Region`：日期、单位、数字、运算与结算；
4. `History Overlay`：低频次级历史，通过 Sheet 保持原任务上下文。

默认关系：

`Display → Keypad`

Display 内部关系：

`Base / Status → Expression → Result / End Time → Format`

md+ 短窗或 lg+ 允许：

`Display | Keypad`

这仍是同一任务的关系重排，不生成新的业务 Region。历史不是常驻导航，不占主页面 Rail。

## 5. Signature / Dials

共同气质：克制、清晰、紧凑、精确、安静。

项目默认 Dials：Density 中高；Expression / Surface / Color / Motion 低；Media 为 0。

不使用装饰性渐变、光球、玻璃、无职责阴影或多层 Card。

## 6. Surface / Hierarchy

- 页面 Canvas 使用 `bg`。
- `Display Region` 是真实的计算器显示区域，因此允许使用一级 Surface + 轻边框建立边界；不使用阴影、材质或装饰性 Elevation。
- `Keypad Region` 是持续操作区域，使用较低一级中性背景层；手机可 Full-bleed 到当前计算器 Canvas 边缘。
- Display 与 Keypad 的边界依靠：背景层 / 轻分割 /空间，不叠加厚边框与阴影。
- 键盘按键作为真实可操作 Surface，可使用 `card / cardAlt`。
- `=` 是当前唯一 Primary，使用 Accent 填充。
- `日期`、单位键、数字键和工具键不得同时使用高饱和填充、厚描边与阴影叠加强调。
- `日期` 开启状态只使用轻量选中状态，不升级为第二 Primary。
- 历史连续记录使用列表节奏，不“一条一卡”。
- Sheet 是真实浮层，可使用较强 Surface 与 Elevation。

## 7. Typography / Alignment

- Page Title：18px / Medium。
- 核心结果：正常窗口最高 38px / Bold；短窗口可流体降级，但不牺牲识别。
- 表达式：20px，数字使用 tabular numerals。
- 基准时间：Display 顶部 Metadata / Control，正常窗口约 16px / Medium；窄短窗口可降至 13–14px，但必须明显高于旧版 11–12px 的微型元信息。
- 结束时间：与核心结果共享结果基线，单行显示，不拆成“日期一行 + 时间一行”。
- 正常控件文字：14px；说明 / Metadata：11–12px。
- 只使用 Regular 400 / Medium 500 / Bold 700。
- 已输入表达式保持稳定运算符列、值列、操作列。
- 当前输入行必须占满可用值轴并按逻辑 End 对齐；不可因隐藏 / 无职责菜单列预留空间而把“输入下一时间”推向中间。
- 第一排输入使用五等分语义组 `日期 / 天 / 时 / 分 / 秒`；其余计算键保持稳定四列。

## 8. Tokens

来自 Zhai Design：

- Spacing：4 / 8 / 12 / 16 / 20 / 24 / 32。
- Radius：4 / 6 / 12 / 16 / 20 / 32 / full。
- Touch Target：最小 40，推荐 48。
- Press Scale：0.95。
- Transition：200ms，standard curve。
- Accent：Light `#0A59F7` / Dark `#317AF7`。
- Canvas：Light `#F1F3F5` / Dark `#000000`。
- Display Surface：Light `#FFFFFF` / Dark `#1D1D1E`。
- Display Border：Light `#E2E3E8` / Dark `#2A2A2C`。
- Keypad Surface：Light `#E5E5EA` / Dark `#202224`。

设计库颜色 Token 使用 ARGB 记法；落到 CSS 时透明色必须转换为 CSS RGBA / RRGGBBAA。

## 9. Interaction

- 数字、单位、运算符、格式切换属于 Immediate Action，结果即时更新，不额外提示“成功”。
- `日期` 是 Toggle：第一次点击直接使用设备“此刻”的本地年月日 + 时分作为基准；再次点击直接取消基准时间。
- 日期 Toggle 不先弹选择器、不额外 Toast；开启 / 关闭状态由按键本身和 Display 中基准时间直接反馈。
- 已有基准时间时，点击 Display 顶部的基准时间才进入平台原生日期时间修改。
- 基准时间位于 Display Header 左侧，不再塞入第一条表达式内部；删除 / 变更第一条时长不得影响基准时间是否存在。
- 状态 / 模式提示位于 Display Header 右侧；日期关闭时状态仍保持右对齐。
- 结束时间与时长结果共享结果行；结束时间单行、低强调，不与核心结果竞争。
- `小时` 显示包含两个子模式：`十进制` 与 `60进制`。
- 从其他格式第一次点击 `小时` 时默认进入十进制；已经处于小时格式时再次点击，在 `十进制 ↔ 60进制` 之间切换。
- 60进制使用 `H:MM:SS`（必要时含毫秒）表示；十进制继续使用 `x.xxxxxx小时`。二者只改变显示，不改变算术值。
- 小时空闲状态在 Display Header 提示 `小时 · 十进制` 或 `小时 · 60进制`；模式变化不使用 Toast。
- `=` 是 Commit 点：结算并保存结构化历史；结果已经可见，不重复弹成功 Toast。
- 本地可逆删除与“清空”采用：先执行 → 提供撤销。
- 错误优先就地显示；Toast 只补充轻量、短暂信息。
- 历史使用 Sheet，不跳转独立页面。

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

日期时间修改使用平台原生日期时间选择行为；不重新发明自绘选择器。Sheet / Picker 结束后必须保持清楚的任务上下文。

## 11. Accessibility

- 不禁止浏览器缩放。
- 所有 icon-only 操作必须有 Accessibility Name。
- 所有交互触控区 ≥40，关键操作优先 48。
- Focus 状态必须明显可见。
- Disabled 不能只靠透明度；同时使用语义属性。
- `日期` 使用 `aria-pressed` 表达 Toggle 状态，并分别说明“添加当前时间作为基准 / 取消基准时间”。
- `小时` 在选中时的 Accessibility Name 必须说明当前十进制 / 60进制以及再次点击可切换。
- 错误使用持久行内文字，不能只靠颜色或 Toast。
- `prefers-reduced-motion` 下去除非必要动画，状态仍可理解。
- 字体放大后允许 Reflow，不通过禁止缩放维持版式。
- 响应式不能以缩小到低于 40px 的触控区换取“一屏全见”。

## 12. Content Language

固定术语：

- 页面：`时间计算器`
- 基准动作：`日期`
- 基准显示：`基准`
- 结果映射：`结束`
- 小时子模式：`十进制 / 60进制`
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
- Compact `≤819px`：隐藏底部说明；手机 Busy Expression 有明确最大高度，更多行内部滚动。
- Short Phone `580–679px`：Expression 最大约 84px；Keypad row 约 46px、触控区仍 ≥44px。
- Extreme Short Phone `<580px`：次级辅助结果可隐藏；Keypad row 约 42px、触控区仍 ≥40px。
- md 竖屏高窗口：工作区设置舒适高度上限，避免大平板内部出现巨大无意义空洞。
- md+ 短窗与 lg+：允许 `Stack → Split`，左侧 Display，右侧 Keypad；不新增第二业务工作区。
- 正常窗口目标是“不滚动整个页面即可完成核心计算”；字体放大、浏览器缩放和极端窗口允许必要 Reflow / 页面滚动。

## 14. Review Gate

每次 UI 修改至少检查：

- 是否仍只有一个最高视觉重点；
- Display / Keypad 是否是职责明确的两个 Region，而不是两张装饰 Card；
- 是否新增无职责 Border / Shadow / Accent；
- 重复行轴线是否稳定；当前输入是否真正右对齐到值轴；
- 基准时间是否清楚可读、单行且不抢过核心结果；
- 结束时间是否保持紧凑单行；
- 日期是否严格按 `关闭 → 加入此刻 → 再点取消` 工作；
- 小时是否严格按 `进入小时=十进制 → 再点=60进制 → 再点=十进制` 工作；
- 状态提示是否同步显示小时子模式；
- 可逆删除 / 清空是否仍可撤销且能恢复日期与小时显示状态；
- Light / Dark 是否语义等价；
- 至少覆盖 `320×568、347×610、347×730、390×844、600×600、768×1024、840×480、1024×768、1440×900`；
- Empty 与 Busy（至少多行表达式 + 基准时间 + 长结果）都必须检查文档是否溢出、Keypad 是否完整可见；
- 长表达式是否只滚动 Expression；
- 字体放大、浏览器缩放、键盘 Focus、Reduce Motion 下是否仍可完成核心任务。
