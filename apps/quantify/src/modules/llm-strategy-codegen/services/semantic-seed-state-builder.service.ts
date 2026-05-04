import { Injectable } from '@nestjs/common'

import type {
  SemanticActionState,
  SemanticAtomContract,
  SemanticCapability,
  SemanticCapabilityDomain,
  SemanticCapabilityShape,
  SemanticEvidence,
  SemanticEffect,
  SemanticNodeStatus,
  SemanticPositionSizingContract,
  SemanticPriority,
  SemanticRequirement,
  SemanticRiskState,
  SemanticSlotState,
  SemanticSource,
  SemanticState,
  SemanticTriggerState,
} from '../types/semantic-state'
import { FIRST_WAVE_TRIGGER_ATOMS } from '../constants/canonical-strategy-capabilities'
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
const SYNTHESIZABLE_TRIGGER_KEYS = new Set<string>(FIRST_WAVE_TRIGGER_ATOMS)

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

    const params = this.normalizeTriggerParams(key, this.readParams(update.params))
    const sideScope = update.sideScope === 'long' || update.sideScope === 'short' || update.sideScope === 'both'
      ? update.sideScope
      : null
    const openSlots = this.readOpenSlots(update.openSlots)
    const evidence = this.readEvidence(update.evidence)
    const supersedes = this.readStringArray(update.supersedes)
    const contracts = this.readContracts(update.contracts)
      ?? (this.hasOwnProperty(update, 'contracts')
        ? null
        : this.synthesizeTriggerContracts(key, phase, sideScope, params, index))
    const contractCoverage = this.resolveContractCoverage({
      contracts,
      openSlots,
      statusValue: update.status,
      fieldPath: `triggers[${index}].contracts`,
      priority: 'core',
    })

    return {
      id: this.readTrimmedString(update.id) ?? `planner-trigger-${index + 1}`,
      key,
      phase,
      params,
      ...(sideScope
        ? { sideScope }
        : {}),
      status: contractCoverage.status,
      source: this.readSource(update.source),
      ...(evidence ? { evidence } : {}),
      openSlots: contractCoverage.openSlots,
      ...(supersedes ? { supersedes } : {}),
      ...(contracts ? { contracts } : {}),
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
    const params = this.readParams(update.params)
    const contracts = this.readContracts(update.contracts)
      ?? (this.hasOwnProperty(update, 'contracts')
        ? null
        : this.synthesizeActionContracts(key, params, index))
    const contractCoverage = this.resolveContractCoverage({
      contracts,
      openSlots,
      statusValue: update.status,
      fieldPath: `actions[${index}].contracts`,
      priority: 'behavior',
    })

    return {
      id: this.readTrimmedString(update.id) ?? `planner-action-${index + 1}`,
      key,
      ...(this.isRecord(update.params) ? { params } : {}),
      status: contractCoverage.status,
      source: this.readSource(update.source),
      ...(evidence ? { evidence } : {}),
      openSlots: contractCoverage.openSlots,
      ...(supersedes ? { supersedes } : {}),
      ...(contracts ? { contracts } : {}),
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
    const params = this.readParams(update.params)
    const contracts = this.readContracts(update.contracts)
      ?? (this.hasOwnProperty(update, 'contracts')
        ? null
        : this.synthesizeRiskContracts(key, params, index))
    const contractCoverage = this.resolveContractCoverage({
      contracts,
      openSlots,
      statusValue: update.status,
      fieldPath: `risk[${index}].contracts`,
      priority: 'risk',
    })

    const risk: SemanticRiskState = {
      id: this.readTrimmedString(update.id) ?? `planner-risk-${index + 1}`,
      key,
      params,
      status: contractCoverage.status,
      source: this.readSource(update.source),
      ...(evidence ? { evidence } : {}),
      openSlots: contractCoverage.openSlots,
      ...(supersedes ? { supersedes } : {}),
      ...(contracts ? { contracts } : {}),
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
    const contracts = this.readContracts(update.contracts)
      ?? (this.hasOwnProperty(update, 'contracts')
        ? null
        : this.synthesizePositionContracts({ sizing, mode: update.mode, value: update.value, positionMode }))
    const contractCoverage = this.resolveContractCoverage({
      contracts,
      openSlots,
      statusValue: update.status,
      fieldPath: 'position.contracts',
      priority: 'behavior',
    })

    return {
      ...(sizing ? { sizing } : {}),
      mode: update.mode,
      value: update.value,
      positionMode,
      status: contractCoverage.status,
      source: this.readSource(update.source),
      ...(evidence ? { evidence } : {}),
      openSlots: contractCoverage.openSlots,
      ...(contracts ? { contracts } : {}),
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

  private synthesizeTriggerContracts(
    key: string,
    phase: SemanticTriggerState['phase'],
    sideScope: SemanticTriggerState['sideScope'] | null,
    params: Record<string, unknown>,
    index: number,
  ): SemanticAtomContract[] | null {
    if (!this.canSynthesizeTriggerContract(key, params)) {
      return null
    }

    return [this.buildAtomContract({
      id: `contract-seed-trigger-${index + 1}-${this.slugifyContractId(key)}`,
      kind: 'trigger',
      capability: this.buildTriggerCapability(key, phase, sideScope, params),
      params,
    })]
  }

  private canSynthesizeTriggerContract(key: string, params: Record<string, unknown>): boolean {
    if (key === 'condition.expression') {
      return this.isRecord(params.expression)
    }

    return SYNTHESIZABLE_TRIGGER_KEYS.has(key)
  }

  private buildTriggerCapability(
    key: string,
    phase: SemanticTriggerState['phase'],
    sideScope: SemanticTriggerState['sideScope'] | null,
    params: Record<string, unknown>,
  ): SemanticCapability {
    if (key === 'execution.on_start') {
      return {
        domain: 'order_program',
        verb: 'schedule',
        object: 'execution_trigger',
        shape: this.toCapabilityShape({
          key,
          phase,
          sideScope: sideScope ?? null,
          ...params,
        }),
      }
    }

    return {
      domain: 'price',
      verb: 'detect',
      object: 'signal_condition',
      shape: this.toCapabilityShape({
        key,
        phase,
        sideScope: sideScope ?? null,
        ...params,
      }),
    }
  }

  private synthesizeActionContracts(
    key: string,
    params: Record<string, unknown>,
    index: number,
  ): SemanticAtomContract[] {
    return [this.buildAtomContract({
      id: `contract-seed-action-${index + 1}-${this.slugifyContractId(key)}`,
      kind: 'action',
      capability: {
        domain: 'order_program',
        verb: 'execute',
        object: 'order_action',
        shape: this.toCapabilityShape({
          key,
          side: this.resolveActionSide(key),
          intent: this.resolveActionIntent(key),
          ...params,
        }),
      },
      params,
    })]
  }

  private synthesizeRiskContracts(
    key: string,
    params: Record<string, unknown>,
    index: number,
  ): SemanticAtomContract[] | null {
    const object = this.resolveRiskContractObject(key)
    if (!object) {
      return null
    }

    return [this.buildAtomContract({
      id: `contract-seed-risk-${index + 1}-${this.slugifyContractId(key)}`,
      kind: 'risk',
      capability: {
        domain: 'guard',
        verb: 'enforce',
        object,
        shape: this.toCapabilityShape({
          key,
          ...params,
        }),
      },
      params,
    })]
  }

  private resolveRiskContractObject(key: string): string | null {
    if (key === 'risk.stop_loss_pct') {
      return 'stop_loss'
    }
    if (key === 'risk.take_profit_pct') {
      return 'take_profit'
    }
    if (key === 'risk.max_drawdown_pct') {
      return 'max_drawdown'
    }
    if (key === 'risk.max_single_loss_pct') {
      return 'max_single_loss'
    }
    if (key === 'risk.condition_expression') {
      return 'risk_condition'
    }
    return null
  }

  private synthesizePositionContracts(position: {
    sizing: SemanticPositionSizingContract | null
    mode: string
    value: number
    positionMode: string
  }): SemanticAtomContract[] {
    return [this.buildAtomContract({
      id: 'contract-seed-position-sizing',
      kind: 'position',
      capability: {
        domain: 'capital',
        verb: 'allocate',
        object: 'position_sizing',
        shape: this.toCapabilityShape({
          sizing: position.sizing,
          mode: position.mode,
          value: position.value,
          positionMode: position.positionMode,
        }),
      },
      params: {
        sizing: position.sizing,
        mode: position.mode,
        value: position.value,
        positionMode: position.positionMode,
      },
    })]
  }

  private buildAtomContract(input: {
    id: string
    kind: SemanticAtomContract['kind']
    capability: SemanticCapability
    params: Record<string, unknown>
  }): SemanticAtomContract {
    return {
      id: input.id,
      kind: input.kind,
      capabilities: [input.capability],
      requires: [],
      params: input.params,
    }
  }

  private readContracts(value: unknown): SemanticAtomContract[] | null {
    if (!Array.isArray(value)) {
      return null
    }

    const contracts = value
      .map(item => this.toContract(item))
      .filter((item): item is SemanticAtomContract => item !== null)
    return contracts.length > 0 ? contracts : null
  }

  private toContract(value: unknown): SemanticAtomContract | null {
    if (!this.isRecord(value)) {
      return null
    }

    const id = this.readTrimmedString(value.id)
    const capabilities = this.readCapabilities(value.capabilities)
    const requires = this.readRequirements(value.requires)
    if (!id || !this.isContractKind(value.kind) || !capabilities || !requires) {
      return null
    }

    const effects = this.readEffects(value.effects)

    return {
      id,
      kind: value.kind,
      capabilities,
      requires,
      params: this.readParams(value.params),
      ...(effects ? { effects } : {}),
    }
  }

  private readCapabilities(value: unknown): SemanticCapability[] | null {
    if (!Array.isArray(value)) {
      return null
    }

    const capabilities: SemanticCapability[] = []
    for (const item of value) {
      const capability = this.toCapability(item)
      if (!capability) {
        return null
      }
      capabilities.push(capability)
    }

    return capabilities.length > 0 ? capabilities : null
  }

  private toCapability(value: unknown): SemanticCapability | null {
    if (!this.isRecord(value) || !this.isCapabilityDomain(value.domain)) {
      return null
    }

    const verb = this.readTrimmedString(value.verb)
    const object = this.readTrimmedString(value.object)
    if (!verb || !object || !this.isCapabilityShape(value.shape)) {
      return null
    }

    return {
      domain: value.domain,
      verb,
      object,
      shape: value.shape,
    }
  }

  private readRequirements(value: unknown): SemanticRequirement[] | null {
    if (!Array.isArray(value)) {
      return null
    }

    const requirements: SemanticRequirement[] = []
    for (const item of value) {
      const requirement = this.toRequirement(item)
      if (!requirement) {
        return null
      }
      requirements.push(requirement)
    }

    return requirements
  }

  private toRequirement(value: unknown): SemanticRequirement | null {
    if (!this.isRecord(value) || !this.isCapabilityDomain(value.domain)) {
      return null
    }

    const verb = this.readTrimmedString(value.verb)
    const object = this.readTrimmedString(value.object)
    if (!verb || !object) {
      return null
    }

    return {
      domain: value.domain,
      verb,
      object,
    }
  }

  private readEffects(value: unknown): SemanticEffect[] | null {
    if (!Array.isArray(value)) {
      return null
    }

    const effects: SemanticEffect[] = []
    for (const item of value) {
      const effect = this.toEffect(item)
      if (!effect) {
        return null
      }
      effects.push(effect)
    }

    return effects.length > 0 ? effects : null
  }

  private toEffect(value: unknown): SemanticEffect | null {
    if (!this.isRecord(value) || !this.isCapabilityDomain(value.domain)) {
      return null
    }

    const verb = this.readTrimmedString(value.verb)
    const object = this.readTrimmedString(value.object)
    const shape = value.shape
    if (!verb || !object) {
      return null
    }

    const effect: SemanticEffect = {
      domain: value.domain,
      verb,
      object,
    }

    if (shape === undefined) {
      return effect
    }

    if (!this.isCapabilityShape(shape)) {
      return null
    }

    return {
      ...effect,
      shape,
    }
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

  private resolveContractCoverage(options: {
    contracts: SemanticAtomContract[] | null
    openSlots: SemanticSlotState[]
    statusValue: unknown
    fieldPath: string
    priority: SemanticPriority
  }): { status: SemanticNodeStatus, openSlots: SemanticSlotState[] } {
    if (options.statusValue === 'superseded') {
      return {
        status: 'superseded',
        openSlots: this.removeContractRequiredSlots(options.openSlots),
      }
    }

    if (options.contracts) {
      const openSlots = this.removeContractRequiredSlots(options.openSlots)
      return {
        status: this.resolveNodeStatus(options.statusValue, openSlots),
        openSlots,
      }
    }

    return {
      status: 'open',
      openSlots: this.appendContractRequiredSlot(options.openSlots, options.fieldPath, options.priority),
    }
  }

  private appendContractRequiredSlot(
    openSlots: SemanticSlotState[],
    fieldPath: string,
    priority: SemanticPriority,
  ): SemanticSlotState[] {
    if (openSlots.some(slot => slot.slotKey === 'contract.required' && slot.fieldPath === fieldPath)) {
      return openSlots
    }

    return [
      ...openSlots,
      {
        slotKey: 'contract.required',
        fieldPath,
        status: 'open',
        priority,
        questionHint: '请补充该原子的执行合约。',
        affectsExecution: true,
      },
    ]
  }

  private removeContractRequiredSlots(openSlots: SemanticSlotState[]): SemanticSlotState[] {
    return openSlots.filter(slot => slot.slotKey !== 'contract.required')
  }

  private resolveActionSide(key: string): 'long' | 'short' | 'unknown' {
    if (key.includes('long')) {
      return 'long'
    }
    if (key.includes('short')) {
      return 'short'
    }
    return 'unknown'
  }

  private resolveActionIntent(key: string): 'open' | 'close' | 'unknown' {
    if (key.startsWith('open_')) {
      return 'open'
    }
    if (key.startsWith('close_')) {
      return 'close'
    }
    return 'unknown'
  }

  private toCapabilityShape(input: Record<string, unknown>): SemanticCapabilityShape {
    const shape: SemanticCapabilityShape = {}
    for (const [key, value] of Object.entries(input)) {
      const normalizedValue = this.toCapabilityShapeValue(value)
      if (normalizedValue !== undefined) {
        shape[key] = normalizedValue
      }
    }
    return shape
  }

  private toCapabilityShapeValue(
    value: unknown,
  ): string | number | boolean | null | SemanticCapabilityShape | SemanticCapabilityShape[] | undefined {
    if (value === null) {
      return null
    }
    if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
      return Number.isNaN(value) ? undefined : value
    }
    if (Array.isArray(value)) {
      return value
        .map(item => this.toCapabilityArrayItem(item))
        .filter((item): item is SemanticCapabilityShape => item !== undefined)
    }
    if (this.isRecord(value)) {
      return this.toCapabilityShape(value)
    }
    return undefined
  }

  private toCapabilityArrayItem(value: unknown): SemanticCapabilityShape | undefined {
    const normalizedValue = this.toCapabilityShapeValue(value)
    if (normalizedValue === undefined) {
      return undefined
    }
    if (
      normalizedValue === null
      || typeof normalizedValue === 'string'
      || typeof normalizedValue === 'number'
      || typeof normalizedValue === 'boolean'
    ) {
      return { value: normalizedValue }
    }
    if (Array.isArray(normalizedValue)) {
      return { items: normalizedValue }
    }
    return normalizedValue
  }

  private slugifyContractId(value: string): string {
    return value.replace(/[^a-z0-9]+/giu, '-').replace(/^-|-$/gu, '').toLowerCase() || 'atom'
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

  private isContractKind(value: unknown): value is SemanticAtomContract['kind'] {
    return value === 'trigger'
      || value === 'action'
      || value === 'risk'
      || value === 'position'
      || value === 'context'
  }

  private isCapabilityDomain(value: unknown): value is SemanticCapabilityDomain {
    return value === 'market'
      || value === 'price'
      || value === 'order_program'
      || value === 'capital'
      || value === 'exposure'
      || value === 'margin'
      || value === 'guard'
  }

  private isCapabilityShape(value: unknown): value is SemanticCapabilityShape {
    if (!this.isRecord(value)) {
      return false
    }

    return Object.values(value).every(item =>
      item === null
      || typeof item === 'string'
      || typeof item === 'number'
      || typeof item === 'boolean'
      || this.isCapabilityShape(item)
      || (Array.isArray(item) && item.every(nested => this.isCapabilityShape(nested))),
    )
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

  private hasOwnProperty(value: SemanticPatchRecord, key: string): boolean {
    return Object.prototype.hasOwnProperty.call(value, key)
  }
}
