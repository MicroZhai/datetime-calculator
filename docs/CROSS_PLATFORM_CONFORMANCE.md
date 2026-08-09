# 跨平台一致性验收说明

本文件定义 Web 与未来 HarmonyOS / ArkTS 版本如何证明“两个平台使用的是同一套时间计算逻辑”。

## 1. 一致性不等于复制代码

未来迁移时，不要求 ArkTS 与 JavaScript 文件结构一致，也不要求函数名逐字相同。

真正需要一致的是：

- 输入协议；
- 任意精度毫秒结果；
- **确定性的显示格式与舍入规则**；
- 日期映射成功/失败语义；
- 历史迁移与去重；
- CalculatorState 的恢复行为；
- 旧数据与损坏持久化数据的迁移、拒绝和降级策略。

因此验收标准是：

> 同一份机器可读输入，在两个平台得到同一份规范结果。

---

## 2. 当前共享测试资产

### 纯时长

`tests/duration-core-vectors.json`

覆盖：

- 普通单位换算；
- 小数精确到毫秒；
- 低于 1ms 的非法输入；
- 超大整数；
- 冒号输入；
- 多行加减；
- 负结果。

### 显示 / 日期 / 历史 / 状态

`tests/cross-platform-conformance-vectors.json`

当前包含：

- Duration display formatting；
- DateMapper；
- HistoryStore；
- CalculatorState。

该文件使用纯 JSON，不包含 BigInt literal、函数或浏览器对象。

显示向量专门锁定：

- 天时分秒文本；
- 毫秒尾数；
- 正负 `H:MM:SS`；
- 超大小时不使用科学计数法；
- 十进制小时 / 分钟的 6 位小数舍入；
- 舍入到下一整数的进位边界；
- 十进制近似显示与 60 进制精确显示之间的区别。

### 持久化完整性 / 损坏数据

`tests/persistence-integrity-vectors.json`

这组 fixture 专门锁定：

- 哪些旧格式可以做语义等价迁移；
- 哪些损坏字段必须拒绝；
- committed rows 不能靠删除坏 Part 被部分抢救；
- 未知运算符不能默认成 `+`；
- colon 一位分钟可补零，但超过两位不能截断；
- 非法可选日期只降级日期上下文；
- 编辑草稿仍允许中间态。

对应正式规则见 `docs/PERSISTENCE_INTEGRITY_CONTRACT.md`。

---

## 3. 日期时区规则

日期测试必须固定测试时区。

当前 fixture：

```json
"dateTimezone": "UTC"
```

原因是产品日期映射属于本地日历语义，而 CI、开发电脑和手机可能处于不同的系统时区。

跨平台 fixture 使用固定时区只用于**自动一致性验收**；真实产品运行仍使用设备本地时区。

---

## 4. Fixture Schema

正常跨平台 fixture：

```json
{
  "schemaVersion": 1,
  "dateTimezone": "UTC",
  "format": [],
  "date": [],
  "history": [],
  "state": []
}
```

持久化完整性 fixture：

```json
{
  "schemaVersion": 1,
  "strictRows": [],
  "history": [],
  "state": []
}
```

每个 case 必须有稳定 `id`。

例如显示舍入：

```json
{
  "id": "decimal-hour-two-ms-rounds-up",
  "operation": "roundedRatio",
  "milliseconds": "2",
  "divisor": "hour",
  "decimals": 6,
  "expected": "0.000001"
}
```

例如日期映射：

```json
{
  "id": "date-plus-one-millisecond",
  "operation": "mapDuration",
  "anchor": "2026-08-09T00:00",
  "durationMs": "1",
  "expected": {
    "ok": true,
    "date": "2026/08/09",
    "time": "00:00:00.001"
  }
}
```

任意精度整数在 fixture 中统一使用十进制字符串。

---

## 5. 显示舍入规则

显示值不是内部真值，但跨平台必须产生相同文本。

