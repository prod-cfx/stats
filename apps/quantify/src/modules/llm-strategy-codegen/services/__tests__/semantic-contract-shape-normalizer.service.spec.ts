import { SemanticContractShapeNormalizerService } from '../semantic-contract-shape-normalizer.service'

describe('SemanticContractShapeNormalizerService', () => {
  const service = new SemanticContractShapeNormalizerService()

  it.each([
    [{ lower: 78800, upper: 81400, gridCount: 10 }, { gridCount: 10 }],
    [{ lower: 78800, upper: 81400, gridCount: 11, absoluteSpacing: 260 }, { gridCount: 11, absoluteSpacing: 260 }],
    [{ lower: 78800, upper: 81400, absoluteSpacing: 260 }, { absoluteSpacing: 260 }],
    [{ lower: 78800, upper: 81400, spacingPct: 0.33 }, { spacingPct: 0.33 }],
  ])('normalizes fixed-range level-set shape %j', (input, expectedDensity) => {
    const result = service.normalizeLevelSetShape(input)

    expect(result).toEqual({
      status: 'valid',
      shape: {
        mode: 'fixed_range',
        lower: 78800,
        upper: 81400,
        spacingMode: 'arithmetic',
        ...expectedDensity,
      },
      openSlots: [],
    })
  })

  it('opens a density slot when required density is missing', () => {
    const fieldPath = 'triggers[t1].contracts[c1].capabilities[0].shape'

    const result = service.normalizeLevelSetShape(
      { lower: 78800, upper: 81400 },
      { requireDensity: true, fieldPath },
    )

    expect(result.status).toBe('open')
    expect(result.openSlots).toEqual([{
      slotKey: 'contract.shape.price.level_set.density',
      fieldPath,
      status: 'open',
      priority: 'core',
      affectsExecution: true,
      questionHint: expect.any(String),
    }])
  })

  it('reports a spacing conflict when grid count and absolute spacing disagree', () => {
    const result = service.normalizeLevelSetShape({
      lower: 78800,
      upper: 81400,
      gridCount: 10,
      absoluteSpacing: 260,
    })

    expect(result.status).toBe('conflict')
    expect(result.openSlots).toEqual([
      expect.objectContaining({
        slotKey: 'contract.shape.price.level_set.spacing_conflict',
        status: 'open',
        priority: 'core',
        affectsExecution: true,
      }),
    ])
  })
})
