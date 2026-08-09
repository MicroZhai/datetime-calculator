# 计算器编辑状态与撤销契约

本文件定义 Web 与未来 ArkTS / HarmonyOS 实现共同遵守的**编辑状态、历史恢复和 Undo Snapshot** 语义。

UI 控件、焦点系统、Toast、动画和页面结构可以不同，但同一计算过程在保存状态、恢复状态之后必须能够继续得到同样的结果。

## 1. 状态模型的职责

状态模型记录的是：

> **足以决定“用户下一步输入会发生什么”的最小产品状态。**

它不记录：

- DOM 节点；
- ArkUI 组件引用；
- 焦点对象；
- Toast / 动画计时器；
- 浏览器滚动位置；
- 平台窗口对象。

这些属于平台 UI Runtime，而不是跨平台计算器状态。

Web 参考实现：`js/calculator-state.js`。

当前 Schema：`schemaVersion = 1`。

---

## 2. 标准 Snapshot

标准状态结构包含：

```json
{
  "schemaVersion": 1,
  "rows": [],
  "currentOp": null,
  "currentParts": [],
  "numberBuffer": "",
  "colonMode": false,
  "colonHours": "",
  "colonMinutes": "",
  "colonSeconds": "",
  "colonStage": "minute",
  "formatIndex": 0,
  "lastResultMs": "0",
  "justEvaluated": false,
  "selectedRow": null,
  "partEdit": null,
  "error": "",
  "anchorDateTime": null,
  "hourDisplayMode": "decimal"
}
```

所有 Snapshot 必须是标准 JSON 可序列化数据。

特别规定：

- `lastResultMs` 必须是十进制字符串；
- 不允许在 Snapshot 中直接存 `BigInt`；
- 日期统一使用 `YYYY-MM-DDTHH:mm`；
- 无日期时为 `null`；
- 小时模式只允许 `decimal` / `sexagesimal`。

---

## 3. 三类状态

### 3.1 可恢复计算真值

包括：

- `rows`
- `lastResultMs`
- `anchorDateTime`

其中 `rows` 仍是表达式真值；`lastResultMs` 是当前运行结果的精确整数毫秒字符串。

### 3.2 编辑中间态

包括：

- `currentOp`
- `currentParts`
- `numberBuffer`
- 冒号输入字段
- `selectedRow`
- `partEdit`
- `justEvaluated`

这些状态即使暂时不能结算，也必须能够 Undo 后恢复。

例如：

- 已输入 `123.` 但还没选单位；
- 已进入 `123:5_`，分钟还没输完；
- 正在把某个片段从 `2小时` 编辑成新值；
- 已按 `=`，随后还没开始下一次运算。

不得因为“当前还不能计算”就丢弃编辑中间态。

注意：`currentParts` 中已经完成的 Part 属于 committed data，恢复时必须严格验证；尚未完成的冒号/数字草稿由独立 buffer 字段保存，继续允许中间态。

### 3.3 显示偏好

包括：

- `formatIndex`
- `hourDisplayMode`

显示偏好需要跟随 Undo / Restore 保持视觉上下文，但**单独改变显示偏好不算存在计算内容**。

---

## 4. Undo Snapshot

清空、删除表达式行等可撤销操作必须先捕获标准 Snapshot。

流程：

```text
Current Runtime
-> CalculatorState.normalizeSnapshot
-> JSON-safe Undo Snapshot
-> destructive action
-> Undo
-> normalize/restore Snapshot
-> platform runtime
```

Web 内存运行时仍可使用 `BigInt`，但跨层 Snapshot 必须使用字符串。

因此：

```text
Web runtime BigInt
<-> Snapshot decimal string
<-> ArkTS arbitrary-precision integer
```

三个阶段不能通过普通浮点 Number 作为桥梁。

---

## 5. 历史恢复

历史记录恢复不是“把一张 UI 卡片重新画出来”，而是生成新的标准计算器状态。

恢复历史时：

1. 从 HistoryStore 获得规范化 `rows`；
2. 重新精确求值；
3. 清空正在输入的裸数字 / 冒号 / 当前运算符；
4. 清空行选择与片段编辑态；
5. `justEvaluated = false`，允许用户直接继续编辑或加减；
6. 恢复该历史记录的日期上下文；
7. 保留用户当前显示格式偏好。

