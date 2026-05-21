import type { OfficialStrategyPlazaTemplate } from '../types/official-strategy-plaza-template'
import { OFFICIAL_STRATEGY_PLAZA_BACKTEST_EVIDENCE } from './official-strategy-plaza-backtest-evidence.constant'

function evidenceFor(templateId: OfficialStrategyPlazaTemplate['id']) {
  const evidence = OFFICIAL_STRATEGY_PLAZA_BACKTEST_EVIDENCE.templates.find(item => item.templateId === templateId)
  if (!evidence) {
    throw new Error(`Missing official Strategy Plaza evidence for ${templateId}`)
  }
  return evidence
}

function paramsFor(templateId: OfficialStrategyPlazaTemplate['id']): Record<string, number> {
  return evidenceFor(templateId).params
}

function metricsFor(templateId: OfficialStrategyPlazaTemplate['id']): OfficialStrategyPlazaTemplate['displayMetrics'] {
  const metrics = evidenceFor(templateId).metrics
  return {
    label: 'official_sample_backtest',
    returnPct: metrics.totalReturnPct,
    winRatePct: Number((metrics.winRate * 100).toFixed(2)),
    maxDrawdownPct: metrics.maxDrawdownPct,
  }
}

export const OFFICIAL_STRATEGY_PLAZA_TEMPLATES = [
  {
    id: 'ma-cross',
    name: 'MA 均线交叉',
    description: '短均线上穿长均线做多，跌回长均线下方退出。',
    logicDescription: '使用优化后的 6/48 均线判断趋势方向，适合趋势初期跟随。',
    tags: ['趋势跟随', '均线', 'OKX 模拟盘'],
    riskLevel: 'medium',
    scenario: '趋势行情',
    exchange: 'okx',
    environment: 'demo',
    status: 'live',
    displayOrder: 10,
    runConfig: {
      exchange: 'okx',
      marketType: 'perp',
      symbol: 'BTC-USDT-SWAP',
      timeframe: '15m',
      positionPct: paramsFor('ma-cross').positionPct,
      leverage: 2,
      publishedSnapshotId: 'official-plaza-ma-cross-v1-snapshot',
      deploymentExecutionConfig: { leverage: 2, priceSource: 'mark', orderType: 'market', timeInForce: 'ioc' },
    },
    editSeed: {
      initialMessage: '基于 OKX 模拟盘 BTC-USDT-SWAP 合约 15m，创建 MA 6/48 均线交叉趋势跟随策略。入场规则：MA6 上穿 MA48 时做多开仓；出场规则：MA6 下穿 MA48 时平多；风控：仓位 35%，2 倍杠杆，止损 2%，止盈 0.6%。',
      guideConfig: {
        symbolExample: 'BTC-USDT-SWAP',
        timeframeExample: '15m',
        entryRuleExample: 'MA6 上穿 MA48',
        exitRuleExample: 'MA6 下穿 MA48',
        riskRuleExample: 'OKX 模拟盘，仓位 35%，2 倍杠杆',
      },
      locales: {
        en: {
          initialMessage: 'Create an MA 6/48 crossover trend-following strategy on OKX Demo BTC-USDT-SWAP perpetual, 15m timeframe. Entry rule: open long when MA6 crosses above MA48. Exit rule: close long when MA6 crosses below MA48. Risk controls: 35% position, 2x leverage, 2% stop loss, 0.6% take profit.',
          guideConfig: {
            symbolExample: 'BTC-USDT-SWAP',
            timeframeExample: '15m',
            entryRuleExample: 'MA6 crosses above MA48',
            exitRuleExample: 'MA6 crosses below MA48',
            riskRuleExample: 'OKX Demo, 35% position, 2x leverage',
          },
        },
      },
    },
    displayMetrics: metricsFor('ma-cross'),
  },
  {
    id: 'bollinger-reversion',
    name: '布林带均值回归',
    description: '价格触及布林带外轨后等待回归，中轨附近止盈。',
    logicDescription: '使用优化后的 30 周期、0.9 倍标准差布林带识别偏离和回归。',
    tags: ['均值回归', '布林带', 'OKX 模拟盘'],
    riskLevel: 'medium',
    scenario: '震荡偏离后回归',
    exchange: 'okx',
    environment: 'demo',
    status: 'live',
    displayOrder: 20,
    runConfig: {
      exchange: 'okx',
      marketType: 'perp',
      symbol: 'ETH-USDT-SWAP',
      timeframe: '15m',
      positionPct: paramsFor('bollinger-reversion').positionPct,
      leverage: 2,
      publishedSnapshotId: 'official-plaza-bollinger-reversion-v1-snapshot',
      deploymentExecutionConfig: { leverage: 2, priceSource: 'mark', orderType: 'market', timeInForce: 'ioc' },
    },
    editSeed: {
      initialMessage: '基于 OKX 模拟盘 ETH-USDT-SWAP 合约 15m，创建布林带均值回归策略。入场规则：价格触及布林带 30 周期 0.9 倍标准差下轨时做多开仓；出场规则：价格回归布林带中轨时平多；风控：仓位 35%，2 倍杠杆，止损 3%，止盈 0.5%。',
      guideConfig: {
        symbolExample: 'ETH-USDT-SWAP',
        timeframeExample: '15m',
        entryRuleExample: '价格触及布林带下轨后出现回归信号',
        exitRuleExample: '价格回归布林带中轨附近',
        riskRuleExample: 'OKX 模拟盘，仓位 35%，2 倍杠杆',
      },
      locales: {
        en: {
          initialMessage: 'Create a Bollinger mean reversion strategy on OKX Demo ETH-USDT-SWAP perpetual, 15m timeframe. Entry rule: open long when price touches the lower Bollinger Band using period 30 and 0.9 standard deviation, with a reversion signal. Exit rule: close long when price returns near the middle band. Risk controls: 35% position, 2x leverage, 3% stop loss, 0.5% take profit.',
          guideConfig: {
            symbolExample: 'ETH-USDT-SWAP',
            timeframeExample: '15m',
            entryRuleExample: 'price touches the lower Bollinger Band and shows reversion',
            exitRuleExample: 'price returns near the Bollinger middle band',
            riskRuleExample: 'OKX Demo, 35% position, 2x leverage',
          },
        },
      },
    },
    displayMetrics: metricsFor('bollinger-reversion'),
  },
  {
    id: 'grid-range',
    name: '区间低买高卖',
    description: '在震荡区间内低买高卖，适合方向不明显的行情。',
    logicDescription: '使用最近 36 根 K 线区间下 20%/上 55% 执行现货低买高卖。',
    tags: ['区间', '低买高卖', 'OKX 模拟盘'],
    riskLevel: 'low',
    scenario: '区间震荡',
    exchange: 'okx',
    environment: 'demo',
    status: 'live',
    displayOrder: 30,
    runConfig: {
      exchange: 'okx',
      marketType: 'spot',
      symbol: 'BTC-USDT',
      timeframe: '15m',
      positionPct: paramsFor('grid-range').positionPct,
      leverage: null,
      publishedSnapshotId: 'official-plaza-grid-range-v1-snapshot',
      deploymentExecutionConfig: { leverage: null, priceSource: 'last', orderType: 'market', timeInForce: 'ioc' },
    },
    editSeed: {
      initialMessage: '基于 OKX 模拟盘 BTC-USDT 现货 15m，创建区间低买高卖策略。入场规则：价格位于最近 36 根 K 线区间下 20% 时买入；出场规则：价格回到区间上 55% 或盈利达到 0.45% 时卖出平仓；风控：单次仓位 25%，不使用杠杆，止损 3%。',
      guideConfig: {
        symbolExample: 'BTC-USDT',
        timeframeExample: '15m',
        entryRuleExample: '价格进入最近 K 线区间下沿买入',
        exitRuleExample: '价格回到区间上沿卖出',
        riskRuleExample: 'OKX 模拟盘现货，单次仓位 25%，不使用杠杆',
      },
      locales: {
        en: {
          initialMessage: 'Create a range buy/sell strategy on OKX Demo BTC-USDT spot, 15m timeframe. Entry rule: buy when price is in the lower 20% of the most recent 36-candle range. Exit rule: sell when price returns to the upper 55% of the range or profit reaches 0.45%. Risk controls: 25% position per trade, no leverage, 3% stop loss.',
          guideConfig: {
            symbolExample: 'BTC-USDT',
            timeframeExample: '15m',
            entryRuleExample: 'buy when price enters the lower part of the recent candle range',
            exitRuleExample: 'sell when price returns to the upper range',
            riskRuleExample: 'OKX Demo spot, 25% position per trade, no leverage',
          },
        },
      },
    },
    displayMetrics: metricsFor('grid-range'),
  },
  {
    id: 'rsi-reversal',
    name: 'RSI 超买超卖',
    description: 'RSI 低位买入，高位退出，适合短周期反转。',
    logicDescription: '使用 RSI 14，跌破 38 后重新站上视为反转，高于 64 退出。',
    tags: ['RSI', '反转', 'OKX 模拟盘'],
    riskLevel: 'medium',
    scenario: '短周期反转',
    exchange: 'okx',
    environment: 'demo',
    status: 'live',
    displayOrder: 40,
    runConfig: {
      exchange: 'okx',
      marketType: 'spot',
      symbol: 'ETH-USDT',
      timeframe: '15m',
      positionPct: paramsFor('rsi-reversal').positionPct,
      leverage: null,
      publishedSnapshotId: 'official-plaza-rsi-reversal-v1-snapshot',
      deploymentExecutionConfig: { leverage: null, priceSource: 'last', orderType: 'market', timeInForce: 'ioc' },
    },
    editSeed: {
      initialMessage: '基于 OKX 模拟盘 ETH-USDT 现货 15m，创建 RSI 反转策略。入场规则：RSI14 从 38 下方向上穿回 38 时买入；出场规则：RSI14 高于 64 时卖出平仓；风控：仓位 25%，不使用杠杆，止损 5%，止盈 0.5%。',
      guideConfig: {
        symbolExample: 'ETH-USDT',
        timeframeExample: '15m',
        entryRuleExample: 'RSI14 从 38 下方向上穿回 38',
        exitRuleExample: 'RSI14 高于 64',
        riskRuleExample: 'OKX 模拟盘现货，仓位 25%，不使用杠杆',
      },
      locales: {
        en: {
          initialMessage: 'Create an RSI reversal strategy on OKX Demo ETH-USDT spot, 15m timeframe. Entry rule: buy when RSI14 crosses back above 38 from below. Exit rule: sell when RSI14 is above 64. Risk controls: 25% position, no leverage, 5% stop loss, 0.5% take profit.',
          guideConfig: {
            symbolExample: 'ETH-USDT',
            timeframeExample: '15m',
            entryRuleExample: 'RSI14 crosses back above 38 from below',
            exitRuleExample: 'RSI14 is above 64',
            riskRuleExample: 'OKX Demo spot, 25% position, no leverage',
          },
        },
      },
    },
    displayMetrics: metricsFor('rsi-reversal'),
  },
  {
    id: 'breakout-follow',
    name: '突破追踪',
    description: '价格突破近期区间后跟随趋势，跌回区间则退出。',
    logicDescription: '使用 15m 近期高点突破作为入场信号，适合波动扩张。',
    tags: ['突破', '趋势', 'OKX 模拟盘'],
    riskLevel: 'high',
    scenario: '波动扩张',
    exchange: 'okx',
    environment: 'demo',
    status: 'live',
    displayOrder: 50,
    runConfig: {
      exchange: 'okx',
      marketType: 'perp',
      symbol: 'BTC-USDT-SWAP',
      timeframe: '15m',
      positionPct: paramsFor('breakout-follow').positionPct,
      leverage: 2,
      publishedSnapshotId: 'official-plaza-breakout-follow-v1-snapshot',
      deploymentExecutionConfig: { leverage: 2, priceSource: 'mark', orderType: 'market', timeInForce: 'ioc' },
    },
    editSeed: {
      initialMessage: '基于 OKX 模拟盘 BTC-USDT-SWAP 合约 15m，创建突破追踪策略。入场规则：价格突破最近 24 根 K 线高点且突破缓冲 0.25% 时做多开仓；出场规则：价格跌回最近 12 根 K 线低点时平多；风控：仓位 25%，2 倍杠杆，止损 3%，止盈 0.6%。',
      guideConfig: {
        symbolExample: 'BTC-USDT-SWAP',
        timeframeExample: '15m',
        entryRuleExample: '价格突破近期高点',
        exitRuleExample: '价格跌回突破区间',
        riskRuleExample: 'OKX 模拟盘，仓位 25%，2 倍杠杆',
      },
      locales: {
        en: {
          initialMessage: 'Create a breakout follow strategy on OKX Demo BTC-USDT-SWAP perpetual, 15m timeframe. Entry rule: open long when price breaks above the highest high of the most recent 24 candles with a 0.25% breakout buffer. Exit rule: close long when price falls back below the low of the most recent 12 candles. Risk controls: 25% position, 2x leverage, 3% stop loss, 0.6% take profit.',
          guideConfig: {
            symbolExample: 'BTC-USDT-SWAP',
            timeframeExample: '15m',
            entryRuleExample: 'price breaks above the recent high',
            exitRuleExample: 'price falls back into the breakout range',
            riskRuleExample: 'OKX Demo, 25% position, 2x leverage',
          },
        },
      },
    },
    displayMetrics: metricsFor('breakout-follow'),
  },
  {
    id: 'macd-cross',
    name: 'MACD 金叉死叉',
    description: 'MACD 金叉做多，死叉退出，适合趋势确认。',
    logicDescription: '使用优化后的 MACD 16/34/12 判断趋势动能变化。',
    tags: ['MACD', '动能', 'OKX 模拟盘'],
    riskLevel: 'medium',
    scenario: '趋势确认',
    exchange: 'okx',
    environment: 'demo',
    status: 'live',
    displayOrder: 60,
    runConfig: {
      exchange: 'okx',
      marketType: 'perp',
      symbol: 'ETH-USDT-SWAP',
      timeframe: '15m',
      positionPct: paramsFor('macd-cross').positionPct,
      leverage: 2,
      publishedSnapshotId: 'official-plaza-macd-cross-v1-snapshot',
      deploymentExecutionConfig: { leverage: 2, priceSource: 'mark', orderType: 'market', timeInForce: 'ioc' },
    },
    editSeed: {
      initialMessage: '基于 OKX 模拟盘 ETH-USDT-SWAP 合约 15m，创建 MACD 16/34/12 金叉做多、死叉平多策略。入场规则：MACD DIF 上穿 DEA 时做多开仓；出场规则：MACD DIF 下穿 DEA 时平多；本策略只做多，不做空；风控：仓位 35%，2 倍杠杆，止损 2%，止盈 0.5%。',
      guideConfig: {
        symbolExample: 'ETH-USDT-SWAP',
        timeframeExample: '15m',
        entryRuleExample: 'MACD DIF 上穿 DEA',
        exitRuleExample: 'MACD DIF 下穿 DEA 时平多',
        riskRuleExample: 'OKX 模拟盘，仓位 35%，2 倍杠杆',
      },
      locales: {
        en: {
          initialMessage: 'Create a long-only MACD 16/34/12 strategy on OKX Demo ETH-USDT-SWAP perpetual, 15m timeframe. Entry rule: open long when MACD DIF crosses above DEA. Exit rule: close long when MACD DIF crosses below DEA. This strategy does not open short positions. Risk controls: 35% position, 2x leverage, 2% stop loss, 0.5% take profit.',
          guideConfig: {
            symbolExample: 'ETH-USDT-SWAP',
            timeframeExample: '15m',
            entryRuleExample: 'MACD DIF crosses above DEA',
            exitRuleExample: 'MACD DIF crosses below DEA to close long',
            riskRuleExample: 'OKX Demo, 35% position, 2x leverage',
          },
        },
      },
    },
    displayMetrics: metricsFor('macd-cross'),
  },
] satisfies readonly OfficialStrategyPlazaTemplate[]