十进制小时 / 分钟默认最多显示 6 位小数，使用当前 Duration Core 定义的**确定性四舍五入**，不得直接依赖不同语言运行时可能存在差异的浮点格式化。

例如：

- `1ms / 1小时` -> `0`（6 位小数）；
- `2ms / 1小时` -> `0.000001`；
- `3599999ms / 1小时` -> `1`（舍入显示）；
- 同一 `3599999ms` 的 60 进制仍必须是 `00:59:59.999`。

因此：

> 十进制显示可以按显示精度舍入，但不得回写或改变内部整数毫秒真值。

---

## 6. Web 验证器

正常跨平台执行器：

`tests/cross-platform-conformance.test.cjs`

持久化完整性执行器：

`tests/persistence-integrity.test.cjs`

它们共同完成：

1. 读取共享 JSON；
2. 固定需要固定的测试时区；
3. 执行共享算术/显示/日期/历史/状态向量；
4. 执行损坏数据与旧格式迁移向量；
5. 逐字段验证 expected；
6. 对 CalculatorState 执行 JSON round-trip。

全部已加入：

```bash
npm test
```

并由 GitHub Actions 自动运行。

---

## 7. HarmonyOS 迁移时的目标

未来 ArkTS 建议建立等价测试入口，例如：

```text
DurationPrecisionArkTS
DateMapperArkTS
HistoryStoreArkTS
CalculatorStateArkTS
       ↓
读取全部共享 fixtures
       ↓
Conformance / Integrity Runner
       ↓
逐 case 比较 expected
```

不要直接读取 Web DOM 代码作为测试依据，也不要用 ArkTS 自带浮点格式化替代已经定义好的定点舍入协议。

对于损坏持久化数据，也不能因为语言/框架不同而自行“更智能地修复”。只有契约明确允许的等价迁移才能执行。

---

## 8. 迁移完成条件

鸿蒙核心迁移只有同时满足以下条件才算完成：

1. 纯时长共享向量全部通过；
2. 天时分秒 / 十进制小时 / 60进制 / 分钟显示向量全部通过；
3. 日期共享向量全部通过；
4. HistoryStore 迁移向量全部通过；
5. CalculatorState 向量全部通过；
6. Persistence Integrity 向量全部通过；
7. Web 与 ArkTS 对所有整数毫秒结果输出完全相同的十进制字符串；
8. 同一个毫秒值在两个平台得到相同的规范显示文本；
9. Date 越界只影响结束日期，不反向影响时长结果；
10. 历史恢复后可以继续计算；
11. Undo 中间态恢复行为一致；
12. 对同一份损坏/旧数据，两端必须做出相同的迁移、拒绝或降级。

---

## 9. 新规则如何加入

以后如果网页端增加会影响跨平台结果的新能力，例如：

- 新的时间单位；
- 新的表达式语法；
- 新的显示格式；
- 新的舍入规则；
- 新的日期语义；
- 新的历史字段；
- 新的编辑状态；
- 新的持久化迁移规则；

正确顺序是：

```text
先定义契约
-> 添加共享 fixture
-> Web 实现
-> Web CI 通过
-> 将同一 fixture 同步给 ArkTS
```

而不是先修改 Web，再等迁移时重新猜规则。

---

## 10. 当前跨平台基础栈

```text
DurationPrecision
DateMapper
HistoryStore
CalculatorState
```

对应契约：

- `docs/DURATION_CORE_CONTRACT.md`
- `docs/DURATION_INVARIANTS.md`
- `docs/HISTORY_SERIALIZATION_CONTRACT.md`
- `docs/CALCULATOR_STATE_CONTRACT.md`
- `docs/PERSISTENCE_INTEGRITY_CONTRACT.md`
- 本文件 `docs/CROSS_PLATFORM_CONFORMANCE.md`

迁移入口：`docs/PLATFORM_CORE_INDEX.md`。

这四层稳定后，Web 与 HarmonyOS 的 UI 可以完全不同，但计算行为、显示结果和损坏数据处理仍可被同一套自动测试证明一致。
