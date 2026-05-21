/**
 * Issue #1445：conversation 层 schema reject → 单轮 planner 重试 → 仍 reject → unsupportedFallback
 *
 * 覆盖验收标准：
 *   - reject → 触发 planner 重试一次（aiService.chat 被调用 2 次）
 *   - 重试仍 reject → 返回 unsupportedFallback plan（不带 semanticPatch，
 *     assistantPrompt 提示用户重述）
 *   - 初次合规 rules[] → 不重试，正常返回 plan
 *   - metric planner_schema_reject_total 在 reject 路径有计数（initial 与 retry 两个 stage）
 */
import { Logger } from '@nestjs/common'
import { CodegenConversationService } from '../codegen-conversation.service'
import { GenericSeedDispatcher } from '../generic-seed-dispatcher.service'
import { PlannerDispatcherMergeService } from '../planner-dispatcher-merge.service'

interface SvcShell {
  // dependencies we exercise
  aiService: { chat: jest.Mock }
  genericSeedDispatcher: { dispatch: jest.Mock }
  plannerDispatcherMerge: PlannerDispatcherMergeService
  logger: Logger
  // private helpers / metadata referenced inside planConversationByLlm
  normalizeSemanticPatch: jest.Mock
  validatePlannerRules: jest.Mock
  applyValidatedPlannerRules: jest.Mock
  extractRawPlannerRules: jest.Mock
  readPlannerPayload: jest.Mock
  collectPlannerSchemaMismatchReasons: jest.Mock
  logPlannerFallback: jest.Mock
  localizedText: jest.Mock
  summarizePlannerError: jest.Mock
}

function makeService(): { svc: CodegenConversationService, shell: SvcShell, mergeSvc: PlannerDispatcherMergeService } {
  const mergeSvc = new PlannerDispatcherMergeService()
  const shell: SvcShell = {
    aiService: { chat: jest.fn() },
    genericSeedDispatcher: { dispatch: jest.fn().mockReturnValue({}) },
    plannerDispatcherMerge: mergeSvc,
    logger: new Logger('CodegenConversationServiceTest'),
    normalizeSemanticPatch: jest.fn(v => v ?? null),
    validatePlannerRules: jest.fn().mockReturnValue({ rules: [], quarantine: [] }),
    applyValidatedPlannerRules: jest.fn(),
    extractRawPlannerRules: jest.fn().mockReturnValue(undefined),
    readPlannerPayload: jest.fn(v => (v && typeof v === 'object' && !Array.isArray(v)) ? v : {}),
    collectPlannerSchemaMismatchReasons: jest.fn().mockReturnValue([]),
    logPlannerFallback: jest.fn(),
    localizedText: jest.fn((_locale: string, _en: string, zh: string) => zh),
    summarizePlannerError: jest.fn((e: unknown) => String(e)),
  }
  const svc = Object.create(CodegenConversationService.prototype) as CodegenConversationService
  Object.assign(svc as unknown as Record<string, unknown>, shell)
  return { svc, shell, mergeSvc }
}

const COMPLIANT_PLAN_JSON = JSON.stringify({
  related: true,
  logicReady: false,
  assistantPrompt: 'ok',
  semanticPatch: {
    rules: [
      {
        id: 'r1',
        phase: 'entry',
        sideScope: 'long',
        condition: { kind: 'atom', key: 'bollinger.touch_lower', params: {} },
        effects: [{ kind: 'atom', key: 'action.open_long', params: {} }],
        evidence: { text: 'BOLL 下轨开多' },
      },
    ],
  },
})

const LEGACY_FLAT_PLAN_JSON = JSON.stringify({
  related: true,
  logicReady: false,
  assistantPrompt: 'noisy',
  semanticPatch: {
    atoms: [
      { key: 'indicator.above', phase: 'entry' },
      { key: 'bollinger.touch_lower', phase: 'entry' },
      { key: 'action.open_long', phase: 'entry' },
    ],
  },
})

const BAD_EVIDENCE_PLAN_JSON = JSON.stringify({
  related: true,
  logicReady: false,
  assistantPrompt: 'ok',
  semanticPatch: {
    rules: [
      {
        id: 'r1',
        phase: 'entry',
        sideScope: 'long',
        condition: { kind: 'atom', key: 'bollinger.touch_lower', params: {} },
        effects: [{ kind: 'atom', key: 'action.open_long', params: {} }],
        evidence: { text: 'LLM 改写过的非原文证据' },
      },
    ],
  },
})

