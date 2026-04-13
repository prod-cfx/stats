# AI Quant Market Scope Conflict Normalization Design

日期：2026-04-13

状态：设计已确认，待用户审阅

## 1. 背景

当前 AI Quant 的澄清链路已经支持在会话合并时识别市场范围冲突，包括：

- `exchange`
- `marketType`
- `symbol`
- `timeframe`

但这条链路存在一个稳定误报：

- 冲突收集阶段使用原始字符串直接比较
- 展示阶段又会对值做 `trim()` 或格式化后再向用户展示

这会导致“比较时不同、展示时相同”的假冲突。例如：

- `15m` 与 `15m `
- `OKX` 与 `okx`
- `BTCUSDT` 与 `btcusdt`

用户最终会看到类似：

`当前会话里的主周期存在冲突：之前是 15m，本轮变成了 15m。`

这不是策略语义冲突，而是实现层的归一化缺失。

## 2. 目标

本次修复只解决市场范围字段的假冲突误报，不改变 AI Quant 主数据流。

明确目标：

1. 在 `exchange / marketType / symbol / timeframe` 四个字段上，消除因空白、大小写、稳定别名写法导致的假冲突。
2. 对历史残留的 `_marketScopeConflicts` 做保守失效处理：如果 `previous` 与 `next` 语义相等，则本轮不再继续对外产生 blocker。
3. 保留真正的冲突阻断能力，例如 `okx -> binance`、`15m -> 1h`。

## 3. 非目标

本次不做：

- 不调整 `natural language -> clarification -> canonical spec -> IR -> publish/backtest/deploy` 的主链路顺序。
- 不修改 checklist 的主结构。
- 不新增持久化字段。
- 不改变 `_marketScopeConflicts` 的存储结构。
- 不扩展为通用“自然语言同义词理解系统”。
- 不修改澄清优先级、交互模板或 summary 主流程。

## 4. 问题定位

当前问题集中在两个实现点：

### 4.1 冲突检测比较原始值

会话合并时，`collectMarketScopeConflicts()` 直接比较 `base` 与 `patch` 中的原始字符串。

这意味着：

- 只要原始文本不完全相等，就会生成 conflict
- 哪怕它们语义上其实相同

### 4.2 冲突展示使用处理后的值

澄清规则服务读取 `_marketScopeConflicts` 后，会对 `previous`、`next` 做 `trim()` 再用于用户可见文案。

因此会出现：

- 内部判定“不同”
- 外部显示“相同”

从而形成明显误报。

## 5. 设计原则

### 5.1 不动主数据流

本次只修补“市场范围冲突判定”这一局部逻辑，不重排现有主链路，不扩散到 canonical spec、IR、发布或回测链路。

### 5.2 比较归一化，存储结构不变

修复重点是“比较前归一化”，不是“重做状态结构”。

`_marketScopeConflicts` 仍保持原有字段：

- `field`
- `previous`
- `next`

### 5.3 只覆盖稳定可判等的字段语义

只对当前四个 market scope 字段定义窄范围、确定性的比较规则，不引入高风险推断。

## 6. 方案对比

### 方案 A：只在冲突收集处补字段比较

做法：

- 仅修改 `collectMarketScopeConflicts()`
- 为四个字段做归一化后比较

优点：

- 改动最小

缺点：

- 历史残留的 `_marketScopeConflicts` 仍可能继续冒出来
- 比较规则容易散落，后续重复实现风险高

### 方案 B：抽一个很薄的 market scope 归一化/比较 helper

做法：

- 抽出字段级比较 helper
- 冲突收集时复用它
- 读取历史 `_marketScopeConflicts` 时也复用它做保守失效过滤

优点：

- 不动主数据流
- 修复点集中
- 能同时解决新冲突误报与旧 conflict 残留

缺点：

- 比方案 A 多一个轻量 helper

### 方案 C：只在展示层吞掉“看起来相同”的 conflict

