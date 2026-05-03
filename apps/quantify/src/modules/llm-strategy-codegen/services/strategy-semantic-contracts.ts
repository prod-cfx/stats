import type {
  SemanticActionState,
  SemanticPositionSizingContract,
  SemanticPositionState,
  SemanticRiskState,
} from '../types/semantic-state'

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

export type SemanticContractValidationResult = { ok: true } | { ok: false, reason: string }

export type SemanticActionContractInput = Pick<SemanticActionState, 'key'> & Partial<Omit<SemanticActionState, 'key'>>
export type SemanticPositionContractInput = Pick<SemanticPositionState, 'mode' | 'value' | 'positionMode'> & Partial<Omit<SemanticPositionState, 'mode' | 'value' | 'positionMode'>>
export type SemanticRiskContractInput = Pick<SemanticRiskState, 'key' | 'params'> & Partial<Omit<SemanticRiskState, 'key' | 'params'>>

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
  'risk.condition_expression': {
    semanticKey: 'risk.condition_expression',
    family: 'risk',
    requiredParams: ['condition', 'effect', 'scope', 'capabilityStatus'],
    editableSlots: [],
  },
}

const SUPPORTED_EXPRESSION_OPERATORS = new Set<string>(['GT', 'GTE', 'LT', 'LTE', 'EQ', 'CROSS_OVER', 'CROSS_UNDER'])
const SUPPORTED_SERIES_FIELDS = new Set<string>(['open', 'high', 'low', 'close'])
const SUPPORTED_INDICATOR_NAMES = new Set<string>(['sma', 'ema', 'rsi', 'macd'])
const SUPPORTED_POSITION_FIELDS = new Set<string>(['avg_price', 'pnl_pct', 'bars_held', 'has_position'])
const SUPPORTED_ACCOUNT_FIELDS = new Set<string>(['drawdown_pct'])
const SUPPORTED_ACTION_KEYS = new Set<string>(['open_long', 'close_long', 'open_short', 'close_short'])
const SUPPORTED_QUOTE_ASSETS = ['USDT', 'USDC', 'USD'] as const
const SUPPORTED_QUOTE_ASSET_SET = new Set<string>(SUPPORTED_QUOTE_ASSETS)
const SUPPORTED_POSITION_SIDE_MODES = new Set<string>(['long_only', 'short_only', 'long_short'])
const SUPPORTED_RISK_KEYS = new Set<string>([
  'risk.stop_loss_pct',
  'risk.take_profit_pct',
  'risk.condition_expression',
])
const SUPPORTED_RISK_EFFECT_TYPES = new Set<string>(['close_position', 'reduce_position', 'notify_only', 'pause_strategy'])
const SUPPORTED_RISK_SCOPES = new Set<string>(['current_position', 'long', 'short', 'both', 'strategy', 'account'])
const SUPPORTED_RISK_BASES = new Set<string>([
  'prev_close',
  'entry_avg_price',
  'position_pnl',
  'peak_equity',
  'peak_position_pnl',
  'upper_band',
  'lower_band',
  'middle_band',
  'last_high',
  'last_low',
])
const SUPPORTED_RISK_BASIS_SOURCES = new Set<string>(['user_explicit', 'system_default', 'derived'])
const POSITION_SIZING_VALUE_EPSILON = 1e-9

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

export function validateSemanticExpressionContract(expression: unknown): SemanticContractValidationResult {
  return validateExpressionNode(expression)
}

export function validateSemanticActionContract(action: SemanticActionContractInput): SemanticContractValidationResult
export function validateSemanticActionContract(action: unknown): SemanticContractValidationResult
export function validateSemanticActionContract(action: unknown): SemanticContractValidationResult {
  if (!isRecord(action)) {
    return invalid('invalid_action_contract')
  }
  if (typeof action.key !== 'string' || !SUPPORTED_ACTION_KEYS.has(action.key)) {
    return invalid('unsupported_action_key')
  }

  return valid()
}

export function validateSemanticPositionContract(position: SemanticPositionContractInput): SemanticContractValidationResult
export function validateSemanticPositionContract(position: unknown): SemanticContractValidationResult
export function validateSemanticPositionContract(position: unknown): SemanticContractValidationResult {
  if (!isRecord(position)) {
    return invalid('invalid_position_contract')
  }

  const legacySizing = normalizeLegacyModeValuePositionSizing(position)
  const legacySizingResult = validatePositionSizingContract(legacySizing)
  if (!legacySizingResult.ok) return legacySizingResult

  if (position.sizing !== undefined && position.sizing !== null) {
    const explicitSizing = isSemanticPositionSizingContract(position.sizing) ? position.sizing : null
    if (!explicitSizing) return validatePositionSizingContract(position.sizing)
    if (!isEquivalentPositionSizing(explicitSizing, legacySizing)) {
      return invalid('position_sizing_legacy_mismatch')
    }
  }

  if (typeof position.positionMode !== 'string' || !SUPPORTED_POSITION_SIDE_MODES.has(position.positionMode)) {
    return invalid('unsupported_position_side_mode')
  }

  return valid()
}

