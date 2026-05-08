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
    expect(displayText).toEqual(expect.stringContaining('EMA20'))
    expect(displayText).toEqual(expect.stringContaining('EMA60'))
    expect(displayText).toEqual(expect.stringContaining('EMA144'))
    expect(displayText).toEqual(expect.stringContaining('BOLL'))
    expect(displayText).not.toMatch(/generic_boundary|indicator\.above|indicator\.below|price\.detect\.indicator_boundary/u)

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
  })
})

function expectGatewayPatch(gatewayPatch: ReturnType<SemanticFrameNormalizerService['normalize']>): void {
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
