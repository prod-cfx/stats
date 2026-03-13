# 脚本引擎辅助函数 - 快速使用指南

## 🚀 立即开始

### 第一步：导入模块

```typescript
// 后端代码
import { createScriptEngine } from '@ai/shared/script-engine'
import { buildStrategyContext, createExampleScript } from '@ai/shared/script-engine/helpers'
```

### 第二步：准备数据

```typescript
// 准备 K线数据
const bars = [
  { open: 50000, high: 51000, low: 49500, close: 50500, volume: 1000, timestamp: Date.now() },
  // ... 更多 K线
]

// 构建策略上下文
const context = buildStrategyContext({
  bars: bars,
  symbol: 'BTCUSDT',
  timeframe: '1h',
  indicators: {
    RSI_14: 65.5,
    MACD: 120.5,
  },
  currentPrice: 50500,
  timestamp: Date.now(),
})
```

### 第三步：执行策略脚本

```typescript
// 创建脚本引擎
const engine = createScriptEngine()

// 策略脚本（字符串形式）
const strategyScript = `
  // 获取价格数据
  const closes = bars.map(b => b.close)
  
  // 计算技术指标
  const sma20 = helpers.ta.sma(closes, 20)
  const sma50 = helpers.ta.sma(closes, 50)
  const rsi = helpers.ta.rsi(closes, 14)
  
  // 判断信号
  if (sma20 && sma50 && sma20 > sma50 && helpers.signal.isOversold(rsi, 30)) {
    const atr = helpers.ta.atr(bars, 14)
    const stopLoss = helpers.signal.calcStopLoss(currentPrice, atr, 2, 'BUY')
    const takeProfit = helpers.signal.calcTakeProfit(currentPrice, stopLoss, 2, 'BUY')
    
    return {
      direction: 'BUY',
      signalType: 'ENTRY',
      confidence: 80,
      entryPrice: currentPrice,
      stopLoss,
      takeProfit,
      reasoning: \`Golden cross + RSI oversold: \${rsi?.toFixed(2)}\`
    }
  }
  
  return null
`

// 执行脚本
const result = await engine.execute(strategyScript, {
  context,
  timeout: 5000,
})

// 处理结果
if (result.success && result.value) {
  console.log('生成信号:', result.value)
  // 创建交易信号...
} else {
  console.error('执行失败:', result.error)
}
```

## 📝 在策略模板中使用

### 集成到 SignalGeneratorService

```typescript
// apps/backend/src/modules/strategy-signals/services/signal-generator.service.ts

import { createScriptEngine } from '@ai/shared/script-engine'
import { buildStrategyContext } from '@ai/shared/script-engine/helpers'

private async executeStrategyScript(
  strategy: StrategyTemplate,
  group: IndicatorGroup
): Promise<ParsedAiSignal | null> {
  // 如果策略使用脚本模式
  if (!strategy.scriptCode) return null
  
  const engine = createScriptEngine()
  
  // 加载市场数据
  const bars = await this.loadRecentBars(group.symbol.id, group.timeframe, 200)
  const indicators = await this.loadIndicatorSnapshots(group, strategy.requiredFields)
  
  // 构建上下文
  const context = buildStrategyContext({
    bars: bars.map(b => ({
      open: Number(b.open),
      high: Number(b.high),
      low: Number(b.low),
      close: Number(b.close),
      volume: Number(b.volume),
      timestamp: b.time.getTime()
    })),
    symbol: group.symbol.code,
    timeframe: group.timeframe,
    indicators,
    currentPrice: Number(bars[bars.length - 1]?.close),
    timestamp: Date.now()
  })
  
  // 执行策略脚本
  const result = await engine.execute(strategy.scriptCode, {
    context,
    timeout: 5000,
    allowAsync: false
  })
  
  if (!result.success || !result.value) {
    this.logger.error(`Script execution failed: ${result.error?.message}`)
    return null
  }
  
  // 验证并返回信号
  return this.parseScriptSignal(result.value)
}

private parseScriptSignal(signal: any): ParsedAiSignal | null {
  if (!signal || typeof signal !== 'object') return null
  
  const validDirections: SignalDirection[] = ['BUY', 'SELL', 'CLOSE_LONG', 'CLOSE_SHORT']
  if (!validDirections.includes(signal.direction)) return null
  
  return {
    direction: signal.direction,
    signalType: signal.signalType || 'ENTRY',
    confidence: signal.confidence,
    entryPrice: signal.entryPrice,
    stopLoss: signal.stopLoss,
    takeProfit: signal.takeProfit,
    reasoning: signal.reasoning
  }
}
```

## 🎯 常用策略模式

### 1. 均线交叉策略

```javascript
const closes = bars.map(b => b.close)
const sma20 = helpers.ta.sma(closes, 20)
const sma50 = helpers.ta.sma(closes, 50)

// 构建完整的均线数组用于交叉判断
const sma20Array = []
const sma50Array = []
for (let i = 20; i < closes.length; i++) {
  sma20Array.push(helpers.ta.sma(closes.slice(0, i + 1), 20))
}
for (let i = 50; i < closes.length; i++) {
  sma50Array.push(helpers.ta.sma(closes.slice(0, i + 1), 50))
}

if (helpers.signal.crossOver(sma20Array, sma50Array)) {
  return {
    direction: 'BUY',
    signalType: 'ENTRY',
    confidence: 75,
    entryPrice: currentPrice,
    reasoning: 'Golden cross detected'
  }
}
```

### 2. RSI 超买超卖策略

```javascript
const closes = bars.map(b => b.close)
const rsi = helpers.ta.rsi(closes, 14)

if (helpers.signal.isOversold(rsi, 30)) {
  const atr = helpers.ta.atr(bars, 14)
  
  return {
    direction: 'BUY',
    signalType: 'ENTRY',
    confidence: 70,
    entryPrice: currentPrice,
    stopLoss: helpers.signal.calcStopLoss(currentPrice, atr, 2, 'BUY'),
    reasoning: `RSI oversold at ${rsi.toFixed(2)}`
  }
}

if (helpers.signal.isOverbought(rsi, 70)) {
  return {
    direction: 'SELL',
    signalType: 'ENTRY',
    confidence: 70,
    entryPrice: currentPrice,
    reasoning: `RSI overbought at ${rsi.toFixed(2)}`
  }
}
```

### 3. 布林带突破策略

```javascript
const closes = bars.map(b => b.close)
const bb = helpers.ta.bollingerBands(closes, 20, 2)
const currentPrice = closes[closes.length - 1]

if (bb) {
  // 突破上轨
  if (currentPrice > bb.upper) {
    return {
      direction: 'SELL',
      signalType: 'ENTRY',
      confidence: 65,
      entryPrice: currentPrice,
      stopLoss: bb.middle,
      reasoning: 'Price above upper Bollinger Band'
    }
  }
  
  // 突破下轨
  if (currentPrice < bb.lower) {
    return {
      direction: 'BUY',
      signalType: 'ENTRY',
      confidence: 65,
      entryPrice: currentPrice,
      stopLoss: bb.middle,
      reasoning: 'Price below lower Bollinger Band'
    }
  }
}
```

### 4. 多指标确认策略

```javascript
const closes = bars.map(b => b.close)

// 计算多个指标
const sma20 = helpers.ta.sma(closes, 20)
const rsi = helpers.ta.rsi(closes, 14)
const macdResult = helpers.ta.macd(closes)
const trend = helpers.signal.trendDirection(closes, 20)

// 多重条件确认
const bullishSignals = []
const currentPrice = closes[closes.length - 1]

// 1. 趋势向上
if (trend === 'UP') bullishSignals.push('Uptrend')

// 2. 价格在均线上方
if (currentPrice > sma20) bullishSignals.push('Above SMA')

// 3. RSI 未超买
if (rsi < 70) bullishSignals.push('RSI not overbought')

// 4. MACD 金叉
if (macdResult && macdResult.histogram > 0) bullishSignals.push('MACD bullish')

// 如果有3个或以上的看涨信号
if (bullishSignals.length >= 3) {
  const atr = helpers.ta.atr(bars, 14)
  
  return {
    direction: 'BUY',
    signalType: 'ENTRY',
    confidence: 75 + bullishSignals.length * 5,
    entryPrice: currentPrice,
    stopLoss: helpers.signal.calcStopLoss(currentPrice, atr, 2, 'BUY'),
    takeProfit: helpers.signal.calcTakeProfit(
      currentPrice,
      helpers.signal.calcStopLoss(currentPrice, atr, 2, 'BUY'),
      2,
      'BUY'
    ),
    reasoning: `Multiple bullish signals: ${bullishSignals.join(', ')}`
  }
}
```

## 🔍 测试和调试

### 测试单个函数

```typescript
import { mathHelpers, technicalIndicators } from '@ai/shared/script-engine/helpers'

// 测试数学函数
const prices = [100, 102, 98, 105, 103]
console.log('Average:', mathHelpers.avg(prices))
console.log('Std Dev:', mathHelpers.std(prices))

// 测试技术指标
const closes = [50000, 50500, 51000, 50800, 51200, 51500]
console.log('SMA(5):', technicalIndicators.sma(closes, 5))
console.log('RSI(14):', technicalIndicators.rsi(closes, 14))
```

### 运行示例

```bash
# 运行策略示例
npx ts-node packages/shared/src/script-engine/examples.ts
```

## 📚 完整函数列表

### helpers.math.*
- avg, sum, std, median, percentile
- max, min
- covariance, correlation
- linearRegression, zscore

### helpers.array.*
- diff, pctChange, cumsum, cumprod
- normalize, standardize
- tail, head, shift, rolling
- findIndex, findLastIndex, unique, zip

### helpers.ta.*
- sma, ema, emaArray, macd
- rsi, momentum, roc
- atr, bollingerBands
- stochastic, cci, williamsR, adx
- obv, vwap

### helpers.signal.*
- crossOver, crossUnder, goldenCross, deathCross
- isRising, isFalling, trendDirection
- isOverbought, isOversold, inRange
- highest, lowest, pricePosition
- calcStopLoss, calcTakeProfit, calcPositionSize
- sharpeRatio, maxDrawdown, winRate, profitFactor
- createSignal

## 💡 最佳实践

1. **始终检查 null 值**
   ```javascript
   const sma = helpers.ta.sma(closes, 20)
   if (sma === null) return null
   ```

2. **使用合理的周期参数**
   ```javascript
   // 确保有足够的数据
   if (bars.length < 50) return null
   ```

3. **组合多个指标**
   ```javascript
   // 使用多重确认避免假信号
   const rsi = helpers.ta.rsi(closes, 14)
   const macd = helpers.ta.macd(closes)
   if (rsi && macd && rsi < 30 && macd.histogram > 0) {
     // 生成信号
   }
   ```

4. **添加风险管理**
   ```javascript
   const atr = helpers.ta.atr(bars, 14)
   const stopLoss = helpers.signal.calcStopLoss(entryPrice, atr, 2, 'BUY')
   const takeProfit = helpers.signal.calcTakeProfit(entryPrice, stopLoss, 2, 'BUY')
   ```

5. **提供清晰的推理**
   ```javascript
   return {
     direction: 'BUY',
     reasoning: `SMA20=${sma20.toFixed(2)}, RSI=${rsi.toFixed(2)}, ATR=${atr.toFixed(2)}`
   }
   ```

## 🐛 常见问题

**Q: 为什么函数返回 null？**
A: 通常是因为数据不足或参数不合法。检查数组长度和参数值。

**Q: 如何处理不同时间周期？**
A: 确保传入的 bars 数据对应正确的 timeframe。

**Q: 可以在脚本中使用 console.log 吗？**
A: 可以！日志会被捕获到 `result.logs` 数组中。

**Q: 脚本执行超时怎么办？**
A: 优化脚本逻辑，减少循环次数，或增加 timeout 参数。

## 📖 更多资源

- [完整 API 文档](./README.md)
- [实现总结](./IMPLEMENTATION_SUMMARY.md)
- [脚本引擎文档](../README.md)
