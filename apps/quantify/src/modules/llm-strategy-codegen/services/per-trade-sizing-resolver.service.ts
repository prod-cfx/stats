import { Injectable } from '@nestjs/common'

import type { SemanticNodeStatus, SemanticPositionConstraintState, SemanticPositionSizingContract, SemanticState } from '../types/semantic-state'
import { CapabilityEvidenceIndex } from './capability-evidence-index.service'
import type { CapabilityEvidence, CapabilityMountKind } from './capability-evidence-index.service'
import type { RulesMainflowAtomFact } from './rules-mainflow-reader.service'
import { RulesMainflowReaderService } from './rules-mainflow-reader.service'

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export type SizingAxis = 'notional_quote' | 'base_qty' | 'equity_ratio' | 'risk_budget'

export type SizingScope =
  | { kind: 'strategy_default' }
  | { kind: 'action'; id: string }
  | { kind: 'position_constraint'; ownerKey: string }

export function scopeKey(scope: SizingScope): string {
  switch (scope.kind) {
    case 'strategy_default':
      return 'strategy_default'
    case 'action':
      return `action:${scope.id}`
    case 'position_constraint':
      return `position_constraint:${scope.ownerKey}`
  }
}

export type SizingSource =
  | 'position'
  | 'action'
  | 'position_constraint'
  | 'position_constraint_params_fallback'

export interface NormalizedSizing {
  readonly axis: SizingAxis
  readonly value: number
  readonly needsRuntimeResolution: boolean
  readonly asset?: string
}

export interface SizingAnchor {
  readonly scope: SizingScope
  readonly executionAnchored: boolean
  readonly fullySpecified: boolean
  readonly normalized?: NormalizedSizing
  readonly source: SizingSource
  readonly evidenceRef?: {
    readonly mount: CapabilityMountKind
    readonly ownerId: string
    readonly contractId: string
  }
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function isExecutionAnchored(ownerStatus: SemanticNodeStatus, axis: SizingAxis, value: number): boolean {
  if (ownerStatus !== 'locked') return false
  if (!Number.isFinite(value)) return false
  switch (axis) {
    case 'notional_quote':
    case 'base_qty':
    case 'risk_budget':
      return value > 0
    case 'equity_ratio':
      return value > 0 && value <= 1
  }
}

/**
 * Map a raw shape value to a SizingAxis.
 * Returns null when the shape cannot be interpreted.
 * Only recognises explicit `kind` fields — no unit/asset heuristics.
 */
function resolveAxisFromShape(shape: Record<string, unknown>): { axis: SizingAxis; value: number; needsRuntimeResolution?: boolean; asset?: string } | null {
  const kind = shape['kind']
  const rawValue = shape['value']
  const rawAsset = typeof shape['asset'] === 'string' && shape['asset'].trim() ? (shape['asset'] as string) : undefined

  if (typeof rawValue !== 'number' || !Number.isFinite(rawValue)) return null

  if (kind === 'quote') {
    return { axis: 'notional_quote', value: rawValue, asset: rawAsset }
  }
  if (kind === 'base') {
    return { axis: 'base_qty', value: rawValue, asset: rawAsset }
  }
  if (kind === 'ratio') {
    const unit = typeof shape['unit'] === 'string' ? (shape['unit'] as string).toLowerCase() : ''
    // percent → 0..1 normalize
    const normalizedValue = unit === 'percent' || unit === '%' ? rawValue / 100 : rawValue
    return { axis: 'equity_ratio', value: normalizedValue }
  }
  if (kind === 'risk_budget') {
    return { axis: 'risk_budget', value: rawValue, needsRuntimeResolution: true }
  }

  return null
}

function axisNeedsRuntimeResolution(axis: SizingAxis): boolean {
  return axis === 'equity_ratio' || axis === 'risk_budget'
}

/**
 * Map SemanticPositionSizingContract to axis + value.
 * Note: risk_budget axis is only produced via the capability shape path (PR4+ atoms can emit it);
 * SemanticPositionSizingContract union currently covers quote/base/ratio only.
 */
function resolveAxisFromPositionSizing(sizing: SemanticPositionSizingContract): { axis: SizingAxis; value: number } | null {
  switch (sizing.kind) {
    case 'quote':
      return { axis: 'notional_quote', value: sizing.value }
    case 'base':
      return { axis: 'base_qty', value: sizing.value }
    case 'ratio': {
      // ratio unit: 'ratio' means 0-1 scale, 'percent' means 0-100
      const value = sizing.unit === 'percent' ? sizing.value / 100 : sizing.value
      return { axis: 'equity_ratio', value }
    }
  }
}

/**
 * Try to extract a sizing shape from a position constraint's params.
 *
 * Recognised field names (in lookup order):
 *   1. `params.perOrderSizing` — legacy / DCA-style emit
 *   2. `params.sizing` — dispatcher emit (GenericSeedDispatcherService writes
 *      `position.sizing` atoms with `params.sizing`)
 *
 * Both shapes must carry an explicit `kind` field ('quote' | 'base' | 'ratio' | 'risk_budget').
 * Any shape without a recognised explicit kind is ignored (no unit/asset heuristics).
 * Note: risk_budget axis is only produced via the capability shape path (PR4+ atoms can emit it).
 */
function readSizingShapeFromParams(params: unknown): { axis: SizingAxis; value: number } | null {
  if (!params || typeof params !== 'object') return null
  const bag = params as Record<string, unknown>
  // perOrderSizing wins for backward compat; sizing is the dispatcher path.
  // 若 perOrderSizing 畸形（缺 kind / value 非数字）→ 回退尝试 sizing，避免合法 sizing 被静默吞掉。
  return tryReadSizingShape(bag['perOrderSizing']) ?? tryReadSizingShape(bag['sizing'])
}

function tryReadSizingShape(raw: unknown): { axis: SizingAxis; value: number } | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null
  const shape = raw as Record<string, unknown>
  const kind = shape['kind']
  if (kind !== 'quote' && kind !== 'base' && kind !== 'ratio' && kind !== 'risk_budget') return null
  const value = typeof shape['value'] === 'number' ? shape['value'] : Number.NaN
  if (!Number.isFinite(value)) return null
  return resolveAxisFromShape(shape)
}

