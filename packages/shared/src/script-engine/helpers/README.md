# 策略脚本辅助函数库

这是为量化交易策略脚本提供的完整辅助函数库，可以在安全的沙箱环境中使用。

## 📦 目录结构

```
helpers/
├── math-helpers.ts          # 数学和统计函数
├── array-helpers.ts         # 数组操作函数
├── technical-indicators.ts  # 技术指标函数
├── signal-helpers.ts        # 信号生成和条件判断
├── helpers.types.ts         # 类型定义
├── context-builder.ts       # 上下文构建器
└── index.ts                 # 统一导出
```

## 🚀 快速开始

### 在后端使用

```typescript
import { createScriptEngine } from '@ai/shared/script-engine'
import { buildStrategyContext } from '@ai/shared/script-engine/helpers'

// 1. 准备市场数据
const bars = await loadMarketBars('BTCUSDT', '1h', 100)

// 2. 构建上下文
const context = buildStrategyContext({
  bars,
  symbol: 'BTCUSDT',
  timeframe: '1h',
  indicators: { RSI_14: 65.5 },
  currentPrice: 52500,
})

// 3. 执行策略脚本
const engine = createScriptEngine()
const result = await engine.execute(strategyScript, {
  context,
  timeout: 5000,
})

// 4. 处理结果
if (result.success && result.value) {
  const signal = result.value
  // 创建交易信号...
}
```

### 在策略脚本中使用

```javascript
// 策略脚本 (在沙箱中执行)

// 1. 获取价格数据
const closes = bars.map(b => b.close)
const highs = bars.map(b => b.high)
const lows = bars.map(b => b.low)

// 2. 计算技术指标
const sma20 = helpers.ta.sma(closes, 20)
const sma50 = helpers.ta.sma(closes, 50)
const rsi14 = helpers.ta.rsi(closes, 14)
const atr14 = helpers.ta.atr(bars, 14)

// 3. 生成信号
if (sma20 && sma50 && helpers.signal.crossOver([sma20], [sma50])) {
  const entryPrice = currentPrice
  const stopLoss = helpers.signal.calcStopLoss(entryPrice, atr14, 2, 'BUY')
  const takeProfit = helpers.signal.calcTakeProfit(entryPrice, stopLoss, 2, 'BUY')
  
  return {
    direction: 'BUY',
    signalType: 'ENTRY',
    confidence: 80,
    entryPrice,
    stopLoss,
    takeProfit,
    reasoning: `Golden cross detected, RSI: ${rsi14?.toFixed(2)}`
  }
}

return null
```

## 📚 函数分类

### 1. 数学和统计 (`helpers.math`)

| 函数 | 说明 | 示例 |
|------|------|------|
| `avg(array)` | 计算平均值 | `helpers.math.avg([1,2,3])` → `2` |
| `sum(array)` | 计算总和 | `helpers.math.sum([1,2,3])` → `6` |
| `std(array)` | 计算标准差 | `helpers.math.std(returns)` |
| `median(array)` | 计算中位数 | `helpers.math.median([1,2,3,4,5])` → `3` |
| `percentile(array, p)` | 计算百分位数 | `helpers.math.percentile(prices, 75)` |
| `max(array)` | 最大值 | `helpers.math.max([1,5,3])` → `5` |
| `min(array)` | 最小值 | `helpers.math.min([1,5,3])` → `1` |
| `correlation(x, y)` | 相关系数 | `helpers.math.correlation(series1, series2)` |
| `linearRegression(x, y)` | 线性回归 | 返回 `{ slope, intercept, r2 }` |
| `zscore(value, array)` | Z分数标准化 | `helpers.math.zscore(price, prices)` |

### 2. 数组操作 (`helpers.array`)

| 函数 | 说明 | 示例 |
|------|------|------|
| `diff(array, periods)` | 差分 | `helpers.array.diff(closes)` |
| `pctChange(array, periods)` | 百分比变化 | `helpers.array.pctChange(closes)` |
| `cumsum(array)` | 累积和 | `helpers.array.cumsum(returns)` |
| `cumprod(array)` | 累积乘积 | `helpers.array.cumprod([1.01, 1.02, 0.99])` |
| `normalize(array)` | 归一化到 [0,1] | `helpers.array.normalize(prices)` |
| `standardize(array)` | 标准化 (Z-score) | `helpers.array.standardize(prices)` |
| `tail(array, n)` | 获取最后N个元素 | `helpers.array.tail(closes, 20)` |
| `head(array, n)` | 获取前N个元素 | `helpers.array.head(closes, 20)` |
| `rolling(array, window, fn)` | 滚动窗口计算 | `helpers.array.rolling(prices, 20, helpers.math.avg)` |

