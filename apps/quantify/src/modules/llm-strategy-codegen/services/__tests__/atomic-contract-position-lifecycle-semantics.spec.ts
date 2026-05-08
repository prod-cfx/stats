import { SemanticAtomRegistryService } from '../semantic-atom-registry.service'
import { SemanticContractReadinessService } from '../semantic-contract-readiness.service'
import { SemanticSeedExtractorService } from '../semantic-seed-extractor.service'
import { SemanticSeedStateBuilderService } from '../semantic-seed-state-builder.service'
import { SemanticSupportClassifierService } from '../semantic-support-classifier.service'

describe('atomic contract position lifecycle semantics', () => {
  const extractor = new SemanticSeedExtractorService()
  const builder = new SemanticSeedStateBuilderService()
  const classifier = new SemanticSupportClassifierService(new SemanticAtomRegistryService())
  const readiness = new SemanticContractReadinessService()

  function classify(message: string) {
    const patch = extractor.extract(message)
    const state = builder.build(patch)
    if (!state) throw new Error('state_not_built')
    const classified = classifier.classify(state)
    const normalized = readiness.normalize(classified.state)
    return { patch, classified, normalized }
  }

  it('extracts reduce_position as an exposure-reducing action', () => {
    const result = classify('盈利 5% 后减仓 30%。')
    const reducePositionAction = result.normalized.state.actions.find(
      action => action.key === 'action.reduce_position',
    )

    expect(result.classified.route).toBe('projection_gate')
    expect(result.classified.state.actions).toEqual(expect.arrayContaining([
      expect.objectContaining({
        key: 'action.reduce_position',
        params: expect.objectContaining({
          reduceBasis: 'ratio',
          reduceValue: 0.3,
          sideScope: 'long',
        }),
      }),
    ]))
    expect(reducePositionAction?.contracts?.[0]).toEqual(expect.objectContaining({
      effects: expect.arrayContaining([
        expect.objectContaining({ domain: 'exposure', verb: 'reduce', object: 'position' }),
      ]),
      orderRequirements: expect.arrayContaining([
        expect.objectContaining({ domain: 'order', verb: 'enforce', object: 'no_exposure_increase' }),
      ]),
    }))
  })

  it('requires an exposure guard for add_position', () => {
    const result = classify('BTC 回踩 MA20 不破后加仓，每次加仓 20%。')

    expect(result.classified.route).toBe('open_slots')
    expect(result.classified.state.actions).toEqual(expect.arrayContaining([
      expect.objectContaining({
        key: 'action.add_position',
        openSlots: expect.arrayContaining([
          expect.objectContaining({ slotKey: 'action.add_position.constraint', affectsExecution: true }),
        ]),
      }),
    ]))
    expect(result.normalized.ready).toBe(false)
  })

  it('extracts add_position with pyramiding limit', () => {
    const result = classify('BTC 回踩 MA20 不破后加仓，每次加仓 20%，最多加仓 3 次。')
    const position = result.classified.state.position as typeof result.classified.state.position & {
      constraints?: unknown[]
    }

    expect(result.classified.route).toBe('projection_gate')
    expect(result.classified.state.actions).toEqual(expect.arrayContaining([
      expect.objectContaining({ key: 'action.add_position' }),
    ]))
    expect(position?.constraints).toEqual(expect.arrayContaining([
      expect.objectContaining({
        key: 'position.pyramiding_limit',
        params: expect.objectContaining({ maxLayers: 3 }),
      }),
    ]))
  })

  it('extracts reverse_position with same-bar and sizing source', () => {
    const result = classify('跌破 MA50 平多并反手做空，反手仓位沿用原仓位，允许同一根 K 线内反手。')

    expect(result.classified.route).toBe('projection_gate')
    expect(result.classified.state.actions).toEqual(expect.arrayContaining([
      expect.objectContaining({
        key: 'action.reverse_position',
        params: expect.objectContaining({
          fromSide: 'long',
          toSide: 'short',
          sameBarPolicy: 'allow',
          sizingSource: 'current_position',
        }),
      }),
    ]))
  })

  it('requires DCA exit rule before deployment', () => {
    const result = classify('每跌 5% 补仓一次，每次 100 USDT，最多 4 次，总投入不超过 500 USDT。')
    const position = result.classified.state.position as typeof result.classified.state.position & {
      constraints?: unknown[]
    }

    expect(result.classified.route).toBe('open_slots')
    expect(position?.constraints).toEqual(expect.arrayContaining([
      expect.objectContaining({
        key: 'position.dca_schedule',
        openSlots: expect.arrayContaining([
          expect.objectContaining({ slotKey: 'position.dca_schedule.exit_rule', affectsExecution: true }),
        ]),
      }),
    ]))
  })
})
