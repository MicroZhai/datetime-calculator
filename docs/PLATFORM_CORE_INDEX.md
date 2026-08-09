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
- `docs/DATE_MAPPING_CONTRACT.md`
- `docs/HISTORY_SERIALIZATION_CONTRACT.md`
- `docs/CALCULATOR_STATE_CONTRACT.md`
- `docs/PERSISTENCE_INTEGRITY_CONTRACT.md`
- `docs/SCHEMA_MIGRATION_CONTRACT.md`
- `docs/CROSS_PLATFORM_CONFORMANCE.md`

## 共享机器可读测试向量

- `tests/duration-core-vectors.json` — 纯时长解析与算术
- `tests/date-edge-vectors.json` — 月底、闰年、跨年、时区与夏令时日期边界
- `tests/cross-platform-conformance-vectors.json` — Display Format / Date / History / State
- `tests/persistence-integrity-vectors.json` — 旧数据内容完整性、损坏数据拒绝与降级策略
- `tests/schema-migration-vectors.json` — Schema 版本升级与未来版本拒绝策略

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

日期映射还要求：

- `1天` 永远是 24 小时真实经过时长，不是简单“日历翻一天”；
- 月底、闰年、跨年与负时长必须按真实日历映射；
- 夏令时地区允许本地一天出现 23 / 25 小时；
- 春季跳过的不存在本地时间必须判无效；
- 0099 这类早期四位年份不能被误解释成 1999；
- 日期越界只影响结束日期，不反向影响纯时长。

持久化完整性还要求：

- committed rows 不能通过删除坏 Part 被“部分抢救”；
- 未知后续运算符不能默认成 `+`；
- colon 一位分钟可以补零，但超过两位不能截断；
- 非法可选日期只降级日期，不反向丢掉可靠纯时长；
- 编辑中间态仍允许不完整输入。

版本升级还要求：

- 无版本旧数据只沿已知 migration 链向前升级；
- 当前 Schema 正常读取；
- 高于当前实现的未来 Schema 必须拒绝，不能强行降级；
- 非法版本号不能被当成当前版本处理。

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
-> 算术、性质、显示、日期边界、历史、状态、完整性、Schema migration 全部通过
-> 再连接 ArkUI 页面
```

只有 Web 与 HarmonyOS 对同一输入得到相同规范状态、整数毫秒字符串和规范显示文本，同时对日期边界、旧版本、未来版本和损坏数据做出相同处理，并满足相同核心不变量，才视为核心迁移完成。