### 3. 技术指标 (`helpers.ta`)

#### 趋势指标

| 函数 | 说明 | 参数 |
|------|------|------|
| `sma(prices, period)` | 简单移动平均 | period: 周期，如 20 |
| `ema(prices, period)` | 指数移动平均 | period: 周期，如 12 |
| `emaArray(prices, period)` | EMA 序列 | 返回完整数组 |
| `macd(prices, fast, slow, signal)` | MACD | 默认 12, 26, 9 |

#### 波动率指标

| 函数 | 说明 | 参数 |
|------|------|------|
| `atr(bars, period)` | 真实波幅 | period: 默认 14 |
| `bollingerBands(prices, period, stdDev)` | 布林带 | 默认 20, 2 |

#### 动量指标

| 函数 | 说明 | 参数 |
|------|------|------|
| `rsi(prices, period)` | 相对强弱指标 | period: 默认 14 |
| `momentum(prices, period)` | 动量 | period: 默认 10 |
| `roc(prices, period)` | 变化率 | period: 默认 10 |
| `stochastic(bars, k, d)` | 随机指标 | 默认 14, 3 |
| `cci(bars, period)` | 商品通道指标 | period: 默认 20 |
| `williamsR(bars, period)` | 威廉指标 | period: 默认 14 |
| `adx(bars, period)` | 平均方向指数 | period: 默认 14 |

#### 成交量指标

| 函数 | 说明 |
|------|------|
| `obv(bars)` | 能量潮 |
| `vwap(bars)` | 成交量加权平均价 |

### 4. 信号生成 (`helpers.signal`)

#### 条件判断

| 函数 | 说明 | 返回 |
|------|------|------|
| `crossOver(series1, series2)` | 上穿（金叉） | boolean |
| `crossUnder(series1, series2)` | 下穿（死叉） | boolean |
| `isRising(array, count)` | 连续上涨 | boolean |
| `isFalling(array, count)` | 连续下跌 | boolean |
| `isOverbought(rsi, threshold)` | 超买判断 | boolean |
| `isOversold(rsi, threshold)` | 超卖判断 | boolean |
| `inRange(value, min, max)` | 范围判断 | boolean |
| `goldenCross(fastMA, slowMA)` | 金叉 | boolean |
| `deathCross(fastMA, slowMA)` | 死叉 | boolean |
| `trendDirection(prices, period)` | 趋势方向 | 'UP' \| 'DOWN' \| 'SIDEWAYS' |

#### 价格计算

| 函数 | 说明 | 示例 |
|------|------|------|
| `highest(array, period)` | 最高价 | `helpers.signal.highest(highs, 20)` |
| `lowest(array, period)` | 最低价 | `helpers.signal.lowest(lows, 20)` |
| `pricePosition(bars, period)` | 价格位置 (0-100) | 当前价在周期内的相对位置 |

#### 风险管理

| 函数 | 说明 | 返回 |
|------|------|------|
| `calcStopLoss(entry, atr, mult, dir)` | 计算止损价 | number |
| `calcTakeProfit(entry, sl, ratio, dir)` | 计算止盈价 | number |
| `calcPositionSize(capital, risk%, entry, sl)` | 计算仓位 | number |
| `kellyPercentage(winRate, avgWin, avgLoss)` | 凯利公式 | 0-0.25 |
| `sharpeRatio(returns, riskFree)` | 夏普比率 | number |
| `maxDrawdown(equity)` | 最大回撤 | 0-1 |
| `winRate(trades)` | 胜率 | 0-1 |
| `profitFactor(trades)` | 盈亏比 | number |

#### 信号构建

| 函数 | 说明 |
|------|------|
| `createSignal(params)` | 创建信号对象 |

```javascript
helpers.signal.createSignal({
  direction: 'BUY',
  signalType: 'ENTRY',
  confidence: 80,
  entryPrice: 52500,
  stopLoss: 51000,
  takeProfit: 55000,
  reasoning: '金叉出现'
})
```

## 🎯 策略示例

