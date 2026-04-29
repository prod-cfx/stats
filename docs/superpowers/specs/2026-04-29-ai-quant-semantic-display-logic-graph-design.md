# AI Quant 语义逻辑图展示投影设计

## 背景

AI Quant 策略生成主链路已经切到原子语义结构：`SemanticState` 中的 `triggers`、`actions`、`risk`、`position`、`contextSlots` 是策略理解、补槽、canonical spec、IR 和脚本生成的事实来源。逻辑图只在策略完整后展示给用户确认，不参与脚本执行主数据流。

当前确认页的逻辑图仍由前端 `buildDisplayLogicGraphFromCodegenSpec()` 从 `specDesc.rules[].condition.key` 白名单翻译。它只覆盖 `price.change_pct`、均线、RSI、MACD、布林带等旧式条件 key。遇到原子语义表达式或组合条件，例如“收盘价高于前 1 根最高价”，前端无法识别，会显示“不支持的条件，待补充”。这不是主链路错误，而是逻辑图展示投影没有同步原子语义改造。

## 目标

- 保持现有逻辑图 UI 不变：`IF / THEN`、`AND AT THEN / IF THEN`、`OR THEN / IF THEN`、`EXECUTE`。
- 只处理新生成的完整策略逻辑图，不迁移历史会话或旧快照。
- 逻辑图从完整、已锁定的原子语义状态生成，不展示 open slot 或待确认槽位。
- 新生成策略不应再因为通用表达式、持仓条件、风控条件而出现“不支持的条件，待补充”。
- 展示投影不改变 canonical spec、IR、AST、compiled script、回测和实盘执行语义。

## 非目标

- 不重做前端视觉样式或交互。
- 不把逻辑图变成补槽界面。
- 不用逻辑图作为脚本生成输入。
- 不为历史数据做批量修复。

## 现状

后端已有 `SemanticStateProjectionService`，它能从 `SemanticState` 生成对话摘要，并且已经包含一部分语义表达式格式化能力：

- `condition.expression` 可格式化 `SemanticExpression`。
- series operand 可格式化为“收盘价”“前 1 根最高价”等。
- position operand 可格式化为“持仓均价”“持仓收益率”“持有多仓”等。
- operator 可格式化 `GT/GTE/LT/LTE/EQ/CROSS_OVER/CROSS_UNDER`。
- risk/position/context 也已经有摘要逻辑。

但该服务目前输出的是自然语言 summary，不是前端现有 `DisplayLogicGraph` 结构。前端展示图仍从 `specDesc.rules` 里按旧白名单解释，所以无法覆盖所有原子语义。

## 方案

扩展后端语义投影层，新增一个稳定的展示图投影：

```ts
interface SemanticDisplayLogicGraph {
  blocks: Array<{
    type: 'IF' | 'AND_AT_THEN' | 'OR_THEN' | 'EXECUTE'
    items: Array<
      | { kind: 'condition'; id: string; text: string }
      | { kind: 'action'; id: string; text: string }
      | { kind: 'execute'; id: string; key: string; value?: string; text: string }
    >
  }>
}
```

该结构与前端 `DisplayLogicGraph` 保持同形，前端无需改 UI。后端在策略确认阶段把它放入 `specDesc.displayLogicGraph`。前端 `buildDisplayLogicGraphFromCodegenSpec()` 优先读取 `specDesc.displayLogicGraph`，没有时继续走旧逻辑作为兼容兜底。

## 投影规则

`SemanticState -> DisplayLogicGraph` 的规则如下：

