import { Injectable } from '@nestjs/common'
import type { SemanticCapabilityShape, SemanticSlotState } from '../types/semantic-state'

export type NormalizedContractShapeStatus = 'valid' | 'open' | 'conflict' | 'invalid'

export interface ContractShapeNormalizationOptions {
  requireDensity?: boolean
  fieldPath?: string
}

export interface ContractShapeNormalizationResult {
  status: NormalizedContractShapeStatus
  shape: SemanticCapabilityShape
  openSlots: SemanticSlotState[]
}

const DENSITY_SLOT_KEY = 'contract.shape.price.level_set.density'
const SPACING_CONFLICT_SLOT_KEY = 'contract.shape.price.level_set.spacing_conflict'
const SPACING_CONFLICT_TOLERANCE = 1e-8

@Injectable()
export class SemanticContractShapeNormalizerService {
  normalizeLevelSetShape(
    input: SemanticCapabilityShape,
    options: ContractShapeNormalizationOptions = {},
  ): ContractShapeNormalizationResult {
    const mode = readShapeString(input, 'mode')

    if (mode === 'centered_percent_range') {
      return this.normalizeCenteredPercentRangeShape(input, options)
    }

    return this.normalizeFixedRangeShape(input, options)
  }

  isValidPerOrderBudgetShape(shape: SemanticCapabilityShape): boolean {
    const value = readShapeNumber(shape, 'value')
    const asset = readShapeString(shape, 'asset')

    return value !== null && value > 0 && asset !== null
  }

  isValidBoundaryCancelShape(shape: SemanticCapabilityShape): boolean {
    const onBreach = readShapeString(shape, 'onBreach')
    const cancelOrders = readShapeBoolean(shape, 'cancelOrders')
    const cancelScope = readShapeString(shape, 'cancelScope')

    return onBreach !== null && (cancelOrders === false || cancelScope !== null)
  }

  private normalizeFixedRangeShape(
    input: SemanticCapabilityShape,
    options: ContractShapeNormalizationOptions,
  ): ContractShapeNormalizationResult {
    const lower = readShapeNumber(input, 'lower')
    const upper = readShapeNumber(input, 'upper')
    if (lower === null || upper === null || upper <= lower) {
      return { status: 'invalid', shape: {}, openSlots: [] }
    }

    const shape = withFiniteDensityFields(input, {
      mode: 'fixed_range',
      lower,
      upper,
      spacingMode: readShapeString(input, 'spacingMode') === 'geometric' ? 'geometric' : 'arithmetic',
    })

    if (hasSpacingConflict(shape, lower, upper)) {
      return {
        status: 'conflict',
        shape,
        openSlots: [this.toOpenSlot(SPACING_CONFLICT_SLOT_KEY, options.fieldPath)],
      }
    }

    if (options.requireDensity === true && !hasPositiveDensity(shape)) {
      return {
        status: 'open',
        shape,
        openSlots: [this.toOpenSlot(DENSITY_SLOT_KEY, options.fieldPath)],
      }
    }

    return { status: 'valid', shape, openSlots: [] }
  }

  private normalizeCenteredPercentRangeShape(
    input: SemanticCapabilityShape,
    options: ContractShapeNormalizationOptions,
  ): ContractShapeNormalizationResult {
    const centerSource = readShapeString(input, 'centerSource')
    const halfRangePct = readShapeNumber(input, 'halfRangePct')
    if (centerSource === null || halfRangePct === null || halfRangePct <= 0) {
      return { status: 'invalid', shape: {}, openSlots: [] }
    }

    const shape = withFiniteDensityFields(input, {
      mode: 'centered_percent_range',
      centerSource,
      halfRangePct,
      spacingMode: readShapeString(input, 'spacingMode') === 'geometric' ? 'geometric' : 'arithmetic',
    })

    const centerTiming = readShapeString(input, 'centerTiming')
    if (centerTiming !== null) {
      shape.centerTiming = centerTiming
    }

    if (options.requireDensity === true && !hasPositiveGridCount(shape)) {
      return {
        status: 'open',
        shape,
        openSlots: [this.toOpenSlot(DENSITY_SLOT_KEY, options.fieldPath)],
      }
    }

    return { status: 'valid', shape, openSlots: [] }
  }

  private toOpenSlot(slotKey: string, fieldPath = 'shape'): SemanticSlotState {
    return {
      slotKey,
      fieldPath,
      status: 'open',
      priority: 'core',
      affectsExecution: true,
      questionHint: '请补充价格层级集合的密度或修正冲突配置。',
    }
  }
}

function withFiniteDensityFields(
  input: SemanticCapabilityShape,
  shape: SemanticCapabilityShape,
): SemanticCapabilityShape {
  const gridCount = readShapeNumber(input, 'gridCount')
  const absoluteSpacing = readShapeNumber(input, 'absoluteSpacing')
  const spacingPct = readShapeNumber(input, 'spacingPct')

  return {
    ...shape,
    ...(gridCount !== null ? { gridCount } : {}),
    ...(absoluteSpacing !== null ? { absoluteSpacing } : {}),
    ...(spacingPct !== null ? { spacingPct } : {}),
  }
}

function hasSpacingConflict(shape: SemanticCapabilityShape, lower: number, upper: number): boolean {
  const gridCount = readShapeNumber(shape, 'gridCount')
  const absoluteSpacing = readShapeNumber(shape, 'absoluteSpacing')
  if (gridCount === null || absoluteSpacing === null || gridCount <= 0) {
    return false
  }

  return Math.abs((upper - lower) / gridCount - absoluteSpacing) > SPACING_CONFLICT_TOLERANCE
}

function hasPositiveDensity(shape: SemanticCapabilityShape): boolean {
  return hasPositiveGridCount(shape)
    || hasPositiveNumber(shape, 'absoluteSpacing')
    || hasPositiveNumber(shape, 'spacingPct')
}

function hasPositiveGridCount(shape: SemanticCapabilityShape): boolean {
  return hasPositiveNumber(shape, 'gridCount')
}

function hasPositiveNumber(shape: SemanticCapabilityShape, key: string): boolean {
  const value = readShapeNumber(shape, key)

  return value !== null && value > 0
}

function readShapeNumber(shape: SemanticCapabilityShape, key: string): number | null {
  const value = shape[key]

  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

function readShapeString(shape: SemanticCapabilityShape, key: string): string | null {
  const value = shape[key]
  if (typeof value !== 'string') {
    return null
  }

  const trimmed = value.trim()

  return trimmed.length > 0 ? trimmed : null
}

function readShapeBoolean(shape: SemanticCapabilityShape, key: string): boolean | null {
  const value = shape[key]

  return typeof value === 'boolean' ? value : null
}
