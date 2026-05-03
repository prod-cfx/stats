import { Injectable } from '@nestjs/common'

import type {
  SemanticActionState,
  SemanticEvidence,
  SemanticNodeStatus,
  SemanticPositionSizingContract,
  SemanticPriority,
  SemanticRiskState,
  SemanticSlotState,
  SemanticSource,
  SemanticState,
  SemanticTriggerState,
} from '../types/semantic-state'
import { normalizeRiskSemantic } from './semantic-state-normalization'

type SemanticPatchRecord = Record<string, unknown>
type ContextField = 'exchange' | 'symbol' | 'marketType' | 'timeframe'
type SlotValueRead =
  | { present: true, value: string | number | boolean | null }
  | { present: false }

const CONTEXT_QUESTION_HINTS: Record<ContextField, string> = {
  exchange: '请确认交易所（binance / okx / hyperliquid）。',
  symbol: '请确认策略交易标的（例如 BTCUSDT）。',
  marketType: '请确认市场类型（现货或合约/perp）。',
  timeframe: '请确认策略主周期（例如 15m 或 1h）。',
}

@Injectable()
export class SemanticSeedStateBuilderService {
  build(semanticPatch: unknown): SemanticState | null {
    if (!this.isRecord(semanticPatch)) {
      return null
    }

    const triggerItems = Array.isArray(semanticPatch.triggers)
      ? semanticPatch.triggers
      : (Array.isArray(semanticPatch.triggerUpdates) ? semanticPatch.triggerUpdates : [])
    const actionItems = Array.isArray(semanticPatch.actions)
      ? semanticPatch.actions
      : (Array.isArray(semanticPatch.actionUpdates) ? semanticPatch.actionUpdates : [])
    const riskItems = Array.isArray(semanticPatch.risk)
      ? semanticPatch.risk
      : (Array.isArray(semanticPatch.riskUpdates) ? semanticPatch.riskUpdates : [])
    const positionUpdate = this.toPositionState(semanticPatch.position ?? semanticPatch.positionUpdate)
    const contextSlots = this.toContextSlots(
      semanticPatch.contextSlots ?? semanticPatch.contextUpdates ?? semanticPatch.context,
    )

    const triggerUpdates = triggerItems
      .map((item, index) => this.toTriggerState(item, index))
      .filter((item): item is SemanticTriggerState => item !== null)
    const actionUpdates = actionItems
      .map((item, index) => this.toActionState(item, index))
      .filter((item): item is SemanticActionState => item !== null)
    const riskUpdates = riskItems
      .map((item, index) => this.toRiskState(item, index))
      .filter((item): item is SemanticRiskState => item !== null)

    if (
      triggerUpdates.length === 0
      && actionUpdates.length === 0
      && riskUpdates.length === 0
      && !positionUpdate
      && !Object.values(contextSlots).some(Boolean)
    ) {
      return null
    }

    return {
      version: 1,
      families: [],
      triggers: triggerUpdates,
      actions: actionUpdates,
      risk: riskUpdates,
      position: positionUpdate,
      contextSlots,
      normalizationNotes: [],
      updatedAt: new Date().toISOString(),
    }
  }

  private toTriggerState(update: unknown, index: number): SemanticTriggerState | null {
    if (!this.isRecord(update)) {
      return null
    }

    const key = this.readTrimmedString(update.key)
    const phase = update.phase
    if (!key || (phase !== 'entry' && phase !== 'exit' && phase !== 'risk' && phase !== 'gate')) {
      return null
    }

    const openSlots = this.readOpenSlots(update.openSlots)
    const status = this.resolveNodeStatus(update.status, openSlots)
    const evidence = this.readEvidence(update.evidence)
    const supersedes = this.readStringArray(update.supersedes)

    return {
      id: this.readTrimmedString(update.id) ?? `planner-trigger-${index + 1}`,
      key,
      phase,
      params: this.normalizeTriggerParams(key, this.readParams(update.params)),
      ...(update.sideScope === 'long' || update.sideScope === 'short' || update.sideScope === 'both'
        ? { sideScope: update.sideScope }
        : {}),
      status,
      source: this.readSource(update.source),
      ...(evidence ? { evidence } : {}),
      openSlots,
      ...(supersedes ? { supersedes } : {}),
    }
  }

