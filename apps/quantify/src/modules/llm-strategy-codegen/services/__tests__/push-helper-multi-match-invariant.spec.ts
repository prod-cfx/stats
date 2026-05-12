/**
 * push-helper-multi-match-invariant.spec.ts
 *
 * Issue #1220：seed extractor 内的 push helper 同子句多组同模式必须全部抽出。
 *
 * 不变式：
 * - 同一子句重复 N 次某 push helper 命中模式 → 必产 N 个对应 trigger
 * - 每个 trigger 的 evidence.text 必须是其对应命中的精确 substring（不是整条子句）
 *
 * 覆盖：cross_over / cross_under、indicator.above/below、bollinger boundary、RSI 阈值。
 */
import type { SemanticState } from '../../types/semantic-state'
import { SemanticSeedExtractorService } from '../semantic-seed-extractor.service'
import { SemanticSeedStateBuilderService } from '../semantic-seed-state-builder.service'

let extractor: SemanticSeedExtractorService
let builder: SemanticSeedStateBuilderService

beforeEach(() => {
  extractor = new SemanticSeedExtractorService()
  builder = new SemanticSeedStateBuilderService()
})

function buildState(message: string): SemanticState {
  const patch = extractor.extract(message)
  const state = builder.build(patch)
  if (!state) throw new Error(`state_build_failed for: ${message}`)
  return state
}

function getEvidenceText(trigger: SemanticState['triggers'][number]): string | null {
  const t = trigger as unknown as { evidence?: { text?: unknown }; params?: { sourceText?: unknown } }
  if (t.evidence && typeof t.evidence.text === 'string') return t.evidence.text
  if (t.params && typeof t.params.sourceText === 'string') return t.params.sourceText
  return null
}

// ─────────────────────────────────────────────────────────────────────────────
// Case A：MA + EMA 同子句 2 组 cross_over
// ─────────────────────────────────────────────────────────────────────────────
it('[#A] MA20 上穿 MA50 且 EMA7 上穿 EMA21 开多 → 抽出 2 个 cross_over trigger', () => {
  const utterance = 'MA20 上穿 MA50 且 EMA7 上穿 EMA21 开多'
  const state = buildState(utterance)

  const crossOvers = state.triggers.filter(
    t => t.key === 'indicator.cross_over' && t.phase === 'entry',
  )

  // 必须同时抽出 MA(20/50) 与 EMA(7/21) 两组
  const maPair = crossOvers.find(
    t => t.params?.indicator === 'ma' && t.params?.fastPeriod === 20 && t.params?.slowPeriod === 50,
  )
  const emaPair = crossOvers.find(
    t => t.params?.indicator === 'ema' && t.params?.fastPeriod === 7 && t.params?.slowPeriod === 21,
  )

  expect(maPair).toBeDefined()
  expect(emaPair).toBeDefined()

  // evidence.text 必须是对应命中的精确 substring（不是整条 utterance）
  const maEvidence = getEvidenceText(maPair!)
  const emaEvidence = getEvidenceText(emaPair!)

  expect(maEvidence).not.toBeNull()
  expect(emaEvidence).not.toBeNull()
  expect(maEvidence!.length).toBeLessThan(utterance.length)
  expect(emaEvidence!.length).toBeLessThan(utterance.length)
  expect(maEvidence).toContain('MA20')
  expect(maEvidence).toContain('MA50')
  expect(emaEvidence).toContain('EMA7')
  expect(emaEvidence).toContain('EMA21')
  // 子句精确性：MA 的 evidence 不应包含 EMA 段
  expect(maEvidence).not.toContain('EMA21')
  expect(emaEvidence).not.toContain('MA50')
})

