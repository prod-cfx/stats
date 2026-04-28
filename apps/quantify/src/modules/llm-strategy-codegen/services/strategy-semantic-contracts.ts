export interface SemanticContract {
  semanticKey: string
  family: 'trigger' | 'grid' | 'risk'
  requiredParams: string[]
  optionalParams?: string[]
  defaultableParams?: string[]
  editableSlots?: SemanticEditableSlotContract[]
}

export type SemanticEditableUnit = 'bars' | 'percent' | 'plain'

export interface SemanticEditableSlotContract {
  slotKey: string
  valueShape: 'scalar' | 'range'
  unit?: SemanticEditableUnit
  paramPaths?: string[]
  rangeParamPairs?: Array<readonly [string, string]>
}

const SEMANTIC_CONTRACTS: Record<string, SemanticContract> = {
  'execution.on_start': {
    semanticKey: 'execution.on_start',
    family: 'trigger',
    requiredParams: ['timing', 'orderType', 'occurrence'],
  },
  'indicator.above': {
    semanticKey: 'indicator.above',
    family: 'trigger',
    requiredParams: ['indicator', 'referenceRole', 'reference.period', 'confirmationMode'],
    editableSlots: [
      { slotKey: 'reference.period', valueShape: 'scalar', unit: 'bars', paramPaths: ['reference.period', 'period'] },
    ],
  },
  'indicator.below': {
    semanticKey: 'indicator.below',
    family: 'trigger',
    requiredParams: ['indicator', 'referenceRole', 'reference.period', 'confirmationMode'],
    editableSlots: [
      { slotKey: 'reference.period', valueShape: 'scalar', unit: 'bars', paramPaths: ['reference.period', 'period'] },
    ],
  },
  grid_touch: {
    semanticKey: 'grid_touch',
    family: 'grid',
    requiredParams: ['range.lower', 'range.upper', 'stepPct', 'sideMode'],
    defaultableParams: ['recycle'],
    editableSlots: [
      {
        slotKey: 'grid.range',
        valueShape: 'range',
        rangeParamPairs: [['range.lower', 'range.upper']],
      },
      { slotKey: 'grid.stepPct', valueShape: 'scalar', unit: 'percent', paramPaths: ['stepPct'] },
    ],
  },
  'grid.range_rebalance': {
    semanticKey: 'grid.range_rebalance',
    family: 'grid',
    requiredParams: ['rangeMin', 'rangeMax', 'stepPct'],
    optionalParams: ['levelCount', 'sideMode', 'recycle'],
    editableSlots: [
      {
        slotKey: 'grid.range',
        valueShape: 'range',
        rangeParamPairs: [
          ['rangeMin', 'rangeMax'],
          ['rangeLower', 'rangeUpper'],
          ['range.lower', 'range.upper'],
        ],
      },
      { slotKey: 'grid.stepPct', valueShape: 'scalar', unit: 'percent', paramPaths: ['stepPct'] },
    ],
  },
  'grid.fixed_range': {
    semanticKey: 'grid.fixed_range',
    family: 'grid',
    requiredParams: ['lowerPrice', 'upperPrice', 'stepPct'],
    optionalParams: ['direction', 'sideMode'],
    editableSlots: [
      {
        slotKey: 'grid.range',
        valueShape: 'range',
        rangeParamPairs: [
          ['lowerPrice', 'upperPrice'],
          ['rangeLower', 'rangeUpper'],
          ['range.lower', 'range.upper'],
        ],
      },
      { slotKey: 'grid.stepPct', valueShape: 'scalar', unit: 'percent', paramPaths: ['stepPct'] },
    ],
  },
  'price.range_position_lte': {
    semanticKey: 'price.range_position_lte',
    family: 'trigger',
    requiredParams: ['lookbackBars', 'positionPct'],
    editableSlots: [
      { slotKey: 'range.lookback', valueShape: 'scalar', unit: 'bars', paramPaths: ['lookbackBars', 'period', 'window', 'length'] },
      { slotKey: 'range.positionPct', valueShape: 'scalar', unit: 'percent', paramPaths: ['positionPct'] },
    ],
  },
  'price.range_position_gte': {
    semanticKey: 'price.range_position_gte',
    family: 'trigger',
    requiredParams: ['lookbackBars', 'positionPct'],
    editableSlots: [
      { slotKey: 'range.lookback', valueShape: 'scalar', unit: 'bars', paramPaths: ['lookbackBars', 'period', 'window', 'length'] },
      { slotKey: 'range.positionPct', valueShape: 'scalar', unit: 'percent', paramPaths: ['positionPct'] },
    ],
  },
  'risk.stop_loss_pct': {
    semanticKey: 'risk.stop_loss_pct',
    family: 'risk',
    requiredParams: ['valuePct'],
    optionalParams: ['basis'],
    editableSlots: [
      { slotKey: 'risk.stop_loss', valueShape: 'scalar', unit: 'percent', paramPaths: ['valuePct', 'stopLossPct', 'pct'] },
    ],
  },
  'risk.take_profit_pct': {
    semanticKey: 'risk.take_profit_pct',
    family: 'risk',
    requiredParams: ['valuePct'],
    optionalParams: ['basis'],
    editableSlots: [
      { slotKey: 'risk.take_profit', valueShape: 'scalar', unit: 'percent', paramPaths: ['valuePct', 'takeProfitPct', 'pct'] },
    ],
  },
}