  private toActionState(update: unknown, index: number): SemanticActionState | null {
    if (!this.isRecord(update)) {
      return null
    }

    const key = this.readTrimmedString(update.key)
    if (!key) {
      return null
    }

    const evidence = this.readEvidence(update.evidence)
    const supersedes = this.readStringArray(update.supersedes)
    const openSlots = this.readOpenSlots(update.openSlots)

    return {
      id: this.readTrimmedString(update.id) ?? `planner-action-${index + 1}`,
      key,
      ...(this.isRecord(update.params) ? { params: { ...update.params } } : {}),
      status: this.resolveNodeStatus(update.status, openSlots),
      source: this.readSource(update.source),
      ...(evidence ? { evidence } : {}),
      openSlots,
      ...(supersedes ? { supersedes } : {}),
    }
  }

  private toRiskState(update: unknown, index: number): SemanticRiskState | null {
    if (!this.isRecord(update)) {
      return null
    }

    const key = this.readTrimmedString(update.key)
    if (!key) {
      return null
    }

    const openSlots = this.readOpenSlots(update.openSlots)
    const evidence = this.readEvidence(update.evidence)
    const supersedes = this.readStringArray(update.supersedes)

    const risk: SemanticRiskState = {
      id: this.readTrimmedString(update.id) ?? `planner-risk-${index + 1}`,
      key,
      params: this.readParams(update.params),
      status: this.resolveNodeStatus(update.status, openSlots),
      source: this.readSource(update.source),
      ...(evidence ? { evidence } : {}),
      openSlots,
      ...(supersedes ? { supersedes } : {}),
    }

    return normalizeRiskSemantic(risk, index)
  }

  private toPositionState(update: unknown): SemanticState['position'] {
    if (!this.isRecord(update)) {
      return null
    }

    const sizing = this.readPositionSizing(update.sizing)
    if (
      typeof update.mode !== 'string'
      || typeof update.positionMode !== 'string'
      || typeof update.value !== 'number'
      || !Number.isFinite(update.value)
    ) {
      return null
    }

    const openSlots = this.readOpenSlots(update.openSlots)
    const positionMode = update.positionMode === 'both' ? 'long_short' : update.positionMode
    const evidence = this.readEvidence(update.evidence)

    return {
      ...(sizing ? { sizing } : {}),
      mode: update.mode,
      value: update.value,
      positionMode,
      status: this.resolveNodeStatus(update.status, openSlots),
      source: this.readSource(update.source),
      ...(evidence ? { evidence } : {}),
      openSlots,
    }
  }

  private readPositionSizing(sizing: unknown): SemanticPositionSizingContract | null {
    if (!this.isRecord(sizing)) {
      return null
    }

    if (typeof sizing.value !== 'number' || !Number.isFinite(sizing.value) || sizing.value <= 0) {
      return null
    }

    if (sizing.kind === 'ratio' && (sizing.unit === 'ratio' || sizing.unit === 'percent')) {
      return { kind: 'ratio', value: sizing.value, unit: sizing.unit }
    }

    if (
      sizing.kind === 'quote'
      && (sizing.asset === 'USDT' || sizing.asset === 'USDC' || sizing.asset === 'USD')
    ) {
      return { kind: 'quote', value: sizing.value, asset: sizing.asset }
    }

    if (
      sizing.kind === 'base'
      && typeof sizing.asset === 'string'
      && /^[A-Z][A-Z0-9]{1,15}$/u.test(sizing.asset)
    ) {
      return { kind: 'base', value: sizing.value, asset: sizing.asset }
    }

    return null
  }

  private toContextSlots(update: unknown): SemanticState['contextSlots'] {
    if (!this.isRecord(update)) {
      return {
        exchange: null,
        symbol: null,
        marketType: null,
        timeframe: null,
      }
    }

    return {
      exchange: this.toContextSlot('exchange', update.exchange),
      symbol: this.toContextSlot('symbol', update.symbol),
      marketType: this.toContextSlot('marketType', update.marketType),
      timeframe: this.toContextSlot('timeframe', update.timeframe),
    }
  }

  private toContextSlot(
    field: ContextField,
    value: unknown,
  ): SemanticState['contextSlots'][typeof field] {
    if (this.isRecord(value)) {
      const slot = this.toSlotState(value, {
        slotKey: field,
        fieldPath: `contextSlots.${field}`,
        priority: 'context',
        questionHint: CONTEXT_QUESTION_HINTS[field],
      })
      return slot
    }

    const trimmedValue = this.readTrimmedString(value)
    if (!trimmedValue) {
      return null
    }

    return {
      slotKey: field,
      fieldPath: `contextSlots.${field}`,
      value: trimmedValue,
      status: 'locked',
      priority: 'context',
      questionHint: CONTEXT_QUESTION_HINTS[field],
      affectsExecution: true,
    }
  }

  private readParams(value: unknown): Record<string, unknown> {
    if (!this.isRecord(value)) {
      return {}
    }

    return { ...value }
  }