export function normalizeLegacyPositionSizing(position: unknown): SemanticPositionSizingContract | null {
  if (!isRecord(position)) return null
  if (isRecord(position.sizing)) {
    return isSemanticPositionSizingContract(position.sizing) ? position.sizing : null
  }
  return normalizeLegacyModeValuePositionSizing(position)
}

function normalizeLegacyModeValuePositionSizing(position: unknown): SemanticPositionSizingContract | null {
  if (!isRecord(position)) return null
  if (typeof position.mode !== 'string' || typeof position.value !== 'number' || !Number.isFinite(position.value)) return null

  if (position.mode === 'fixed_ratio') {
    return { kind: 'ratio', value: position.value, unit: 'ratio' }
  }
  if (position.mode === 'fixed_quote') {
    return { kind: 'quote', value: position.value, asset: 'USDT' }
  }
  if (position.mode === 'fixed_qty') {
    return {
      kind: 'base',
      value: position.value,
      asset: readExplicitPositionSizingAsset(position.sizing, 'base') ?? 'BASE',
    }
  }
  return null
}

function readExplicitPositionSizingAsset(sizing: unknown, kind: 'quote' | 'base'): string | null {
  if (!isRecord(sizing) || sizing.kind !== kind || typeof sizing.asset !== 'string') {
    return null
  }

  return sizing.asset
}

function validatePositionSizingContract(sizing: unknown): SemanticContractValidationResult {
  if (!isRecord(sizing) || typeof sizing.kind !== 'string') return invalid('invalid_position_sizing_contract')
  if (typeof sizing.value !== 'number' || !Number.isFinite(sizing.value) || sizing.value <= 0) return invalid('invalid_position_value')

  if (sizing.kind === 'ratio') {
    return sizing.unit === 'ratio' || sizing.unit === 'percent' ? valid() : invalid('invalid_position_ratio_unit')
  }
  if (sizing.kind === 'quote') {
    return typeof sizing.asset === 'string' && SUPPORTED_QUOTE_ASSET_SET.has(sizing.asset)
      ? valid()
      : invalid('invalid_position_quote_asset')
  }
  if (sizing.kind === 'base') {
    return typeof sizing.asset === 'string' && /^[A-Z][A-Z0-9]{1,15}$/u.test(sizing.asset)
      ? valid()
      : invalid('invalid_position_base_asset')
  }
  return invalid('unsupported_position_sizing_kind')
}

function isSemanticPositionSizingContract(sizing: unknown): sizing is SemanticPositionSizingContract {
  return validatePositionSizingContract(sizing).ok
}

function isEquivalentPositionSizing(
  sizing: SemanticPositionSizingContract,
  legacySizing: SemanticPositionSizingContract,
): boolean {
  if (sizing.kind !== legacySizing.kind) return false
  if (!isEquivalentPositionSizingValue(sizing.value, legacySizing.value)) return false

  if (sizing.kind === 'ratio') {
    return legacySizing.kind === 'ratio' && sizing.unit === legacySizing.unit
  }
  if (sizing.kind === 'quote') {
    return legacySizing.kind === 'quote'
  }
  if (sizing.kind === 'base') {
    return legacySizing.kind === 'base'
  }

  return false
}

function isEquivalentPositionSizingValue(left: number, right: number): boolean {
  return Math.abs(left - right) <= POSITION_SIZING_VALUE_EPSILON
}

