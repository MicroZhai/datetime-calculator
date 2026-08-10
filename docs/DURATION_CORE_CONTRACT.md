# 跨平台时长计算核心契约

本文件定义 Web 与未来 ArkTS / HarmonyOS 实现必须共同遵守的计算语义。UI、存储框架和日期控件可以不同，但同一组时长输入必须得到同一个整数毫秒结果。

## 1. 核心边界

- 核心只负责**纯时长**：解析、归一化、加减、格式化所需的确定性数值转换。
- 核心不得依赖 DOM、ArkUI、localStorage、Preferences、系统日期选择器或 Toast。
- 日期/时间戳映射属于上层 Adapter；日期超出平台可表示范围时，不得使纯时长结果失效。
- 历史记录/序列化属于独立 Store/Codec；完整规则见 `docs/HISTORY_SERIALIZATION_CONTRACT.md`。
- 编辑状态、历史恢复与 Undo Snapshot 属于独立 Calculator State；完整规则见 `docs/CALCULATOR_STATE_CONTRACT.md`。

当前跨平台基础栈：

```text
DurationPrecision
      ↓
DateMapper
      ↓
HistoryStore
      ↓
CalculatorState
      ↓
Platform UI Runtime
```

## 2. 唯一真值

内部唯一真值为**任意精度整数毫秒**。

Web：`BigInt`。

HarmonyOS 迁移时：必须选择能表达任意精度整数或等价十进制定点整数的实现；不得把核心退回普通浮点 `number` 后再声称与 Web 等价。

单位因子：

- 1 天 = 86,400,000 ms
- 1 小时 = 3,600,000 ms
- 1 分钟 = 60,000 ms
- 1 秒 = 1,000 ms

## 3. 输入协议

单位输入在进入核心前保持十进制字符串。

- 允许整数和十进制小数。
- 只有最终能够**整除并精确落到整数毫秒**的输入才合法。
- 最小精度 1ms；禁止静默四舍五入。
- 例如 `0.001秒` = 1ms，允许；`0.0001秒` = 0.1ms，拒绝。
- 单个数字最多 100 位属于 UI/资源保护，不属于数学结果上限。

冒号输入采用 `H:MM` / `H:MM:SS`：

- H 为非负整数，可为超大整数。
- MM / SS 必须在 00–59。
- 冒号路径同样直接生成整数毫秒，不经过浮点运算。

## 4. 表达式协议

表达式由有序 Rows 组成：

- 第一行 `op = null`。
- 后续行仅允许 `+` 或 `-`。
- 每行由一个或多个时间 Part 组成；同一行的 Part 先相加，再应用该行运算符。
- 中间结果和最终结果均不得因数值大小切回浮点数。
- 负结果合法，并允许继续参与下一次计算。

## 5. 显示协议

显示不是核心真值。

- 天时分秒与 `H:MM:SS` 必须从整数毫秒直接拆分。
- 十进制小时/分钟使用整数长除法生成显示文本。
- 默认最多显示 6 位小数，采用确定性的四舍五入；内部毫秒值不随显示舍入改变。
- 超长结果允许 UI 横向查看，但不得为了适配宽度改写、截断或科学计数化核心值，除非产品未来明确增加独立的“近似显示”模式。

## 6. 持久化协议

任意精度整数不能以普通 JSON number 作为跨平台真值。

- `resultMs` 持久化为十进制字符串，例如 `"25920000000000001"`。
- 单位输入值也优先保留规范化十进制字符串。
- 不允许把超大整数先转换成 Number 再序列化。
- 历史记录加载时，以可恢复表达式 `rows` 为真值重新计算 `resultMs`；旧 Number `resultMs` 只作为遗留字段读取，不作为精确真值继续传播。
- 历史 Schema、日期上下文、签名去重、旧版本迁移与撤销规则统一由 `docs/HISTORY_SERIALIZATION_CONTRACT.md` 定义。
- Undo / 编辑 Snapshot 中的 `lastResultMs` 同样必须保存为十进制字符串，不能直接把 BigInt 放入 JSON；状态规则统一由 `docs/CALCULATOR_STATE_CONTRACT.md` 定义。

## 7. 日期映射协议

日期是**可选平台适配层**，不属于纯时长核心。

流程：

`Duration Core -> integer milliseconds -> Date Adapter -> platform date/time`

统一产品规则：

