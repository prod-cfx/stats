import type { CanonicalConditionNode, CanonicalRuleV2 } from '../../types/canonical-strategy-spec'
import type { SemanticExpression, SemanticSlotState, SemanticState } from '../../types/semantic-state'
import { CanonicalSpecBuilderService } from '../canonical-spec-builder.service'
import { NaturalLanguageGatewayService } from '../natural-language-gateway.service'
import { SemanticAtomRegistryService } from '../semantic-atom-registry.service'
import { SemanticContractReadinessService } from '../semantic-contract-readiness.service'
import { SemanticFrameNormalizerService } from '../semantic-frame-normalizer.service'
import { SemanticSeedExtractorService } from '../semantic-seed-extractor.service'
import { SemanticSeedStateBuilderService } from '../semantic-seed-state-builder.service'
import { SemanticStateProjectionService } from '../semantic-state-projection.service'
import { SemanticSupportClassifierService } from '../semantic-support-classifier.service'

const P0_INPUT = '15min k线 在价格都位于ema20 ema60 ema144 上方时候只开多 都位于下方时候只开空 入场时机是boll下轨开多 上轨开空 币安的btcusdt永续合约 风控是亏损百分5止损'

describe('semantic gateway golden corpus', () => {
  const gateway = new NaturalLanguageGatewayService()
  const frameNormalizer = new SemanticFrameNormalizerService()
  const seedExtractor = new SemanticSeedExtractorService()
  const seedStateBuilder = new SemanticSeedStateBuilderService()
  const atomRegistry = new SemanticAtomRegistryService()
  const supportClassifier = new SemanticSupportClassifierService(atomRegistry)
  const readiness = new SemanticContractReadinessService()
  const stateProjection = new SemanticStateProjectionService()
  const canonicalBuilder = new CanonicalSpecBuilderService()

  it('keeps the P0 EMA gate plus BOLL boundary strategy stable through the full semantic chain', () => {
    const frames = gateway.parse(P0_INPUT)
    const gatewayPatch = frameNormalizer.normalize(frames)
    const seedPatch = seedExtractor.extract(P0_INPUT)
    const builtState = seedStateBuilder.build(seedPatch)

    expect(frames.length).toBeGreaterThanOrEqual(10)
    expectGatewayPatch(gatewayPatch)
    expect(builtState).not.toBeNull()

    if (!builtState) {
      throw new Error('Expected semantic seed state to be built')
    }

    const classified = supportClassifier.classify(builtState)
    const normalized = readiness.normalize(classified.state)
    const displayText = buildDisplayText(stateProjection, normalized.state)
    const openSlots = collectOpenSlots(normalized.state)
    const canonicalSpec = canonicalBuilder.build({ semanticState: normalized.state })

    expect(classified.state).toBeDefined()
    expect(normalized.state).toBeDefined()
    expectRawP0Frames(frames)
    expectP0ContextState(normalized.state)
    expect(displayText).toEqual(expect.stringContaining('EMA20'))
    expect(displayText).toEqual(expect.stringContaining('EMA60'))
    expect(displayText).toEqual(expect.stringContaining('EMA144'))
    expect(displayText).toEqual(expect.stringContaining('BOLL'))
    expect(displayText).not.toMatch(/generic_boundary|indicator\.above|indicator\.below|price\.detect\.indicator_boundary/u)
    expectP0Clarification(stateProjection, normalized.state)

    expect(normalized.ready).toBe(false)
    expect(openSlots).toEqual(expect.arrayContaining([
      expect.objectContaining({
        slotKey: 'position.sizing',
        fieldPath: 'position.sizing',
        status: 'open',
      }),
    ]))
    expect(normalized.state.position).toEqual(expect.objectContaining({
      status: 'open',
      sizing: null,
    }))
    expect(canonicalSpec).toEqual(expect.objectContaining({
      version: 2,
      market: expect.any(Object),
      rules: expect.any(Array),
    }))
    expect(canonicalSpec.rules.length).toBeGreaterThan(0)
    expectCanonicalP0Market(canonicalSpec)
    expectCanonicalP0Rules(canonicalSpec.rules)

    const canonicalJson = JSON.stringify(canonicalSpec)
    expect(canonicalJson).toContain('OPEN_LONG')
    expect(canonicalJson).toContain('OPEN_SHORT')
    expect(canonicalJson).toContain('bollinger.lower_break')
    expect(canonicalJson).toContain('bollinger.upper_break')
    expect(canonicalJson).not.toMatch(/generic_boundary|indicator\.above|indicator\.below/u)
  })
})

