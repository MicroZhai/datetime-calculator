# 跨平台一致性验收说明

本文件定义 Web 与未来 HarmonyOS / ArkTS 版本如何证明“两个平台使用的是同一套时间计算逻辑”。

## 1. 一致性不等于复制代码

未来迁移时，不要求 ArkTS 与 JavaScript 文件结构一致，也不要求函数名逐字相同。

真正需要一致的是：

- 输入协议；
- 任意精度毫秒结果；
- 日期映射成功/失败语义；
- 历史迁移与去重；
- CalculatorState 的恢复行为。

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

### 日期 / 历史 / 状态

`tests/cross-platform-conformance-vectors.json`

当前包含：

- DateMapper；
- HistoryStore；
- CalculatorState。

该文件使用纯 JSON，不包含 BigInt literal、函数或浏览器对象。

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

当前总 Schema：

```json
{
  "schemaVersion": 1,
  "dateTimezone": "UTC",
  "date": [],
  "history": [],
  "state": []
}
```

每个 case 必须有稳定 `id`。

例如：

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

## 5. Web 验证器

Web 参考执行器：

`tests/cross-platform-conformance.test.cjs`

它会：

1. 读取共享 JSON；
2. 固定测试时区；
3. 调用当前 Web 参考实现；
4. 逐字段验证 expected；
5. 对 CalculatorState 再执行一次 JSON round-trip。

它已加入：

```bash
npm test
```

并由 GitHub Actions 自动运行。

---

## 6. HarmonyOS 迁移时的目标

未来 ArkTS 建议建立等价测试入口，例如：

```text
DurationPrecisionArkTS
DateMapperArkTS
HistoryStoreArkTS
CalculatorStateArkTS
       ↓
读取共享 fixtures
       ↓
Conformance Runner
       ↓
逐 case 比较 expected
```

不要直接读取 Web DOM 代码作为测试依据。

---

## 7. 迁移完成条件

鸿蒙核心迁移只有同时满足以下条件才算完成：

1. 纯时长共享向量全部通过；
2. 日期共享向量全部通过；
3. HistoryStore 迁移向量全部通过；
4. CalculatorState 向量全部通过；
5. Web 与 ArkTS 对所有整数毫秒结果输出完全相同的十进制字符串；
6. Date 越界只影响结束日期，不反向影响时长结果；
7. 历史恢复后可以继续计算；
8. Undo 中间态恢复行为一致。

---

## 8. 新规则如何加入

以后如果网页端增加会影响跨平台结果的新能力，例如：

- 新的时间单位；
- 新的表达式语法；
- 新的日期语义；
- 新的历史字段；
- 新的编辑状态；

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

## 9. 当前跨平台基础栈

```text
DurationPrecision
DateMapper
HistoryStore
CalculatorState
```

对应契约：

- `docs/DURATION_CORE_CONTRACT.md`
- `docs/HISTORY_SERIALIZATION_CONTRACT.md`
- `docs/CALCULATOR_STATE_CONTRACT.md`
- 本文件 `docs/CROSS_PLATFORM_CONFORMANCE.md`

这四层稳定后，Web 与 HarmonyOS 的 UI 可以完全不同，但计算行为仍可被同一套自动测试证明一致。
