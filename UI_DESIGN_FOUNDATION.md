# 时间计算器 UI Design Foundation

> 基线：Zhai Design Language v1.2 / Universal Template v1.3 / Platform Patterns v1.1。
>
> 本文件只记录本项目长期设计规则；页面级临时判断不在这里扩张为通用规则。

## 1. Platform / Window Profile

- 产品形态：可安装、可离线使用的 Web PWA。
- 主要设备：手机竖屏，触控优先。
- 次要输入：桌面 / 平板浏览器的键盘与鼠标。
- 主题：提供 `跟随系统 / 浅色 / 深色` 三种模式；默认跟随系统，手动选择持久化；Light / Dark 保持相同层级和交互职责。
- xs `<320`：保持单列，缩减非必要说明与键盘间距，但触控区不低于 40px。
- sm `≥320`：默认手机布局。
- md `≥600` 及以上：仍保持单任务单列，不因为窗口变宽自动增加侧栏或第二工作区。

## 2. Core Task

用户的核心任务是：

1. 快速输入一个或多个时长；
2. 使用 `+ / −` 形成连续表达式；
3. 实时确认当前结果；
4. 必要时编辑已输入的行、片段或运算符；
5. 按 `=` 结算并进入历史；
6. 从历史恢复完整表达式继续编辑。

产品始终使用“持续时间”语义，不解释为钟表时刻或日期时间。

## 3. Primary Focus

单一最高视觉重点是**当前计算结果**。

表达式是结果的直接上下文，保持第二层级；键盘是高频操作区，但静止时不与结果竞争视觉焦点；页面标题、状态说明、历史入口均为低一级信息。

## 4. Regions / Relations

页面只保留四个稳定区域：

1. `Title Region`：页面定位 + 历史入口；
2. `Expression / Result Region`：表达式、编辑状态、规范化提示、结果、错误；
3. `Keypad Region`：单位、数字、运算与结算；
4. `History Overlay`：低频次级历史，通过 Sheet 保持原任务上下文。

关系：

`Expression → Result → Keypad`

历史不是常驻导航，不占主页面 Rail。

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
- 单位键、数字键和工具键不得同时使用高饱和填充、描边与阴影叠加强调。
- 历史连续记录使用列表节奏，不“一条一卡”。
- Sheet 是真实浮层，可使用较强 Surface 与 Elevation。

## 7. Typography / Alignment

- Page Title：18px / Medium。
- 核心结果：38px / Bold，Value 与 Unit 作为同一语义组。
- 表达式：20px，数字使用 tabular numerals。
- 正常控件文字：14px；说明 / Metadata：12px。
- 只使用 Regular 400 / Medium 500 / Bold 700，避免页面级临时 650 / 680 等近似字重。
- 表达式、结果、规范化提示统一按逻辑 End 对齐。
- 重复运算行共享运算符列、值列、操作列。

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
- `=` 是 Commit 点：结算并保存结构化历史；结果已经可见，不重复弹成功 Toast。
- 本地可逆删除与“清空”采用：先执行 → 提供撤销。
- 错误优先就地显示；Toast 只补充轻量、短暂信息。
- 历史使用 Sheet，不跳转独立页面。
- 恢复历史后回到主任务，并保留完整表达式继续编辑。

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

Sheet 关闭后焦点回到原触发位置。

## 11. Accessibility

- 不禁止浏览器缩放。
- 所有 icon-only 操作必须有 Accessibility Name。
- 所有交互触控区 ≥40，关键操作优先 48。
- Focus 状态必须明显可见。
- Disabled 不能只靠透明度；同时使用语义属性。
- 错误使用持久行内文字，不能只靠颜色或 Toast。
- `prefers-reduced-motion` 下去除非必要动画，状态仍可理解。
- 字体放大后允许 Reflow，不通过禁止缩放维持版式。

## 12. Content Language

固定术语：

- 页面：`时间计算器`
- 次级入口：`计算历史`
- 结算：`=` / Accessibility Name `计算`
- 删除表达式：`删除行`
- 删除历史：`删除`
- 恢复操作：`撤销`
- 显示方式：`天时分秒 / 小时 / 分`

文案保持短、准、直接；不增加欢迎语、营销语或重复说明。

## 13. Review Gate

每次 UI 修改至少检查：

- 是否仍只有一个最高视觉重点；
- 是否新增了没有职责的 Card / Border / Shadow / Accent；
- 是否出现非 Token 间距、随机 offset 或近似字重；
- 重复行轴线是否稳定；
- State 是否在不改变几何的情况下清楚表达；
- 可逆删除是否仍可撤销；
- Light / Dark 是否语义等价；
- 320px、字体放大、键盘 Focus、Reduce Motion 下是否仍可完成核心任务。
