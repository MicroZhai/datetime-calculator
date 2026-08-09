# 历史记录与序列化契约

本文件定义 Web 与未来 ArkTS / HarmonyOS 实现共同遵守的历史记录语义。历史 UI 可以不同，但历史数据必须能够稳定迁移、恢复并继续计算。

**实现状态（2026-08-09）**：Web 参考实现已落地到 `js/history-store.js`，并由 GitHub Actions 自动执行历史与完整状态链回归测试。未来 HarmonyOS 迁移应以本契约和测试结果为准。

## 1. 历史记录的真值

历史记录的**可恢复表达式 `rows` 是真值**。

`resultMs` 是由 `rows` 重新计算得到的缓存字段，不允许把旧 JSON number 或其他派生值当成比表达式更高优先级的真值。

加载历史时必须：

1. 规范化 `rows`；
2. 使用任意精度 Duration Core 重新计算结果；
3. 将结果写成十进制毫秒字符串 `resultMs`；
4. 重新生成 canonical signature。

这样可以修复旧版本中可能存在的 Number 精度风险或过期派生结果。

## 2. Schema v2

当前规范版本：`schemaVersion = 2`。

标准记录：

```json
{
  "schemaVersion": 2,
  "id": "h_xxx",
  "createdAt": 0,
  "signature": "...",
  "rows": [],
  "resultMs": "25920000000000001",
  "anchorDateTime": "2026-08-09T00:00"
}
```

其中：

- `id`：记录身份，只用于 UI / 删除 / 恢复定位；
- `createdAt`：创建时间戳；
- `rows`：完整可恢复表达式；
- `resultMs`：十进制字符串，不得存为 JSON number；
- `anchorDateTime`：可选日期上下文；无日期时省略；
- `signature`：由规范化后的 `rows + anchorDateTime` 生成。

## 3. 日期兼容

旧字段 `anchorDate` 允许读取并迁移：

- `YYYY-MM-DD` -> `YYYY-MM-DDT00:00`；
- 新记录只写 `anchorDateTime`；
- 日期是历史上下文，不参与纯时长算术结果；
- 同一表达式但不同日期起点必须视为两条不同历史记录。

## 4. 去重规则

去重依据是 canonical signature，而不是 `id` 或显示文本。

signature 输入：

```text
normalized rows + normalized anchorDateTime|null
```

同一 signature 再次保存时：

- 新记录置顶；
- 旧记录删除；
- 总数仍受历史容量限制。

默认历史容量为 50 条。

## 5. BigInt 与 JSON

BigInt 不直接写入 JSON。

所有跨平台持久化整数均使用十进制字符串：

```json
"resultMs": "25920000000000001"
```

禁止：

- `25920000000000001` 作为 JSON number；
- `25920000000000001n` 作为非标准 JSON；
- 保存前先转 `Number`。

## 6. 旧历史迁移

旧记录可以包含：

- Number `resultMs`；
- 旧 `anchorDate`；
- 缺失 `schemaVersion`；
- 旧 signature。

迁移时不信任旧 `resultMs` 和旧 signature，而从 `rows` 重新构建当前 schema。

若 `rows` 本身无法规范化或无法精确计算到 1ms，该记录视为不可恢复并丢弃。

## 7. 删除、清空与撤销

删除和撤销也必须经过同一 HistoryStore 规范化规则：

- `removeAt()` 删除；
- `insertAt()` 撤销恢复；
- 恢复后仍受 signature 去重和容量规则约束；
- 清空撤销恢复时重新 normalize list。

UI 不应直接实现另一套历史容量、去重或迁移逻辑。

## 8. 跨平台状态测试

至少覆盖以下完整状态链：

```text
输入 -> 计算 -> 保存 -> JSON serialize -> JSON parse
-> 恢复 rows -> 继续加减 -> 再计算
```

必须包含：

- 300,000,000 天 + 1ms；
- 超大数日期映射越界但时长仍有效；
- 负结果保存/恢复后继续运算；
- 旧 Number 历史迁移；
- 旧 date-only 历史迁移；
- 同表达式同日期去重；
- 同表达式不同日期不去重；
- 删除 -> 撤销插回；
- 50 条容量限制。

Web 参考实现：`js/history-store.js`。

自动测试：`tests/history-store.test.cjs`、`tests/state-flow.test.cjs`。
