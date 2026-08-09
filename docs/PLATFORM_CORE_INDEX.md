# 跨平台核心索引

本页是 Web 时间计算器未来迁移到 HarmonyOS / ArkTS 的统一入口。

## 四层参考实现

1. `js/duration-precision.js` — 任意精度时长核心
2. `js/date-mapper.js` — 日期映射 Adapter
3. `js/history-store.js` — 历史与序列化 Store
4. `js/calculator-state.js` — 编辑状态 / Undo Snapshot

Web 与页面运行时之间的桥接：`js/calculator-state-runtime.js`。

## 正式契约

- `docs/DURATION_CORE_CONTRACT.md`
- `docs/DURATION_INVARIANTS.md`
- `docs/HISTORY_SERIALIZATION_CONTRACT.md`
- `docs/CALCULATOR_STATE_CONTRACT.md`
- `docs/CROSS_PLATFORM_CONFORMANCE.md`

## 共享机器可读测试向量

- `tests/duration-core-vectors.json` — 纯时长解析与算术
- `tests/cross-platform-conformance-vectors.json` — Display Format / Date / History / State

显示格式向量已经锁定：

- 天时分秒与毫秒尾数；
- 正负 `H:MM:SS`；
- 超大 HMS 不使用科学计数法；
- 十进制小时 / 分钟 6 位小数的确定性舍入；
- 十进制显示进位与 60 进制精确值之间的边界；
- 舍入到零时禁止输出 `-0`。

核心性质测试还要求：

```text
partsToMs(millisecondsToParts(x)) === x
```

对正负、毫秒尾数与超大 BigInt 都成立。负复合时长拆成多个 Part 时，每个组成部分必须共同保持负号，确保结算后继续 `+ / -` 不改变原值。

## Web 验证入口

```bash
npm test
```

GitHub Actions：`.github/workflows/core-tests.yml`。

## 迁移原则

未来 ArkTS 不以复制 Web DOM/UI 代码为目标。

正确顺序：

```text
实现四层平台无关能力
-> 读取同一批共享 fixtures
-> 算术、性质、显示、日期、历史、状态全部 conformance cases 通过
-> 再连接 ArkUI 页面
```

只有 Web 与 HarmonyOS 对同一输入得到相同规范状态、整数毫秒字符串和规范显示文本，并满足相同核心不变量，才视为核心迁移完成。
