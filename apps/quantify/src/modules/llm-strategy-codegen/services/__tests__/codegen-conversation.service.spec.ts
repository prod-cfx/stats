import type { ContinueCodegenSessionDto } from '../../dto/continue-codegen-session.dto'
import type { StartCodegenSessionDto } from '../../dto/start-codegen-session.dto'
import type { CodegenSessionsRepository } from '../../repositories/codegen-sessions.repository'
import type { PublishedStrategySnapshotsRepository } from '../../repositories/published-strategy-snapshots.repository'
import type { RecommendationIndexService } from '../recommendation-index.service'
import type { AiService } from '@/modules/ai/ai.service'
import { restoreProcessEnv, setProcessEnvValue, snapshotProcessEnv } from '@/common/env/env.accessor'
import { CanonicalSpecBuilderService } from '../canonical-spec-builder.service'
import { CanonicalSpecV2DigestService } from '../canonical-spec-v2-digest.service'
import { CanonicalSpecV2IrCompilerService } from '../canonical-spec-v2-ir-compiler.service'
import { CanonicalStrategyAstCompilerService } from '../canonical-strategy-ast-compiler.service'
import { CodegenConversationService } from '../codegen-conversation.service'
import { CodegenSessionPublicationPipelineService } from '../codegen-session-publication-pipeline.service'
import { CompiledPublicationGateService } from '../compiled-publication-gate.service'
import { CompiledScriptEmitterService } from '../compiled-script-emitter.service'
import { CompiledScriptExecutionEnvelopeService } from '../compiled-script-execution-envelope.service'
import { CompiledScriptParserService } from '../compiled-script-parser.service'
import { RuntimeGuardrailService } from '../runtime-guardrail.service'
import { ScriptProfileExtractorService } from '../script-profile-extractor.service'
import { SpecDescBuilderService } from '../spec-desc-builder.service'
import { StaticGuardrailService } from '../static-guardrail.service'
import { StrategyClarificationQuestionService } from '../strategy-clarification-question.service'
import { StrategyClarificationRulesService } from '../strategy-clarification-rules.service'
import { StrategyConsistencyService } from '../strategy-consistency.service'
import { StrategySummaryBuilderService } from '../strategy-summary-builder.service'

jest.mock('../../repositories/published-strategy-snapshots.repository', () => ({
  PublishedStrategySnapshotsRepository: class PublishedStrategySnapshotsRepository {},
}))

