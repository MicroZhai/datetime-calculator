# 数据版本升级契约

本文件定义 Web 与未来 HarmonyOS / ArkTS 在读取历史记录和 CalculatorState 时必须遵守的版本升级规则。

核心原则：

> 旧版本只能沿已知迁移步骤向前升级；当前版本正常读取；高于当前实现的未来版本必须拒绝，旧程序不得猜测新版本含义。

## 1. 为什么需要版本升级通道

历史记录和 CalculatorState 都会长期保留在用户设备上。以后字段、格式或语义发生变化时，不能每次都直接用当前代码“顺手规范化”。

否则会出现两类风险：

- 旧数据升级时丢失原意；
- 旧程序读取未来新格式时，把自己不认识的字段忽略后继续运行。

第二类尤其危险，因为页面可能看起来正常，但表达式或状态已经被错误降级。

## 2. 三种版本状态

### 旧版本

如果版本低于当前版本，并且仓库里存在明确的下一步迁移函数，则逐级向前升级。

例如 History：

```text
unversioned(v0) -> v1 -> v2(current)
```

不得直接从任意旧格式跳到当前格式并猜测中间语义。

### 当前版本

版本等于当前实现时，直接进入现有严格完整性校验和规范化流程。

### 未来版本

如果数据的 `schemaVersion` 高于当前实现：

```text
future version -> reject
```

History：整条未来记录不读取。

CalculatorState：降级为空状态，不恢复未来状态字段。

旧程序不得把未来版本强行改写成自己的当前版本。

## 3. 非法版本号

`schemaVersion` 必须是非负整数。

以下都视为非法：

- 字符串版本号，例如 `"2"`；
- 负数；
- 小数；
- NaN / Infinity；
- 其他非整数类型。

非法 History 记录拒绝；非法 CalculatorState 降级为空状态。

## 4. 无版本旧数据

历史上没有 `schemaVersion` 的记录视为 legacy v0。

只要内容能通过已知迁移步骤和严格完整性校验，就允许升级。

当前已锁定的兼容行为包括：

- 旧 `anchorDate` -> `anchorDateTime`；
- date-only -> 当天 `00:00`；
- 旧 Number `resultMs` 不作为真值，仍从 rows 重算；
- 旧 Snapshot 中 Number 毫秒转换为十进制字符串。

## 5. 迁移函数要求

每次 Schema 升级必须新增一条明确的单步迁移：

```text
vN -> vN+1
```

迁移函数必须：

- 只处理自己负责的相邻版本；
- 明确更新 `schemaVersion`；
- 不允许版本不前进；
- 不允许越过当前实现版本；
- 迁移后仍必须经过 Persistence Integrity 严格校验。

如果缺少某一步迁移，则该旧数据不能继续自动升级。

## 6. History 当前路径

当前 History Schema：`v2`。

参考实现：`js/history-store.js`。

当前迁移链：

```text
v0(unversioned) -> v1 -> v2
```

最终仍以 rows 为真值重新计算 resultMs，并重新生成当前 signature。

## 7. CalculatorState 当前路径

当前 CalculatorState Schema：`v1`。

参考实现：`js/calculator-state.js`。

当前迁移链：

```text
v0(unversioned) -> v1
```

未来版本状态不会被当前 v1 Runtime 猜测恢复。

## 8. 与完整性校验的关系

Schema migration 只回答：

> 这个版本我是否认识，以及如何升级到当前版本？

Persistence Integrity 再回答：

> 升级后的具体 rows、日期、Part、运算符是否可信？

顺序固定为：

```text
读取 JSON
-> 检查 schemaVersion
-> 逐级 migration
-> strict integrity validation
-> current canonical data
```

不能反过来先删字段或修数据，再假装完成版本迁移。

## 9. 跨平台测试

共享机器可读测试：

`tests/schema-migration-vectors.json`

Web 执行器：

`tests/schema-migration.test.cjs`

当前至少锁定：

- 无版本 History -> v2；
- History v1 -> v2；
- History v2 正常读取；
- History v3 被 v2 实现拒绝；
- 非法 History 版本号拒绝；
- 无版本 CalculatorState -> v1；
- CalculatorState v1 正常读取；
- CalculatorState v2 被 v1 实现拒绝；
- 非法 State 版本号降级为空状态。

未来 ArkTS 必须运行同一批向量。

## 10. 以后升级 Schema 的固定流程

例如未来 History 从 v2 升到 v3：

```text
先定义 v2 -> v3 迁移规则
-> 新增共享 migration fixture
-> 提升 SCHEMA_VERSION 到 3
-> Web 测试全部通过
-> 再发布
-> HarmonyOS 实现同一迁移规则
```

不得只修改当前字段结构，然后依赖一个通用 normalize 函数猜测所有历史版本。