- 点击“日期”时，默认基准必须是**设备本地当天 00:00**，而不是点击瞬间的当前时分。
- 日期字符串的跨层规范格式为 `YYYY-MM-DDTHH:mm`；仅日期 `YYYY-MM-DD` 读取时按 `00:00` 兼容。
- Date Adapter 先验证本地日历日期是否合法，再把基准转换为平台时间戳。
- 与时长相加时，先把基准时间戳转成整数毫秒，再与任意精度时长相加；不得先把超大时长转换成浮点数。
- 只有最终目标毫秒位于平台日期 API 可表示范围内时，才生成结束年月日。
- Web 当前 `Date` 范围按 `±8,640,000,000,000,000ms` 判断。
- HarmonyOS 未来迁移时使用该平台实际日期 API 的范围；平台范围可以不同，但失败语义必须一致。

如果目标日期超出平台日期 API 的可表示范围：

- 时长结果继续有效；
- Date Adapter 返回明确的 `date-out-of-range` / 等价状态；
- UI 只降级结束日期，不得把整个计算判定失败。

日期 Adapter 的显示结果属于**本地日历映射**。因此跨平台一致性重点是：同一设备时区/日历语义下的基准解析、绝对毫秒相加和范围失败规则一致；纯时长结果本身始终由 Duration Core 决定。

## 8. 状态恢复协议

历史恢复与 Undo 不允许直接复制平台 UI 对象。

统一流程：

```text
Platform Runtime
-> CalculatorState Snapshot
-> JSON-safe canonical state
-> restore / undo
-> Platform Runtime
```

关键规则：

- `rows`、日期上下文和编辑中间态必须可恢复；
- 未完成的裸数字、小数点和冒号输入也属于合法 Undo 状态；
- 历史恢复后进入“可继续编辑的表达式”状态，而不是锁死结果页；
- 显示格式属于显示偏好；小时结果固定使用精确 60 进制，可随 Snapshot 恢复，但显示偏好单独存在不算计算内容；
- Web Runtime 恢复 Snapshot 时把毫秒字符串重新转回 BigInt；未来 ArkTS 使用自己的任意精度整数实现。

## 9. 跨平台一致性测试

`tests/duration-core-vectors.json` 是平台无关时长测试向量。

Web 端由 `tests/duration-precision.test.cjs` 自动执行；未来 ArkTS 核心必须读取或等价复制同一批向量，并逐项比较最终毫秒**字符串**。

至少覆盖：

- 普通加减；
- 1ms 边界；
- 小于 1ms 的非法输入；
- 300,000,000 天；
- 100 位整数输入；
- 超大数 + 1ms；
- 负结果；
- 超大冒号小时；
- 历史字符串序列化。

日期适配层由 `tests/date-mapper.test.cjs` 检查：

- 当天默认零点；
- 日期字符串规范化；
- 非法日历日期拒绝；
- 正负毫秒映射；
- 超大时长只产生 `date-out-of-range`，不反向否定时长核心。

历史层由 `tests/history-store.test.cjs` 检查：

- 旧 Number / date-only 历史迁移；
- 日期参与 signature 去重；
- 删除、撤销与容量规则；
- rows 作为历史真值重新生成精确 resultMs。

状态与完整链路由以下测试检查：

- `tests/calculator-state.test.cjs`
- `tests/state-flow.test.cjs`
- `tests/state-runtime-wiring.test.cjs`

覆盖：

- 保存 -> JSON -> 重载 -> State -> 继续计算；
- 超大 BigInt Snapshot JSON 往返；
- 未完成小数/冒号输入 Undo；
- 日期 + 小时 60 进制状态恢复；
- 负结果恢复后继续保持毫秒级精确；
- Web Runtime 的 `string -> BigInt` 桥接；
- PWA 脚本加载顺序和离线缓存接线。

## 10. Web 参考实现

纯时长核心：`js/duration-precision.js`

Web 日期适配层：`js/date-mapper.js`

Web 历史序列化层：`js/history-store.js`

跨平台计算器状态：`js/calculator-state.js`

Web 状态桥接层：`js/calculator-state-runtime.js`

Web UI 适配层：`js/duration-core.js`、`js/duration-ui.js`、`js/date-anchor.js`、`js/display-mode.js`

共享测试向量：`tests/duration-core-vectors.json`

自动测试：`npm test`

CI 门禁：`.github/workflows/core-tests.yml`

迁移到其他平台时，应以本契约、历史序列化契约、状态契约、共享测试向量和 Adapter 失败语义为准，而不是复制 Web 的 DOM/UI 代码。
