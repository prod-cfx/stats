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
  const checklist = {
    symbols: ['BTCUSDT'],
    timeframes: ['5m'],
    entryRules: ['短均线上穿长均线（金叉）时做多'],
    exitRules: ['短均线下穿长均线（死叉）时平多'],
    riskRules: { positionPct: 10 },
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
    }
    const gate = overrides?.gate ?? {
      publish: jest.fn().mockResolvedValue({
        snapshotId: 'snapshot-1',
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
      checklist,
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
      checklist,
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
      checklist,
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
      checklist,
      message: '生成策略',
      model: 'gpt-4.1',
    })

    expect(repo.createVersion).toHaveBeenCalled()
    expect(recommendationIndex.onSpecDescPersisted).toHaveBeenCalledWith(expect.objectContaining({
      versionId: 'version-1',
    }))
    expect(repo.ensureDraftStrategyInstanceBoundForPublishedSession).toHaveBeenCalled()
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
      checklist,
      message: '生成策略',
    })

    expect(gate.publish).not.toHaveBeenCalled()
    expect(repo.updateSession).toHaveBeenCalledWith('session-5', expect.objectContaining({
      status: 'REJECTED',
      rejectReason: 'bind failed',
    }))
  })
})
