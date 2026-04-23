# AI Quant POSITION_PNL_PCT Threshold Minimal Fix Design

## 背景

当前编译脚本中存在两类百分比单位：

- `PRICE_CHANGE_PCT` 返回小数比例，例如 1% 为 `0.01`。
- `POSITION_PNL_PCT` 返回百分数，例如持仓亏损 5% 为 `-5`。

语义原子中的止盈、持仓收益类条件会先进入 canonical rule，常见值为 `0.1` 表示 10%。当这些条件被编译成 `POSITION_PNL_PCT >= 0.1` 时，运行时会解释为 0.1%，导致止盈过早触发。

## 目标

最小修复 `POSITION_PNL_PCT` predicate 阈值单位，使 10% 止盈编译成 `POSITION_PNL_PCT >= 10`。

## 非目标

- 不改策略族、checklist 或语义主数据流。
- 不改 `PRICE_CHANGE_PCT` 的小数比例语义。
- 不改 `STOP_LOSS_PCT`、`TAKE_PROFIT_PCT` guard 的现有百分数语义。
- 不改仓位 sizing 的 `pct_equity` / `position_pct` 归一逻辑。
- 不改部署 `on_start` runtime signal 语义。

## 推荐方案

在 `CanonicalSpecV2IrCompilerService` 中增加一个局部 helper，用于只在编译 `POSITION_PNL_PCT` predicate 阈值时做单位归一：

- 输入值绝对值小于等于 `1` 时乘以 `100`。
- 输入值绝对值大于 `1` 时保持原样。

应用范围仅限：

- `risk.take_profit_pct`
- `position_gain_pct`
- `position_loss_pct` 的 predicate 编译路径

`PRICE_CHANGE_PCT` predicate 继续保留 `0.01` 表示 1%。

## 数据流

修复后，止盈链路为：

```text
语义原子 valuePct: 10
→ canonical rule value: 0.1
→ compile POSITION_PNL_PCT threshold: 10
→ POSITION_PNL_PCT >= 10
```

价格涨跌链路保持：

```text
语义原子 valuePct: 1
→ canonical trigger value: 0.01
→ PRICE_CHANGE_PCT >= 0.01
```

## 测试

新增或调整 `canonical-spec-v2-ir-compiler.service.spec.ts` 覆盖：

- `risk.take_profit_pct` 的 canonical value `0.1` 编译为 `POSITION_PNL_PCT >= 10`。
- `position_gain_pct` 的 canonical value `0.1` 编译为 `POSITION_PNL_PCT >= 10`。
- `PRICE_CHANGE_PCT` 的 `0.01` 仍保持 `0.01`，防止误伤市场价格变化条件。

## 风险

风险集中在已有脚本如果手写了 `POSITION_PNL_PCT >= 10` 风格的 canonical condition。归一 helper 对大于 `1` 的值保持原样，因此兼容这类输入。

本修复不改变运行时 `POSITION_PNL_PCT` 返回值，也不改变 guard，所以不会影响已有 guard 语义。
