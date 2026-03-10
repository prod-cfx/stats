import type { StrategyLogicGraph } from './logic-graph-model'
import type { QuantParams } from '@/app/[lng]/ai-quant/AiQuantPageClient'

function findPercent(input: string, fallback: number) {
  const match = input.match(/(\d+(?:\.\d+)?)%/)
  return match ? Number(match[1]) : fallback
}

function findWindow(input: string, fallback: number) {
  const match = input.match(/(\d+)\s*分钟/)
  return match ? Number(match[1]) : fallback
}

export function buildLogicGraphFromPrompt(
  input: string,
  params: QuantParams,
  version: number,
): StrategyLogicGraph {
  const buyDrop = findPercent(input, params.buyDropPct)
  const buyWindow = findWindow(input, params.buyWindowMin)

  return {
    version,
    status: 'draft',
    trigger: [
      {
        id: `trigger-buy-${version}`,
        subject: params.symbol,
        operator: `在 ${buyWindow} 分钟内下跌`,
        value: `${buyDrop}%`,
      },
      {
        id: `trigger-sell-${version}`,
        join: 'AND',
        subject: params.symbol,
        operator: `在 ${params.sellWindowMin} 分钟内上涨`,
        value: `${params.sellRisePct}%`,
      },
    ],
    actions: [
      {
        id: `action-buy-${version}`,
        action: 'BUY',
        target: params.symbol,
        amount: `${params.positionPct}% 资金`,
      },
      {
        id: `action-sell-${version}`,
        action: 'SELL',
        target: params.symbol,
        amount: `${params.positionPct}% 持仓`,
      },
    ],
    risk: [`单笔仓位 ${params.positionPct}%`, '默认最大回撤阈值 20%'],
    meta: {
      exchange: params.exchange,
      symbol: params.symbol,
      timeframe: `${params.buyWindowMin}m/${params.sellWindowMin}m`,
      positionPct: params.positionPct,
    },
  }
}
