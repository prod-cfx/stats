import type { CodegenSessionResponseDto } from '../dto/codegen-session.response.dto'
import { InternalKeyLeakGuardService } from '../nl-gateway/internal-key-leak-guard'

export interface PublishedSnapshotProjection {
  publishedSnapshotStrategyConfig: Record<string, unknown> | null
  publishedSnapshotBacktestConfigDefaults: Record<string, unknown> | null
  publishedSnapshotDeploymentExecutionDefaults: Record<string, unknown> | null
  publishedSnapshotDeploymentExecutionConstraints: Record<string, unknown> | null
  publishedSnapshotCompatibilityMetadata: Record<string, unknown> | null
}

export class CodegenConversationResponseMapperHelper {
  private readonly internalKeyLeakGuard = new InternalKeyLeakGuardService()

  finalizeSessionResponse(
    response: Omit<CodegenSessionResponseDto, 'clarificationGate'> & {
      clarificationGate?: CodegenSessionResponseDto['clarificationGate']
    },
    buildClarificationGate: (
      clarificationState?: unknown,
    ) => CodegenSessionResponseDto['clarificationGate'],
  ): CodegenSessionResponseDto {
    const clarificationGate = response.clarificationGate ?? buildClarificationGate(response.clarificationState)
    const publicationGate = response.publicationGate ?? this.readPublicationGate(response.consistencyReport)
    if (!clarificationGate.blocked) {
      return {
        ...response,
        specDesc: this.buildPublicSpecDesc(response.specDesc),
        semanticGraph: null,
        unsupportedFallback: this.buildPublicUnsupportedFallback(response.unsupportedFallback),
        clarificationGate,
        publicationGate,
      }
    }

    return {
      ...response,
      clarificationGate,
      publicationGate,
      specDesc: null,
      canonicalDigest: null,
      semanticGraph: null,
      unsupportedFallback: this.buildPublicUnsupportedFallback(response.unsupportedFallback),
    }
  }

  readPublicationGate(value: unknown): CodegenSessionResponseDto['publicationGate'] | null {
    const direct = this.normalizePublicationGate(value)
    if (direct) {
      return direct
    }

    const report = this.readRecord(value)
    const compilerConsistency = this.readRecord(report?.compilerConsistency)
    return this.normalizePublicationGate(compilerConsistency?.publicationGate)
  }

  buildPublishedSnapshotParamValues(
    snapshot: {
      paramsSnapshot?: unknown
      lockedParams?: unknown
      executionPolicy?: unknown
    } | null | undefined,
  ): Record<string, unknown> | null {
    if (!snapshot) {
      return null
    }

    const paramsSnapshot = this.readRecord(snapshot.paramsSnapshot)
    const lockedParams = this.readRecord(snapshot.lockedParams)
    const executionPolicy = this.readRecord(snapshot.executionPolicy)
    const merged = {
      ...(paramsSnapshot ?? {}),
      ...(lockedParams ?? {}),
    }

    if (typeof merged.timeframe === 'string' && merged.timeframe.trim() && typeof merged.baseTimeframe !== 'string') {
      merged.baseTimeframe = merged.timeframe.trim()
    }

    const allowPartialFill = this.readAllowPartialFill(executionPolicy)
    if (allowPartialFill !== null) {
      merged.backtestAllowPartial = allowPartialFill
    }

    return Object.keys(merged).length > 0 ? merged : null
  }

