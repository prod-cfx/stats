import type { QuantParams } from '@/app/[lng]/ai-quant/AiQuantPageClient'

export interface StrategyPreset {
  id: string
  name: string
  desc: string
  params: Partial<QuantParams>
}

export const STRATEGY_PRESETS: StrategyPreset[] = [
  {
    id: 'momentum-steady',
    name: '价格动量（稳健）',
    desc: '3分钟跌 1% 买入，15分钟涨 2% 卖出，10% 仓位',
    params: {
      exchange: 'binance',
      symbol: 'BTCUSDT',
      buyWindowMin: 3,
      buyDropPct: 1,
      sellWindowMin: 15,
      sellRisePct: 2,
      positionPct: 10,
    },
  },
  {
    id: 'momentum-aggressive',
    name: '价格动量（进取）',
    desc: '5分钟跌 1.5% 买入，20分钟涨 3% 卖出，15% 仓位',
    params: {
      exchange: 'okx',
      symbol: 'BTC-USDT-SWAP',
      buyWindowMin: 5,
      buyDropPct: 1.5,
      sellWindowMin: 20,
      sellRisePct: 3,
      positionPct: 15,
    },
  },
  {
    id: 'grid-range',
    name: '网格（区间震荡）',
    desc: '区间 60000-80000，网格 0.5%，单笔 10% 仓位',
    params: {
      exchange: 'okx',
      symbol: 'BTC-USDT-SWAP',
      buyWindowMin: 10,
      buyDropPct: 0.5,
      sellWindowMin: 10,
      sellRisePct: 0.5,
      positionPct: 10,
    },
  },
  {
    id: 'bollinger-reversion',
    name: '布林带均值回归',
    desc: '15分钟周期，上轨做空下轨做多，单笔 10%',
    params: {
      exchange: 'okx',
      symbol: 'BTC-USDT-SWAP',
      buyWindowMin: 15,
      buyDropPct: 0.8,
      sellWindowMin: 15,
      sellRisePct: 1.2,
      positionPct: 10,
    },
  },
  {
    id: 'breakout-short',
    name: '突破追涨（短周期）',
    desc: '3分钟确认突破后跟随，止盈目标 2%',
    params: {
      exchange: 'binance',
      symbol: 'BTCUSDT',
      buyWindowMin: 3,
      buyDropPct: 0.4,
      sellWindowMin: 12,
      sellRisePct: 2,
      positionPct: 12,
    },
  },
  {
    id: 'dip-buy-mid',
    name: '回撤抄底（中周期）',
    desc: '15分钟回撤 1.8% 买入，反弹 2.4% 卖出',
    params: {
      exchange: 'binance',
      symbol: 'ETHUSDT',
      buyWindowMin: 15,
      buyDropPct: 1.8,
      sellWindowMin: 30,
      sellRisePct: 2.4,
      positionPct: 8,
    },
  },
]

export function findPresetById(id: string) {
  return STRATEGY_PRESETS.find(item => item.id === id)
}
