import type { StrategyLogicGraph } from './logic-graph-model'
import type { QuantParams } from '@/app/[lng]/ai-quant/AiQuantPageClient'
import type { TFunction } from 'i18next'

function findPercent(input: string, fallback: number) {
  const match = input.match(/(\d+(?:\.\d+)?)%/)
  return match ? Number(match[1]) : fallback
}

function findWindow(input: string, fallback: number) {
  const match = input.match(/(\d+)\s*分钟/) || input.match(/(\d+)\s*m/)
  return match ? Number(match[1]) : fallback
}

export function buildLogicGraphFromPrompt(
  input: string,
  params: QuantParams,
  version: number,
  t: TFunction,
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
        operator: t('aiQuant.logic.dropIn', { window: buyWindow }),
        value: `${buyDrop}%`,
      },
      {
        id: `trigger-sell-${version}`,
        join: 'AND',
        subject: params.symbol,
        operator: t('aiQuant.logic.riseIn', { window: params.sellWindowMin }),
        value: `${params.sellRisePct}%`,
      },
    ],
    actions: [
      {
        id: `action-buy-${version}`,
        action: 'BUY',
        target: params.symbol,
        amount: t('aiQuant.logic.buyAmount', { percent: params.positionPct }),
      },
      {
        id: `action-sell-${version}`,
        action: 'SELL',
        target: params.symbol,
        amount: t('aiQuant.logic.sellAmount', { percent: params.positionPct }),
      },
    ],
    risk: [
      t('aiQuant.logic.riskPosition', { percent: params.positionPct }),
      t('aiQuant.logic.riskDrawdown', { percent: 20 }),
    ],
    meta: {
      exchange: params.exchange,
      symbol: params.symbol,
      timeframe: `${params.buyWindowMin}m/${params.sellWindowMin}m`,
      positionPct: params.positionPct,
    },
  }
}