// ─────────────────────────────────────────────────────────────────────────────
// Case B：三段混合 — cross + RSI + cross
// ─────────────────────────────────────────────────────────────────────────────
it('[#B] MA20 上穿 MA50 且 RSI14 低于 35 且 EMA7 上穿 EMA21 开多 → ≥ 2 个 cross_over + ≥ 1 个 rsi_lte', () => {
  const utterance = 'MA20 上穿 MA50 且 RSI14 低于 35 且 EMA7 上穿 EMA21 开多'
  const state = buildState(utterance)

  const crossOvers = state.triggers.filter(t => t.key === 'indicator.cross_over' && t.phase === 'entry')
  const maPair = crossOvers.find(t => t.params?.fastPeriod === 20 && t.params?.slowPeriod === 50)
  const emaPair = crossOvers.find(t => t.params?.fastPeriod === 7 && t.params?.slowPeriod === 21)
  expect(maPair).toBeDefined()
  expect(emaPair).toBeDefined()

  const rsiLte = state.triggers.find(t => t.key === 'oscillator.rsi_lte' && t.phase === 'entry')
  expect(rsiLte).toBeDefined()

  for (const trigger of [maPair!, emaPair!, rsiLte!]) {
    const ev = getEvidenceText(trigger)
    expect(ev).not.toBeNull()
    // 不应是整条 utterance
    expect(ev!.length).toBeLessThan(utterance.length)
  }
})

// ─────────────────────────────────────────────────────────────────────────────
// Case C：indicator.above 同子句 3 组
// ─────────────────────────────────────────────────────────────────────────────
it('[#C] 价格高于 EMA20 且价格高于 EMA50 且价格高于 EMA144 开多 → 3 个 indicator.above', () => {
  const utterance = '价格高于 EMA20 且价格高于 EMA50 且价格高于 EMA144 开多'
  const state = buildState(utterance)

  const aboves = state.triggers.filter(t => t.key === 'indicator.above' && t.phase === 'entry')
  const periods = new Set(
    aboves
      .map(t => (t.params as Record<string, unknown> | undefined)?.['reference.period'])
      .filter((v): v is number => typeof v === 'number'),
  )
  expect(periods.has(20)).toBe(true)
  expect(periods.has(50)).toBe(true)
  expect(periods.has(144)).toBe(true)
})

// ─────────────────────────────────────────────────────────────────────────────
// Case D：布林上轨 + 布林下轨 → 2 个 boundary trigger
// ─────────────────────────────────────────────────────────────────────────────
it('[#D] K 线触及布林下轨开多，K 线触及布林上轨开空 → 2 个 boundary trigger', () => {
  const state = buildState('K 线触及布林下轨开多，K 线触及布林上轨开空')

  const lowerTouch = state.triggers.find(
    t => (
      (t.key === 'bollinger.touch_lower' || t.key === 'price.detect.indicator_boundary')
      && t.phase === 'entry'
      && (t.sideScope === 'long' || t.sideScope === 'both')
    ),
  )
  const upperTouch = state.triggers.find(
    t => (
      (t.key === 'bollinger.touch_upper' || t.key === 'price.detect.indicator_boundary')
      && t.phase === 'entry'
      && (t.sideScope === 'short' || t.sideScope === 'both')
    ),
  )

  expect(lowerTouch).toBeDefined()
  expect(upperTouch).toBeDefined()
})

// ─────────────────────────────────────────────────────────────────────────────
// Case E：evidence span 不变式 — 对 Case A 的 utterance 抽出的 cross trigger 全部 evidence.text 必须
// 是 utterance 的真子串且短于 utterance
// ─────────────────────────────────────────────────────────────────────────────
it('[#E] 每个 cross trigger 的 evidence.text 是 utterance 的真子串', () => {
  const utterance = 'MA20 上穿 MA50 且 EMA7 上穿 EMA21 开多'
  const state = buildState(utterance)

  const crossOvers = state.triggers.filter(t => t.key === 'indicator.cross_over' && t.phase === 'entry')
  expect(crossOvers.length).toBeGreaterThanOrEqual(2)

  for (const trigger of crossOvers) {
    const ev = getEvidenceText(trigger)
    expect(ev).not.toBeNull()
    expect(utterance).toContain(ev!)
    expect(ev!.length).toBeLessThan(utterance.length)
  }
})
