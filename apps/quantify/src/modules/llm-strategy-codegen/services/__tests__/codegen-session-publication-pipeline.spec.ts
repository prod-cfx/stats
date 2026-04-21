import type { SemanticState } from '../../types/semantic-state'
import type { CompiledScriptParserService } from '../compiled-script-parser.service'
import { CanonicalSpecBuilderService } from '../canonical-spec-builder.service'
import { CanonicalSpecV2IrCompilerService } from '../canonical-spec-v2-ir-compiler.service'
import { CanonicalStrategyAstCompilerService } from '../canonical-strategy-ast-compiler.service'
import { CodegenSessionPublicationPipelineService } from '../codegen-session-publication-pipeline.service'
import { CompiledScriptEmitterService } from '../compiled-script-emitter.service'
import { CompiledScriptExecutionEnvelopeService } from '../compiled-script-execution-envelope.service'
import { SpecDescBuilderService } from '../spec-desc-builder.service'

jest.mock('../../repositories/published-strategy-snapshots.repository', () => ({
  PublishedStrategySnapshotsRepository: class PublishedStrategySnapshotsRepository {},
}))

describe('codegenSessionPublicationPipeline', () => {
  const semanticState: SemanticState = {
    version: 1,
    families: ['single-leg'],
    triggers: [
      {
        id: 'entry-bollinger-upper',
        key: 'bollinger.touch_upper',
        phase: 'entry',
        params: {
          indicator: 'bollinger',
          period: 30,
          stdDev: 2.5,
          confirmationMode: 'close_confirm',
        },
        sideScope: 'short',
        status: 'locked',
        source: 'user_explicit',
        openSlots: [],
      },
      {
        id: 'exit-bollinger-middle',
        key: 'bollinger.touch_middle',
        phase: 'exit',
        params: {
          indicator: 'bollinger',
          period: 30,
          stdDev: 2.5,
          confirmationMode: 'close_confirm',
        },
        sideScope: 'short',
        status: 'locked',
        source: 'user_explicit',
        openSlots: [],
      },
    ],
    actions: [
      { id: 'action-open-short', key: 'open_short', status: 'locked', source: 'user_explicit' },
      { id: 'action-close-short', key: 'close_short', status: 'locked', source: 'user_explicit' },
    ],
    risk: [],
    position: {
      mode: 'fixed_ratio',
      value: 0.1,
      positionMode: 'short_only',
      status: 'locked',
      source: 'user_explicit',
    },
    contextSlots: {
      exchange: {
        slotKey: 'exchange',
        fieldPath: 'contextSlots.exchange',
        value: 'okx',
        status: 'locked',
        priority: 'context',
        questionHint: '请确认交易所。',
        affectsExecution: true,
      },
      symbol: {
        slotKey: 'symbol',
        fieldPath: 'contextSlots.symbol',
        value: 'BTCUSDT',
        status: 'locked',
        priority: 'context',
        questionHint: '请确认交易标的。',
        affectsExecution: true,
      },
      marketType: {
        slotKey: 'marketType',
        fieldPath: 'contextSlots.marketType',
        value: 'perp',
        status: 'locked',
        priority: 'context',
        questionHint: '请确认市场类型。',
        affectsExecution: true,
      },
      timeframe: {
        slotKey: 'timeframe',
        fieldPath: 'contextSlots.timeframe',
        value: '5m',
        status: 'locked',
        priority: 'context',
        questionHint: '请确认周期。',
        affectsExecution: true,
      },
    },
    normalizationNotes: [],
    updatedAt: '2026-04-15T10:00:00.000Z',
  }

  const baseProfile = {
    indicators: [],
    actions: [],
    ruleMappings: [],
    rules: [],
    sizing: null,
    requiredParams: [],
    fallbackDetected: false,
  }

  const passedReport = {
    status: 'PASSED' as const,
    specProfile: baseProfile,
    scriptProfile: baseProfile,
    checks: [],
    summary: { criticalFailed: 0, warningFailed: 0, unprovable: 0 },
  }

  function createPipeline(overrides?: {
    parser?: { parse: jest.Mock }
    consistency?: { evaluate: jest.Mock }
    gate?: { publish: jest.Mock }
    repo?: Partial<Record<string, jest.Mock>>
  }) {
    const repo = {
      findSessionStrategyInstanceId: jest.fn().mockResolvedValue(null),
      updateSession: jest.fn().mockResolvedValue(undefined),
      createVersion: jest.fn().mockResolvedValue({ id: 'version-1' }),
      ensureDraftStrategyInstanceBoundForPublishedSession: jest.fn().mockResolvedValue({
        strategyTemplateId: 'template-1',
        strategyInstanceId: 'instance-1',
      }),
      bindPublishedSnapshotToStrategyInstance: jest.fn().mockResolvedValue(undefined),
      ...(overrides?.repo ?? {}),
    }
    const recommendationIndex = {
      onSpecDescPersisted: jest.fn().mockResolvedValue(undefined),
    }
    const parser = overrides?.parser ?? {
      parse: jest.fn().mockReturnValue({
        compiledManifest: {
          irHash: 'ir-hash',
          astDigest: 'ast-digest',
          specHash: 'spec-hash',
          structuralDigest: 'structural-digest',
        },
      }),
    }
    const consistency = overrides?.consistency ?? {
      evaluate: jest.fn().mockReturnValue(passedReport),
    }
    const summaryBuilder = {
      buildUserIntentSummary: jest.fn().mockReturnValue({ summary: 'intent' }),
      buildStrategySummary: jest.fn().mockReturnValue({ summary: 'strategy' }),
      buildScriptSummary: jest.fn().mockReturnValue({ summary: 'script' }),
      buildSummaryFromProfile: jest.fn().mockReturnValue({ summary: 'profile' }),
    }
    const summaryObservation = {
      build: jest.fn().mockReturnValue({ status: 'aligned', warnings: [], details: {} }),
    }
    const gate = overrides?.gate ?? {
      publish: jest.fn().mockResolvedValue({
        snapshotId: 'snapshot-1',
        snapshotHash: 'snapshot-hash-1',
        consistencyReport: { status: 'PASSED' },
      }),
    }

    const canonicalSpecBuilder = new CanonicalSpecBuilderService()
    const pipeline = new CodegenSessionPublicationPipelineService(
      repo as any,
      recommendationIndex as any,
      canonicalSpecBuilder,
      new SpecDescBuilderService(canonicalSpecBuilder),
      consistency as any,
      summaryBuilder as any,
      new CanonicalSpecV2IrCompilerService(),
      new CanonicalStrategyAstCompilerService(),
      new CompiledScriptEmitterService(),
      new CompiledScriptExecutionEnvelopeService(),
      parser as unknown as CompiledScriptParserService,
      summaryObservation as any,
      gate as any,
    )

    return { pipeline, repo, recommendationIndex, parser, consistency, gate }
  }

  it('marks rejected when compiled script structural validation fails', async () => {
    const { pipeline, repo } = createPipeline({
      parser: { parse: jest.fn().mockImplementation(() => { throw new Error('invalid compiled manifest') }) },
    })

    await pipeline.run({
      sessionId: 'session-1',
      userId: 'user-1',
      semanticState,
      message: '生成策略',
    })

    expect(repo.updateSession).toHaveBeenCalledWith('session-1', expect.objectContaining({
      status: 'REJECTED',
      rejectReason: expect.stringContaining('编译脚本结构校验失败'),
    }))
  })

  it('marks consistency failed when semantic consistency does not pass', async () => {
    const failedReport = {
      ...passedReport,
      status: 'FAILED' as const,
      checks: [{
        key: 'entry',
        level: 'critical' as const,
        status: 'failed' as const,
        expected: 'golden-cross',
        actual: 'death-cross',
        message: '入场规则不一致',
      }],
      summary: { criticalFailed: 1, warningFailed: 0, unprovable: 0 },
    }
    const { pipeline, repo } = createPipeline({
      consistency: { evaluate: jest.fn().mockReturnValue(failedReport) },
    })

    await pipeline.run({
      sessionId: 'session-2',
      userId: 'user-1',
      semanticState,
      message: '生成策略',
    })

    expect(repo.updateSession).toHaveBeenCalledWith('session-2', expect.objectContaining({
      status: 'CONSISTENCY_FAILED',
      rejectReason: expect.stringContaining('入场规则不一致'),
    }))
  })

  it('marks consistency failed when compiled publication gate returns failed consistency', async () => {
    const { pipeline, repo, gate } = createPipeline({
      gate: {
        publish: jest.fn().mockResolvedValue({
          snapshotId: 'snapshot-2',
          snapshotHash: 'snapshot-hash-2',
          consistencyReport: {
            status: 'FAILED',
            compilerConsistency: {
              graphVsIr: { passed: false },
              irVsScript: { passed: true },
              manifestSelfCheck: { passed: true },
            },
          },
        }),
      },
    })

    await pipeline.run({
      sessionId: 'session-3',
      userId: 'user-1',
      semanticState,
      message: '生成策略',
    })

    expect(gate.publish).toHaveBeenCalled()
    expect(repo.updateSession).toHaveBeenCalledWith('session-3', expect.objectContaining({
      status: 'CONSISTENCY_FAILED',
      rejectReason: expect.stringContaining('semantic view 与 IR 摘要不一致'),
    }))
  })

  it('publishes snapshot and binds strategy instance on success', async () => {
    const { pipeline, repo, recommendationIndex } = createPipeline()

    await pipeline.run({
      sessionId: 'session-4',
      userId: 'user-1',
      semanticState,
      message: '生成策略',
      model: 'gpt-4.1',
    })

    expect(repo.createVersion).toHaveBeenCalled()
    expect(recommendationIndex.onSpecDescPersisted).toHaveBeenCalledWith(expect.objectContaining({
      versionId: 'version-1',
    }))
    expect(repo.createVersion).toHaveBeenCalledWith(expect.objectContaining({
      specDesc: expect.objectContaining({
        normalizedIntent: expect.objectContaining({
          families: expect.any(Array),
        }),
      }),
    }))
    expect(JSON.stringify(repo.createVersion.mock.calls[0][0].specDesc)).not.toContain('entryRules')
    expect(JSON.stringify(repo.createVersion.mock.calls[0][0].specDesc)).not.toContain('exitRules')
    expect(JSON.stringify(repo.createVersion.mock.calls[0][0].specDesc)).not.toContain('riskRules')
    expect(repo.ensureDraftStrategyInstanceBoundForPublishedSession).toHaveBeenCalled()
    expect(repo.bindPublishedSnapshotToStrategyInstance).toHaveBeenCalledWith({
      strategyInstanceId: 'instance-1',
      userId: 'user-1',
      publishedSnapshotId: 'snapshot-1',
      snapshotHash: expect.any(String),
      strategyTemplateId: 'template-1',
    })
    expect(repo.updateSession).toHaveBeenCalledWith('session-4', expect.objectContaining({
      status: 'PUBLISHED',
      strategyInstanceId: 'instance-1',
      rejectReason: null,
    }))
  })

  it('marks rejected when strategy instance binding fails before publish', async () => {
    const { pipeline, repo, gate } = createPipeline({
      repo: {
        ensureDraftStrategyInstanceBoundForPublishedSession: jest.fn().mockRejectedValue(new Error('bind failed')),
      },
    })

    await pipeline.run({
      sessionId: 'session-5',
      userId: 'user-1',
      semanticState,
      message: '生成策略',
    })

    expect(gate.publish).not.toHaveBeenCalled()
    expect(repo.updateSession).toHaveBeenCalledWith('session-5', expect.objectContaining({
      status: 'REJECTED',
      rejectReason: 'bind failed',
    }))
  })
})
