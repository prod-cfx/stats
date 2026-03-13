/**
 * 策略脚本执行示例
 * 演示如何使用辅助函数库在沙箱中执行策略
 */

import type { Bar } from './helpers/technical-indicators'
import { buildStrategyContext, createExampleScript } from './helpers/context-builder'
import { createScriptEngine } from './script-engine'

async function runStrategyExample() {
  console.log('=== 策略脚本执行示例 ===\n')

  // 1. 创建脚本引擎
  const engine = createScriptEngine()

  // 2. 准备模拟的市场数据
  const mockBars: Bar[] = [
    { open: 50000, high: 51000, low: 49500, close: 50500, volume: 1000, timestamp: Date.now() - 5000 },
    { open: 50500, high: 51500, low: 50000, close: 51000, volume: 1200, timestamp: Date.now() - 4000 },
    { open: 51000, high: 52000, low: 50500, close: 51500, volume: 1100, timestamp: Date.now() - 3000 },
    { open: 51500, high: 52500, low: 51000, close: 52000, volume: 1300, timestamp: Date.now() - 2000 },
    { open: 52000, high: 53000, low: 51500, close: 52500, volume: 1400, timestamp: Date.now() - 1000 },
  ]

  // 模拟更多历史数据（用于计算指标）
  const extendedBars: Bar[] = []
  let basePrice = 45000
  for (let i = 0; i < 50; i++) {
    const change = (Math.random() - 0.5) * 1000
    basePrice += change
    extendedBars.push({
      open: basePrice,
      high: basePrice + Math.random() * 500,
      low: basePrice - Math.random() * 500,
      close: basePrice + (Math.random() - 0.5) * 300,
      volume: 1000 + Math.random() * 500,
      timestamp: Date.now() - (50 - i) * 1000,
    })
  }
  extendedBars.push(...mockBars)

  // 3. 构建策略上下文
  const context = buildStrategyContext({
    bars: extendedBars,
    symbol: 'BTCUSDT',
    timeframe: '1h',
    indicators: {
      RSI_14: 65.5,
      MACD: 120.5,
      SIGNAL: 110.2,
    },
    currentPrice: 52500,
    timestamp: Date.now(),
  })

  console.log('市场数据：')
  console.log(`  Symbol: ${context.symbol}`)
  console.log(`  Timeframe: ${context.timeframe}`)
  console.log(`  Bars: ${(context.bars as Bar[]).length} 根K线`)
  console.log(`  Current Price: ${context.currentPrice}`)
  console.log(`  Indicators: ${JSON.stringify(context.indicators)}\n`)

  // 4. 示例1: 执行双均线交叉策略
  console.log('示例1: 双均线交叉策略')
  const maCrossScript = createExampleScript('ma-cross')

  const result1 = await engine.execute(maCrossScript, {
    context,
    timeout: 5000,
  })

  if (result1.success) {
    console.log('  执行成功！')
    console.log('  返回值:', JSON.stringify(result1.value, null, 2))
    console.log(`  执行时间: ${result1.executionTime}ms`)
  }
  else {
    console.log('  执行失败:', result1.error?.message)
  }
  console.log()

  // 5. 示例2: 执行 RSI 策略
  console.log('示例2: RSI 超买超卖策略')
  const rsiScript = createExampleScript('rsi-reversal')

  const result2 = await engine.execute(rsiScript, {
    context,
    timeout: 5000,
  })

  if (result2.success) {
    console.log('  执行成功！')
    console.log('  返回值:', JSON.stringify(result2.value, null, 2))
    console.log(`  执行时间: ${result2.executionTime}ms`)
  }
  else {
    console.log('  执行失败:', result2.error?.message)
  }
  console.log()

  // 6. 示例3: 自定义脚本 - 测试辅助函数
  console.log('示例3: 测试辅助函数')
  const testScript = `
    // 测试数学函数
    const closes = bars.map(b => b.close)
    const avg = helpers.math.avg(closes)
    const stdDev = helpers.math.std(closes)
    
    // 测试技术指标
    const sma20 = helpers.ta.sma(closes, 20)
    const rsi14 = helpers.ta.rsi(closes, 14)
    const atr = helpers.ta.atr(bars, 14)
    
    // 测试数组操作
    const returns = helpers.array.pctChange(closes)
    const cumReturns = helpers.array.cumsum(returns)
    
    return {
      statistics: {
        avg: avg?.toFixed(2),
        stdDev: stdDev?.toFixed(2)
      },
      indicators: {
        sma20: sma20?.toFixed(2),
        rsi14: rsi14?.toFixed(2),
        atr: atr?.toFixed(2)
      },
      performance: {
        totalReturn: (cumReturns[cumReturns.length - 1] * 100)?.toFixed(2) + '%',
        numReturns: returns.length
      }
    }
  `

  const result3 = await engine.execute(testScript, {
    context,
    timeout: 5000,
  })

  if (result3.success) {
    console.log('  执行成功！')
    console.log('  统计数据:', JSON.stringify(result3.value, null, 2))
    console.log(`  执行时间: ${result3.executionTime}ms`)
  }
  else {
    console.log('  执行失败:', result3.error?.message)
  }
  console.log()

  // 7. 测试脚本验证
  console.log('示例4: 脚本验证')
  const invalidScript = 'require("fs").readFileSync("/etc/passwd")'
  const validation = engine.validate(invalidScript)

  console.log('  验证危险脚本:')
  console.log('  Valid:', validation.valid)
  console.log('  Errors:', validation.errors)
  console.log()

  console.log('=== 示例执行完成 ===')
}

// 运行示例
if (require.main === module) {
  runStrategyExample().catch(console.error)
}

export { runStrategyExample }