  buildPublishedSnapshotProjection(args: {
    publishedSnapshotId: string | null
    snapshot: unknown
    strategyInstanceId?: string | null
  }): PublishedSnapshotProjection {
    if (!args.publishedSnapshotId) {
      return {
        publishedSnapshotStrategyConfig: null,
        publishedSnapshotBacktestConfigDefaults: null,
        publishedSnapshotDeploymentExecutionDefaults: null,
        publishedSnapshotDeploymentExecutionConstraints: null,
        publishedSnapshotCompatibilityMetadata: null,
      }
    }

    const snapshotRecord = this.readRecord(args.snapshot)
    const strategyConfig = this.readRecord(snapshotRecord?.strategyConfig)
    const backtestConfigDefaults = this.readRecord(snapshotRecord?.backtestConfigDefaults)
    const deploymentExecutionDefaults = this.readRecord(snapshotRecord?.deploymentExecutionDefaults)
    const deploymentExecutionConstraints = this.readRecord(snapshotRecord?.deploymentExecutionConstraints)
    const snapshotStrategyInstanceId = typeof snapshotRecord?.strategyInstanceId === 'string'
      ? snapshotRecord.strategyInstanceId.trim()
      : ''
    const strategyInstanceId = snapshotStrategyInstanceId || args.strategyInstanceId?.trim() || ''

    const missingStrategyConfig = !strategyConfig
    const missingBacktestConfigDefaults = !backtestConfigDefaults
    const missingDeploymentExecutionDefaults = !deploymentExecutionDefaults
    const missingDeploymentExecutionConstraints = !deploymentExecutionConstraints
    const missingStrategyInstanceBinding = strategyInstanceId.length === 0

    return {
      publishedSnapshotStrategyConfig: strategyConfig,
      publishedSnapshotBacktestConfigDefaults: backtestConfigDefaults,
      publishedSnapshotDeploymentExecutionDefaults: deploymentExecutionDefaults,
      publishedSnapshotDeploymentExecutionConstraints: deploymentExecutionConstraints,
      publishedSnapshotCompatibilityMetadata: {
        isLegacySnapshot:
          missingStrategyInstanceBinding
          || missingStrategyConfig
          || missingBacktestConfigDefaults
          || missingDeploymentExecutionDefaults
          || missingDeploymentExecutionConstraints,
        missingBacktestConfigDefaults,
        missingDeploymentExecutionDefaults,
        missingDeploymentExecutionConstraints,
        requiresRepublishForBacktest: missingStrategyConfig || missingBacktestConfigDefaults,
        requiresRepublishForDeploy:
          missingStrategyInstanceBinding
          || missingStrategyConfig
          || missingDeploymentExecutionDefaults
          || missingDeploymentExecutionConstraints,
      },
    }
  }

  private normalizePublicationGate(value: unknown): CodegenSessionResponseDto['publicationGate'] | null {
    const record = this.readRecord(value)
    if (!record) {
      return null
    }

    if (typeof record.passed === 'boolean' && Array.isArray(record.blockingMismatches)) {
      return {
        passed: record.passed,
        blockingMismatches: record.blockingMismatches
          .map(item => this.normalizePublicationGateMismatch(this.readRecord(item)))
          .filter((item): item is NonNullable<CodegenSessionResponseDto['publicationGate']>['blockingMismatches'][number] => item !== null),
      }
    }

    if (typeof record.status === 'string' && Array.isArray(record.checks)) {
      const blockingMismatches = record.checks
        .map(item => this.readRecord(item))
        .filter((item): item is Record<string, unknown> => item !== null)
        .filter(item => item.blocking === true && item.status === 'failed')
        .map(item => ({
          field: this.normalizePublicationGateField(item.key),
          expected: this.stringifyPublicationGateValue(item.expected),
          actual: this.stringifyPublicationGateValue(item.actual),
          reason:
            typeof item.message === 'string' && item.message.trim()
              ? item.message.trim()
              : 'publication gate blocked',
        }))

      return {
        passed: blockingMismatches.length === 0,
        blockingMismatches,
      }
    }

    return null
  }

  private normalizePublicationGateMismatch(
    value: Record<string, unknown> | null,
  ): NonNullable<CodegenSessionResponseDto['publicationGate']>['blockingMismatches'][number] | null {
    if (!value) {
      return null
    }

    const field = typeof value.field === 'string' && value.field.trim()
      ? value.field.trim()
      : null
    const reason = typeof value.reason === 'string' && value.reason.trim()
      ? value.reason.trim()
      : null
    if (!field || !reason) {
      return null
    }

    return {
      field,
      expected: this.stringifyPublicationGateValue(value.expected),
      actual: this.stringifyPublicationGateValue(value.actual),
      reason,
    }
  }

  private normalizePublicationGateField(value: unknown): string {
    if (typeof value !== 'string' || !value.trim()) {
      return 'unknown'
    }

    const normalized = value.trim()
    return normalized.startsWith('market.')
      ? normalized.slice('market.'.length)
      : normalized
  }