因此历史恢复后的状态是“**可继续编辑的表达式**”，不是锁死的结果页。

---

## 6. 清空语义

一次完整的“清空计算器”必须重置：

- rows；
- 当前输入；
- 运算符；
- 冒号输入；
- 行/片段编辑选择；
- 最后结果；
- 日期上下文；
- 结果显示模式回到产品默认值。

如果操作支持 Undo，则清空前的完整状态必须能够被标准 Snapshot 恢复。

---

## 7. hasContent 语义

以下任意条件成立，都认为计算器存在可清空/可保护内容：

- 有表达式 rows；
- 有 currentParts；
- 有裸数字 `numberBuffer`；
- 正处于冒号输入；
- 已选择下一运算符；
- 处于 justEvaluated 状态；
- 正在选择/编辑表达式行；
- 有日期上下文。

仅有以下状态不算计算内容：

- 切换“天时分秒 / 小时 / 分”；
- 切换“小时十进制 / 60进制”。

---

## 8. 状态规范化与完整性边界

所有外部 Snapshot 在恢复前必须 normalize，但要区分**committed data**与**editing draft**。

### 8.1 committed rows / completed currentParts

这些字段代表已经成立的数学表达式，必须走严格持久化规范：

- 任意未知 Part -> 整组 committed rows 判坏；
- 任意未知后续 Row 运算符 -> 整组 rows 判坏；
- colon 分钟/秒超过两位 -> 拒绝，不能截尾；
- 单位值超过输入位数限制 -> 拒绝；
- 无法精确到 1ms -> 拒绝；
- 不允许删除坏 Part 后保留剩余 Part。

当前 State 降级语义：

```text
损坏 rows -> rows = []
损坏 completed currentParts -> currentParts = []
```

这是“无法证明原表达式”时的安全降级，而不是把损坏数据改成另一道计算。

### 8.2 editing draft

以下仍允许中间态：

- `numberBuffer = "123."`；
- `colonMinutes = "5"`；
- 秒字段尚未完成；
- partEdit 的合法部分输入。

这些字段不能套用 committed rows 的“必须立即可计算”要求。

### 8.3 其他字段

- 非法 `currentOp` -> `null`；
- 非法格式索引 -> 默认格式；
- 失效的 selectedRow -> `null`；
- 指向不存在片段的 partEdit -> `null`；
- 非法日期 -> `null`；
- 非法结果毫秒 -> `"0"`；
- BigInt 输入 -> 十进制字符串。

状态恢复不得因为一个无效的 UI 指针导致整个合法计算表达式丢失；反过来，也不得因为一个合法 Part 存在就部分抢救包含损坏 Part 的 committed rows。

完整持久化规则见：`docs/PERSISTENCE_INTEGRITY_CONTRACT.md`。

---

## 9. 自动测试

Web 自动测试：

- `tests/calculator-state.test.cjs`
- `tests/state-flow.test.cjs`
- `tests/persistence-integrity.test.cjs`

至少覆盖：

- 超大 BigInt 结果 Snapshot JSON 往返；
- 日期 + 小时 60 进制一起恢复；
- `123.` 这种未完成小数 Undo；
- 未完成 `H:MM:SS` Undo；
- 失效行索引安全降级；
- 历史 -> State -> 继续运算；
- 负结果恢复后继续 +1ms；
- 显示偏好不被误判为计算内容；
- 损坏 committed rows 不得部分抢救；
- 非法可选日期安全降级；
- 编辑中间态不受严格持久化规则误伤。

共享完整性向量：`tests/persistence-integrity-vectors.json`。

仓库 GitHub Actions 会在 `master` 与 `agent/**` 分支自动执行 `npm test`。

---

## 10. HarmonyOS 迁移原则

未来 ArkTS 不需要复制 Web 的 `snapshotCalculator()` 或 DOM Runtime。

应实现：

```text
Duration Core
Date Adapter
History Store
Calculator State
Persistence Integrity
```

并把它们连接到 ArkUI 页面状态。

最终一致性判断不是“两个页面长得一样”，而是：

> 给定同一计算状态和同一后续输入序列，Web 与 HarmonyOS 必须得到同一表达式状态和同一整数毫秒结果；给定同一份损坏/旧 Snapshot，也必须做出相同的迁移、拒绝或降级。
