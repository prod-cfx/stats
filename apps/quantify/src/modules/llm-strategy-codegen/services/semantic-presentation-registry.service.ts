import { Injectable } from '@nestjs/common'

import type {
  SemanticPresentationMetadata,
} from '../types/semantic-presentation'

const INTERNAL_KEY_LEAK_PATTERN = /generic_boundary|indicator\.above|indicator\.below|price\.detect\.indicator_boundary/u

const PRESENTATIONS: SemanticPresentationMetadata[] = [
  presentation({
    key: 'condition.expression',
    publicName: '表达式条件',
    aliases: ['自定义条件', '条件表达式'],
    positiveExamples: ['价格同时位于 EMA20、EMA60、EMA144 上方'],
    negativeExamples: ['indicator.above'],
    displayRenderer: ({ params }) => stringParam(params, 'label', '自定义条件'),
  }),
  presentation({
    key: 'indicator.boundary_touch',
    publicName: '指标边界触及',
    aliases: ['触及指标边界', '指标碰线'],
    positiveExamples: ['触及 BOLL 下轨'],
    negativeExamples: ['generic_boundary'],
    displayRenderer: ({ params }) => renderIndicatorBoundaryTouch(params),
  }),
  presentation({
    key: 'price.detect.indicator_boundary',
    publicName: '价格触及指标边界',
    aliases: ['价格碰线', '触及指标边界'],
    positiveExamples: ['触及 BOLL 下轨（20, 2）'],
    negativeExamples: ['price.detect.indicator_boundary'],
    displayRenderer: ({ params }) => renderIndicatorBoundaryTouch(params),
  }),
  presentation({
    key: 'risk.stop_loss_pct',
    publicName: '百分比止损',
    aliases: ['止损比例', '亏损止损'],
    positiveExamples: ['亏损 5% 止损'],
    negativeExamples: ['risk.stop_loss_pct'],
    displayRenderer: ({ params }) => `亏损 ${numberParam(params, 'valuePct', 0)}% 止损`,
  }),
  presentation({
    key: 'open_long',
    publicName: '开多',
    aliases: ['做多', '买入开多'],
    positiveExamples: ['开多'],
    negativeExamples: ['open_long'],
    displayRenderer: () => '开多',
  }),
  presentation({
    key: 'open_short',
    publicName: '开空',
    aliases: ['做空', '卖出开空'],
    positiveExamples: ['开空'],
    negativeExamples: ['open_short'],
    displayRenderer: () => '开空',
  }),
  presentation({
    key: 'position.fixed_pct',
    publicName: '固定比例仓位',
    aliases: ['固定百分比仓位', '按比例下单'],
    positiveExamples: ['单笔 10% 仓位'],
    negativeExamples: ['position.fixed_pct'],
    displayRenderer: ({ params }) => `单笔 ${numberParam(params, 'value', 0) * 100}% 仓位`,
  }),
  presentation({
    key: 'position.fixed_notional',
    publicName: '固定名义金额',
    aliases: ['固定金额仓位', '按金额下单'],
    positiveExamples: ['单笔 100 USDT'],
    negativeExamples: ['position.fixed_notional'],
    displayRenderer: ({ params }) => `单笔 ${numberParam(params, 'value', 0)} ${stringParam(params, 'asset', 'USDT')}`,
  }),
  presentation({
    key: 'position.fixed_quantity',
    publicName: '固定数量仓位',
    aliases: ['固定数量下单', '按数量下单'],
    positiveExamples: ['单笔 0.01 BTC'],
    negativeExamples: ['position.fixed_quantity'],
    displayRenderer: ({ params }) => `单笔 ${numberParam(params, 'value', 0)} ${stringParam(params, 'asset', '币')}`,
  }),
]

@Injectable()
export class SemanticPresentationRegistryService {
  private readonly presentations = new Map(PRESENTATIONS.map(metadata => [metadata.key, metadata]))

  get(key: string): SemanticPresentationMetadata {
    const metadata = this.presentations.get(key)
    if (!metadata) {
      throw new Error(`semantic_presentation_not_registered:${key}`)
    }
    return metadata
  }

  renderDisplay(key: string, params: Record<string, unknown>): string {
    const output = this.get(key).displayRenderer({ params })
    if (INTERNAL_KEY_LEAK_PATTERN.test(output)) {
      throw new Error(`semantic_presentation_internal_key_leak:${key}`)
    }
    return output
  }
}

function presentation(
  metadata: Omit<SemanticPresentationMetadata, 'clarificationRenderer'> & {
    clarificationRenderer?: SemanticPresentationMetadata['clarificationRenderer']
  },
): SemanticPresentationMetadata {
  return {
    ...metadata,
    clarificationRenderer: metadata.clarificationRenderer ?? defaultClarificationRenderer,
  }
}

function defaultClarificationRenderer(slotKey: string): string {
  return `请补充 ${slotKey}。`
}

function renderIndicatorBoundaryTouch(params: Record<string, unknown>): string {
  const indicator = objectParam(params, 'indicator')
  const indicatorName = stringParam(indicator, 'name', '指标')
  const boundaryRole = stringParam(params, 'boundaryRole', 'boundary')

  if (indicatorName === 'bollinger') {
    const period = numberParam(indicator, 'period', 20)
    const stdDev = numberParam(indicator, 'stdDev', 2)
    return `触及 BOLL ${renderBoundaryRole(boundaryRole)}（${period}, ${stdDev}）`
  }

  return `触及 ${indicatorName.toUpperCase()} ${renderBoundaryRole(boundaryRole)}`
}

function renderBoundaryRole(boundaryRole: string): string {
  const roleNames: Record<string, string> = {
    lower: '下轨',
    middle: '中轨',
    upper: '上轨',
  }
  return roleNames[boundaryRole] ?? '边界'
}

function objectParam(params: Record<string, unknown>, key: string): Record<string, unknown> {
  const value = params[key]
  return typeof value === 'object' && value !== null && !Array.isArray(value) ? value as Record<string, unknown> : {}
}

function stringParam(params: Record<string, unknown>, key: string, fallback: string): string {
  const value = params[key]
  return typeof value === 'string' && value.length > 0 ? value : fallback
}

function numberParam(params: Record<string, unknown>, key: string, fallback: number): number {
  const value = params[key]
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback
}