优点：

- 实现最省

缺点：

- 只修文案，不修状态
- 误报数据仍然残留在内部流程中

结论：

采用方案 B。

## 7. 详细设计

### 7.1 新增轻量 market scope 比较 helper

在 `llm-strategy-codegen` 模块内部新增一个很薄的字段比较 helper，仅服务市场范围冲突判定。

建议暴露两个能力：

- `normalizeMarketScopeValue(field, value)`
- `isEquivalentMarketScopeValue(field, left, right)`

字段归一化规则如下：

- `exchange`: `trim().toLowerCase()`
- `marketType`: `trim().toLowerCase()`
- `symbol`: `trim().toUpperCase()`
- `timeframe`: `trim().toLowerCase()`

说明：

- 本次 `timeframe` 只做结构化字段层面的稳定归一化，例如 `15M -> 15m`、`1H -> 1h`
- 不在本次中把任意中文自然语言周期表达扩展成新的解析系统

### 7.2 冲突收集改为比较归一化值

`collectMarketScopeConflicts()` 不再用原始值判断是否冲突，而改为：

1. 读取原始 `previous` / `next`
2. 按字段归一化
3. 仅当归一化结果都存在且不相等时，才生成 conflict

这样可以保证：

- `15m` 与 `15m ` 不再误判
- `OKX` 与 `okx` 不再误判
- `BTCUSDT` 与 `btcusdt` 不再误判
- 真冲突仍然保留

### 7.3 历史 conflict 加保守失效过滤

在澄清规则服务读取 `_marketScopeConflicts` 时，增加一道轻量过滤：

- 如果 `previous` 与 `next` 归一化后相等，则忽略该 conflict

这是对残留状态的“弱化实现版 3”：

- 只做清 cache 效果
- 不改持久化结构
- 不引入迁移
- 不重构状态机

### 7.4 用户回答后按字段清 conflict 的逻辑保持不变

现有 `clearMarketScopeConflicts(field)` 逻辑继续保留。

原因：

- 它已经满足“用户确认某字段后，按字段清理冲突”的行为预期
- 本次修复的关键在于“不再产生假冲突”与“旧假冲突自然失效”
- 没必要把修复扩展成状态架构改造

## 8. 影响范围

预计只影响以下局部实现：

- `codegen-conversation.service.ts`
- `strategy-clarification-rules.service.ts`
- 新增的 market scope 比较 helper
- 对应单测

不应影响：

- canonical spec 结构
- semantic graph / IR 编译
- 发布、回测、部署主链路

## 9. 测试策略

需要补充或更新以下测试：

1. `timeframe` 同值误报消失
   例如 `15m` 对 `15M`、`15m `

2. `exchange` 同值误报消失
   例如 `OKX` 对 `okx`

3. `symbol` 同值误报消失
   例如 `BTCUSDT` 对 `btcusdt`

4. `marketType` 同值误报消失
   例如 `PERP` 对 `perp`

5. 真冲突继续保留
   例如 `okx` 对 `binance`、`15m` 对 `1h`

6. 历史残留 conflict 的弱清理生效
   当 `_marketScopeConflicts` 中的 `previous` 与 `next` 归一化后等价时，不再向外发 blocker

## 10. 验收标准

满足以下条件即可认为本次修复完成：

1. 不动主数据流。
2. 不新增持久化结构。
3. 假冲突不再触发澄清阻断。
4. 真冲突仍然保持阻断。
5. 残留的等价 conflict 不再对外冒泡。
6. 相关单测通过。

## 11. 风险与约束

主要风险很低，集中在归一化边界定义：

- 若归一化过强，可能错误吞掉真实冲突
- 若归一化过弱，仍会遗留少量假冲突

因此本次约束为：

- 只做空白、大小写、稳定结构化写法归一化
- 不做开放式语义推断

这能把风险保持在局部、可测试、可回退的范围内。