  private normalizeTriggerParams(
    key: string,
    params: Record<string, unknown>,
  ): Record<string, unknown> {
    if (key !== 'price.percent_change' || typeof params.valuePct !== 'number' || !Number.isFinite(params.valuePct)) {
      return params
    }

    if (params.direction === 'down' || params.direction === '跌' || params.direction === '下跌') {
      return {
        ...params,
        valuePct: -Math.abs(params.valuePct),
      }
    }

    if (params.direction === 'up' || params.direction === '涨' || params.direction === '上涨') {
      return {
        ...params,
        valuePct: Math.abs(params.valuePct),
      }
    }

    return params
  }

  private readOpenSlots(value: unknown): SemanticSlotState[] {
    if (!Array.isArray(value)) {
      return []
    }

    return value
      .map(item => this.toSlotState(item))
      .filter((item): item is SemanticSlotState => item !== null)
  }

  private toSlotState(
    value: unknown,
    defaults?: {
      slotKey: string
      fieldPath: string
      priority: SemanticPriority
      questionHint: string
    },
  ): SemanticSlotState | null {
    if (!this.isRecord(value)) {
      return null
    }

    const slotKey = this.readTrimmedString(value.slotKey) ?? defaults?.slotKey
    const fieldPath = this.readTrimmedString(value.fieldPath) ?? defaults?.fieldPath
    const status = this.readStatus(value.status) ?? 'open'
    const priority = this.readPriority(value.priority) ?? defaults?.priority
    const questionHint = this.readTrimmedString(value.questionHint) ?? defaults?.questionHint
    const evidence = this.readEvidence(value.evidence)
    const supersedes = this.readStringArray(value.supersedes)

    if (!slotKey || !fieldPath || !priority || !questionHint || typeof value.affectsExecution !== 'boolean') {
      return null
    }

    const slotValue = this.readSlotValue(value.value)

    return {
      slotKey,
      fieldPath,
      ...(slotValue.present ? { value: slotValue.value } : {}),
      status,
      priority,
      questionHint,
      affectsExecution: value.affectsExecution,
      ...(evidence ? { evidence } : {}),
      ...(supersedes ? { supersedes } : {}),
    }
  }

  private resolveNodeStatus(statusValue: unknown, openSlots: SemanticSlotState[]): SemanticNodeStatus {
    const status = this.readStatus(statusValue) ?? 'locked'
    if (status === 'superseded') {
      return status
    }
    return openSlots.some(slot => slot.status === 'open') ? 'open' : status
  }

  private readEvidence(value: unknown): SemanticEvidence | null {
    if (!this.isRecord(value)) {
      return null
    }

    const text = this.readTrimmedString(value.text)
    const source = this.readSource(value.source, null)
    if (!text || !source) {
      return null
    }

    return {
      text,
      ...(typeof value.messageIndex === 'number' && Number.isInteger(value.messageIndex)
        ? { messageIndex: value.messageIndex }
        : {}),
      source,
    }
  }

  private readSource(value: unknown): SemanticSource
  private readSource(value: unknown, fallback: SemanticSource): SemanticSource
  private readSource(value: unknown, fallback: null): SemanticSource | null
  private readSource(value: unknown, fallback: SemanticSource | null = 'user_explicit'): SemanticSource | null {
    if (value === 'user_explicit' || value === 'inferred' || value === 'derived') {
      return value
    }
    return fallback
  }

  private readStatus(value: unknown): SemanticNodeStatus | null {
    if (value === 'open' || value === 'locked' || value === 'superseded') {
      return value
    }
    return null
  }

  private readPriority(value: unknown): SemanticPriority | null {
    if (value === 'core' || value === 'behavior' || value === 'risk' || value === 'context') {
      return value
    }
    return null
  }

  private readStringArray(value: unknown): string[] | null {
    if (!Array.isArray(value)) {
      return null
    }

    const items = value
      .map(item => this.readTrimmedString(item))
      .filter((item): item is string => Boolean(item))
    return items.length > 0 ? items : null
  }

  private readSlotValue(value: unknown): SlotValueRead {
    if (value === null) {
      return { present: true, value: null }
    }

    if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
      return { present: true, value }
    }

    return { present: false }
  }

  private readTrimmedString(value: unknown): string | null {
    if (typeof value !== 'string') {
      return null
    }

    const trimmed = value.trim()
    return trimmed ? trimmed : null
  }

  private isRecord(value: unknown): value is SemanticPatchRecord {
    return Boolean(value && typeof value === 'object' && !Array.isArray(value))
  }
}