  private stringifyPublicationGateValue(value: unknown): string {
    if (typeof value === 'string') {
      return value
    }
    if (typeof value === 'number' || typeof value === 'boolean') {
      return String(value)
    }

    const record = this.readRecord(value)
    if (record) {
      if (typeof record.script === 'string' && record.script.trim()) {
        return record.script.trim()
      }
      if (typeof record.ir === 'string' && record.ir.trim()) {
        return record.ir.trim()
      }
    }

    if (value === null || value === undefined) {
      return ''
    }

    try {
      return JSON.stringify(value)
    } catch {
      return String(value)
    }
  }

  private readAllowPartialFill(executionPolicy: Record<string, unknown> | null): boolean | null {
    if (!executionPolicy) {
      return null
    }

    const direct = executionPolicy.allowPartialFill
    if (typeof direct === 'boolean') {
      return direct
    }
    if (direct === 'true') {
      return true
    }
    if (direct === 'false') {
      return false
    }

    return null
  }

  private buildPublicSpecDesc(
    value: CodegenSessionResponseDto['specDesc'],
  ): CodegenSessionResponseDto['specDesc'] {
    if (value === null || value === undefined) {
      return value
    }

    const record = this.readRecord(value)
    if (!record) {
      return null
    }

    const publicSpecDesc = omitInternalSpecDescFields(record)
    this.internalKeyLeakGuard.assertNoLeaks(publicSpecDesc, {
      surface: 'codegen.session.specDesc',
      scanPaths: true,
      // displayLogicGraph 块 / 节点 / item 的 `id` 字段按 contract 内嵌 canonical
      // action 或 atom key 做跨投影稳定标识（见 semantic-state-projection
      // 中 `action-${trigger.id}-${actionKey}` 形式），不是用户可见 prose。
      // `key` 字段（如 condition.key）由 cluster-1 contract 明确对外暴露 canonical
      // atom key，leak guard 的值扫描不应拦截此字段。
      ignoreValueAtKeys: ['id', 'key'],
    })
    return publicSpecDesc
  }

  private buildPublicUnsupportedFallback(
    value: CodegenSessionResponseDto['unsupportedFallback'],
  ): CodegenSessionResponseDto['unsupportedFallback'] {
    if (value === null || value === undefined) {
      return null
    }

    const record = this.readRecord(value)
    if (!record) {
      return null
    }

    const unsupportedAtoms = Array.isArray(record.unsupportedAtoms)
      ? record.unsupportedAtoms.map(toPublicUnsupportedAtom).filter(isRecord)
      : []
    const recommendedStrategy = toPublicRecommendedStrategy(record.recommendedStrategy)
    const publicFallback: Record<string, unknown> = {}
    copyStringField(record, publicFallback, 'status')
    copyStringField(record, publicFallback, 'prompt')
    if (unsupportedAtoms.length > 0) {
      publicFallback.unsupportedAtoms = unsupportedAtoms
    }
    if (recommendedStrategy) {
      publicFallback.recommendedStrategy = recommendedStrategy
    }

    this.internalKeyLeakGuard.assertNoLeaks(publicFallback, {
      surface: 'codegen.session.unsupportedFallback',
      scanPaths: true,
    })
    return publicFallback
  }

  private readRecord(value: unknown): Record<string, unknown> | null {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      return null
    }

    return value as Record<string, unknown>
  }
}

function omitInternalSpecDescFields(specDesc: Record<string, unknown>): Record<string, unknown> {
  const {
    rules,
    canonicalSpec,
    riskRules: _riskRules,
    normalizedIntent: _normalizedIntent,
    scriptSummary: _scriptSummary,
    strategySummary: _strategySummary,
    userIntentSummary: _userIntentSummary,
    summaryObservation: _summaryObservation,
    stateHints: _stateHints,
    canonicalSnapshot: _canonicalSnapshot,
    specSnapshot: _specSnapshot,
    semanticState: _semanticState,
    semanticAtomInvariant: _semanticAtomInvariant,
    semanticPredicateGraph: _semanticPredicateGraph,
    consistencyReport: _consistencyReport,
    stage1ConsistencyEvidence: _stage1ConsistencyEvidence,
    ...publicSpecDesc
  } = specDesc
  const conditionTextByRuleId = readDisplayConditionTextByRuleId(publicSpecDesc.displayLogicGraph)

  return {
    ...publicSpecDesc,
    ...(Array.isArray(rules)
      ? { rules: rules.map(rule => toPublicRule(rule, conditionTextByRuleId)).filter(isRecord) }
      : {}),
    ...(isRecord(canonicalSpec) ? { canonicalSpec: toPublicCanonicalSpec(canonicalSpec) } : {}),
  }
}