const FALLBACK_EDITABLE_SLOTS: SemanticEditableSlotContract[] = [
  {
    slotKey: 'semantic.range',
    valueShape: 'range',
    rangeParamPairs: [
      ['rangeLower', 'rangeUpper'],
      ['rangeMin', 'rangeMax'],
      ['lowerPrice', 'upperPrice'],
      ['lower', 'upper'],
      ['min', 'max'],
      ['range.lower', 'range.upper'],
    ],
  },
  {
    slotKey: 'semantic.bars',
    valueShape: 'scalar',
    unit: 'bars',
    paramPaths: ['lookbackBars', 'bars', 'fastPeriod', 'slowPeriod', 'period', 'window', 'length', 'reference.period'],
  },
  {
    slotKey: 'semantic.percent',
    valueShape: 'scalar',
    unit: 'percent',
    paramPaths: ['valuePct', 'stopLossPct', 'takeProfitPct', 'positionPct', 'pct', 'percent', 'ratio'],
  },
  {
    slotKey: 'semantic.scalar',
    valueShape: 'scalar',
    unit: 'plain',
    paramPaths: ['value', 'threshold', 'fastPeriod', 'slowPeriod', 'period'],
  },
]

export function resolveSemanticContract(semanticKey: string): SemanticContract {
  const contract = SEMANTIC_CONTRACTS[semanticKey]
  if (!contract) {
    throw new Error(`Unknown semantic contract: ${semanticKey}`)
  }

  return contract
}

export function resolveEditableScalarParamPaths(
  semanticKey: string,
  unit: SemanticEditableUnit | undefined,
): string[] {
  const slots = resolveEditableSlots(semanticKey)
  return uniqueStrings(slots
    .filter(slot => slot.valueShape === 'scalar' && isEditableUnitMatch(slot.unit, unit))
    .flatMap(slot => slot.paramPaths ?? []))
}

export function resolveEditableRangeParamPairs(semanticKey: string): Array<readonly [string, string]> {
  const slots = resolveEditableSlots(semanticKey)
  return uniquePairs(slots
    .filter(slot => slot.valueShape === 'range')
    .flatMap(slot => slot.rangeParamPairs ?? []))
}

function resolveEditableSlots(semanticKey: string): SemanticEditableSlotContract[] {
  const contract = SEMANTIC_CONTRACTS[semanticKey]
  return [
    ...(contract?.editableSlots ?? []),
    ...FALLBACK_EDITABLE_SLOTS,
  ]
}

function isEditableUnitMatch(slotUnit: SemanticEditableUnit | undefined, requestedUnit: SemanticEditableUnit | undefined): boolean {
  if (!requestedUnit || requestedUnit === 'plain') return !slotUnit || slotUnit === 'plain'
  return slotUnit === requestedUnit
}

function uniqueStrings(values: string[]): string[] {
  return [...new Set(values)]
}

function uniquePairs(values: Array<readonly [string, string]>): Array<readonly [string, string]> {
  const seen = new Set<string>()
  return values.filter((pair) => {
    const key = `${pair[0]}:${pair[1]}`
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}