function expectRawP0Frames(frames: ReturnType<NaturalLanguageGatewayService['parse']>): void {
  expect(frames).toEqual(expect.arrayContaining([
    expect.objectContaining({
      kind: 'context',
      field: 'timeframe',
      value: '15m',
    }),
    expect.objectContaining({
      kind: 'context',
      field: 'exchange',
      value: 'binance',
    }),
    expect.objectContaining({
      kind: 'context',
      field: 'symbol',
      value: 'BTCUSDT',
    }),
    expect.objectContaining({
      kind: 'context',
      field: 'marketType',
      value: 'perp',
    }),
    expect.objectContaining({
      kind: 'action',
      actionKey: 'open_long',
    }),
    expect.objectContaining({
      kind: 'action',
      actionKey: 'open_short',
    }),
    expect.objectContaining({
      kind: 'risk',
      riskKey: 'risk.stop_loss_pct',
      valuePct: 5,
    }),
    expect.objectContaining({
      kind: 'boundary_touch',
      indicator: 'bollinger',
      boundaryRole: 'lower',
      sideScope: 'long',
    }),
    expect.objectContaining({
      kind: 'boundary_touch',
      indicator: 'bollinger',
      boundaryRole: 'upper',
      sideScope: 'short',
    }),
  ]))
}

function expectGatewayPatch(gatewayPatch: ReturnType<SemanticFrameNormalizerService['normalize']>): void {
  expect(gatewayPatch.contextSlots).toEqual(expect.objectContaining({
    timeframe: '15m',
    exchange: 'binance',
    symbol: 'BTCUSDT',
    marketType: 'perp',
  }))
  expect(gatewayPatch.actions).toEqual(expect.arrayContaining([
    expect.objectContaining({ key: 'open_long' }),
    expect.objectContaining({ key: 'open_short' }),
  ]))
  expect(gatewayPatch.risk).toEqual(expect.arrayContaining([
    expect.objectContaining({
      key: 'risk.stop_loss_pct',
      params: expect.objectContaining({ valuePct: 5 }),
    }),
  ]))
  expect(gatewayPatch.triggers).toEqual(expect.arrayContaining([
    expect.objectContaining({
      key: 'condition.expression',
      phase: 'gate',
      sideScope: 'long',
    }),
    expect.objectContaining({
      key: 'condition.expression',
      phase: 'gate',
      sideScope: 'short',
    }),
    expect.objectContaining({
      key: 'price.detect.indicator_boundary',
      phase: 'entry',
      sideScope: 'long',
      params: expect.objectContaining({ boundaryRole: 'lower' }),
    }),
    expect.objectContaining({
      key: 'price.detect.indicator_boundary',
      phase: 'entry',
      sideScope: 'short',
      params: expect.objectContaining({ boundaryRole: 'upper' }),
    }),
  ]))
  expectConditionExpression(findGatewayExpression(gatewayPatch, 'long'), 'GT')
  expectConditionExpression(findGatewayExpression(gatewayPatch, 'short'), 'LT')
}

function expectP0ContextState(state: SemanticState): void {
  expect(state.contextSlots.timeframe).toEqual(expect.objectContaining({
    slotKey: 'timeframe',
    fieldPath: 'contextSlots.timeframe',
    status: 'locked',
    value: '15m',
  }))
  expect(state.contextSlots.symbol).toEqual(expect.objectContaining({
    slotKey: 'symbol',
    fieldPath: 'contextSlots.symbol',
    status: 'locked',
    value: 'BTCUSDT',
  }))
  expect(state.contextSlots.exchange).toEqual(expect.objectContaining({
    slotKey: 'exchange',
    fieldPath: 'contextSlots.exchange',
    status: 'locked',
    value: 'binance',
  }))
  expect(state.contextSlots.marketType).toEqual(expect.objectContaining({
    slotKey: 'marketType',
    fieldPath: 'contextSlots.marketType',
    status: 'locked',
    value: 'perp',
  }))
}

function expectP0Clarification(projection: SemanticStateProjectionService, state: SemanticState): void {
  const clarification = projection.buildClarificationView(state)
  const clarificationText = [clarification.summary, clarification.nextQuestion].filter(Boolean).join(' ')

  expect(clarification.nextQuestion).toEqual(expect.stringMatching(/单笔仓位|position sizing/iu))
  expect(clarification.nextQuestion).not.toMatch(/boll|布林|上轨|下轨|boundary|交易所|exchange|标的|symbol|周期|timeframe|市场类型|market\s*type|perp|perpetual/iu)
  expect(clarificationText).not.toMatch(/contextSlots|position\.sizing|risk\.stop_loss_pct|price\.detect\.indicator_boundary|generic_boundary|open_long|open_short|indicator\.above|indicator\.below/u)
}

function findGatewayExpression(
  gatewayPatch: ReturnType<SemanticFrameNormalizerService['normalize']>,
  sideScope: 'long' | 'short',
): SemanticExpression | undefined {
  const trigger = gatewayPatch.triggers?.find(item =>
    item.key === 'condition.expression'
    && item.phase === 'gate'
    && item.sideScope === sideScope,
  )

  return trigger?.params?.expression
}

function expectConditionExpression(expression: SemanticExpression | undefined, op: 'GT' | 'LT'): void {
  expect(expression).toEqual(expect.objectContaining({
    kind: 'AND',
    children: expect.arrayContaining([
      emaClosePredicate(op, 20),
      emaClosePredicate(op, 60),
      emaClosePredicate(op, 144),
    ]),
  }))

  if (!expression || expression.kind !== 'AND') {
    throw new Error('Expected an AND semantic expression')
  }

  expect(expression.children).toHaveLength(3)
}

