# 时间计算器响应式布局计划

> 基线：Zhai Design Language v1.2 / Universal Template v1.3 / Responsive Tokens。
>
> 目标：不同手机、平板、电脑、横竖屏和分屏窗口中，保持同一计算任务与交互语义；空间变化时重组关系，而不是整体缩放。

## 1. 核心原则

1. 不按设备型号判断布局，只看当前窗口 Profile。
2. Profile = Width + Height + Orientation + Input + Window Mode。
3. 宽度主要决定 Composition，高度主要决定 Density；两者共同决定 Transform。
4. 手机优先保证 Display、当前结果、完整 Keypad 和当前表达式上下文可用。
5. 空间不足时先释放空占位、说明和冗余 Metadata，再限制重复表达式高度并内部滚动；最后才降低到 40px 触控底线。
6. 不能为了“一屏全见”整体缩放页面、缩小字体到不可读或把按键缩到低于 40px。
7. 空余高度属于 Display Workspace：结果自然落在显示区下部，Keypad 靠近视区底部；禁止内容挤在上半屏而底部留下无职责大空洞。
8. Display 与 Keypad 都是有真实职责的 Region；Surface 用于说明区域边界，不用于装饰性卡片化。
9. 宽屏允许 `Stack → Split`，把 Display 与 Keypad 左右并列；这仍是同一计算任务。
10. 字体放大、浏览器缩放或极端窗口下允许 Reflow / 必要滚动，不通过禁止缩放维持版式。

## 2. Width Profile

沿用 Zhai Design min-width 断点：

- `xs <320`
- `sm >=320`
- `md >=600`
- `lg >=840`
- `xl >=1440`

项目行为：

- xs：保持手机单列；减少横向 chrome 与间距，触控区仍 >=40px。
- sm：默认 `Display → Keypad` Stack。
- md `600–839`：正常 / 高窗口仍为单任务居中 Stack，工作区宽度最多约 600px；短窗口转 Split。
- lg `>=840`：允许同一任务直接使用左右 Split，避免把手机单列无限拉高。
- xl：延续 Split；不因为超宽自动增加第三栏或无职责 Rail。

## 3. Height Strategy

Height Profile 用于说明优先级；常见窗口继续使用 `clamp()` 流体调整标题栏、结果字号、键盘行高和间距。

### Regular `>=820px`

- 保留底部说明与次级结果；
- 键盘自然趋近 56px 行高；
- Expression 可增长到正常上限，超过后内部滚动；
- Display Workspace 吸收多余高度；
- md 竖屏使用舒适工作区上限，避免巨大空画布。

### Compact `680–819px`

- 底部说明隐藏；
- App 底部空白压缩；
- 手机 Busy Expression 最大约 112px，更多行内部滚动；
- Keypad 保持流体行高，但行间距收至 4px；
- 空的规范化 / 错误区域不占位；
- 次级结果默认仍保留。

### Short Phone `580–679px`

- Expression 最大约 84px，更多内容只在 Expression 内部滚动；
- Keypad row 约 46px，实际触控区仍 >=44px；
- 结果、结束时间、格式切换继续保留；
- Display Header 中的基准时间仍保持可读，不优先缩成微型文字。

### Extreme Short Phone `<580px`

- 次级辅助结果可隐藏；
- Expression 最大约 80px；
- Keypad row 约 42px，实际触控区仍 >=40px；
- 行编辑动作保持一行并允许自身横向滚动。

### md+ Short

- 转为左右 Split，用横向空间换回纵向空间；
- Display 与 Keypad 同时可见。

## 4. Region Priority

空间不足时按以下顺序处理：

1. 当前结果：必须保留。
2. 数字 / 日期 / 单位 / + / − / = / 退格等计算动作：必须保留。
3. 当前表达式上下文：必须可见，但允许 Expression 内部滚动。
4. 已启用的基准时间 / 结束时间：保留为清楚、单行的低强调信息。
5. 格式切换：保留，可流体压缩。
6. 状态 / 小时模式提示：保留必要文本，不为默认状态预留大空白。
7. 次级辅助结果：只在 Extreme Short Phone 降级。
8. 底部使用说明：Compact / Short 隐藏。
9. 装饰：最先消失。

## 5. Transform Matrix

| Window | Layout | Expression | Keypad | Secondary |
|---|---|---|---|---|
| sm + Regular | Stack | 正常上限，内部滚动 | 流体至 56px | 全部 |
| sm + Compact | Stack | max ~112px | 流体行高 / gap 4px | 隐藏说明 |
| sm + Short | Stack | max ~84px | ~46px / hit >=44 | 隐藏说明 |
| sm + Extreme Short | Stack | max ~80px | ~42px / hit >=40 | 可隐藏次级结果 |
| md portrait + Regular | 居中 Stack | 正常 | 正常 | 全部 |
| md+ + Short | Split | 左侧局部滚动 | 右侧完整键盘 | 保留必要 Metadata |
| lg+ | Split | 左侧 Display | 右侧 Keypad | 保持语义层级 |

## 6. 已执行视觉 / 几何验证（2026-08-09）

当前 Display Surface 方案测试了：

- Empty：空表达式、`0分`；
- Busy：多行表达式 + 基准时间 + 结束时间 + 小时 60 进制结果；
- Light / Dark。

实测主要视口：

- `320 × 568`
- `347 × 610`（接近用户当前手机浏览器可用视区）
- `347 × 730`
- `390 × 844`
- `600 × 600`
- `840 × 480`
- `1024 × 768`

测试过程中曾发现 Display Surface 加入后 `347×610` / `347×730` Busy 状态分别约有 28px / 26px 文档级溢出；通过限制 Expression 与轻微收紧 Keypad 后重新验证通过。

最终结果：

- 上述 Empty / Busy 均满足 `document scrollHeight == clientHeight`；
- Keypad 全部留在视口内；
- `347×610` Busy Expression 高度约 84px，更多行内部滚动；
- `347×730` Busy Expression 高度约 112px，更多行内部滚动；
- 当前输入值轴的右边缘到达 Display 可用右边缘，不再被无职责菜单列向中间挤压；
- Light / Dark 的 Display / Keypad Surface 均保持职责可辨但不过度卡片化；
- md+ 短窗继续使用 Split。

## 7. 每次改动的验收要求

至少检查：

- 核心键盘是否完整可操作；
- `=` 是否仍是唯一 Primary；
- 当前结果是否始终清楚；
- Display 与 Keypad 的区域边界是否明确但不过重；
- 长表达式是否只在 Expression 内部滚动；
- 当前输入是否真正靠右对齐；
- 基准时间 / 结束时间是否保持单行可读；
- 日期开 / 关、小时十进制 / 60进制是否都不会改变几何到导致整页溢出；
- safe area 是否避让；
- Light / Dark 是否层级等价；
- 浏览器缩放 / 字体放大时是否仍能通过 Reflow 完成任务。

## 8. 非目标

- 不追求所有设备完全相同的几何位置。
- 不追求任何极端窗口都“所有次级信息一屏全见”。
- 不按手机 / 平板 / PC 写三套业务页面。
- 不为了适配短屏把按键缩到低于 40px。
- 不因为桌面宽屏就添加无职责 SideBar、Card 或额外信息栏。
