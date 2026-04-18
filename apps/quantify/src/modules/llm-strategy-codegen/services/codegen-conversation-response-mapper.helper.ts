import type { CodegenSessionResponseDto } from '../dto/codegen-session.response.dto'

export interface PublishedSnapshotProjection {
  publishedSnapshotStrategyConfig: Record<string, unknown> | null
  publishedSnapshotBacktestConfigDefaults: Record<string, unknown> | null
  publishedSnapshotDeploymentExecutionDefaults: Record<string, unknown> | null
  publishedSnapshotDeploymentExecutionConstraints: Record<string, unknown> | null
  publishedSnapshotCompatibilityMetadata: Record<string, unknown> | null
}

export class CodegenConversationResponseMapperHelper {
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

  private readRecord(value: unknown): Record<string, unknown> | null {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      return null
    }

    return value as Record<string, unknown>
  }
}