### 示例 1: 双均线交叉

```javascript
const closes = bars.map(b => b.close)
const sma20 = helpers.ta.sma(closes, 20)
const sma50 = helpers.ta.sma(closes, 50)

if (helpers.signal.goldenCross([sma20], [sma50])) {
  return {
    direction: 'BUY',
    signalType: 'ENTRY',
    confidence: 75,
    entryPrice: currentPrice,
    reasoning: 'Golden cross'
  }
}
```

### 示例 2: RSI 超买超卖

```javascript
const closes = bars.map(b => b.close)
const rsi14 = helpers.ta.rsi(closes, 14)

if (helpers.signal.isOversold(rsi14, 30)) {
  const atr = helpers.ta.atr(bars, 14)
  const stopLoss = helpers.signal.calcStopLoss(currentPrice, atr, 2, 'BUY')
  
  return {
    direction: 'BUY',
    signalType: 'ENTRY',
    confidence: 70,
    entryPrice: currentPrice,
    stopLoss,
    reasoning: `RSI oversold: ${rsi14.toFixed(2)}`
  }
}
```

### 示例 3: 布林带突破

```javascript
const closes = bars.map(b => b.close)
const bb = helpers.ta.bollingerBands(closes, 20, 2)
const currentPrice = closes[closes.length - 1]

if (bb && currentPrice > bb.upper) {
  return {
    direction: 'SELL',
    signalType: 'ENTRY',
    confidence: 65,
    entryPrice: currentPrice,
    reasoning: 'Price above upper Bollinger Band'
  }
}
```

### 示例 4: MACD 背离

```javascript
const closes = bars.map(b => b.close)
const macdResult = helpers.ta.macd(closes, 12, 26, 9)

if (macdResult && macdResult.histogram > 0 && macdResult.histogram > macdResult.signal) {
  return {
    direction: 'BUY',
    signalType: 'ENTRY',
    confidence: 70,
    entryPrice: currentPrice,
    reasoning: 'MACD bullish crossover'
  }
}
```

## 📊 可用的上下文变量

在策略脚本中，你可以访问以下变量：

### 市场数据

- `bars`: K线数据数组
  ```typescript
  interface Bar {
    open: number
    high: number
    low: number
    close: number
    volume: number
    timestamp: number
  }
  ```

- `symbol`: 交易对代码，如 `"BTCUSDT"`
- `timeframe`: 时间周期，如 `"1h"`, `"4h"`
- `currentPrice`: 当前价格
- `timestamp`: 当前时间戳

### 预计算指标

- `indicators`: 预计算的指标值对象
  ```javascript
  {
    RSI_14: 65.5,
    MACD: 120.5,
    SIGNAL: 110.2
  }
  ```

### 辅助函数

- `helpers.math.*`: 数学函数
- `helpers.array.*`: 数组操作
- `helpers.ta.*`: 技术指标
- `helpers.signal.*`: 信号生成

### 原生对象

- `Math`: 原生数学对象
- `Date`: 原生日期对象
- `JSON`: JSON 解析
- `Array`, `Object`, `String`, `Number`, `Boolean`

## ⚠️ 安全限制

为了安全考虑，脚本环境**禁止**以下操作：

- ❌ `require()` / `import` - 不能加载模块
- ❌ `eval()` / `Function()` - 不能动态执行代码
- ❌ `process` / `__dirname` - 不能访问进程信息
- ❌ 文件系统操作
- ❌ 网络请求

## 🔧 返回值格式

策略脚本必须返回以下格式的对象或 `null`：

```typescript
{
  direction: 'BUY' | 'SELL' | 'CLOSE_LONG' | 'CLOSE_SHORT',
  signalType?: 'ENTRY' | 'EXIT' | 'ADJUSTMENT' | 'ALERT',
  confidence?: number,        // 0-100
  entryPrice?: number,
  stopLoss?: number,
  takeProfit?: number,
  reasoning?: string
}
```

返回 `null` 表示当前没有信号。

## 📝 运行示例

```bash
# 运行策略示例
npx ts-node packages/shared/src/script-engine/examples.ts
```

## 🧪 测试

```bash
# 运行单元测试
dx test e2e backend
```

## 📖 更多文档

- [脚本引擎 README](../README.md)
- [快速入门](../QUICKSTART.md)
- [实现说明](../IMPLEMENTATION.md)