/** Extract sizing shape from a capability's shape field */
function resolveAxisFromCapabilityShape(cap: CapabilityEvidence): { axis: SizingAxis; value: number; asset?: string } | null {
  const shape = cap.capability.shape
  if (!shape || typeof shape !== 'object') return null

  // The shape may directly carry axis fields (kind/value/unit/asset)
  // or may nest them under a key like `perOrderSizing`
  const direct = resolveAxisFromShape(shape as Record<string, unknown>)
  if (direct) return direct

  const nested = shape['perOrderSizing']
  if (nested && typeof nested === 'object' && !Array.isArray(nested)) {
    return resolveAxisFromShape(nested as Record<string, unknown>)
  }

  return null
}

// ---------------------------------------------------------------------------
// Anchor builders
// ---------------------------------------------------------------------------

function anchorFromPositionSizing(
  sizing: SemanticPositionSizingContract,
  ownerStatus: SemanticNodeStatus,
  fullySpecified: boolean,
): SizingAnchor {
  const resolved = resolveAxisFromPositionSizing(sizing)
  const scope: SizingScope = { kind: 'strategy_default' }

  if (!resolved) {
    return {
      scope,
      executionAnchored: false,
      fullySpecified: false,
      source: 'position',
    }
  }

  const { axis, value } = resolved
  const anchored = isExecutionAnchored(ownerStatus, axis, value)

  return {
    scope,
    executionAnchored: anchored,
    fullySpecified: anchored && fullySpecified,
    normalized: anchored ? { axis, value, needsRuntimeResolution: axisNeedsRuntimeResolution(axis) } : undefined,
    source: 'position',
  }
}

function anchorFromActionCapability(
  ev: CapabilityEvidence,
  actionOpenSlots: readonly unknown[] | undefined,
): SizingAnchor {
  const scope: SizingScope = { kind: 'action', id: ev.ownerId }
  const resolved = resolveAxisFromCapabilityShape(ev)

  if (!resolved) {
    return {
      scope,
      executionAnchored: false,
      fullySpecified: false,
      source: 'action',
      evidenceRef: { mount: ev.mount, ownerId: ev.ownerId, contractId: ev.contractId },
    }
  }

  const { axis, value, asset } = resolved
  const anchored = isExecutionAnchored(ev.ownerStatus, axis, value)
  const fullySpecified = anchored && ev.ownerStatus === 'locked' && (actionOpenSlots ?? []).length === 0

  return {
    scope,
    executionAnchored: anchored,
    fullySpecified,
    normalized: anchored ? { axis, value, needsRuntimeResolution: axisNeedsRuntimeResolution(axis), asset } : undefined,
    source: 'action',
    evidenceRef: { mount: ev.mount, ownerId: ev.ownerId, contractId: ev.contractId },
  }
}

