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
      questionHint: '请确认网格数量或每格间距，例如 20 格 / 每格 100 USDT / 每格 0.5%。',
    }])
  })

  it('normalizes centered total range percent into half range percent and preserves density', () => {
    const result = service.normalizeLevelSetShape({
      mode: 'centered_percent_range',
      centerSource: 'last_price',
      totalRangePct: 10,
      gridCount: 10,
    })

    expect(result).toEqual({
      status: 'valid',
      shape: {
        mode: 'centered_percent_range',
        centerSource: 'last_price',
        halfRangePct: 5,
        gridCount: 10,
        spacingMode: 'arithmetic',
      },
      openSlots: [],
    })
  })

  it('accepts percent spacing as density for centered percent ranges', () => {
    const result = service.normalizeLevelSetShape({
      mode: 'centered_percent_range',
      centerSource: 'last_price',
      totalRangePct: 10,
      spacingPct: 0.5,
    }, { requireDensity: true })

    expect(result).toEqual({
      status: 'valid',
      shape: {
        mode: 'centered_percent_range',
        centerSource: 'last_price',
        halfRangePct: 5,
        spacingPct: 0.5,
        spacingMode: 'arithmetic',
      },
      openSlots: [],
    })
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
        questionHint: '网格数量和每格间距与当前价格区间不一致，请确认保留网格数量还是每格间距。',
      }),
    ])
  })

  it('reports a spacing conflict when grid count and percent spacing disagree', () => {
    const result = service.normalizeLevelSetShape({
      lower: 100,
      upper: 110,
      gridCount: 20,
      spacingPct: 0.5,
    })

    expect(result.status).toBe('conflict')
    expect(result.openSlots).toEqual([
      expect.objectContaining({
        slotKey: 'contract.shape.price.level_set.spacing_conflict',
        status: 'open',
        priority: 'core',
        affectsExecution: true,
        questionHint: '网格数量和每格间距与当前价格区间不一致，请确认保留网格数量还是每格间距。',
      }),
    ])
  })

  it('accepts rounded percent spacing when it matches the grid count within business tolerance', () => {
    const result = service.normalizeLevelSetShape({
      lower: 100,
      upper: 110,
      gridCount: 20,
      spacingPct: 0.503,
    })

    expect(result).toEqual({
      status: 'valid',
      shape: {
        mode: 'fixed_range',
        lower: 100,
        upper: 110,
        gridCount: 20,
        spacingPct: 0.503,
        spacingMode: 'arithmetic',
      },
      openSlots: [],
    })
  })
})
