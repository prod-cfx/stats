# 策略脚本辅助函数库

这是 `ScriptEngine` 在量化策略场景下使用的辅助函数与上下文构建层。

## 真实结构

```text
helpers/
├── array-helpers.ts
├── finance-helpers.ts
├── technical-indicators.ts
├── signal-helpers.ts
├── safe-helpers.ts
├── helpers.types.ts
├── context-builder.ts
└── index.ts
```

当前真实导出以这些文件为准：

- [index.ts](/Users/a1/work/stats/packages/shared/src/script-engine/helpers/index.ts)
- [context-builder.ts](/Users/a1/work/stats/packages/shared/src/script-engine/helpers/context-builder.ts)
- [safe-helpers.ts](/Users/a1/work/stats/packages/shared/src/script-engine/helpers/safe-helpers.ts)

## 提供什么

这层主要做三件事：

1. 构造策略脚本上下文
2. 暴露只读的 `helpers` 命名空间
3. 给脚本返回值与可用全局做约束

## 可用命名空间

- `helpers.finance.*`
- `helpers.array.*`
- `helpers.ta.*`
- `helpers.signal.*`

注意：当前不是 `helpers.math.*`。

## 快速开始

```ts
import { createScriptEngine } from '@ai/shared/script-engine'
import { buildStrategyContext } from '@ai/shared/script-engine/helpers'

const context = buildStrategyContext({
  bars,
  symbol: 'BTCUSDT',
  timeframe: '1h',
  indicators: { RSI_14: 65.5 },
  currentPrice: 52500,
})

const engine = createScriptEngine()
const result = await engine.execute(strategyScript, {
  context,
  timeout: 5000,
})
```

## 脚本里怎么用

```js
const closes = bars.map(b => b.close)
const sma20 = helpers.ta.sma(closes, 20)
const sma50 = helpers.ta.sma(closes, 50)
const rsi14 = helpers.ta.rsi(closes, 14)
const returns = helpers.finance.returns(closes)

if (sma20 && sma50 && helpers.signal.crossOver([sma20], [sma50])) {
  return {
    direction: 'BUY',
    signalType: 'ENTRY',
    confidence: 80,
    entryPrice: currentPrice,
    reasoning: `golden cross, rsi=${rsi14}, sharpe=${helpers.finance.sharpeRatio(returns, 0, 252)}`,
  }
}

return null
```

## 上下文构建器

当前主要构建器：

- `buildStrategyContext(context)`

它会注入：

- `bars`
- `symbol`
- `timeframe`
- `indicators`
- `currentPrice`
- `timestamp`
- `params`
- `paramsNormalized`
- `helpers`

其中 `helpers` 会经过安全包装与冻结。

## 代表性函数

### `helpers.finance`

- `returns`
- `sharpeRatio`
- `volatility`
- `maxDrawdown`

### `helpers.array`

- `diff`
- `pctChange`
- `tail`
- `head`
- `rolling`

### `helpers.ta`

- `sma`
- `ema`
- `macd`
- `atr`
- `bollingerBands`
- `rsi`
- `stochastic`
- `adx`

### `helpers.signal`

- `crossOver`
- `crossUnder`
- `goldenCross`
- `deathCross`
- `highest`
- `lowest`
- `calcStopLoss`
- `calcTakeProfit`
- `createSignal`

## 安全说明

- 不要直接把宿主函数塞进 `engine.execute({ context })`
- 应通过 `buildStrategyContext()` 使用预包装后的 `helpers`
- `helpers` 底层由 `safe-helpers.ts` 包装、去原型并冻结

## 返回值约束

策略脚本通常返回：

```ts
{
  direction: 'BUY' | 'SELL' | 'CLOSE_LONG' | 'CLOSE_SHORT'
  signalType?: 'ENTRY' | 'EXIT' | 'ADJUSTMENT' | 'ALERT'
  confidence?: number
  entryPrice?: number
  stopLoss?: number
  takeProfit?: number
  reasoning?: string
}
```

也可以返回 `null`，表示当前没有信号。

## 相关文档

- [脚本引擎 README](../README.md)
- [脚本引擎快速入门](../QUICKSTART.md)
- [helpers QUICKSTART](./QUICKSTART.md)