export function validateSemanticRiskContract(risk: SemanticRiskContractInput): SemanticContractValidationResult
export function validateSemanticRiskContract(risk: unknown): SemanticContractValidationResult
export function validateSemanticRiskContract(risk: unknown): SemanticContractValidationResult {
  if (!isRecord(risk)) {
    return invalid('invalid_risk_contract')
  }
  if (typeof risk.key !== 'string' || !SUPPORTED_RISK_KEYS.has(risk.key)) {
    return invalid('unsupported_risk_key')
  }
  if (!isRecord(risk.params)) {
    return invalid('invalid_risk_params')
  }
  if (risk.key === 'risk.condition_expression') {
    const expressionResult = validateSemanticExpressionContract(risk.params.condition)
    if (!expressionResult.ok) {
      return invalid('invalid_risk_condition_expression')
    }
    if (
      !isRecord(risk.params.effect)
      || typeof risk.params.effect.type !== 'string'
      || !SUPPORTED_RISK_EFFECT_TYPES.has(risk.params.effect.type)
    ) {
      return invalid('invalid_risk_effect')
    }
    if (
      risk.params.effect.type === 'reduce_position'
      && risk.params.effect.reducePct !== undefined
      && (
        typeof risk.params.effect.reducePct !== 'number'
        || !Number.isFinite(risk.params.effect.reducePct)
        || risk.params.effect.reducePct <= 0
        || risk.params.effect.reducePct > 100
      )
    ) {
      return invalid('invalid_risk_reduce_pct')
    }
    if (typeof risk.params.scope !== 'string' || !SUPPORTED_RISK_SCOPES.has(risk.params.scope)) {
      return invalid('invalid_risk_scope')
    }
    if (
      risk.params.capabilityStatus !== 'supported'
      && risk.params.capabilityStatus !== 'recognized_unsupported'
    ) {
      return invalid('invalid_risk_capability_status')
    }
    if (risk.params.capabilityStatus === 'supported' && expressionContainsRuntimeUnsupportedOperand(risk.params.condition)) {
      return invalid('unsupported_runtime_risk_expression_operand')
    }
    return valid()
  }
  if (
    typeof risk.params.valuePct !== 'number'
    || !Number.isFinite(risk.params.valuePct)
    || risk.params.valuePct <= 0
  ) {
    return invalid('invalid_risk_value_pct')
  }
  if (
    risk.params.basis !== undefined
    && (typeof risk.params.basis !== 'string' || !SUPPORTED_RISK_BASES.has(risk.params.basis))
  ) {
    return invalid('invalid_risk_basis')
  }
  if (
    risk.params.basisSource !== undefined
    && (
      typeof risk.params.basisSource !== 'string'
      || !SUPPORTED_RISK_BASIS_SOURCES.has(risk.params.basisSource)
    )
  ) {
    return invalid('invalid_risk_basis_source')
  }

  return valid()
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

function validateExpressionNode(expression: unknown): SemanticContractValidationResult {
  if (!isRecord(expression)) {
    return invalid('invalid_expression')
  }

  if (expression.kind === 'predicate') {
    if (typeof expression.op !== 'string' || !SUPPORTED_EXPRESSION_OPERATORS.has(expression.op)) {
      return invalid('unsupported_expression_operator')
    }

    const leftResult = validateExpressionOperand(expression.left)
    if (!leftResult.ok) return leftResult

    return validateExpressionOperand(expression.right)
  }

  if (expression.kind === 'AND' || expression.kind === 'OR' || expression.kind === 'NOT') {
    const children = expression.children
    if (!Array.isArray(children) || children.length === 0 || (expression.kind === 'NOT' && children.length !== 1)) {
      return invalid('invalid_logical_children')
    }

    for (const child of children) {
      const result = validateExpressionNode(child)
      if (!result.ok) return result
    }

    return valid()
  }

  return invalid('unsupported_expression_kind')
}

function validateExpressionOperand(operand: unknown): SemanticContractValidationResult {
  if (!isRecord(operand)) {
    return invalid('invalid_expression_operand')
  }

  if (operand.kind === 'series') {
    if (operand.source !== 'bar') {
      return invalid('unsupported_series_source')
    }
    if (typeof operand.field !== 'string' || !SUPPORTED_SERIES_FIELDS.has(operand.field)) {
      return invalid('unsupported_series_field')
    }
    const offsetBars = operand.offsetBars
    if (
      offsetBars !== undefined
      && (typeof offsetBars !== 'number' || !Number.isInteger(offsetBars) || offsetBars < 0)
    ) {
      return invalid('invalid_series_offset')
    }

    return valid()
  }

  if (operand.kind === 'indicator') {
    if (typeof operand.name !== 'string' || !SUPPORTED_INDICATOR_NAMES.has(operand.name)) {
      return invalid('unsupported_indicator_name')
    }
    if (!isRecord(operand.params)) {
      return invalid('invalid_indicator_params')
    }

    return valid()
  }

  if (operand.kind === 'position') {
    if (typeof operand.field !== 'string' || !SUPPORTED_POSITION_FIELDS.has(operand.field)) {
      return invalid('unsupported_position_field')
    }

    return valid()
  }

  if (operand.kind === 'account') {
    if (typeof operand.field !== 'string' || !SUPPORTED_ACCOUNT_FIELDS.has(operand.field)) {
      return invalid('unsupported_account_field')
    }

    return valid()
  }

  if (operand.kind === 'constant') {
    if (
      typeof operand.value !== 'string'
      && typeof operand.value !== 'boolean'
      && !(typeof operand.value === 'number' && Number.isFinite(operand.value))
    ) {
      return invalid('invalid_constant_value')
    }

    return valid()
  }

  return invalid('unsupported_expression_operand_kind')
}

function expressionContainsRuntimeUnsupportedOperand(expression: unknown): boolean {
  if (!isRecord(expression)) {
    return false
  }

  if (expression.kind === 'predicate') {
    return operandIsRuntimeUnsupported(expression.left) || operandIsRuntimeUnsupported(expression.right)
  }

  if (
    (expression.kind === 'AND' || expression.kind === 'OR' || expression.kind === 'NOT')
    && Array.isArray(expression.children)
  ) {
    return expression.children.some(child => expressionContainsRuntimeUnsupportedOperand(child))
  }

  return false
}

function operandIsRuntimeUnsupported(operand: unknown): boolean {
  if (!isRecord(operand)) {
    return false
  }

  return operand.kind === 'account'
    || (operand.kind === 'position' && operand.field === 'has_position')
    || (operand.kind === 'constant' && typeof operand.value === 'boolean')
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function valid(): SemanticContractValidationResult {
  return { ok: true }
}

function invalid(reason: string): SemanticContractValidationResult {
  return { ok: false, reason }
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