- `triggers` 生成主逻辑块。只读取 `status === 'locked'` 的完整策略节点。
- 第一条非 risk trigger 使用 `IF`；后续 trigger 根据语义 join 或默认顺序映射为 `AND_AT_THEN`，明确 OR 时映射为 `OR_THEN`。
- entry trigger 的 action 文案来自已锁定 `actions` 和 `position`，例如 `开多 3%`、`开空 10 USDT`。
- exit trigger 文案为 `平多`、`平空`、`平仓`。
- gate trigger 不单独生成主块；若它表达持仓准入，例如“当前没有持仓”，合并到对应 entry 条件文本中。
- `risk` 不进入主 IF 链，追加到 `EXECUTE`：`风控: 价格相对入场均价下跌 1% -> 平仓`。
- `contextSlots` 和 `position` 生成 `EXECUTE` 标签：交易所、标的、周期、仓位、市场类型。

## 条件文案

后端复用并收敛 `SemanticStateProjectionService` 的格式化能力，新增面向逻辑图的格式化函数：

- `SemanticExpression` 递归格式化 `predicate / AND / OR / NOT`。
- series：`close`、`high[1]`、`low[1]` -> `收盘价`、`前 1 根最高价`、`前 1 根最低价`。
- indicator：SMA、EMA、RSI、MACD 保持现有中文风格。
- position：`avg_price`、`pnl_pct`、`bars_held`、`has_position` 格式化为用户可读文本。
- constant：按 `unit` 处理百分比、价格、quote/base 数量。
- operator：`GT/GTE/LT/LTE/EQ/CROSS_OVER/CROSS_UNDER` 统一中文化。

完整语义若无法格式化，应在后端单测中失败并补齐 formatter；不要让新生成策略静默掉到“不支持的条件，待补充”。

## 示例

用户策略：

> OKX BTCUSDT 1m 永续；收盘价突破上一根 K 线最高价且当前无持仓则用 3% 开多；收盘价跌破上一根 K 线最低价则平多；1% 止损。

期望展示：

- `IF`
  - `收盘价高于前 1 根最高价，且当前没有多仓`
  - `开多 3%`
- `AND_AT_THEN`
  - `收盘价低于前 1 根最低价`
  - `平多`
- `EXECUTE`
  - `交易所: OKX`
  - `标的: BTCUSDT`
  - `周期: 1m`
  - `仓位: 3%`
  - `市场: 永续`
  - `风控: 价格相对入场均价下跌 1% -> 平仓`

## 数据流

1. 对话阶段持续维护 `SemanticState`，处理 open slots。
2. 策略完整后，后端基于 locked `SemanticState` 生成 canonical spec 和 `specDesc`。
3. 同一步生成 `specDesc.displayLogicGraph`。
4. 前端收到 `specDesc` 后，优先使用 `displayLogicGraph` 渲染现有确认 UI。
5. 用户确认逻辑图后，仍走现有确认和代码生成流程。

## 错误处理

- 如果 `SemanticState` 尚未完整，不生成 `displayLogicGraph`，继续走现有澄清流程。
- 如果 locked 语义节点无法投影，后端应返回可观测错误或测试失败；不要在新路径输出“不支持的条件，待补充”。
- 前端保留旧兜底，只用于旧 specDesc 或异常兼容。

## 测试

- 后端新增 `SemanticStateProjectionService` 或独立投影服务单测：
  - 本测试案例：上一根高低点突破/跌破、无持仓开多、1% 止损。
  - expression predicate、AND/OR/NOT、position operand、ratio/quote/base 仓位。
  - risk stop loss / take profit / drawdown。
- 前端新增 `display-logic-graph` 单测：
  - 优先渲染 `specDesc.displayLogicGraph`。
  - 后端 display graph 存在时不走旧 condition key 白名单。
  - 旧 specDesc 仍兼容。
- 运行最小相关测试：
  - `dx test unit front apps/front/src/components/ai-quant/display-logic-graph.test.ts`
  - 受影响的 quantify codegen service 单测。

## 风险

- 最大风险是展示投影和执行语义再次漂移。缓解方式是投影只从 `SemanticState` 读取，不从前端推断。
- 另一个风险是已有 `SemanticStateProjectionService` 继续膨胀。实现时优先提取小的 formatter/helper，保持摘要投影和逻辑图投影边界清楚。