function emaClosePredicate(op: 'GT' | 'LT', period: number): object {
  return expect.objectContaining({
    kind: 'predicate',
    op,
    left: { kind: 'series', source: 'bar', field: 'close' },
    right: { kind: 'indicator', name: 'ema', params: { period } },
  })
}

function expectCanonicalP0Market(canonicalSpec: ReturnType<CanonicalSpecBuilderService['build']>): void {
  expect(canonicalSpec.market).toEqual(expect.objectContaining({
    exchange: 'binance',
    symbol: 'BTCUSDT',
    marketType: 'perp',
    defaultTimeframe: '15m',
  }))
}

function expectCanonicalP0Rules(rules: CanonicalRuleV2[]): void {
  const longEntryRule = findCanonicalEntryRule(rules, 'long', 'OPEN_LONG')
  const shortEntryRule = findCanonicalEntryRule(rules, 'short', 'OPEN_SHORT')

  expect(longEntryRule).toBeDefined()
  expect(shortEntryRule).toBeDefined()
  expect(rules).toEqual(expect.arrayContaining([
    expect.objectContaining({
      phase: 'risk',
      sideScope: 'both',
      condition: expect.objectContaining({
        kind: 'atom',
        key: 'position_loss_pct',
        op: 'GTE',
        value: 0.05,
      }),
      actions: expect.arrayContaining([
        expect.objectContaining({ type: 'FORCE_EXIT' }),
      ]),
    }),
  ]))

  if (!longEntryRule || !shortEntryRule) {
    throw new Error('Expected canonical long and short entry rules')
  }

  expect(conditionContainsAtom(longEntryRule.condition, 'bollinger.lower_break')).toBe(true)
  expect(conditionContainsAtom(shortEntryRule.condition, 'bollinger.upper_break')).toBe(true)
  expectCanonicalEmaGate(longEntryRule.condition, 'GT')
  expectCanonicalEmaGate(shortEntryRule.condition, 'LT')
  expectCanonicalEmaGate(longEntryRule.condition, 'LT', false)
  expectCanonicalEmaGate(shortEntryRule.condition, 'GT', false)
}

function findCanonicalEntryRule(
  rules: CanonicalRuleV2[],
  sideScope: 'long' | 'short',
  actionType: 'OPEN_LONG' | 'OPEN_SHORT',
): CanonicalRuleV2 | undefined {
  return rules.find(rule =>
    rule.phase === 'entry'
    && rule.sideScope === sideScope
    && rule.actions.some(action => action.type === actionType),
  )
}

function conditionContainsAtom(condition: CanonicalConditionNode, key: string): boolean {
  if (condition.kind === 'atom') {
    return condition.key === key
  }
  if (condition.kind === 'expression') {
    return false
  }

  return condition.children.some(child => conditionContainsAtom(child, key))
}

function expectCanonicalEmaGate(condition: CanonicalConditionNode, op: 'GT' | 'LT', expected = true): void {
  const expressions = collectCanonicalExpressions(condition)
  const matcher = expect.arrayContaining([
    canonicalEmaCloseExpression(op, 20),
    canonicalEmaCloseExpression(op, 60),
    canonicalEmaCloseExpression(op, 144),
  ])

  if (expected) {
    expect(expressions).toEqual(matcher)
    return
  }

  expect(expressions).not.toEqual(matcher)
}

function collectCanonicalExpressions(
  condition: CanonicalConditionNode,
): Extract<CanonicalConditionNode, { kind: 'expression' }>[] {
  if (condition.kind === 'expression') {
    return [condition]
  }
  if (condition.kind === 'atom') {
    return []
  }

  return condition.children.flatMap(child => collectCanonicalExpressions(child))
}

function canonicalEmaCloseExpression(op: 'GT' | 'LT', period: number): object {
  return expect.objectContaining({
    kind: 'expression',
    op,
    left: { kind: 'series', source: 'bar', field: 'close' },
    right: { kind: 'indicator', name: 'ema', params: { period } },
  })
}

function buildDisplayText(projection: SemanticStateProjectionService, state: SemanticState): string {
  const conversation = projection.buildConversationView(state)
  const graph = projection.buildDisplayLogicGraph(state)
  const graphText = graph.blocks
    .flatMap(block => block.items.map(item => item.text))
    .join(' ')

  return `${conversation.summary} ${graphText}`
}

function collectOpenSlots(state: SemanticState): SemanticSlotState[] {
  return [
    ...state.triggers.flatMap(trigger => trigger.openSlots ?? []),
    ...state.actions.flatMap(action => action.openSlots ?? []),
    ...state.risk.flatMap(risk => risk.openSlots ?? []),
    ...(state.position?.openSlots ?? []),
    ...(state.position?.constraints?.flatMap(constraint => constraint.openSlots ?? []) ?? []),
    ...Object.values(state.contextSlots).flatMap(slot => (slot?.status === 'open' ? [slot] : [])),
  ]
}