describe('codegenConversationService (llm orchestrated flow)', () => {
  jest.setTimeout(120_000)

  const envSnapshot = snapshotProcessEnv([
    'LLM_CODEGEN_STRICT_ENABLED',
    'LLM_CODEGEN_STRICT_FALLBACK',
    'LLM_CODEGEN_STRICT_UNSUPPORTED_TTL_MS',
  ])

  const mockRepo = {
    createSession: jest.fn(),
    findById: jest.fn(),
    updateSession: jest.fn(),
    tryMarkGenerating: jest.fn(),
    tryRequeueFromProcessing: jest.fn(),
    findSessionStrategyInstanceId: jest.fn(),
    bindStrategyInstanceIfEmpty: jest.fn(),
    createVersion: jest.fn(),
    create: jest.fn(),
    findLatestBySessionId: jest.fn(),
    createDraftStrategyInstanceFromPublishedSession: jest.fn().mockResolvedValue({
      strategyTemplateId: 'template-1',
      strategyInstanceId: 'instance-1',
    }),
    ensureDraftStrategyInstanceBoundForPublishedSession: jest.fn().mockResolvedValue({
      strategyTemplateId: 'template-1',
      strategyInstanceId: 'instance-1',
    }),
  }
  const mockAi = {
    chat: jest.fn(),
  }
  const mockRecommendation = {
    onSpecDescPersisted: jest.fn(),
  }
  const canonicalSpecBuilder = new CanonicalSpecBuilderService()
  const canonicalDigestService = new CanonicalSpecV2DigestService()
  const specDescBuilder = new SpecDescBuilderService(canonicalSpecBuilder)
  const publicationPipeline = new CodegenSessionPublicationPipelineService(
    mockRepo as unknown as CodegenSessionsRepository,
    mockRecommendation as unknown as RecommendationIndexService,
    canonicalSpecBuilder,
    specDescBuilder,
    new StrategyConsistencyService(new ScriptProfileExtractorService()),
    new StrategySummaryBuilderService(new ScriptProfileExtractorService()),
    new CanonicalSpecV2IrCompilerService(),
    new CanonicalStrategyAstCompilerService(),
    new CompiledScriptEmitterService(),
    new CompiledScriptExecutionEnvelopeService(),
    new CompiledScriptParserService(),
    new CompiledPublicationGateService(mockRepo as unknown as PublishedStrategySnapshotsRepository),
  )
  const buildConfirmedCanonicalDigest = (checklist: Record<string, unknown>): string => {
    return canonicalDigestService.hash(canonicalSpecBuilder.build(checklist))
  }
  const completeChecklist = (checklist: Record<string, any> = {}) => ({
    ...checklist,
    symbols: checklist.symbols ?? ['BTCUSDT'],
    timeframes: checklist.timeframes ?? ['1h'],
    riskRules: {
      exchange: 'okx',
      marketType: 'perp',
      ...(checklist.riskRules ?? {}),
    },
  })
  const withRequiredMarketContext = completeChecklist

  const service = new CodegenConversationService(
    mockAi as unknown as AiService,
    mockRepo as unknown as CodegenSessionsRepository,
    mockRepo as unknown as PublishedStrategySnapshotsRepository,
    new StaticGuardrailService(),
    new RuntimeGuardrailService(),
    specDescBuilder,
    canonicalSpecBuilder,
    new StrategyClarificationRulesService(),
    new StrategyClarificationQuestionService(),
    publicationPipeline,
  )
  const waitForTerminalStatus = async (
    sessionId: string,
    timeoutMs = 20_000,
  ): Promise<void> => {
    const startedAt = Date.now()
    while (Date.now() - startedAt <= timeoutMs) {
      const hasTerminal = mockRepo.updateSession.mock.calls.some((call) => {
        const currentId = call[0] as string
        const payload = call[1] as { status?: string }
        return currentId === sessionId
          && (payload.status === 'PUBLISHED' || payload.status === 'CONSISTENCY_FAILED' || payload.status === 'REJECTED')
      })
      if (hasTerminal) return
      await new Promise(resolve => setTimeout(resolve, 20))
    }

    throw new Error(`timed out waiting for terminal status: ${sessionId}`)
  }

  beforeEach(() => {
    jest.resetAllMocks()
    mockRepo.tryMarkGenerating.mockResolvedValue(true)
    mockRepo.tryRequeueFromProcessing.mockResolvedValue(false)
    mockRepo.findSessionStrategyInstanceId.mockResolvedValue(null)
    mockRepo.bindStrategyInstanceIfEmpty.mockResolvedValue(true)
    mockRepo.createVersion.mockResolvedValue({ id: 'version-1' })
    mockRepo.create.mockResolvedValue({
      id: 'snapshot-1',
      consistencyReport: {},
    })
    mockRepo.findLatestBySessionId.mockResolvedValue(null)
    mockRepo.createDraftStrategyInstanceFromPublishedSession.mockResolvedValue({
      strategyTemplateId: 'template-1',
      strategyInstanceId: 'instance-1',
    })
    mockRepo.ensureDraftStrategyInstanceBoundForPublishedSession.mockResolvedValue({
      strategyTemplateId: 'template-1',
      strategyInstanceId: 'instance-1',
    })
    setProcessEnvValue('LLM_CODEGEN_STRICT_ENABLED', 'false')
    setProcessEnvValue('LLM_CODEGEN_STRICT_FALLBACK', 'true')
  })

  afterEach(() => {
    jest.restoreAllMocks()
  })

  afterAll(() => {
    restoreProcessEnv(envSnapshot)
  })

  it('starts in drafting and asks next key question from llm planner', async () => {
    const dto: StartCodegenSessionDto = {
      userId: 'u1',
      initialMessage: '帮我做一个均线策略',
    }
    mockAi.chat.mockResolvedValue({
      content: JSON.stringify({
        related: true,
        logicReady: false,
        assistantPrompt: '先确认入场条件：例如 5/20 金叉。',
      }),
    })
    mockRepo.createSession.mockResolvedValue({ id: 's1' })

    const result = await service.startSession(dto)

    expect(result.status).toBe('DRAFTING')
    expect(result.missingFields).toEqual([])
    expect(result.assistantPrompt).toContain('先确认入场条件')
    expect(mockRepo.createSession).toHaveBeenCalledWith(expect.objectContaining({
      status: 'DRAFTING',
    }))
  })

  it('stays in DRAFTING when an entry rule can resolve to both OPEN_LONG and OPEN_SHORT', async () => {
    mockRepo.createSession.mockResolvedValue({ id: 's-clarify-1' })

    const result = await service.startSession({
      userId: 'u-1',
      initialMessage: '在okx交易所合约市场的BTCUSDT 15分钟图上，突破布林带上轨交易，仓位10%',
    })

    expect(result.status).toBe('DRAFTING')
    expect(result.assistantPrompt).toContain('当前这条规则还缺少方向约束')
    expect(result.assistantPrompt).toContain('是只做空，还是也允许做多')
  })

  it('preserves explicit direction in bollinger fallback inference and does not ask direction clarification', async () => {
    mockRepo.createSession.mockResolvedValue({ id: 's-clarify-2' })

    const result = await service.startSession({
      userId: 'u-1',
      initialMessage: '在okx交易所合约市场的BTCUSDT 15分钟图上，突破布林带上轨做空，仓位10%',
    })

    expect(result.status).toBe('DRAFTING')
    expect(result.assistantPrompt).not.toContain('缺少方向约束')
    expect(mockRepo.createSession).toHaveBeenCalledWith(expect.objectContaining({
      checklist: expect.objectContaining({
        entryRules: ['K线收盘后确认突破布林带上轨时做空'],
      }),
      clarificationState: expect.objectContaining({ status: 'CLEAR' }),
    }))
  })

  it('captures exchange and risk clauses from natural language without bypassing clarification flow', async () => {
    mockRepo.createSession.mockResolvedValue({ id: 's-real-pipeline-1' })

    const result = await service.startSession({
      userId: 'u-1',
      initialMessage:
        '在okx交易所合约市场，交易对BTCUSDT 15分钟图上，突破布林带上轨做空、突破下轨做多，仓位10%；出场条件为价格回到布林带中轨（MA20）平仓、亏损≥5%强制止损，以及价格连续3根K线在轨外时提前止损或减仓。',
    })

    expect(result.status).toBe('DRAFTING')
    expect(result.assistantPrompt).toContain('缺少方向约束')
    expect(mockRepo.createSession).toHaveBeenCalledWith(expect.objectContaining({
      checklist: expect.objectContaining({
        symbols: ['BTCUSDT'],
        timeframes: ['15m'],
        riskRules: expect.objectContaining({
          exchange: 'okx',
          positionPct: 10,
          stopLossPct: 5,
          earlyStop: expect.stringContaining('连续3根K线'),
        }),
      }),
      clarificationState: expect.objectContaining({ status: 'NEEDS_CLARIFICATION' }),
    }))
  })

  it('keeps direction ambiguous when only exit wording includes sell action', async () => {
    mockRepo.createSession.mockResolvedValue({ id: 's-clarify-3' })

    const result = await service.startSession({
      userId: 'u-1',
      initialMessage: '在okx交易所合约市场的BTCUSDT 15分钟图上，突破布林带上轨交易，回到中轨卖出，仓位10%',
    })

    expect(result.status).toBe('DRAFTING')
    expect(result.assistantPrompt).toContain('缺少方向约束')
    expect(mockRepo.createSession).toHaveBeenCalledWith(expect.objectContaining({
      checklist: expect.objectContaining({
        entryRules: ['突破布林带上轨交易'],
      }),
      clarificationState: expect.objectContaining({ status: 'NEEDS_CLARIFICATION' }),
    }))
  })

  it('keeps direction ambiguous for same-sentence no-comma exit wording after upper-band trigger', async () => {
    mockRepo.createSession.mockResolvedValue({ id: 's-clarify-4' })

    const result = await service.startSession({
      userId: 'u-1',
      initialMessage: '在okx交易所合约市场的BTCUSDT 15分钟图上，突破布林带上轨交易后回到中轨卖出，仓位10%',
    })

    expect(result.status).toBe('DRAFTING')
    expect(result.assistantPrompt).toContain('缺少方向约束')
    expect(mockRepo.createSession).toHaveBeenCalledWith(expect.objectContaining({
      checklist: expect.objectContaining({
        entryRules: ['突破布林带上轨交易'],
      }),
      clarificationState: expect.objectContaining({ status: 'NEEDS_CLARIFICATION' }),
    }))
  })

  it('starts in checklist gate when llm says logic is ready', async () => {
    const dto: StartCodegenSessionDto = {
      userId: 'u1',
      initialMessage: '在okx交易所合约市场的BTCUSDT 3分钟图上，3分钟跌1%做多，5分钟涨2%平多',
    }
    mockAi.chat.mockResolvedValue({
      content: JSON.stringify({
        related: true,
        logicReady: true,
        assistantPrompt: '策略逻辑已完整，请确认逻辑图。',
        logic: {
          entryRules: ['3m 内下跌 1% 做多'],
          exitRules: ['5m 内上涨 2% 平多'],
          riskRules: { exchange: 'okx', marketType: 'perp' },
        },
      }),
    })
    mockRepo.createSession.mockResolvedValue({ id: 's2' })

    const result = await service.startSession(dto)

    expect(result.status).toBe('CHECKLIST_GATE')
    expect(result.specDesc).toBeTruthy()
    expect(result.canonicalDigest).toMatch(/^sha256:/)
    expect(result.specDesc).toEqual(expect.objectContaining({
      viewType: 'canonical-semantic-view.v1',
      canonicalDigest: result.canonicalDigest,
      confirmation: expect.objectContaining({
        required: true,
        digest: result.canonicalDigest,
      }),
    }))
    expect(result.assistantPrompt).toContain('确认逻辑图')
  })

  it('stays in drafting when planner says logicReady is false even with a detailed message', async () => {
    const dto: StartCodegenSessionDto = {
      userId: 'u1',
      initialMessage: [
        '平台：OKX',
        '类型：现货',
        '交易对：SOL/USDT',
        '账户余额：1000 USDT',
        '开仓：市价买入 100 USDT',
        '交易周期：5 分钟',
        '止盈：涨幅达到 2% 市价卖出',
        '止损：最大亏损 10% 市价卖出',
      ].join('\n'),
    }
    mockAi.chat.mockResolvedValue({
      content: JSON.stringify({
        related: true,
        logicReady: false,
        assistantPrompt: '为了完善策略，请补充短均线和长均线周期。',
      }),
    })
    mockRepo.createSession.mockResolvedValue({ id: 's-execution-template' })

    const result = await service.startSession(dto)

    expect(result.status).toBe('DRAFTING')
    expect(mockRepo.createSession).toHaveBeenCalledWith(expect.objectContaining({
      status: 'DRAFTING',
      checklist: expect.objectContaining({
        timeframes: ['5m'],
        entryRules: expect.arrayContaining([expect.any(String)]),
      }),
    }))
  })

  it('does not infer ma rules from pure price-action message in a new session', async () => {
    const dto: StartCodegenSessionDto = {
      userId: 'u1',
      initialMessage: '在BTCUSDT的3m和15m周期，价格收盘高于关键阻力位入场，跌破最近支撑位出场',
    }
    mockAi.chat.mockResolvedValue({
      content: JSON.stringify({
        related: true,
        logicReady: false,
        assistantPrompt: '继续补充风险参数。',
      }),
    })
    mockRepo.createSession.mockResolvedValue({ id: 's-price-action' })

    await service.startSession(dto)

    expect(mockRepo.createSession).toHaveBeenCalledWith(expect.objectContaining({
      checklist: expect.objectContaining({
        symbols: ['BTCUSDT'],
        timeframes: ['3m', '15m'],
        entryRules: ['价格收盘确认突破关键阻力位入场'],
        exitRules: ['价格跌破关键支撑位出场'],
      }),
    }))
    const payload = mockRepo.createSession.mock.calls[0]?.[0] as { checklist?: { entryRules?: string[]; exitRules?: string[] } }
    expect(payload.checklist?.entryRules?.join(' ')).not.toContain('均线')
    expect(payload.checklist?.exitRules?.join(' ')).not.toContain('均线')
  })

  it('returns strategyInstanceId in session snapshot response', async () => {
    mockRepo.findLatestBySessionId.mockResolvedValue({
      id: 'snapshot-session-1',
      consistencyReport: {
        status: 'PASSED',
      },
    })
    mockRepo.findById.mockResolvedValue({
      id: 's-snapshot',
      userId: 'u1',
      status: 'PUBLISHED',
      checklist: {},
      constraintPack: {},
      latestDraftCode: 'return null',
      latestSpecDesc: {
        publishedSnapshotId: 'snapshot-session-old',
        consistencyReport: { status: 'FAILED' },
      },
      strategyInstanceId: 'instance-snapshot-1',
      clarificationState: {
        status: 'NEEDS_CLARIFICATION',
        items: [
          {
            key: 'rule.entry.upper_band.side_scope',
            reason: 'direction_ambiguous',
            field: 'positionMode',
            blocking: true,
            question: '突破上轨时是只做空还是也允许做多？',
            status: 'pending',
          },
          {
            key: 'riskRules.earlyStop.action',
            reason: 'ambiguous_risk_effect',
            field: 'riskRules.earlyStop.action',
            blocking: true,
            allowedAnswers: ['reduce', 'close'],
            question: '轨外连续3根K线时，应执行减仓还是直接平仓？',
            status: 'pending',
          },
        ],
      },
      rejectReason: null,
    })

    const result = await service.getSession('s-snapshot', 'u1')

    expect(result.status).toBe('PUBLISHED')
    expect(result.strategyInstanceId).toBe('instance-snapshot-1')
    expect(result.clarificationState).toEqual({
      status: 'NEEDS_CLARIFICATION',
      items: [
        expect.objectContaining({
          key: 'rule.entry.upper_band.side_scope',
          field: 'positionMode',
          blocking: true,
          status: 'pending',
        }),
        expect.objectContaining({
          key: 'riskRules.earlyStop.action',
          field: 'riskRules.earlyStop.action',
          blocking: true,
          allowedAnswers: ['reduce', 'close'],
        }),
      ],
    })
    expect(result.publishedSnapshotId).toBe('snapshot-session-1')
    expect(result.consistencyReport).toEqual({ status: 'PASSED' })
  })

  it('keeps legacy clarification items without field/blocking via backward-compatible normalization', async () => {
    mockRepo.findById.mockResolvedValue({
      id: 's-invalid-clarification',
      userId: 'u1',
      status: 'DRAFTING',
      checklist: {},
      constraintPack: {},
      latestDraftCode: null,
      latestSpecDesc: null,
      strategyInstanceId: null,
      clarificationState: {
        status: 'NEEDS_CLARIFICATION',
        items: [
          {
            key: 'entry.side.1',
            reason: 'missing_side_scope',
            question: '突破上轨时是只做空，还是也允许做多？',
            allowedAnswers: ['long', 'short'],
            status: 'pending',
          },
          {
            key: 'riskRules.earlyStop.action',
            reason: 'ambiguous_risk_effect',
            question: '轨外连续3根K线时，应执行减仓还是直接平仓？',
            status: 'pending',
          },
        ],
      },
      rejectReason: null,
    })

    const result = await service.getSession('s-invalid-clarification', 'u1')

    expect(result.clarificationState).toEqual({
      status: 'NEEDS_CLARIFICATION',
      items: [
        expect.objectContaining({
          key: 'entry.side.1',
          reason: 'missing_side_scope',
          field: 'positionMode',
          blocking: true,
          allowedAnswers: ['long', 'short'],
          status: 'pending',
        }),
        expect.objectContaining({
          key: 'riskRules.earlyStop.action',
          reason: 'ambiguous_risk_effect',
          field: 'riskRules.earlyStop.action',
          blocking: true,
          allowedAnswers: ['reduce', 'close'],
          status: 'pending',
        }),
      ],
    })
  })

  it('hides semantic confirmation fields when blocking clarification items remain in snapshot', async () => {
    mockRepo.findById.mockResolvedValue({
      id: 's-blocked-clarification',
      userId: 'u1',
      status: 'CHECKLIST_GATE',
      checklist: {
        entryRules: ['突破布林带上轨交易'],
        exitRules: ['价格回到布林带中轨(MA20)时平仓'],
      },
      constraintPack: {},
      latestDraftCode: null,
      latestSpecDesc: {
        viewType: 'canonical-semantic-view.v1',
        canonicalDigest: 'sha256:blocked',
        confirmation: {
          required: true,
          digest: 'sha256:blocked',
        },
      },
      clarificationState: {
        status: 'NEEDS_CLARIFICATION',
        items: [
          {
            key: 'entry.side.1',
            reason: 'missing_side_scope',
            field: 'positionMode',
            blocking: true,
            question: '突破上轨时是只做空，还是也允许做多？',
            allowedAnswers: ['long', 'short'],
            status: 'pending',
          },
        ],
      },
      strategyInstanceId: null,
      rejectReason: null,
    })

    const result = await service.getSession('s-blocked-clarification', 'u1')

    expect((result as any).clarificationGate).toEqual({
      blocked: true,
      items: [
        expect.objectContaining({
          key: 'entry.side.1',
          status: 'pending',
          blocking: true,
        }),
      ],
      pendingItems: [
        expect.objectContaining({
          key: 'entry.side.1',
          status: 'pending',
          blocking: true,
        }),
      ],
    })
    expect(result.specDesc).toBeNull()
    expect(result.canonicalDigest).toBeNull()
    expect(result.semanticGraph).toBeNull()
  })

  it('applies clarificationAnswers before semantic readiness evaluation', async () => {
    mockRepo.findById.mockResolvedValue({
      id: 's-clarification-answers',
      userId: 'u1',
      status: 'DRAFTING',
      checklist: {
        symbols: ['BTCUSDT'],
        timeframes: ['15m'],
        entryRules: ['突破布林带上轨交易'],
        exitRules: ['价格回到布林带中轨(MA20)时平仓'],
        riskRules: {
          exchange: 'okx',
          marketType: 'perp',
        },
      },
      clarificationState: {
        status: 'NEEDS_CLARIFICATION',
        items: [
          {
            key: 'entry.side.1',
            reason: 'missing_side_scope',
            field: 'positionMode',
            blocking: true,
            question: '突破上轨时是只做空，还是也允许做多？',
            allowedAnswers: ['long', 'short'],
            status: 'pending',
          },
        ],
      },
      constraintPack: {},
    })
    mockAi.chat.mockResolvedValue({
      content: JSON.stringify({
        related: true,
        logicReady: true,
        assistantPrompt: '逻辑已整理完毕，请确认逻辑图。',
      }),
    })

    const result = await service.continueSession('s-clarification-answers', {
      userId: 'u1',
      message: '继续',
      clarificationAnswers: {
        'entry.side.1': 'short',
      },
    } as ContinueCodegenSessionDto)

    expect(result.status).toBe('CHECKLIST_GATE')
    expect(result.clarificationState).toEqual(expect.objectContaining({
      status: 'CLEAR',
    }))
    expect((result as any).clarificationGate).toEqual({
      blocked: false,
      items: [],
      pendingItems: [],
    })
    expect(result.specDesc).toBeTruthy()
    expect(result.canonicalDigest).toMatch(/^sha256:/)
    expect(mockRepo.updateSession).toHaveBeenCalledWith('s-clarification-answers', expect.objectContaining({
      status: 'CHECKLIST_GATE',
      checklist: expect.objectContaining({
        entryRules: expect.arrayContaining([expect.stringContaining('做空')]),
      }),
    }))
  })

  it('applies action uniqueness clarification to the targeted entry rule only', async () => {
    mockRepo.findById.mockResolvedValue({
      id: 's-clarification-action-uniqueness',
      userId: 'u1',
      status: 'DRAFTING',
      checklist: {
        symbols: ['BTCUSDT'],
        timeframes: ['15m'],
        entryRules: ['突破后同时做多和做空', '跌破下轨时做多'],
        exitRules: ['价格回到布林带中轨(MA20)时平仓'],
        riskRules: {
          exchange: 'okx',
          marketType: 'perp',
        },
      },
      clarificationState: {
        status: 'NEEDS_CLARIFICATION',
        items: [
          {
            key: 'entry.action_uniqueness.1',
            ruleId: 'entry-1',
            reason: 'missing_action_uniqueness',
            field: 'positionMode',
            allowedAnswers: ['long', 'short'],
            blocking: true,
            question: '这条入场规则同时包含做多和做空，请确认最终只保留哪个方向？',
            status: 'pending',
          },
        ],
      },
      constraintPack: {},
    })
    mockAi.chat.mockResolvedValue({
      content: JSON.stringify({
        related: true,
        logicReady: true,
        assistantPrompt: '逻辑已整理完毕，请确认逻辑图。',
      }),
    })

    const result = await service.continueSession('s-clarification-action-uniqueness', {
      userId: 'u1',
      message: '继续',
      clarificationAnswers: {
        'entry.action_uniqueness.1': 'short',
      },
    } as ContinueCodegenSessionDto)

    expect(result.status).toBe('CHECKLIST_GATE')
    expect(mockRepo.updateSession).toHaveBeenCalledWith(
      's-clarification-action-uniqueness',
      expect.objectContaining({
        checklist: expect.objectContaining({
          entryRules: expect.arrayContaining([
            expect.stringContaining('做空'),
            '跌破下轨时做多',
          ]),
        }),
      }),
    )
  })

  it('preserves extra rule conditions when applying entry-side clarification answers', async () => {
    mockRepo.findById.mockResolvedValue({
      id: 's-clarification-extra-condition',
      userId: 'u1',
      status: 'DRAFTING',
      checklist: withRequiredMarketContext({
        entryRules: ['突破布林带上轨且 RSI > 70 时交易'],
        exitRules: ['价格回到布林带中轨(MA20)时平仓'],
      }),
      clarificationState: {
        status: 'NEEDS_CLARIFICATION',
        items: [
          {
            key: 'entry.side.1',
            ruleId: 'entry-1',
            reason: 'missing_side_scope',
            field: 'positionMode',
            allowedAnswers: ['long', 'short'],
            blocking: true,
            question: '突破上轨时是只做空，还是也允许做多？',
            status: 'pending',
          },
        ],
      },
      constraintPack: {},
    })
    mockAi.chat.mockResolvedValue({
      content: JSON.stringify({
        related: true,
        logicReady: true,
        assistantPrompt: '逻辑已整理完毕，请确认逻辑图。',
      }),
    })

    await service.continueSession('s-clarification-extra-condition', {
      userId: 'u1',
      message: '继续',
      clarificationAnswers: {
        'entry.side.1': 'short',
      },
    } as ContinueCodegenSessionDto)

    expect(mockRepo.updateSession).toHaveBeenCalledWith(
      's-clarification-extra-condition',
      expect.objectContaining({
        checklist: expect.objectContaining({
          entryRules: expect.arrayContaining([
            expect.stringContaining('RSI > 70'),
            expect.stringContaining('做空'),
          ]),
        }),
      }),
    )
  })

  it('persists structured clarification answers even when planner marks the short reply unrelated', async () => {
    mockRepo.findById.mockResolvedValue({
      id: 's-clarification-unrelated-answer',
      userId: 'u1',
      status: 'DRAFTING',
      checklist: {
        symbols: ['BTCUSDT'],
        timeframes: ['15m'],
        entryRules: ['突破布林带上轨交易'],
        exitRules: ['价格回到布林带中轨(MA20)时平仓'],
        riskRules: {
          exchange: 'okx',
          marketType: 'perp',
        },
      },
      clarificationState: {
        status: 'NEEDS_CLARIFICATION',
        items: [
          {
            key: 'entry.side.1',
            ruleId: 'entry-1',
            reason: 'missing_side_scope',
            field: 'positionMode',
            allowedAnswers: ['long', 'short'],
            blocking: true,
            question: '突破上轨时是只做空，还是也允许做多？',
            status: 'pending',
          },
        ],
      },
      constraintPack: {},
    })
    mockAi.chat.mockResolvedValue({
      content: JSON.stringify({
        related: false,
        logicReady: false,
        assistantPrompt: '这条消息和策略无关，请继续描述交易逻辑。',
      }),
    })

    const result = await service.continueSession('s-clarification-unrelated-answer', {
      userId: 'u1',
      message: 'short',
      clarificationAnswers: {
        'entry.side.1': 'short',
      },
    } as ContinueCodegenSessionDto)

    expect(result.status).toBe('CHECKLIST_GATE')
    expect(result.canonicalDigest).toMatch(/^sha256:/)
    expect((result as any).clarificationGate).toEqual({
      blocked: false,
      items: [],
      pendingItems: [],
    })
    expect(mockRepo.updateSession).toHaveBeenCalledWith(
      's-clarification-unrelated-answer',
      expect.objectContaining({
        status: 'CHECKLIST_GATE',
        checklist: expect.objectContaining({
          entryRules: expect.arrayContaining([expect.stringContaining('做空')]),
        }),
      }),
    )
  })

  it('turns merged market metadata drift into a blocking clarification item', async () => {
    mockRepo.findById.mockResolvedValue({
      id: 's-market-scope-conflict',
      userId: 'u1',
      status: 'DRAFTING',
      checklist: withRequiredMarketContext({
        entryRules: ['价格突破阻力位入场'],
        exitRules: ['跌破支撑位出场'],
      }),
      clarificationState: { status: 'CLEAR', items: [] },
      constraintPack: {},
    })
    mockAi.chat.mockResolvedValue({
      content: JSON.stringify({
        related: true,
        logicReady: true,
        assistantPrompt: '逻辑已整理完毕，请确认逻辑图。',
        logic: {
          riskRules: {
            exchange: 'binance',
          },
        },
      }),
    })

    const result = await service.continueSession('s-market-scope-conflict', {
      userId: 'u1',
      message: '改成 Binance',
    })

    expect(result.status).toBe('DRAFTING')
    expect(result.clarificationState).toEqual(expect.objectContaining({
      status: 'NEEDS_CLARIFICATION',
      items: expect.arrayContaining([
        expect.objectContaining({
          key: 'market.conflict.exchange',
          reason: 'conflicting_market_scope',
          allowedAnswers: ['okx', 'binance'],
        }),
      ]),
    }))
  })

  it('keeps drafting when structured clarification answers still leave required fields missing', async () => {
    mockRepo.findById.mockResolvedValue({
      id: 's-clarification-missing-fields',
      userId: 'u1',
      status: 'DRAFTING',
      checklist: {
        symbols: ['BTCUSDT'],
        timeframes: ['15m'],
        entryRules: ['突破布林带上轨交易'],
        riskRules: {
          exchange: 'okx',
          marketType: 'perp',
        },
      },
      clarificationState: {
        status: 'NEEDS_CLARIFICATION',
        items: [
          {
            key: 'entry.side.1',
            ruleId: 'entry-1',
            reason: 'missing_side_scope',
            field: 'positionMode',
            allowedAnswers: ['long', 'short'],
            blocking: true,
            question: '突破上轨时是只做空，还是也允许做多？',
            status: 'pending',
          },
        ],
      },
      constraintPack: {},
    })
    mockAi.chat.mockResolvedValue({
      content: JSON.stringify({
        related: false,
        logicReady: false,
        assistantPrompt: '这条消息和策略无关，请继续描述交易逻辑。',
      }),
    })

    const result = await service.continueSession('s-clarification-missing-fields', {
      userId: 'u1',
      message: 'short',
      clarificationAnswers: {
        'entry.side.1': 'short',
      },
    } as ContinueCodegenSessionDto)

    expect(result.status).toBe('DRAFTING')
    expect(result.missingFields).toEqual(expect.arrayContaining(['exitRules']))
    expect(result.canonicalDigest ?? null).toBeNull()
  })

  it('surfaces publicationGate at the top level when stored in latestSpecDesc', async () => {
    mockRepo.findById.mockResolvedValue({
      id: 's-publication-gate',
      userId: 'u1',
      status: 'REJECTED',
      checklist: {},
      latestSpecDesc: {
        publicationGate: {
          passed: false,
          blockingMismatches: [
            {
              field: 'exchange',
              expected: 'okx',
              actual: 'binance',
              reason: 'confirmed snapshot and compiled artifact exchange mismatch',
            },
          ],
        },
      },
      rejectReason: 'publication gate blocked',
      clarificationState: {
        status: 'CLEAR',
        items: [],
      },
      strategyInstanceId: null,
    })

    const result = await service.getSession('s-publication-gate', 'u1')

    expect((result as any).publicationGate).toEqual({
      passed: false,
      blockingMismatches: [
        expect.objectContaining({
          field: 'exchange',
          expected: 'okx',
          actual: 'binance',
        }),
      ],
    })
  })

  it('keeps drafting and returns unrelated guidance when planner marks message unrelated', async () => {
    mockRepo.findById.mockResolvedValue({
      id: 's3',
      userId: 'u1',
      status: 'DRAFTING',
      checklist: {},
      clarificationState: {
        status: 'NEEDS_CLARIFICATION',
        items: [
          {
            key: 'market.marketType',
            reason: 'missing_market_type',
            field: 'marketType',
            blocking: true,
            allowedAnswers: ['spot', 'perp'],
            question: '该策略运行在现货还是合约市场？',
            status: 'pending',
          },
        ],
      },
      constraintPack: {},
    })
    mockAi.chat.mockResolvedValue({
      content: JSON.stringify({
        related: false,
        logicReady: false,
        assistantPrompt: '这条消息和策略无关，请继续描述交易逻辑。',
      }),
    })

    const result = await service.continueSession('s3', {
      userId: 'u1',
      message: 'hi',
    })

    expect(result.status).toBe('DRAFTING')
    expect(result.assistantPrompt).toContain('无关')
    expect((result as any).clarificationGate).toEqual({
      blocked: true,
      items: [
        expect.objectContaining({
          key: 'market.marketType',
          status: 'pending',
          blocking: true,
        }),
      ],
      pendingItems: [
        expect.objectContaining({
          key: 'market.marketType',
          status: 'pending',
          blocking: true,
        }),
      ],
    })
    expect(result.canonicalDigest).toBeNull()
    expect(mockRepo.updateSession).not.toHaveBeenCalled()
  })

  it('moves to checklist gate when llm planner marks logic ready', async () => {
    mockRepo.findById.mockResolvedValue({
      id: 's4',
      userId: 'u1',
      status: 'DRAFTING',
      checklist: completeChecklist({}),
      constraintPack: {},
    })
    mockAi.chat.mockResolvedValue({
      content: JSON.stringify({
        related: true,
        logicReady: true,
        assistantPrompt: '逻辑已整理完毕，请确认逻辑图。',
        logic: {
          entryRules: ['短均线上穿长均线（金叉）时做多'],
          exitRules: ['短均线下穿长均线（死叉）时平多'],
          riskRules: { exchange: 'okx', marketType: 'perp' },
        },
      }),
    })

    const result = await service.continueSession('s4', {
      userId: 'u1',
      message: '入场用金叉，出场用死叉',
    })

    expect(result.status).toBe('CHECKLIST_GATE')
    expect(result.specDesc).toBeTruthy()
    expect(result.assistantPrompt).toContain('确认逻辑图')
    expect(mockRepo.updateSession).toHaveBeenCalledWith('s4', expect.objectContaining({
      status: 'CHECKLIST_GATE',
    }))
  })

  it('keeps drafting in continueSession when planner returns logic that requires clarification', async () => {
    mockRepo.findById.mockResolvedValue({
      id: 's4-clarify',
      userId: 'u1',
      status: 'DRAFTING',
      checklist: completeChecklist({}),
      constraintPack: {},
    })
    mockAi.chat.mockResolvedValue({
      content: JSON.stringify({
        related: true,
        logicReady: true,
        assistantPrompt: '逻辑已整理完毕，请确认逻辑图。',
        logic: {
          entryRules: ['突破布林带上轨交易'],
          exitRules: ['价格回到布林带中轨(MA20)时平仓'],
        },
      }),
    })

    const result = await service.continueSession('s4-clarify', {
      userId: 'u1',
      message: '就按这个逻辑推进',
    })

    expect(result.status).toBe('DRAFTING')
    expect(result.assistantPrompt).toContain('缺少方向约束')
    expect(result.clarificationState).toEqual(expect.objectContaining({
      status: 'NEEDS_CLARIFICATION',
    }))
    expect(mockRepo.updateSession).toHaveBeenCalledWith('s4-clarify', expect.objectContaining({
      status: 'DRAFTING',
      clarificationState: expect.objectContaining({
        status: 'NEEDS_CLARIFICATION',
      }),
    }))
    expect(mockRepo.updateSession).not.toHaveBeenCalledWith('s4-clarify', expect.objectContaining({
      status: 'CHECKLIST_GATE',
    }))
  })

  it('publishes after confirmGenerate without making a second llm codegen call', async () => {
    mockAi.chat
      .mockResolvedValueOnce({
        content: JSON.stringify({
          related: true,
          logicReady: true,
          assistantPrompt: '已确认逻辑，开始生成。',
          logic: {
            symbols: ['BTCUSDT'],
            timeframes: ['1h'],
            entryRules: ['短均线上穿长均线（金叉）时做多'],
            exitRules: ['短均线下穿长均线（死叉）时平多'],
            riskRules: {
              exchange: 'okx',
              marketType: 'perp',
            },
          },
        }),
      })
    mockRepo.createSession.mockResolvedValue({ id: 's5' })
    mockRepo.createVersion.mockResolvedValue({ id: 'v1' })

    const started = await service.startSession({
      userId: 'u1',
      initialMessage: '在okx交易所合约市场的BTCUSDT 1小时图上，短均线上穿长均线（金叉）时做多，短均线下穿长均线（死叉）时平多',
    })

    expect(started.status).toBe('CHECKLIST_GATE')
    expect(started.canonicalDigest).toMatch(/^sha256:/)

    mockRepo.findById.mockResolvedValue({
      id: 's5',
      userId: 'u1',
      status: 'CHECKLIST_GATE',
      checklist: completeChecklist({
        entryRules: ['短均线上穿长均线（金叉）时做多'],
        exitRules: ['短均线下穿长均线（死叉）时平多'],
      }),
      constraintPack: {},
    })

    const dto: ContinueCodegenSessionDto = {
      userId: 'u1',
      message: '确认逻辑图',
      confirmGenerate: true,
      confirmedCanonicalDigest: started.canonicalDigest ?? undefined,
    }
    const result = await service.continueSession('s5', dto)

    expect(result.status).toBe('GENERATING')
    expect(mockRepo.tryMarkGenerating).toHaveBeenCalledWith('s5', expect.objectContaining({
      status: 'GENERATING',
      latestSpecDesc: expect.objectContaining({
        viewType: 'canonical-semantic-view.v1',
      }),
    }))
    await waitForTerminalStatus('s5')

    expect(mockRepo.createVersion).toHaveBeenCalled()
    expect(mockRepo.updateSession).toHaveBeenCalledWith('s5', expect.objectContaining({
      status: 'PUBLISHED',
    }))
    expect(mockAi.chat).toHaveBeenCalledTimes(1)
  })

  it('publishes canonical snapshot, semantic view, and compiled artifacts after confirmGenerate', async () => {
    mockAi.chat
      .mockResolvedValueOnce({
        content: JSON.stringify({
          related: true,
          logicReady: true,
          assistantPrompt: '已确认逻辑，开始生成。',
          logic: {
            symbols: ['BTCUSDT'],
            timeframes: ['1h'],
            entryRules: ['短均线上穿长均线（金叉）时做多'],
            exitRules: ['短均线下穿长均线（死叉）时平多'],
            riskRules: {
              exchange: 'okx',
              marketType: 'perp',
            },
          },
        }),
      })
    mockRepo.createSession.mockResolvedValue({ id: 's5-compiled' })
    mockRepo.createVersion.mockResolvedValue({ id: 'v-compiled' })

    const started = await service.startSession({
      userId: 'u1',
      initialMessage: '在okx交易所合约市场的BTCUSDT 1小时图上，短均线上穿长均线（金叉）时做多，短均线下穿长均线（死叉）时平多',
    })

    mockRepo.findById.mockResolvedValue({
      id: 's5-compiled',
      userId: 'u1',
      status: 'CHECKLIST_GATE',
      checklist: completeChecklist({
        entryRules: ['短均线上穿长均线（金叉）时做多'],
        exitRules: ['短均线下穿长均线（死叉）时平多'],
      }),
      constraintPack: {},
    })

    await service.continueSession('s5-compiled', {
      userId: 'u1',
      message: '确认逻辑图',
      confirmGenerate: true,
      confirmedCanonicalDigest: started.canonicalDigest ?? undefined,
    })

    await waitForTerminalStatus('s5-compiled')

    expect(mockRepo.create).toHaveBeenCalledWith(expect.objectContaining({
      specSnapshot: expect.objectContaining({
        version: 2,
      }),
      semanticGraph: expect.objectContaining({
        viewType: 'canonical-semantic-view.v1',
        canonicalDigest: started.canonicalDigest,
      }),
      compiledIr: expect.objectContaining({
        irVersion: 'csi.v1',
        source: expect.objectContaining({
          specHash: expect.stringMatching(/^sha256:/),
        }),
      }),
      irSnapshot: expect.objectContaining({
        irVersion: 'csi.v1',
      }),
      astSnapshot: expect.objectContaining({
        astVersion: 'csa.v1',
      }),
      executionEnvelope: expect.objectContaining({
        positionMode: 'long_only',
      }),
      scriptSnapshot: expect.stringContaining('COMPILED_MANIFEST'),
      consistencyReport: expect.objectContaining({
        semanticConsistency: expect.any(Object),
        compilerConsistency: expect.any(Object),
      }),
      snapshotVersion: 3,
    }))
    expect(mockAi.chat).toHaveBeenCalledTimes(1)
  })

  it('rejects compiler-first publish when compiled script fails structural validation', async () => {
    const emitSpy = jest
      .spyOn(CompiledScriptEmitterService.prototype, 'emit')
      .mockReturnValue('broken compiled script')

    mockRepo.findById.mockResolvedValue({
      id: 's-runtime-invalid',
      userId: 'u1',
      status: 'CHECKLIST_GATE',
      strategyInstanceId: null,
      checklist: completeChecklist({
        symbols: ['BTCUSDT'],
        timeframes: ['15m'],
        entryRules: ['EMA7 上穿 EMA21 做多'],
        exitRules: ['EMA7 下穿 EMA21 平多'],
        riskRules: { positionPct: 10 },
      }),
      clarificationState: { status: 'CLEAR', items: [] },
      constraintPack: {},
    })

    const result = await service.continueSession('s-runtime-invalid', {
      userId: 'u1',
      message: '确认逻辑图',
      confirmGenerate: true,
      confirmedCanonicalDigest: buildConfirmedCanonicalDigest(completeChecklist({
        symbols: ['BTCUSDT'],
        timeframes: ['15m'],
        entryRules: ['EMA7 上穿 EMA21 做多'],
        exitRules: ['EMA7 下穿 EMA21 平多'],
        riskRules: { positionPct: 10 },
      })),
    })

    expect(result.status).toBe('GENERATING')
    await waitForTerminalStatus('s-runtime-invalid')

    expect(mockRepo.updateSession).toHaveBeenCalledWith('s-runtime-invalid', expect.objectContaining({
      status: 'REJECTED',
      rejectReason: expect.stringContaining('编译脚本结构校验失败'),
    }))
    expect(mockRepo.createVersion).not.toHaveBeenCalled()
    expect(mockRepo.create).not.toHaveBeenCalled()
    expect(emitSpy).toHaveBeenCalledTimes(1)
  })

  it('marks session as consistency failed when compiled publication gate reports failed compiler consistency', async () => {
    jest
      .spyOn(StrategyConsistencyService.prototype, 'evaluate')
      .mockReturnValue({
        status: 'PASSED',
        checks: [],
        summary: {
          criticalFailed: 0,
          warningFailed: 0,
          unprovable: 0,
        },
        specProfile: {
          actions: [],
          fallbackDetected: false,
          indicators: [],
          requiredParams: [],
          ruleMappings: [],
          rules: [],
        },
        scriptProfile: {
          actions: [],
          fallbackDetected: false,
          indicators: [],
          requiredParams: [],
          ruleMappings: [],
          rules: [],
        },
      } as never)
    const publishSpy = jest
      .spyOn(CompiledPublicationGateService.prototype, 'publish')
      .mockResolvedValue({
        snapshotId: 'snapshot-compiler-failed',
        consistencyReport: {
          status: 'FAILED',
          semanticConsistency: { status: 'PASSED', checks: [] },
          compilerConsistency: {
            status: 'FAILED',
            graphVsIr: { passed: false },
          },
        },
      })

    mockRepo.findById.mockResolvedValue({
      id: 's-compiler-consistency-failed',
      userId: 'u1',
      status: 'CHECKLIST_GATE',
      strategyInstanceId: null,
      checklist: completeChecklist({
        symbols: ['BTCUSDT'],
        timeframes: ['15m'],
        entryRules: ['EMA7 上穿 EMA21 做多'],
        exitRules: ['EMA7 下穿 EMA21 平多'],
        riskRules: { positionPct: 10 },
      }),
      clarificationState: { status: 'CLEAR', items: [] },
      constraintPack: {},
    })

    const result = await service.continueSession('s-compiler-consistency-failed', {
      userId: 'u1',
      message: '确认逻辑图',
      confirmGenerate: true,
      confirmedCanonicalDigest: buildConfirmedCanonicalDigest(completeChecklist({
        symbols: ['BTCUSDT'],
        timeframes: ['15m'],
        entryRules: ['EMA7 上穿 EMA21 做多'],
        exitRules: ['EMA7 下穿 EMA21 平多'],
        riskRules: { positionPct: 10 },
      })),
    })

    expect(result.status).toBe('GENERATING')
    await waitForTerminalStatus('s-compiler-consistency-failed')

    expect(mockRepo.updateSession).toHaveBeenCalledWith('s-compiler-consistency-failed', expect.objectContaining({
      status: 'CONSISTENCY_FAILED',
      rejectReason: expect.stringContaining('编译发布一致性校验失败'),
      latestSpecDesc: expect.objectContaining({
        consistencyReport: expect.objectContaining({
          status: 'FAILED',
        }),
      }),
    }))

    const hasPublished = mockRepo.updateSession.mock.calls.some(call =>
      call[0] === 's-compiler-consistency-failed' && (call[1] as { status?: string }).status === 'PUBLISHED',
    )
    expect(hasPublished).toBe(false)
    expect(publishSpy).toHaveBeenCalledTimes(1)
  })

  it('rejects confirmGenerate when confirmedCanonicalDigest does not match the current semantic view', async () => {
    mockRepo.findById.mockResolvedValue({
      id: 'session-1',
      userId: 'u-1',
      status: 'CHECKLIST_GATE',
      checklist: completeChecklist({
        symbols: ['BTCUSDT'],
        timeframes: ['15m'],
        entryRules: ['EMA7 上穿 EMA21 做多'],
        exitRules: ['EMA7 下穿 EMA21 平多'],
        riskRules: { positionPct: 10 },
      }),
      clarificationState: { status: 'CLEAR', items: [] },
      constraintPack: {},
      latestDraftCode: null,
      latestSpecDesc: null,
      rejectReason: null,
      strategyInstanceId: null,
    })

    await expect(service.continueSession('session-1', {
      userId: 'u-1',
      message: '确认逻辑图',
      confirmGenerate: true,
      confirmedCanonicalDigest: 'sha256:stale',
    })).rejects.toThrow('codegen.confirmation_digest_mismatch')
  })

  it('rejects processing-session requeue when confirmedCanonicalDigest mismatches current semantic view', async () => {
    mockRepo.findById.mockResolvedValue({
      id: 'session-processing-1',
      userId: 'u-1',
      status: 'VALIDATING_RUNTIME',
      checklist: completeChecklist({
        symbols: ['BTCUSDT'],
        timeframes: ['15m'],
        entryRules: ['EMA7 上穿 EMA21 做多'],
        exitRules: ['EMA7 下穿 EMA21 平多'],
        riskRules: { positionPct: 10 },
      }),
      clarificationState: { status: 'CLEAR', items: [] },
      constraintPack: {},
      latestDraftCode: 'const strategy = {}',
      latestSpecDesc: null,
      rejectReason: null,
      strategyInstanceId: null,
    })

    await expect(service.continueSession('session-processing-1', {
      userId: 'u-1',
      message: '确认并继续',
      confirmGenerate: true,
      confirmedCanonicalDigest: 'sha256:stale',
    })).rejects.toThrow('codegen.confirmation_digest_mismatch')

    expect(mockRepo.tryRequeueFromProcessing).not.toHaveBeenCalled()
  })

  it('marks consistency failed when script output cannot satisfy signal payload schema and fallback publish is disabled', async () => {
    mockRepo.findById.mockResolvedValue({
      id: 's6',
      userId: 'u1',
      status: 'CHECKLIST_GATE',
      checklist: completeChecklist({
        entryRules: ['rsi < 30'],
        exitRules: ['atr stop'],
      }),
      constraintPack: {},
    })
    mockAi.chat
      .mockResolvedValueOnce({
        content: JSON.stringify({
          related: true,
          logicReady: true,
          assistantPrompt: '可以生成',
        }),
      })
      .mockResolvedValueOnce({ content: 'return "BUY"' })
      .mockResolvedValueOnce({ content: 'return "BUY"' })
      .mockResolvedValueOnce({ content: 'return "BUY"' })
    mockRepo.createVersion.mockResolvedValue({ id: 'v2' })

    const result = await service.continueSession('s6', {
      userId: 'u1',
      message: '确认逻辑图',
      confirmGenerate: true,
      confirmedCanonicalDigest: buildConfirmedCanonicalDigest(completeChecklist({
        entryRules: ['rsi < 30'],
        exitRules: ['atr stop'],
      })),
    })

    expect(result.status).toBe('GENERATING')
    await waitForTerminalStatus('s6')

    const hasRejectedOrConsistencyFailed = mockRepo.updateSession.mock.calls.some(call =>
      call[0] === 's6' && ['CONSISTENCY_FAILED', 'REJECTED'].includes((call[1] as { status?: string }).status ?? ''),
    )
    const hasPublished = mockRepo.updateSession.mock.calls.some(call =>
      call[0] === 's6' && (call[1] as { status?: string }).status === 'PUBLISHED',
    )
    expect(hasRejectedOrConsistencyFailed).toBe(true)
    expect(hasPublished).toBe(false)
  })

  it('generates directly when confirmGenerate is true and checklist is complete even if session is drafting', async () => {
    mockRepo.findById.mockResolvedValue({
      id: 's7',
      userId: 'u1',
      status: 'DRAFTING',
      checklist: completeChecklist({
        entryRules: ['突破关键阻力位后入场'],
        exitRules: ['跌破最近支撑位出场'],
      }),
      constraintPack: {},
    })
    mockAi.chat
      .mockResolvedValueOnce({
        content: JSON.stringify({
          related: true,
          logicReady: true,
          assistantPrompt: '逻辑已确认，可以生成。',
        }),
      })
      .mockResolvedValueOnce({
        content: 'return { direction: "BUY", signalType: "ENTRY", confidence: 75, entryPrice: 62000, stopLoss: 61000, takeProfit: 64000, reasoning: "阻力位突破", positionSizeRatio: 0.1 }',
      })
    mockRepo.createVersion.mockResolvedValue({ id: 'v3' })

    const result = await service.continueSession('s7', {
      userId: 'u1',
      message: '确认，直接生成代码',
      confirmGenerate: true,
      confirmedCanonicalDigest: buildConfirmedCanonicalDigest(completeChecklist({
        entryRules: ['突破关键阻力位后入场'],
        exitRules: ['跌破最近支撑位出场'],
      })),
    })

    expect(result.status).toBe('GENERATING')
    await waitForTerminalStatus('s7')

    expect(mockRepo.updateSession).toHaveBeenCalledWith('s7', expect.objectContaining({
      status: 'PUBLISHED',
    }))
  })

  it('returns rejected payload instead of throwing 500 when compiler-first publication setup throws', async () => {
    mockRepo.findById.mockResolvedValue({
      id: 's8',
      userId: 'u1',
      status: 'CHECKLIST_GATE',
      checklist: completeChecklist({
        entryRules: ['突破关键阻力位后入场'],
        exitRules: ['跌破最近支撑位出场'],
      }),
      constraintPack: {},
    })
    mockRepo.createVersion.mockRejectedValueOnce(new Error('version write failed'))

    const result = await service.continueSession('s8', {
      userId: 'u1',
      message: '确认，直接生成代码',
      confirmGenerate: true,
      confirmedCanonicalDigest: buildConfirmedCanonicalDigest(completeChecklist({
        entryRules: ['突破关键阻力位后入场'],
        exitRules: ['跌破最近支撑位出场'],
      })),
    })

    expect(result.status).toBe('GENERATING')
    await waitForTerminalStatus('s8')

    expect(mockRepo.updateSession).toHaveBeenCalledWith('s8', expect.objectContaining({
      status: 'REJECTED',
      rejectReason: expect.stringContaining('version write failed'),
    }))
  })

  it('marks session rejected instead of published when publish step fails after code generation', async () => {
    mockRepo.findById.mockResolvedValue({
      id: 's8-publish-fail',
      userId: 'u1',
      status: 'CHECKLIST_GATE',
      checklist: completeChecklist({
        entryRules: ['突破关键阻力位后入场'],
        exitRules: ['跌破最近支撑位出场'],
      }),
      constraintPack: {},
    })
    mockAi.chat
      .mockResolvedValueOnce({
        content: JSON.stringify({
          related: true,
          logicReady: true,
          assistantPrompt: '逻辑已确认，可以生成。',
        }),
      })
      .mockResolvedValueOnce({
        content: 'const strategy: StrategyAdapterV1 = { protocolVersion: "v1", onBar(): StrategyDecisionV1 { return { action: "NOOP" } } }\nstrategy',
      })
    mockRepo.createVersion.mockResolvedValue({ id: 'v-publish-fail' })
    mockRepo.ensureDraftStrategyInstanceBoundForPublishedSession.mockRejectedValue(
      new Error('Transaction API error: Unable to start a transaction in the given time.'),
    )

    const result = await service.continueSession('s8-publish-fail', {
      userId: 'u1',
      message: '确认，直接生成代码',
      confirmGenerate: true,
      confirmedCanonicalDigest: buildConfirmedCanonicalDigest(completeChecklist({
        entryRules: ['突破关键阻力位后入场'],
        exitRules: ['跌破最近支撑位出场'],
      })),
    })

    expect(result.status).toBe('GENERATING')
    await waitForTerminalStatus('s8-publish-fail')

    expect(mockRepo.updateSession).toHaveBeenCalledWith('s8-publish-fail', expect.objectContaining({
      status: 'REJECTED',
      latestDraftCode: expect.any(String),
      latestSpecDesc: expect.any(Object),
      rejectReason: expect.stringContaining('Unable to start a transaction'),
      strategyInstanceId: null,
    }))
  })

  it('persists publicationGate in session payload when compiled publication gate blocks publish', async () => {
    mockRepo.findById.mockResolvedValue({
      id: 's8-publication-blocked',
      userId: 'u1',
      status: 'CHECKLIST_GATE',
      checklist: {
        symbols: ['BTCUSDT'],
        timeframes: ['1h'],
        entryRules: ['突破关键阻力位后入场'],
        exitRules: ['跌破最近支撑位出场'],
        riskRules: {
          exchange: 'okx',
          marketType: 'perp',
        },
      },
      constraintPack: {},
    })
    jest.spyOn(CompiledPublicationGateService.prototype, 'publish').mockRejectedValue(
      Object.assign(new Error('publication gate blocked: confirmed exchange=okx，but IR=binance、script=binance'), {
        publicationGate: {
          status: 'FAILED',
          checks: [
            {
              key: 'market.exchange',
              blocking: true,
              status: 'failed',
              expected: 'okx',
              actual: {
                ir: 'binance',
                script: 'binance',
              },
              message: 'confirmed exchange=okx，but IR=binance、script=binance',
            },
          ],
        },
      }),
    )

    const result = await service.continueSession('s8-publication-blocked', {
      userId: 'u1',
      message: '确认，直接生成代码',
      confirmGenerate: true,
      confirmedCanonicalDigest: buildConfirmedCanonicalDigest({
        symbols: ['BTCUSDT'],
        timeframes: ['1h'],
        entryRules: ['突破关键阻力位后入场'],
        exitRules: ['跌破最近支撑位出场'],
        riskRules: {
          exchange: 'okx',
          marketType: 'perp',
        },
      }),
    })

    expect(result.status).toBe('GENERATING')
    await waitForTerminalStatus('s8-publication-blocked')

    expect(mockRepo.updateSession).toHaveBeenCalledWith('s8-publication-blocked', expect.objectContaining({
      status: 'REJECTED',
      latestSpecDesc: expect.objectContaining({
        publicationGate: {
          passed: false,
          blockingMismatches: [
            expect.objectContaining({
              field: 'exchange',
              expected: 'okx',
              actual: 'binance',
            }),
          ],
        },
      }),
      rejectReason: expect.stringContaining('publication gate blocked'),
    }))
  })

  it('publishes without calling ai codegen even when strict mode flags are enabled', async () => {
    setProcessEnvValue('LLM_CODEGEN_STRICT_ENABLED', 'true')
    setProcessEnvValue('LLM_CODEGEN_STRICT_FALLBACK', 'false')

    mockRepo.findById.mockResolvedValue({
      id: 's9',
      userId: 'u1',
      status: 'CHECKLIST_GATE',
      checklist: completeChecklist({
        entryRules: ['价格突破阻力位入场'],
        exitRules: ['跌破支撑位出场'],
      }),
      constraintPack: {},
    })

    const result = await service.continueSession('s9', {
      userId: 'u1',
      message: '确认并生成',
      confirmGenerate: true,
      confirmedCanonicalDigest: buildConfirmedCanonicalDigest(completeChecklist({
        entryRules: ['价格突破阻力位入场'],
        exitRules: ['跌破支撑位出场'],
      })),
      providerCode: 'uniapi',
      model: 'gpt-4',
    })

    expect(result.status).toBe('GENERATING')
    await waitForTerminalStatus('s9')

    expect(mockRepo.updateSession).toHaveBeenCalledWith('s9', expect.objectContaining({
      status: 'PUBLISHED',
    }))
    expect(mockAi.chat).not.toHaveBeenCalled()
  })

  it('marks session as consistency failed when validated script does not match checklist semantics', async () => {
    jest.spyOn(StrategyConsistencyService.prototype, 'evaluate').mockReturnValue({
      status: 'FAILED',
      checks: [
        {
          key: 'entry',
          level: 'critical',
          status: 'failed',
          expected: '布林带上轨做空 / 下轨做多',
          actual: '双均线趋势跟随',
          message: '策略语义与确认逻辑图不一致',
        },
      ],
      summary: { criticalFailed: 1, warningFailed: 0, unprovable: 0 },
      specProfile: {
        indicators: [],
        actions: [],
        ruleMappings: [],
        rules: [],
        sizing: null,
        requiredParams: [],
        fallbackDetected: false,
      },
      scriptProfile: {
        indicators: [],
        actions: [],
        ruleMappings: [],
        rules: [],
        sizing: null,
        requiredParams: [],
        fallbackDetected: false,
      },
    } as never)
    mockRepo.findById.mockResolvedValue({
      id: 's-consistency',
      userId: 'u1',
      status: 'CHECKLIST_GATE',
      checklist: {
        symbols: ['BTCUSDT'],
        timeframes: ['15m'],
        entryRules: ['K线收盘后确认突破布林带上轨时做空', 'K线收盘后确认突破布林带下轨时做多'],
        exitRules: ['价格回到布林带中轨(MA20)时平仓'],
        riskRules: {
          exchange: 'okx',
          marketType: 'perp',
          positionPct: 10,
          stopLossPct: 5,
          earlyStop: '价格连续3根K线在轨外时直接减仓',
        },
      },
      constraintPack: {},
    })
    mockRepo.createVersion.mockResolvedValue({ id: 'v-consistency' })

    const result = await service.continueSession('s-consistency', {
      userId: 'u1',
      message: '确认并生成',
      confirmGenerate: true,
      confirmedCanonicalDigest: buildConfirmedCanonicalDigest({
        symbols: ['BTCUSDT'],
        timeframes: ['15m'],
        entryRules: ['K线收盘后确认突破布林带上轨时做空', 'K线收盘后确认突破布林带下轨时做多'],
        exitRules: ['价格回到布林带中轨(MA20)时平仓'],
        riskRules: {
          exchange: 'okx',
          marketType: 'perp',
          positionPct: 10,
          stopLossPct: 5,
          earlyStop: '价格连续3根K线在轨外时直接减仓',
        },
      }),
    })

    expect(result.status).toBe('GENERATING')
    await waitForTerminalStatus('s-consistency')

    const hasRejectedOrConsistencyFailed = mockRepo.updateSession.mock.calls.some(call =>
      call[0] === 's-consistency' && (call[1] as { status?: string }).status === 'CONSISTENCY_FAILED',
    )
    const hasPublished = mockRepo.updateSession.mock.calls.some(call =>
      call[0] === 's-consistency' && (call[1] as { status?: string }).status === 'PUBLISHED',
    )
    expect(hasRejectedOrConsistencyFailed).toBe(true)
    expect(hasPublished).toBe(false)
    expect(mockRepo.ensureDraftStrategyInstanceBoundForPublishedSession).not.toHaveBeenCalled()
  }, 15_000)

  it('rejects continueSession when canonical spec version is not 2', async () => {
    const buildSpy = jest.spyOn(canonicalSpecBuilder, 'build').mockReturnValue({
      version: 1,
      market: {
        exchange: 'binance',
        symbol: 'BTCUSDT',
        marketType: 'spot',
        timeframe: '15m',
      },
      indicators: [],
      entries: [],
      exits: [],
      riskRules: [],
      sizing: {
        mode: 'RATIO',
        value: 0.1,
      },
      executionPolicy: {
        signalTiming: 'BAR_CLOSE',
        fillTiming: 'NEXT_BAR_OPEN',
      },
      dataRequirements: {},
    } as never)

    mockRepo.findById.mockResolvedValue({
      id: 's-v1',
      userId: 'u1',
      status: 'CHECKLIST_GATE',
      checklist: {
        symbols: ['BTCUSDT'],
        timeframes: ['15m'],
        entryRules: ['突破布林带上轨时做空'],
        exitRules: ['价格回到布林带中轨时平仓'],
        riskRules: {
          exchange: 'binance',
          marketType: 'perp',
        },
      },
      clarificationState: { status: 'CLEAR', items: [] },
      constraintPack: {},
    })
    mockAi.chat
      .mockResolvedValueOnce({
        content: JSON.stringify({
          related: true,
          logicReady: true,
          assistantPrompt: '逻辑已确认，可以生成。',
        }),
      })
      .mockResolvedValueOnce({
        content: JSON.stringify({
          code: 'const strategy: StrategyAdapterV1 = { protocolVersion: "v1", onBar(): StrategyDecisionV1 { return { action: "NOOP" } } }\nstrategy',
        }),
      })

    await expect(service.continueSession('s-v1', {
      userId: 'u1',
      message: '确认并生成',
      confirmGenerate: true,
      providerCode: 'uniapi',
      model: 'gpt-4',
    })).rejects.toThrow('canonical_spec_v2_required')

    buildSpy.mockRestore()
  })

  it('creates strategy instance on publish and returns it in published snapshot', async () => {
    mockRepo.findById.mockResolvedValue({
      id: 's-new-instance',
      userId: 'u1',
      status: 'CHECKLIST_GATE',
      strategyInstanceId: null,
      checklist: completeChecklist({
        symbols: ['BTCUSDT'],
        timeframes: ['5m'],
        entryRules: ['价格突破阻力位入场'],
        exitRules: ['跌破支撑位出场'],
      }),
      constraintPack: {},
    })
    mockAi.chat
      .mockResolvedValueOnce({
        content: JSON.stringify({
          related: true,
          logicReady: true,
          assistantPrompt: '逻辑已确认，可以生成。',
        }),
      })
      .mockResolvedValueOnce({
        content: 'return { direction: "BUY", signalType: "ENTRY", confidence: 75, entryPrice: 62000, stopLoss: 61000, takeProfit: 64000, reasoning: "breakout", positionSizeRatio: 0.1 }',
      })
    mockRepo.createVersion.mockResolvedValue({ id: 'v-instance-1' })
    mockRepo.updateSession.mockResolvedValue({ id: 's-new-instance' })

    const result = await service.continueSession('s-new-instance', {
      userId: 'u1',
      message: '确认并生成',
      confirmGenerate: true,
      confirmedCanonicalDigest: buildConfirmedCanonicalDigest(completeChecklist({
        symbols: ['BTCUSDT'],
        timeframes: ['5m'],
        entryRules: ['价格突破阻力位入场'],
        exitRules: ['跌破支撑位出场'],
      })),
    })

    expect(result.status).toBe('GENERATING')
    await waitForTerminalStatus('s-new-instance')

    expect(mockRepo.ensureDraftStrategyInstanceBoundForPublishedSession).toHaveBeenCalledTimes(1)
    expect(mockRepo.create).toHaveBeenCalledWith(expect.objectContaining({
      sessionId: 's-new-instance',
      strategyInstanceId: 'instance-1',
      scriptSnapshot: expect.any(String),
    }))
    expect(mockRepo.updateSession).toHaveBeenCalledWith('s-new-instance', expect.objectContaining({
      status: 'PUBLISHED',
      strategyInstanceId: 'instance-1',
    }))
  })

  it('propagates requested exchange and perp marketType into consistency-failed publish artifacts', async () => {
    mockRepo.findById.mockResolvedValue({
      id: 's-perp-publish',
      userId: 'u1',
      status: 'CHECKLIST_GATE',
      strategyInstanceId: null,
      checklist: {
        symbols: ['BTCUSDT'],
        timeframes: ['15m'],
        entryRules: ['价格下跌触及网格线时买入'],
        exitRules: ['价格上涨一个网格时卖出'],
        riskRules: {
          exchange: 'okx',
          marketType: 'perp',
          positionPct: 10,
        },
      },
      constraintPack: {},
    })
    mockAi.chat
      .mockResolvedValueOnce({
        content: JSON.stringify({
          related: true,
          logicReady: true,
          assistantPrompt: '逻辑已确认，可以生成。',
        }),
      })
      .mockResolvedValueOnce({
        content: 'return { direction: "BUY", signalType: "ENTRY", confidence: 75, entryPrice: 62000, stopLoss: 61000, takeProfit: 64000, reasoning: "grid", positionSizeRatio: 0.1 }',
      })
    mockRepo.createVersion.mockResolvedValue({ id: 'v-perp-1' })
    mockRepo.updateSession.mockResolvedValue({ id: 's-perp-publish' })

    const result = await service.continueSession('s-perp-publish', {
      userId: 'u1',
      message: '确认并生成',
      confirmGenerate: true,
      confirmedCanonicalDigest: buildConfirmedCanonicalDigest(completeChecklist({
        symbols: ['BTCUSDT'],
        timeframes: ['15m'],
        entryRules: ['价格下跌触及网格线时买入'],
        exitRules: ['价格上涨一个网格时卖出'],
        riskRules: {
          exchange: 'okx',
          marketType: 'perp',
          positionPct: 10,
        },
      })),
    })

    expect(result.status).toBe('GENERATING')
    await waitForTerminalStatus('s-perp-publish')

    expect(mockRepo.updateSession).toHaveBeenCalledWith('s-perp-publish', expect.objectContaining({
      status: 'CONSISTENCY_FAILED',
      latestSpecDesc: expect.objectContaining({
        lockedParams: expect.objectContaining({
          exchange: 'okx',
          marketType: 'perp',
        }),
        canonicalSpec: expect.objectContaining({
          market: expect.objectContaining({
            exchange: 'okx',
            marketType: 'perp',
          }),
        }),
      }),
    }))
  })

  it('does not recreate strategy instance when session already bound', async () => {
    mockRepo.findById.mockResolvedValue({
      id: 's-existing-instance',
      userId: 'u1',
      status: 'CHECKLIST_GATE',
      strategyInstanceId: 'instance-existing',
      checklist: completeChecklist({
        symbols: ['BTCUSDT'],
        timeframes: ['15m'],
        entryRules: ['价格突破阻力位入场'],
        exitRules: ['跌破支撑位出场'],
      }),
      constraintPack: {},
    })
    mockAi.chat
      .mockResolvedValueOnce({
        content: JSON.stringify({
          related: true,
          logicReady: true,
          assistantPrompt: '逻辑已确认，可以生成。',
        }),
      })
      .mockResolvedValueOnce({
        content: 'return { direction: "BUY", signalType: "ENTRY", confidence: 75, entryPrice: 62000, stopLoss: 61000, takeProfit: 64000, reasoning: "breakout", positionSizeRatio: 0.1 }',
      })
    mockRepo.createVersion.mockResolvedValue({ id: 'v-instance-2' })
    mockRepo.updateSession.mockResolvedValue({ id: 's-existing-instance' })

    const result = await service.continueSession('s-existing-instance', {
      userId: 'u1',
      message: '确认并生成',
      confirmGenerate: true,
      confirmedCanonicalDigest: buildConfirmedCanonicalDigest(completeChecklist({
        symbols: ['BTCUSDT'],
        timeframes: ['15m'],
        entryRules: ['价格突破阻力位入场'],
        exitRules: ['跌破支撑位出场'],
      })),
    })

    expect(result.status).toBe('GENERATING')
    await waitForTerminalStatus('s-existing-instance')

    expect(mockRepo.ensureDraftStrategyInstanceBoundForPublishedSession).not.toHaveBeenCalled()
    expect(mockRepo.updateSession).toHaveBeenCalledWith('s-existing-instance', expect.objectContaining({
      status: 'PUBLISHED',
      strategyInstanceId: 'instance-existing',
    }))
  })

  it('rejects publish when strategy instance binding fails before snapshot creation', async () => {
    mockRepo.findById.mockResolvedValue({
      id: 's-instance-failed',
      userId: 'u1',
      status: 'CHECKLIST_GATE',
      strategyInstanceId: null,
      checklist: completeChecklist({
        symbols: ['BTCUSDT'],
        timeframes: ['5m'],
        entryRules: ['价格突破阻力位入场'],
        exitRules: ['跌破支撑位出场'],
      }),
      constraintPack: {},
    })
    mockAi.chat
      .mockResolvedValueOnce({
        content: JSON.stringify({
          related: true,
          logicReady: true,
          assistantPrompt: '逻辑已确认，可以生成。',
        }),
      })
      .mockResolvedValueOnce({
        content: 'return { direction: "BUY", signalType: "ENTRY", confidence: 75, entryPrice: 62000, stopLoss: 61000, takeProfit: 64000, reasoning: "breakout", positionSizeRatio: 0.1 }',
      })
    mockRepo.createVersion.mockResolvedValue({ id: 'v-instance-3' })
    mockRepo.ensureDraftStrategyInstanceBoundForPublishedSession.mockRejectedValueOnce(new Error('create instance failed'))
    mockRepo.updateSession.mockResolvedValue({ id: 's-instance-failed' })

    const result = await service.continueSession('s-instance-failed', {
      userId: 'u1',
      message: '确认并生成',
      confirmGenerate: true,
      confirmedCanonicalDigest: buildConfirmedCanonicalDigest(completeChecklist({
        symbols: ['BTCUSDT'],
        timeframes: ['5m'],
        entryRules: ['价格突破阻力位入场'],
        exitRules: ['跌破支撑位出场'],
      })),
    })

    expect(result.status).toBe('GENERATING')
    await waitForTerminalStatus('s-instance-failed')

    expect(mockRepo.updateSession).toHaveBeenCalledWith('s-instance-failed', expect.objectContaining({
      status: 'REJECTED',
      latestDraftCode: expect.any(String),
      latestSpecDesc: expect.any(Object),
      strategyInstanceId: null,
      rejectReason: 'create instance failed',
    }))
    expect(mockRepo.create).not.toHaveBeenCalled()
  })
})