function anchorFromPositionConstraintCapability(
  ev: CapabilityEvidence,
  pc: RulesMainflowAtomFact | undefined,
): SizingAnchor {
  const scope: SizingScope = { kind: 'position_constraint', ownerKey: ev.ownerKey }
  const resolved = resolveAxisFromCapabilityShape(ev)

  if (!resolved) {
    return {
      scope,
      executionAnchored: false,
      fullySpecified: false,
      source: 'position_constraint',
      evidenceRef: { mount: ev.mount, ownerId: ev.ownerId, contractId: ev.contractId },
    }
  }

  const { axis, value, asset } = resolved
  const anchored = isExecutionAnchored(ev.ownerStatus, axis, value)
  const fullySpecified = anchored && ev.ownerStatus === 'locked' && (pc?.openSlots ?? []).length === 0

  return {
    scope,
    executionAnchored: anchored,
    fullySpecified,
    normalized: anchored ? { axis, value, needsRuntimeResolution: axisNeedsRuntimeResolution(axis), asset } : undefined,
    source: 'position_constraint',
    evidenceRef: { mount: ev.mount, ownerId: ev.ownerId, contractId: ev.contractId },
  }
}

function anchorFromParamsSizing(
  pc: RulesMainflowAtomFact,
  resolved: { axis: SizingAxis; value: number },
): SizingAnchor {
  const scope: SizingScope = { kind: 'position_constraint', ownerKey: pc.key }
  const { axis, value } = resolved
  const anchored = isExecutionAnchored(pc.status, axis, value)
  const fullySpecified = anchored && pc.status === 'locked' && pc.openSlots.length === 0

  return {
    scope,
    executionAnchored: anchored,
    fullySpecified,
    normalized: anchored ? { axis, value, needsRuntimeResolution: axisNeedsRuntimeResolution(axis) } : undefined,
    source: 'position_constraint_params_fallback',
  }
}

// ---------------------------------------------------------------------------
// Resolver service
// ---------------------------------------------------------------------------

/** @pure 无 IO 无事务边界 */
@Injectable()
export class PerTradeSizingResolver {
  constructor(
    private readonly rulesMainflowReader: RulesMainflowReaderService = new RulesMainflowReaderService(),
  ) {}

  resolve(state: SemanticState): ReadonlyMap<string, SizingAnchor> {
    const index = CapabilityEvidenceIndex.build(state)
    const out = new Map<string, SizingAnchor>()

    // (a) state.position.sizing — strategy_default scope
    const pos = state.position
    if (pos?.sizing != null) {
      const sizing = pos.sizing
      const posOpenSlots = pos.openSlots ?? []
      const fullySpecified = pos.status === 'locked' && posOpenSlots.length === 0
      const anchor = anchorFromPositionSizing(sizing, pos.status, fullySpecified)
      if (anchor.executionAnchored) {
        out.set(scopeKey(anchor.scope), anchor)
      }
    }

    // (b) action level — capital.allocate.per_order_budget
    for (const ev of index.byKey('capital', 'allocate', 'per_order_budget')) {
      if (ev.mount !== 'action') continue
      const action = this.rulesMainflowReader.readFactsByRole(state, 'action').find(a => a.id === ev.ownerId)
      const anchor = anchorFromActionCapability(ev, action?.openSlots)
      if (anchor.executionAnchored) {
        out.set(scopeKey(anchor.scope), anchor)
      }
    }

    // (c) position_constraint level — capital.allocate.per_order_budget (PR4 emit path)
    for (const ev of index.byKey('capital', 'allocate', 'per_order_budget')) {
      if (ev.mount !== 'position_constraint') continue
      const sk = scopeKey({ kind: 'position_constraint', ownerKey: ev.ownerKey })
      // Don't override an already-placed entry from same scope (shouldn't happen with distinct mounts, but defensive)
      const pc = this.rulesMainflowReader.readFactsByRole(state, 'position').find(c => c.key === ev.ownerKey)
      const anchor = anchorFromPositionConstraintCapability(ev, pc)
      if (anchor.executionAnchored) {
        out.set(sk, anchor)
      }
    }

    // (d) degraded path — positionConstraint[*].params.perOrderSizing
    for (const pc of this.rulesMainflowReader.readFactsByRole(state, 'position')) {
      const sk = scopeKey({ kind: 'position_constraint', ownerKey: pc.key })
      if (out.has(sk)) continue // capability main path already placed — skip fallback
      const resolved = readSizingShapeFromParams(pc.params)
      if (!resolved) continue
      const anchor = anchorFromParamsSizing(pc, resolved)
      if (anchor.executionAnchored) {
        out.set(sk, anchor)
      }
    }

    return out
  }

  /**
   * #1186 PR2 (decision 6): shared method 供 builder 多锚反填、PR3 readiness 多腿 per-leg 判定共用。
   * 仅返回 `kind==='action'` 且 `executionAnchored===true` 的 anchor scopeKey；
   * `kind==='position_constraint'` scope（PR4 emit 路径用）属"开仓后约束"，不构成 leg。
   */
  getExecutableLegScopes(state: SemanticState): readonly string[] {
    const anchors = this.resolve(state)
    const result: string[] = []
    for (const [key, anchor] of anchors.entries()) {
      if (anchor.scope.kind === 'action' && anchor.executionAnchored) {
        result.push(key)
      }
    }
    return result
  }
}