function toPublicRule(
  rule: unknown,
  conditionTextByRuleId: ReadonlyMap<string, string>,
): Record<string, unknown> | null {
  if (!isRecord(rule)) {
    return null
  }

  const publicRule: Record<string, unknown> = {}
  copyStringField(rule, publicRule, 'id')
  copyStringField(rule, publicRule, 'phase')
  copyStringField(rule, publicRule, 'join')

  if (Array.isArray(rule.actions)) {
    publicRule.actions = rule.actions.map(toPublicAction).filter(isRecord)
  }
  const conditionText = readRuleConditionText(rule, conditionTextByRuleId)
  if (conditionText) {
    publicRule.condition = { text: conditionText }
  } else {
    const condition = isRecord(rule.condition) ? rule.condition : null
    const fallbackConditionText = toPublicConditionText(condition)
    if (fallbackConditionText) {
      publicRule.condition = { text: fallbackConditionText }
    }
  }

  const metadata = isRecord(rule.metadata) ? rule.metadata : null
  if (metadata) {
    const publicMetadata: Record<string, unknown> = {}
    if (isRecord(metadata.partialTakeProfit)) {
      publicMetadata.partialTakeProfit = metadata.partialTakeProfit
    }
    if (Object.keys(publicMetadata).length > 0) {
      publicRule.metadata = publicMetadata
    }
  }

  return publicRule
}

function toPublicConditionText(condition: Record<string, unknown> | null): string | null {
  if (!condition || typeof condition.key !== 'string') {
    return null
  }

  if (condition.key === 'grid.range_rebalance') {
    const params = isRecord(condition.params) ? condition.params : {}
    const rangeMin = readNumericParam(params, 'rangeMin') ?? readNumericParam(params, 'rangeLower')
    const rangeMax = readNumericParam(params, 'rangeMax') ?? readNumericParam(params, 'rangeUpper')
    const stepPct = readNumericParam(params, 'stepPct') ?? readNumericParam(params, 'gridStepPct')
    const parts: string[] = []
    if (rangeMin !== null && rangeMax !== null) {
      parts.push(`网格区间 ${formatNumber(rangeMin)}-${formatNumber(rangeMax)}`)
    }
    if (stepPct !== null) {
      parts.push(`间距 ${formatNumber(stepPct)}%`)
    }
    return parts.length > 0 ? parts.join('，') : '网格运行条件'
  }

  return '策略条件'
}

function readNumericParam(params: Record<string, unknown>, key: string): number | null {
  const value = params[key]
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string' && value.trim()) {
    const numeric = Number(value)
    return Number.isFinite(numeric) ? numeric : null
  }
  return null
}

function formatNumber(value: number): string {
  return Number(value.toFixed(8)).toString()
}

function readRuleConditionText(
  rule: Record<string, unknown>,
  conditionTextByRuleId: ReadonlyMap<string, string>,
): string | null {
  const id = typeof rule.id === 'string' ? rule.id.trim() : ''
  const displayText = id ? conditionTextByRuleId.get(id) : null
  if (displayText) {
    return displayText
  }

  const riskCondition = toPublicRiskCondition(rule)
  return riskCondition?.text ?? null
}

function toPublicAction(action: unknown): Record<string, unknown> | null {
  if (!isRecord(action)) {
    return null
  }

  const publicAction: Record<string, unknown> = {}
  copyStringField(action, publicAction, 'type')
  if (isRecord(action.sizing)) {
    publicAction.sizing = action.sizing
  }

  return publicAction
}