const USER_MESSAGE = '5min K 线里面 价格在 EMA20/60/144 上方时做多开仓 都位于下方只开空 入场是 BOLL 下轨开多 上轨开空 币安 BTCUSDT 永续 风控亏损 5% 止损'
describe('#1445 CodegenConversation planner schema reject → retry → unsupportedFallback', () => {
  it('initial compliant rules[] → no retry, returns plan with semanticPatch', async () => {
    const { svc, shell } = makeService()
    shell.aiService.chat.mockResolvedValueOnce({ content: COMPLIANT_PLAN_JSON })
    const plan = await (svc as unknown as { planConversationByLlm: Function }).planConversationByLlm(
      USER_MESSAGE,
      { rules: [] },
      { providerCode: 'test', locale: 'zh' },
      [],
    )
    expect(shell.aiService.chat).toHaveBeenCalledTimes(1)
    expect(shell.aiService.chat).toHaveBeenCalledWith(expect.objectContaining({
      maxTokens: expect.any(Number),
    }))
    expect(shell.aiService.chat.mock.calls[0][0].maxTokens).toBeGreaterThanOrEqual(4000)
    expect(shell.aiService.chat.mock.calls[0][0].responseFormat).toBeUndefined()
    expect(plan.related).toBe(true)
    expect(plan.semanticPatch).toBeDefined()
  })

  it('parses fenced planner JSON without falling back to empty rules', async () => {
    const { svc, shell } = makeService()
    shell.aiService.chat.mockResolvedValueOnce({ content: `\`\`\`json\n${COMPLIANT_PLAN_JSON}\n\`\`\`` })
    const plan = await (svc as unknown as { planConversationByLlm: Function }).planConversationByLlm(
      USER_MESSAGE,
      { rules: [] },
      { providerCode: 'test', locale: 'zh' },
      [],
    )

    expect(shell.logPlannerFallback).not.toHaveBeenCalledWith('invalid_json', expect.any(Object))
    expect(plan.semanticPatch).toBeDefined()
  })

  it('normalizes non-substring evidence as warning without retrying or blocking script generation', async () => {
    const { svc, shell } = makeService()
    shell.aiService.chat
      .mockResolvedValueOnce({ content: BAD_EVIDENCE_PLAN_JSON })
      .mockResolvedValueOnce({ content: BAD_EVIDENCE_PLAN_JSON })
    const plan = await (svc as unknown as { planConversationByLlm: Function }).planConversationByLlm(
      USER_MESSAGE,
      { rules: [] },
      { providerCode: 'test', locale: 'zh' },
      [],
    )

    expect(shell.aiService.chat).toHaveBeenCalledTimes(1)
    expect(plan.semanticPatch).toBeDefined()
    expect(plan.diagnostics).toEqual(expect.objectContaining({
      gate: 'RulesTreeEntryGate',
      warnings: expect.arrayContaining(['evidence_text_not_substring']),
    }))
    expect(shell.logPlannerFallback).not.toHaveBeenCalledWith(
      'schema_reject_unsupported',
      expect.anything(),
    )
  })

  it('initial reject (legacy atoms[]) → planner retried once', async () => {
    const { svc, shell } = makeService()
    // 第一次返回 legacy flat；第二次返回合规 rules[]
    shell.aiService.chat
      .mockResolvedValueOnce({ content: LEGACY_FLAT_PLAN_JSON })
      .mockResolvedValueOnce({ content: COMPLIANT_PLAN_JSON })
    const plan = await (svc as unknown as { planConversationByLlm: Function }).planConversationByLlm(
      USER_MESSAGE,
      { rules: [] },
      { providerCode: 'test', locale: 'zh' },
      [],
    )
    expect(shell.aiService.chat).toHaveBeenCalledTimes(2)
    // 第二次调用 messages 中必须含 schema reminder 作为 system feedback
    const secondCallArgs = shell.aiService.chat.mock.calls[1][0]
    const concat = JSON.stringify(secondCallArgs.messages)
    expect(concat).toMatch(/schema|rules-first|未通过/)
    expect(plan.semanticPatch).toBeDefined()
  })

  it('initial reject + retry still reject → unsupportedFallback (no semanticPatch)', async () => {
    const { svc, shell, mergeSvc } = makeService()
    shell.aiService.chat
      .mockResolvedValueOnce({ content: LEGACY_FLAT_PLAN_JSON })
      .mockResolvedValueOnce({ content: LEGACY_FLAT_PLAN_JSON })
    const metricSpy = jest.spyOn(mergeSvc, 'emitPlannerSchemaRejectMetric')
    const plan = await (svc as unknown as { planConversationByLlm: Function }).planConversationByLlm(
      USER_MESSAGE,
      { rules: [] },
      { providerCode: 'test', locale: 'zh' },
      [],
    )
    expect(shell.aiService.chat).toHaveBeenCalledTimes(2)
    expect(plan.semanticPatch).toBeUndefined()
    expect(plan.assistantPrompt).toMatch(/重新描述|策略表达暂未识别/)
    expect(shell.logPlannerFallback).toHaveBeenCalledWith(
      'schema_reject_unsupported',
      expect.objectContaining({ reasons: expect.stringContaining('legacy_flat_field') }),
    )
    // metric: initial + retry stage 均触发
    const stages = metricSpy.mock.calls.map(c => c[0])
    expect(stages).toEqual(expect.arrayContaining(['initial', 'retry']))
    metricSpy.mockRestore()
  })

  it('initial reject + retry still reject + dispatcher atoms → unsupportedFallback without executable semanticPatch', async () => {
    const { svc, shell, mergeSvc } = makeService()
    shell.aiService.chat
      .mockResolvedValueOnce({ content: LEGACY_FLAT_PLAN_JSON })
      .mockResolvedValueOnce({ content: LEGACY_FLAT_PLAN_JSON })
    const metricSpy = jest.spyOn(mergeSvc, 'emitPlannerSchemaRejectMetric')

    const plan = await (svc as unknown as { planConversationByLlm: Function }).planConversationByLlm(
      USER_MESSAGE,
      { rules: [] },
      { providerCode: 'test', locale: 'zh' },
      [],
    )

    expect(shell.aiService.chat).toHaveBeenCalledTimes(2)
    expect(shell.genericSeedDispatcher.dispatch).not.toHaveBeenCalled()
    expect(plan.logicReady).toBe(false)
    expect(plan.semanticPatch).toBeUndefined()
    expect(plan.diagnostics).toEqual(expect.objectContaining({
      gate: 'RulesTreeEntryGate',
      entry: expect.objectContaining({ result: 'unsupported' }),
    }))
    const stages = metricSpy.mock.calls.map(c => c[0])
    expect(stages).toEqual(expect.arrayContaining(['initial', 'retry']))
    metricSpy.mockRestore()
  })

  it('#1445 retry budget: transport-failure + transport-retry reject → no extra schema-retry (≤2 LLM calls total)', async () => {
    // 防护 retry 风暴：transport-failure 后的 retry 已用掉单轮重试预算，
    //   若该次 LLM 返回 schema-reject，必须直接走 unsupportedFallback，
    //   而非再叠加一次 schema-retry。否则最坏可达 3 次 LLM 调用，超出「单轮重试」契约。
    const { svc, shell, mergeSvc } = makeService()
    shell.aiService.chat
      .mockRejectedValueOnce(new Error('transport boom'))
      .mockResolvedValueOnce({ content: LEGACY_FLAT_PLAN_JSON })
    const metricSpy = jest.spyOn(mergeSvc, 'emitPlannerSchemaRejectMetric')
    const plan = await (svc as unknown as { planConversationByLlm: Function }).planConversationByLlm(
      USER_MESSAGE,
      { rules: [] },
      { providerCode: 'test', locale: 'zh' },
      [],
    )
    // 硬上限：transport-fail (1) + transport-retry (2) = 2 次；不允许再有 schema-retry
    expect(shell.aiService.chat).toHaveBeenCalledTimes(2)
    expect(plan.semanticPatch).toBeUndefined()
    // 仍要打 retry stage 的 reject metric（用于可观测）
    const stages = metricSpy.mock.calls.map(c => c[0])
    expect(stages).toContain('retry')
    metricSpy.mockRestore()
  })

  it('cmp9d849x0nyxx5qsf0wdfcp3 replay: original flat-atoms output is rejected (not silently passed to merge)', async () => {
    const { svc, shell } = makeService()
    shell.aiService.chat
      .mockResolvedValueOnce({ content: LEGACY_FLAT_PLAN_JSON })
      .mockResolvedValueOnce({ content: LEGACY_FLAT_PLAN_JSON })
    const plan = await (svc as unknown as { planConversationByLlm: Function }).planConversationByLlm(
      USER_MESSAGE,
      { rules: [] },
      { providerCode: 'test', locale: 'zh' },
      [],
    )
    // 主链路必须 reject；dispatcher 不再作为 schema reject 后的语义 fallback。
    expect(plan.semanticPatch).toBeUndefined()
    expect(shell.genericSeedDispatcher.dispatch).not.toHaveBeenCalled()
  })

  it('planner asks for core semantics but deterministic rules tree can recover multi-timeframe EMA rules', async () => {
    const text = '15min 1h 4h的价格都在ema20的上方买入 15min跌破ema20卖出 再币安交易所 btcusdt永续合约'
    const { svc, shell } = makeService()
    shell.genericSeedDispatcher.dispatch.mockImplementation(message => new GenericSeedDispatcher().dispatch(message))
    shell.aiService.chat.mockResolvedValueOnce({
      content: JSON.stringify({
        related: true,
        logicReady: false,
        assistantPrompt: '当前还没有形成可执行规则。请补充入场条件、出场条件、风控和仓位。',
      }),
    })

    const plan = await (svc as unknown as { planConversationByLlm: Function }).planConversationByLlm(
      text,
      { rules: [] },
      { providerCode: 'test', locale: 'zh' },
      [],
    )

    expect(plan.semanticPatch?.rules).toEqual(expect.arrayContaining([
      expect.objectContaining({
        phase: 'entry',
        sideScope: 'long',
        condition: expect.objectContaining({ kind: 'atom', key: 'indicator.above' }),
      }),
      expect.objectContaining({
        phase: 'exit',
        sideScope: 'long',
        condition: expect.objectContaining({ kind: 'atom', key: 'indicator.below' }),
      }),
    ]))
    expect(JSON.stringify(plan.semanticPatch?.rules)).toContain('"timeframe":"15m"')
    expect(JSON.stringify(plan.semanticPatch?.rules)).toContain('"timeframe":"1h"')
    expect(JSON.stringify(plan.semanticPatch?.rules)).toContain('"timeframe":"4h"')
  })

  it('planner asks for core semantics but deterministic rules tree can recover EMA cross with drawdown guard', async () => {
    const text = 'SOL 1d，EMA20 上穿 EMA60 开多，下穿平仓，最大回撤 15% 熔断'
    const { svc, shell } = makeService()
    shell.genericSeedDispatcher.dispatch.mockImplementation(message => new GenericSeedDispatcher().dispatch(message))
    shell.aiService.chat.mockResolvedValueOnce({
      content: JSON.stringify({
        related: true,
        logicReady: false,
        assistantPrompt: '当前还没有形成可执行规则。请补充入场条件、出场条件、风控和仓位。',
      }),
    })

    const plan = await (svc as unknown as { planConversationByLlm: Function }).planConversationByLlm(
      text,
      { rules: [] },
      { providerCode: 'test', locale: 'zh' },
      [],
    )

    expect(plan.semanticPatch?.rules).toEqual(expect.arrayContaining([
      expect.objectContaining({
        phase: 'entry',
        sideScope: 'long',
        condition: expect.objectContaining({ kind: 'atom', key: 'indicator.cross_over' }),
      }),
      expect.objectContaining({
        phase: 'exit',
        sideScope: 'long',
        condition: expect.objectContaining({ kind: 'atom', key: 'indicator.cross_under' }),
      }),
    ]))
    expect(JSON.stringify(plan.semanticPatch)).toContain('portfolioRisk.drawdown_block')
    expect(JSON.stringify(plan.semanticPatch)).toContain('"thresholdPct":15')
    const gateRule = plan.semanticPatch?.rules?.find(rule => rule.phase === 'gate')
    expect(JSON.stringify(gateRule?.effects)).not.toContain('action.open_long')
  })
})
