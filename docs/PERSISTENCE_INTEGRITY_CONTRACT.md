# 持久化数据完整性契约

本文件定义 Web 与未来 HarmonyOS / ArkTS 对**历史记录、CalculatorState、旧版本数据和损坏本地数据**必须共同遵守的恢复边界。

核心原则：

> **只有能够证明语义等价的旧格式才允许迁移；需要猜测用户原意的数据必须拒绝或降级，绝不能静默改成另一个计算。**

Web 参考入口：

- `DurationPrecision.normalizeStoredRowsStrict()`
- `HistoryStore.normalizeRecord()`
- `CalculatorState.normalizeSnapshot()`

共享机器可读测试：`tests/persistence-integrity-vectors.json`。

---

## 1. 两个信任边界

### 1.1 编辑中间态：允许不完整

用户正在输入时，以下内容可以暂时不满足最终计算协议：

- `numberBuffer = "123."`；
- `H:MM` 中分钟只输入一位，例如 `12:5_`；
- 正在编辑某个 Part；
- 尚未完成的冒号秒字段。

这些状态属于 Undo / 编辑体验，必须保留。

### 1.2 已提交持久化数据：必须严格

以下内容一旦进入 committed rows，就代表已经成立的数学表达式：

- History `rows`；
- CalculatorState `rows`；
- CalculatorState `currentParts` 中已经完成的 Part。

恢复这些数据时，不允许通过截断、删除未知字段或重写未知运算符来“修好”。

---

## 2. Unit Part 严格规则

标准结构：

```json
{ "kind": "unit", "unit": "h", "value": "1.5" }
```

必须满足：

- `kind = unit`；
- `unit` 只能是 `d / h / m / s`；
- `value` 必须能规范化为合法十进制字符串；
- 数字位数不得超过 `MAX_INPUT_DIGITS = 100`；
- 最终必须能够**精确落到整数毫秒**；
- 不允许科学计数法、NaN、Infinity 或无法证明精确性的 JSON number。

例如：

- `1.5小时`：允许；
- `0.001秒`：允许；
- `0.0001秒`：拒绝；
- 101 位输入：拒绝。

持久化数据不得绕过 UI 的资源保护限制。

---

## 3. Colon Part 严格规则

标准结构：

```json
{ "kind": "colon", "hours": "12", "minutes": "05", "seconds": null }
```

规则：

- `hours` 必须是纯数字，最多 100 位；
- `minutes` 必须是 1～2 位纯数字，数值 0～59；
- `seconds` 为 `null`，或 1～2 位纯数字且数值 0～59；
- 一位分钟/秒允许补前导零；
- 超过两位不得截断。

允许的等价迁移：

```text
1:5 -> 1:05
```

禁止的猜测：

```text
1:005 -> 1:05   // 禁止
1:160 -> 1:60   // 禁止
```

因此实现中不得对持久化分钟/秒使用 `slice(-2)` 一类“取最后两位”的修复。

---

## 4. Row 运算符严格规则

第一行：

- `null / undefined` -> `null`；
- 旧式 leading `+` 可安全迁移为 `null`；
- 其他值拒绝。

后续行：

- 只允许 `+` 或 `-`；
- `*`、`/`、空字符串、未知枚举不得重写为 `+`。

原因是把未知运算符默认为 `+` 会直接改变表达式真值。

---

## 5. 禁止“部分抢救” committed rows

对一组 committed rows：

```text
只要其中任意 Row / Part 无法严格规范化
=> 整组 rows 视为损坏
```

不得：

```text
[合法 Part, 损坏 Part]
-> 删除损坏 Part
-> 保留合法 Part
```

因为删除一个 Part 后得到的是**另一道计算题**，不是原记录的可靠恢复。

因此严格路径禁止使用类似：

```text
map(normalize).filter(Boolean)
```

来恢复持久化表达式。

---

## 6. History 的损坏策略

History 的 `rows` 是真值。

如果 committed rows 损坏：

```text
整条历史记录丢弃
```

如果只有派生字段损坏：

- 旧 `resultMs`：不信任，从 rows 重算；
- 旧 signature：不信任，重新生成；
- 缺失 schemaVersion：允许迁移。

### 可选日期字段

`anchorDateTime` / 旧 `anchorDate` 属于可选上下文，不属于纯时长真值。

因此：

```text
rows 合法 + 日期非法
=> 保留时长历史
=> 丢弃非法日期字段
```

例如 `2026-02-29T00:00` 在非闰年无效，不能继续保存为日期上下文，但不能因此丢掉一条完全可恢复的纯时长记录。

---

## 7. CalculatorState 的损坏策略

CalculatorState 区分 committed state 与 editing draft。

### committed rows / currentParts 损坏

不得部分恢复为另一表达式。

当前规范降级：

```text
损坏 committed rows -> rows = []
损坏 completed currentParts -> currentParts = []
```

### editing draft

仍按编辑协议保留：

- `123.`；
- 一位分钟；
- 未完成秒字段；
- 合法长度内的冒号小时草稿。

### 可选日期损坏

```text
非法 anchorDateTime -> null
```

其他失效 UI 指针仍可独立降级，例如 `selectedRow -> null`，不能反向破坏合法 rows。

---

## 8. “迁移”与“修复”的判定标准

允许迁移的前提是：

> 迁移前后数学语义能够被证明完全相同。

允许：

- `5分钟` 的 JSON number `5` -> 字符串 `"5"`；
- colon minute `5` -> `"05"`；
- 第一行旧 leading `+` -> `null`；
- date-only `YYYY-MM-DD` -> 当天 `00:00`。

拒绝：

- 删除未知 Part；
- 未知运算符改成 `+`；
- `005` 截成 `05`；
- 超限数值强行 BigInt 化；
- 非法日历日期强行滚动到下个月；
- 低于 1ms 的值静默四舍五入。

---

## 9. 跨平台一致性要求

未来 ArkTS 必须读取或等价复制：

`tests/persistence-integrity-vectors.json`

至少验证：

- 一位 colon 分钟的等价迁移；
- leading `+` 的安全迁移；
- 超长 colon 字段拒绝；
- 未知 Part 导致整组 rows 拒绝；
- 未知运算符拒绝；
- 超过输入位数限制的持久化值拒绝；
- 无效可选日期只降级日期；
- committed rows 损坏不能部分抢救；
- 编辑草稿继续允许中间态。

Web 执行器：`tests/persistence-integrity.test.cjs`。

这些用例必须和正常算术 / 显示 / Date / History / State conformance 一起通过，才算跨平台核心一致。