function toPublicCanonicalSpec(canonicalSpec: Record<string, unknown>): Record<string, unknown> {
  const publicCanonicalSpec: Record<string, unknown> = {}
  if (isRecord(canonicalSpec.market)) {
    publicCanonicalSpec.market = canonicalSpec.market
  }
  if (isRecord(canonicalSpec.sizing)) {
    publicCanonicalSpec.sizing = canonicalSpec.sizing
  }

  return publicCanonicalSpec
}

function readDisplayConditionTextByRuleId(displayLogicGraph: unknown): ReadonlyMap<string, string> {
  const graph = isRecord(displayLogicGraph) ? displayLogicGraph : null
  const blocks = Array.isArray(graph?.blocks) ? graph.blocks : []
  const conditionTextByRuleId = new Map<string, string>()
  for (const block of blocks) {
    const record = isRecord(block) ? block : null
    const items = Array.isArray(record?.items) ? record.items : []
    for (const item of items) {
      const itemRecord = isRecord(item) ? item : null
      if (itemRecord?.kind !== 'condition' || typeof itemRecord.id !== 'string' || typeof itemRecord.text !== 'string') {
        continue
      }
      const id = itemRecord.id.trim()
      const text = itemRecord.text.trim()
      const prefix = 'condition-'
      if (!id.startsWith(prefix) || text.length === 0) {
        continue
      }
      const ruleId = id.slice(prefix.length)
      if (ruleId && !conditionTextByRuleId.has(ruleId)) {
        conditionTextByRuleId.set(ruleId, text)
      }
    }
  }
  return conditionTextByRuleId
}

function toPublicRiskRules(rules: unknown[]): Record<string, unknown> {
  const publicRiskRules: Record<string, unknown> = {}
  for (const rule of rules) {
    const riskCondition = toPublicRiskCondition(rule)
    if (!riskCondition) {
      continue
    }
    if (riskCondition.type === 'stop_loss') {
      publicRiskRules.stopLossPct = riskCondition.valuePct
    }
    if (riskCondition.type === 'take_profit') {
      publicRiskRules.takeProfitPct = riskCondition.valuePct
    }
  }
  return publicRiskRules
}

function toPublicRiskCondition(rule: unknown): { text: string, type: string, valuePct: number } | null {
  if (!isRecord(rule) || rule.phase !== 'risk') {
    return null
  }
  const condition = isRecord(rule.condition) ? rule.condition : null
  if (!condition || typeof condition.key !== 'string') {
    return null
  }

  const valuePct = normalizePercent(condition.value)
  if (valuePct === null) {
    return null
  }

  switch (condition.key) {
    case 'position_loss_pct':
      return {
        text: `亏损达到 ${formatPercent(valuePct)}%`,
        type: 'stop_loss',
        valuePct,
      }
    case 'position_profit_pct':
      return {
        text: `盈利达到 ${formatPercent(valuePct)}%`,
        type: 'take_profit',
        valuePct,
      }
    default:
      return null
  }
}

function normalizePercent(value: unknown): number | null {
  const numeric = typeof value === 'number'
    ? value
    : (typeof value === 'string' && value.trim() ? Number(value) : NaN)
  if (!Number.isFinite(numeric)) {
    return null
  }
  return numeric <= 1 ? numeric * 100 : numeric
}

function formatPercent(value: number): string {
  return Number(value.toFixed(4)).toString()
}

function toPublicUnsupportedAtom(atom: unknown): Record<string, unknown> | null {
  if (!isRecord(atom)) {
    return null
  }

  const publicAtom: Record<string, unknown> = {}
  copyStringField(atom, publicAtom, 'displayName')
  copyStringField(atom, publicAtom, 'publicReason')
  return Object.keys(publicAtom).length > 0 ? publicAtom : null
}

function toPublicRecommendedStrategy(strategy: unknown): Record<string, unknown> | null {
  if (!isRecord(strategy)) {
    return null
  }

  const publicStrategy: Record<string, unknown> = {}
  copyStringField(strategy, publicStrategy, 'strategyKey')
  copyStringField(strategy, publicStrategy, 'description')
  return Object.keys(publicStrategy).length > 0 ? publicStrategy : null
}

function copyStringField(
  source: Record<string, unknown>,
  target: Record<string, unknown>,
  field: string,
): void {
  if (typeof source[field] === 'string') {
    target[field] = source[field]
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}
