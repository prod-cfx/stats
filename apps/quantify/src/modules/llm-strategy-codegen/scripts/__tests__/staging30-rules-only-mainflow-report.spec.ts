import { STAGING30_RULES_ONLY_CASES } from '../staging30-rules-only-mainflow-cases'
import {
  addCompiledPortfolioRiskTokens,
  buildRuleSignature,
  buildStaging30EvidenceSummary,
  collectAtomKeysFromRule,
  collectAtomKeysFromRules,
  collectPhaseCountsFromRules,
  detectSemanticDriftAndRegression,
  extractStrategyTokens,
  extractStaging30HashesFromResponse,
  inferStaging30ClarificationAnswer,
  inferStaging30AssistantPromptAnswer,
  readStaging30ConfirmationDigest,
  requiredEvidenceKeys,
  scriptCoversStrategyToken,
  buildStaging30ConfirmGenerateBody,
} from '../staging30-rules-only-mainflow-report'

const completeConsistency = {
  passed: true,
  userPrompt: 'BTC 15m EMA20 做多',
  assistantPrompts: ['BTC 15m EMA20 做多'],
  finalAssistantPrompt: 'BTC 15m EMA20 做多',
  scriptCode: 'const symbol = "BTCUSDT"; const timeframe = "15m"; const ema20 = 20; const side = "long";',
  strategyTokens: ['15m', 'btcusdt', 'ema', 'ema20', 'long'],
  missingInFinalDescription: [],
  missingInScript: [],
  failures: [],
}

describe('staging30 rules-only mainflow report', () => {
  it('contains exactly 30 new-session staging cases', () => {
    expect(STAGING30_RULES_ONLY_CASES).toHaveLength(30)
    expect(new Set(STAGING30_RULES_ONLY_CASES.map(item => item.id)).size).toBe(30)
    expect(STAGING30_RULES_ONLY_CASES.every(item => item.prompt.trim().length > 0)).toBe(true)
    expect(STAGING30_RULES_ONLY_CASES.map(item => item.id)).toEqual(
      Array.from({ length: 30 }, (_, index) => `s${String(index + 1).padStart(2, '0')}`),
    )
  })

  it('documents rules-only evidence fields without flat fallback evidence', () => {
    expect(requiredEvidenceKeys()).toEqual([
      'caseId',
      'status',
      'sessionId',
      'steps',
      'turns',
      'turns.step',
      'turns.status',
      'turns.pendingItemKeys',
      'turns.rulesCount',
      'turns.readinessReady',
      'turns.failures',
      'turns.assistantPrompt',
      'turns.ruleSignatures',
      'turns.duplicateRuleSignatures',
      'hashes.rulesHash',
      'hashes.canonicalSpecHash',
      'hashes.irHash',
      'hashes.astHash',
      'hashes.scriptHash',
      'hashes.runtimeEvaluatorVersion',
      'failureReason',
      'rootCause',
      'answers',
      'consistency.userPrompt',
      'consistency.assistantPrompts',
      'consistency.finalAssistantPrompt',
      'consistency.scriptCode',
      'consistency.strategyTokens',
      'consistency.missingInFinalDescription',
      'consistency.missingInScript',
      'consistency.failures',
    ])
    expect(requiredEvidenceKeys()).not.toContain('usedFlatFallback')
  })

  it('passes only when rules tree evidence and hash chain are complete', () => {
    const summary = buildStaging30EvidenceSummary([{
      caseId: 's01',
      sessionId: 'session-1',
      status: 'passed',
      hashes: {
        rulesHash: 'sha256:a',
        canonicalSpecHash: 'sha256:b',
        irHash: 'sha256:c',
        astHash: 'sha256:d',
        scriptHash: 'sha256:e',
        runtimeEvaluatorVersion: 'compiler.v1',
      },
      steps: ['session', 'confirmGenerate', 'poll'],
      turns: [{
        step: 'poll',
        status: 'PUBLISHED',
        pendingItemKeys: [],
        rulesCount: 2,
        readinessReady: true,
        failures: [],
        ruleSignatures: [],
        duplicateRuleSignatures: [],
      }],
      answers: {},
      failureReason: null,
      rootCause: null,
      consistency: completeConsistency,
    }], 1)

    expect(summary).toEqual({
      passed: true,
      total: 1,
      passedCount: 1,
      failedCaseIds: [],
      failures: [],
      rootCauseGroups: {},
    })
  })

  it('requires non-empty rules tree evidence for a passing case', () => {
    const summary = buildStaging30EvidenceSummary([{
      caseId: 's01',
      sessionId: 'session-1',
      status: 'passed',
      hashes: {
        rulesHash: 'sha256:a',
        canonicalSpecHash: 'sha256:b',
        irHash: 'sha256:c',
        astHash: 'sha256:d',
        scriptHash: 'sha256:e',
        runtimeEvaluatorVersion: 'compiler.v1',
      },
      steps: ['session', 'confirmGenerate', 'poll'],
      turns: [{
        step: 'poll',
        status: 'PUBLISHED',
        pendingItemKeys: [],
        rulesCount: 0,
        readinessReady: true,
        failures: [],
        ruleSignatures: [],
        duplicateRuleSignatures: [],
      }],
      answers: {},
      failureReason: null,
      rootCause: null,
      consistency: completeConsistency,
    }], 1)

    expect(summary.passed).toBe(false)
    expect(summary.failedCaseIds).toEqual(['s01'])
    expect(summary.failures[0]).toContain('rules_tree_empty')
    expect(summary.rootCauseGroups.rules_tree_empty).toEqual(['s01'])
  })

  it('requires all hash-chain fields for a passing case', () => {
    const summary = buildStaging30EvidenceSummary([{
      caseId: 's01',
      sessionId: 'session-1',
      status: 'passed',
      hashes: {
        rulesHash: 'sha256:a',
        canonicalSpecHash: 'sha256:b',
        irHash: 'sha256:c',
        astHash: 'sha256:d',
        scriptHash: 'sha256:e',
        runtimeEvaluatorVersion: '',
      },
      steps: ['session', 'confirmGenerate', 'poll'],
      turns: [{
        step: 'poll',
        status: 'PUBLISHED',
        pendingItemKeys: [],
        rulesCount: 1,
        readinessReady: true,
        failures: [],
        ruleSignatures: [],
        duplicateRuleSignatures: [],
      }],
      answers: {},
      failureReason: null,
      rootCause: null,
      consistency: completeConsistency,
    }], 1)

    expect(summary.passed).toBe(false)
    expect(summary.failedCaseIds).toEqual(['s01'])
    expect(summary.failures[0]).toContain('hashes incomplete')
  })

  it('requires real dialogue clarification evidence when pending slots were observed', () => {
    const summary = buildStaging30EvidenceSummary([{
      caseId: 's01',
      sessionId: 'session-1',
      status: 'passed',
      hashes: {
        rulesHash: 'sha256:a',
        canonicalSpecHash: 'sha256:b',
        irHash: 'sha256:c',
        astHash: 'sha256:d',
        scriptHash: 'sha256:e',
        runtimeEvaluatorVersion: 'compiler.v1',
      },
      steps: ['session', 'confirmGenerate', 'publish'],
      turns: [{
        step: 'session',
        status: 'DRAFTING',
        pendingItemKeys: ['executionContext.exchange'],
        rulesCount: 1,
        readinessReady: null,
        failures: [],
        ruleSignatures: [],
        duplicateRuleSignatures: [],
      }],
      answers: {},
      failureReason: null,
      rootCause: null,
      consistency: completeConsistency,
    }], 1)

    expect(summary.passed).toBe(false)
    expect(summary.failures[0]).toContain('dialogue clarification loop missing')
    expect(summary.rootCauseGroups.clarification_not_resolved_to_script).toEqual(['s01'])
  })

  it('groups mainflow failures by root cause', () => {
    const summary = buildStaging30EvidenceSummary([
      {
        caseId: 's01',
        status: 'failed',
        hashes: null,
        steps: ['session', 'clarification'],
        failureReason: 'rules_tree_empty, hash_chain_missing',
        rootCause: 'rules_tree_empty',
      },
      {
        caseId: 's02',
        status: 'failed',
        hashes: null,
        steps: ['session', 'clarification'],
        failureReason: 'dispatcher_fallback_used',
        rootCause: 'dispatcher_fallback_used',
      },
    ])

    expect(summary.rootCauseGroups).toEqual({
      rules_tree_empty: ['s01'],
      dispatcher_fallback_used: ['s02'],
    })
  })

  it('fails passing cases when strategy description or script consistency evidence is missing', () => {
    const summary = buildStaging30EvidenceSummary([{
      caseId: 's01',
      sessionId: 'session-1',
      status: 'passed',
      hashes: {
        rulesHash: 'sha256:a',
        canonicalSpecHash: 'sha256:b',
        irHash: 'sha256:c',
        astHash: 'sha256:d',
        scriptHash: 'sha256:e',
        runtimeEvaluatorVersion: 'compiler.v1',
      },
      steps: ['session', 'confirmGenerate', 'poll'],
      turns: [{
        step: 'poll',
        status: 'PUBLISHED',
        pendingItemKeys: [],
        rulesCount: 1,
        readinessReady: true,
        failures: [],
        ruleSignatures: [],
        duplicateRuleSignatures: [],
        assistantPrompt: null,
      }],
      answers: {},
      failureReason: null,
      rootCause: null,
      consistency: {
        passed: false,
        userPrompt: 'BTC 15m EMA20 做多',
        assistantPrompts: [],
        finalAssistantPrompt: null,
        scriptCode: null,
        strategyTokens: ['15m', 'btcusdt', 'ema', 'ema20', 'long'],
        missingInFinalDescription: ['15m', 'btcusdt', 'ema', 'ema20', 'long'],
        missingInScript: ['15m', 'btcusdt', 'ema', 'ema20', 'long'],
        failures: ['assistant_strategy_description_missing', 'script_code_missing'],
      },
    }], 1)

    expect(summary.passed).toBe(false)
    expect(summary.failedCaseIds).toEqual(['s01'])
    expect(summary.failures[0]).toContain('strategy_script_mismatch')
    expect(summary.rootCauseGroups.strategy_script_mismatch).toEqual(['s01'])
  })

  it('does not accept astDigest as staging astHash evidence', () => {
    const summary = buildStaging30EvidenceSummary([{
      caseId: 's01',
      sessionId: 'session-1',
      status: 'passed',
      hashes: {
        rulesHash: 'sha256:a',
        canonicalSpecHash: 'sha256:b',
        irHash: 'sha256:c',
        astHash: '',
        scriptHash: 'sha256:e',
        runtimeEvaluatorVersion: 'compiler.v1',
      },
      steps: ['session', 'confirmGenerate', 'publish'],
      turns: [{
        step: 'poll',
        status: 'PUBLISHED',
        pendingItemKeys: [],
        rulesCount: 1,
        readinessReady: true,
        failures: [],
        ruleSignatures: [],
        duplicateRuleSignatures: [],
      }],
      answers: {},
      failureReason: null,
      rootCause: null,
      consistency: completeConsistency,
    }], 1)

    expect(summary.passed).toBe(false)
    expect(summary.failures[0]).toContain('hashes incomplete')
  })

  it('extracts hash-chain evidence from public specDesc and runtime version from script header', () => {
    expect(extractStaging30HashesFromResponse({
      scriptCode: '/* @generated by compiler.v1 */\n/* irHash: sha256:c */',
      specDesc: {
        rulesOnlyHashChain: {
          hashes: {
            rulesHash: 'sha256:a',
            canonicalSpecHash: 'sha256:b',
            irHash: 'sha256:c',
            astHash: 'sha256:d',
            scriptHash: 'sha256:e',
          },
        },
      },
    })).toEqual({
      rulesHash: 'sha256:a',
      canonicalSpecHash: 'sha256:b',
      irHash: 'sha256:c',
      astHash: 'sha256:d',
      scriptHash: 'sha256:e',
      runtimeEvaluatorVersion: 'compiler.v1',
    })
  })

  it('reads confirmation digest from public specDesc when top-level canonicalDigest is absent', () => {
    expect(readStaging30ConfirmationDigest({
      canonicalDigest: null,
      specDesc: {
        confirmation: { digest: 'sha256:confirm' },
        canonicalDigest: 'sha256:canonical',
      },
    })).toBe('sha256:confirm')
  })

  it('does not invent runtime version when script header is absent', () => {
    expect(extractStaging30HashesFromResponse({
      specDesc: {
        rulesOnlyHashChain: {
          hashes: {
            rulesHash: 'sha256:a',
            canonicalSpecHash: 'sha256:b',
            irHash: 'sha256:c',
            astHash: 'sha256:d',
            scriptHash: 'sha256:e',
          },
        },
      },
    })).toBeNull()
  })

  it('answers a concrete DCA exit rule instead of leaving exit empty', () => {
    const answer = inferStaging30ClarificationAnswer(
      'ETH 现货每天定投 100 USDT，回撤 5% 加投 200 USDT。',
      {
        key: 'rulesTree.exit',
        field: 'rulesTree.exit',
        fieldPath: 'rulesTree.exit',
        slotKey: 'rulesTree.exit',
        reason: 'missing_exit_rules',
        question: '请补充退出规则。',
        blocking: true,
        status: 'pending',
      },
    )

    expect(answer).toContain('下跌 5%')
    expect(answer).toContain('卖出退出')
    expect(answer).not.toContain('不设置固定退出规则')
  })

  it('derives drawdown + threshold tokens from portfolio-scoped compiled risks', () => {
    const tokens = addCompiledPortfolioRiskTokens(
      [{ id: 'risk-dd', scope: 'portfolio', mode: 'enforce', thresholdPct: 15, effectWhenTriggered: 'block_new_entries' }],
      new Set<string>(),
    )

    expect(tokens.has('drawdown')).toBe(true)
    expect(tokens.has('15%')).toBe(true)
  })

  it('treats missing-scope compiled risk as portfolio drawdown (runtime default)', () => {
    const tokens = addCompiledPortfolioRiskTokens(
      [{ id: 'risk-dd', thresholdPct: 10 }],
      new Set<string>(),
    )

    expect(tokens.has('drawdown')).toBe(true)
    expect(tokens.has('10%')).toBe(true)
  })

  it('skips non-portfolio scopes for drawdown token derivation', () => {
    const tokens = addCompiledPortfolioRiskTokens(
      [{ id: 'cap', scope: 'symbol', notionalCapPct: 30 }],
      new Set<string>(),
    )

    expect(tokens.has('drawdown')).toBe(false)
    expect(tokens.size).toBe(0)
  })

  it('answers DCA add-position constraint with a parseable max add count', () => {
    const answer = inferStaging30ClarificationAnswer(
      'ETH 现货每天定投 100 USDT，回撤 5% 加投 200 USDT。',
      {
        key: 'semantic.action.add_position.constraint',
        field: 'semantic.action.add_position.constraint',
        fieldPath: 'actions[action.add_position].params.constraint',
        slotKey: 'action.add_position.constraint',
        reason: 'missing_add_position_constraint',
        question: '请确认加仓的约束。',
        blocking: true,
        status: 'pending',
      },
    )

    expect(answer).toContain('最多加投 1 次')
    expect(answer).toContain('回撤 5%')
  })

  it('checks generated script semantics instead of raw text tokens', () => {
    const scriptCode = [
      'const EXECUTION_MODEL = {"instrumentType":"perpetual","primaryTimeframe":"15m","symbol":"BTCUSDT","venue":"okx"} as const',
      'const DATA_REQUIREMENTS = {"requiredTimeframes":["15m"]} as const',
      'const EXPR_POOL = [{"payload":{"kind":"EMA","params":{"period":20},"timeframe":"15m"}}] as const',
      'const GUARD_PROGRAMS = [{"payload":{"kind":"STOP_LOSS_PCT","value":5}}] as const',
      'const DECISION_PROGRAMS = [{"actions":[{"kind":"OPEN_LONG","quantity":{"asset":"USDT","mode":"fixed_quote","value":10}}]}] as const',
      'const ORDER_PROGRAMS = [] as const',
      'const ORCHESTRATION_PROGRAMS = [] as const',
      'const ORCHESTRATION_PORTFOLIO_RISKS = [] as const',
    ].join('\n')

    expect(scriptCoversStrategyToken(scriptCode, 'btcusdt')).toBe(true)
    expect(scriptCoversStrategyToken(scriptCode, 'okx')).toBe(true)
    expect(scriptCoversStrategyToken(scriptCode, 'perp')).toBe(true)
    expect(scriptCoversStrategyToken(scriptCode, '15m')).toBe(true)
    expect(scriptCoversStrategyToken(scriptCode, 'ema20')).toBe(true)
    expect(scriptCoversStrategyToken(scriptCode, '5%')).toBe(true)
    expect(scriptCoversStrategyToken(scriptCode, '10usdt')).toBe(true)
    expect(scriptCoversStrategyToken(scriptCode, 'ema60')).toBe(false)
  })

  it('uses natural confirmation so the server owns the latest canonical digest', () => {
    expect(buildStaging30ConfirmGenerateBody()).toEqual({
      message: '确认生成',
      locale: 'zh',
    })
  })

  it('answers unstructured post-confirm grid questions generically', () => {
    expect(inferStaging30AssistantPromptAnswer(
      '15m 周期，价格区间 79200-80200，采用双向网格',
      '请确认：你要不要把“入场”也显式加成 entry 规则，还是保持“仅由网格程序自动入场”。',
    )).toContain('仅由网格程序自动入场')

    expect(inferStaging30AssistantPromptAnswer(
      '当价格突破上下边界时执行“立即停止并撤销所有未成交订单”',
      '请确认：突破边界后行为保持 continue，还是改为 stop？',
    )).toContain('stop')

    expect(inferStaging30AssistantPromptAnswer(
      '15m 周期，价格区间 79200-80200，采用双向网格',
      '请确认单笔仓位大小（position.sizing）。',
    )).toBe('10%')
  })

  it('does not infer MA token from EMA wording', () => {
    expect(extractStrategyTokens('价格在 ema20 ema60 ema144 上方时做多')).toEqual(
      expect.arrayContaining(['ema', 'ema20', 'ema60', 'ema144']),
    )
    expect(extractStrategyTokens('价格在 ema20 ema60 ema144 上方时做多')).not.toContain('ma')
  })

  it('does not infer 4h from 24-hour lookback wording', () => {
    expect(extractStrategyTokens('BTC 突破过去 24 小时高点后等待回踩不破再买')).not.toContain('4h')
  })

  it('classifies ATR risk predicates as stop loss and take profit tokens', () => {
    const scriptCode = [
      'const EXECUTION_MODEL = {"instrumentType":"spot","primaryTimeframe":"1h","symbol":"ETHUSDT","venue":"okx"} as const',
      'const DATA_REQUIREMENTS = {"requiredTimeframes":["1h"]} as const',
      'const EXPR_POOL = [] as const',
      'const GUARD_PROGRAMS = [] as const',
      'const RISK_PREDICATES = [{"kind":"atrTrailingStop"},{"kind":"atrMultipleTakeProfit"}] as const',
      'const DECISION_PROGRAMS = [] as const',
      'const ORDER_PROGRAMS = [] as const',
      'const ORCHESTRATION_PROGRAMS = [] as const',
      'const ORCHESTRATION_PORTFOLIO_RISKS = [] as const',
    ].join('\n')

    expect(scriptCoversStrategyToken(scriptCode, 'stop_loss')).toBe(true)
    expect(scriptCoversStrategyToken(scriptCode, 'take_profit')).toBe(true)
    expect(scriptCoversStrategyToken(scriptCode, 'atr')).toBe(true)
  })

  it('classifies remembered breakout stop predicates as stop loss tokens', () => {
    const scriptCode = [
      'const EXECUTION_MODEL = {"instrumentType":"perpetual","primaryTimeframe":"24h","symbol":"BTCUSDT","venue":"okx"} as const',
      'const DATA_REQUIREMENTS = {"requiredTimeframes":["24h"]} as const',
      'const EXPR_POOL = [] as const',
      'const GUARD_PROGRAMS = [] as const',
      'const RISK_PREDICATES = [{"kind":"rememberedLevelStop","levelKey":"previous_extrema"}] as const',
      'const DECISION_PROGRAMS = [] as const',
      'const ORDER_PROGRAMS = [] as const',
      'const ORCHESTRATION_PROGRAMS = [] as const',
      'const ORCHESTRATION_PORTFOLIO_RISKS = [] as const',
    ].join('\n')

    expect(scriptCoversStrategyToken(scriptCode, 'stop_loss')).toBe(true)
  })

  it('classifies MACD compiled predicates as MACD tokens', () => {
    const scriptCode = [
      'const EXECUTION_MODEL = {"instrumentType":"perpetual","primaryTimeframe":"1h","symbol":"BTCUSDT","venue":"okx"} as const',
      'const DATA_REQUIREMENTS = {"requiredTimeframes":["1h"]} as const',
      'const EXPR_POOL = [] as const',
      'const GUARD_PROGRAMS = [] as const',
      'const RISK_PREDICATES = [] as const',
      'const DECISION_PROGRAMS = [{"predicate":{"kind":"macdGoldenCross"},"actions":[{"kind":"OPEN_LONG"}]}] as const',
      'const ORDER_PROGRAMS = [] as const',
      'const ORCHESTRATION_PROGRAMS = [] as const',
      'const ORCHESTRATION_PORTFOLIO_RISKS = [] as const',
    ].join('\n')

    expect(scriptCoversStrategyToken(scriptCode, 'macd')).toBe(true)
  })

  it('classifies grid order program quantities and spacing as script tokens', () => {
    const scriptCode = [
      'const EXECUTION_MODEL = {"instrumentType":"spot","primaryTimeframe":"1m","symbol":"ETHUSDT","venue":"okx"} as const',
      'const DATA_REQUIREMENTS = {"requiredTimeframes":["1m"]} as const',
      'const EXPR_POOL = [{"payload":{"kind":"ARITHMETIC_LEVEL_SET","spacing":{"mode":"pct","value":0.4},"timeframe":"1m"}}] as const',
      'const GUARD_PROGRAMS = [] as const',
      'const RISK_PREDICATES = [] as const',
      'const DECISION_PROGRAMS = [] as const',
      'const ORDER_PROGRAMS = [{"payload":{"kind":"LIMIT_LADDER","quantity":{"asset":"USDT","mode":"fixed_quote","value":10}}}] as const',
      'const ORCHESTRATION_PROGRAMS = [] as const',
      'const ORCHESTRATION_PORTFOLIO_RISKS = [] as const',
    ].join('\n')

    expect(scriptCoversStrategyToken(scriptCode, 'grid')).toBe(true)
    expect(scriptCoversStrategyToken(scriptCode, '0.4%')).toBe(true)
    expect(scriptCoversStrategyToken(scriptCode, '10usdt')).toBe(true)
  })

  // Bug A1：runner 签名按语义参数区分，禁止 key-only 误杀
  describe('buildRuleSignature (semantic param-aware)', () => {
    const makeExitPercentChangeRule = (id: string, basis: string, valuePct: number) => ({
      id,
      phase: 'exit',
      sideScope: 'long',
      condition: {
        kind: 'atom',
        key: 'price.percent_change',
        sideScope: 'long',
        params: { basis, valuePct, direction: valuePct >= 0 ? 'up' : 'down' },
      },
      effects: {
        actions: [{ kind: 'atom', key: 'action.close_long', sideScope: 'long', params: {} }],
      },
    })

    it('produces 3 distinct signatures for 3 exit percent_change rules with different basis/valuePct', () => {
      const r1 = makeExitPercentChangeRule('tp', 'prev_close', 1)
      const r2 = makeExitPercentChangeRule('sl', 'entry_avg_price', -5)
      const r3 = makeExitPercentChangeRule('tp2', 'entry_avg_price', 10)
      const sigs = [r1, r2, r3].map(buildRuleSignature)
      expect(sigs.every(s => typeof s === 'string')).toBe(true)
      expect(new Set(sigs).size).toBe(3)
    })

    it('dedupes 2 truly identical rules to 1 signature', () => {
      const a = makeExitPercentChangeRule('a', 'entry_avg_price', -5)
      const b = makeExitPercentChangeRule('b', 'entry_avg_price', -5)
      expect(buildRuleSignature(a)).toBe(buildRuleSignature(b))
    })

    it('ignores noise params (phase/source/basisSource/evidence) in signature', () => {
      const base = makeExitPercentChangeRule('a', 'entry_avg_price', -5)
      const withNoise = {
        ...base,
        condition: {
          ...base.condition,
          params: {
            ...base.condition.params,
            phase: 'exit',
            source: 'planner',
            basisSource: 'user',
            evidence: 'foo',
          },
        },
      }
      expect(buildRuleSignature(base)).toBe(buildRuleSignature(withNoise))
    })

    it('treats and/or children as order-insensitive', () => {
      const ruleAB = {
        phase: 'entry',
        sideScope: 'long',
        condition: {
          kind: 'and',
          children: [
            { kind: 'atom', key: 'indicator.above', sideScope: 'long', params: { ref: 'ma20' } },
            { kind: 'atom', key: 'indicator.below', sideScope: 'long', params: { ref: 'ma60' } },
          ],
        },
        effects: { actions: [{ kind: 'atom', key: 'action.open_long', sideScope: 'long', params: {} }] },
      }
      const ruleBA = {
        ...ruleAB,
        condition: {
          ...ruleAB.condition,
          children: [...ruleAB.condition.children].reverse(),
        },
      }
      expect(buildRuleSignature(ruleAB)).toBe(buildRuleSignature(ruleBA))
    })
  })

  // Bug A2：bollinger.middle(period=N) 等价于 maN，token 覆盖应放行
  describe('scriptCoversStrategyToken (bollinger middle ≡ ma)', () => {
    it('treats bollinger.touch_middle with period=20 as ma20 coverage', () => {
      const scriptCode = [
        'const EXECUTION_MODEL = {"venue":"binance","symbol":"BTCUSDT","instrumentType":"perpetual","primaryTimeframe":"15m"} as const',
        'const DATA_REQUIREMENTS = {"requiredTimeframes":["15m"]} as const',
        // EXPR_POOL 不含 BAND 形态，仅 predicate sourceRef 引用 bollinger.touch_middle + period=20
        'const EXPR_POOL = [{"id":"e1","payload":{"kind":"PRICE","timeframe":"15m"}},{"id":"e2","payload":{"kind":"PREDICATE","sourceRef":"bollinger.touch_middle","params":{"period":20}}}] as const',
        'const GUARD_PROGRAMS = [] as const',
        'const RISK_PREDICATES = [] as const',
        'const DECISION_PROGRAMS = [] as const',
        'const ORDER_PROGRAMS = [] as const',
        'const ORCHESTRATION_PROGRAMS = [] as const',
        'const ORCHESTRATION_PORTFOLIO_RISKS = [] as const',
      ].join('\n')

      expect(scriptCoversStrategyToken(scriptCode, 'ma20')).toBe(true)
    })
  })

  // Bug #1633：drift/regression 检测必须基于 atomKeys（与 param-aware sig 解耦）
  describe('detectSemanticDriftAndRegression (atom-key based, decoupled from buildRuleSignature)', () => {
    const makeAndRule = () => ({
      id: 'r1',
      phase: 'entry',
      sideScope: 'long',
      condition: {
        kind: 'and',
        children: [
          { kind: 'atom', key: 'indicator.above', sideScope: 'long', params: { indicator: 'ema', period: 50 } },
          { kind: 'atom', key: 'indicator.above', sideScope: 'long', params: { indicator: 'ema', period: 200 } },
        ],
      },
      effects: {
        actions: [{ kind: 'atom', key: 'action.open_long', sideScope: 'long', params: {} }],
      },
    })

    it('collectAtomKeysFromRule flattens AtomExpr leaves into sorted unique keys', () => {
      expect(collectAtomKeysFromRule(makeAndRule())).toEqual(['action.open_long', 'indicator.above'])
    })

    it('collectAtomKeysFromRules dedupes across multiple rules', () => {
      const rule = makeAndRule()
      expect(collectAtomKeysFromRules([rule, rule])).toEqual(['action.open_long', 'indicator.above'])
    })

    it('collectPhaseCountsFromRules tallies by rule.phase', () => {
      const r1 = makeAndRule()
      const r2 = { ...makeAndRule(), id: 'r2', phase: 'exit' }
      expect(collectPhaseCountsFromRules([r1, r2])).toEqual({ entry: 1, exit: 1 })
    })

    // 复现 s01/s17/s21 形态：两轮 condition 都是
    // and(indicator.above{period:50}, indicator.above{period:200})；
    // 旧路径用 sig.split('|')[2].split(',') 反推 atom-key 必然误判 drift；
    // 新路径直接消费 atomKeys，两轮 atomKeys 一致 → 不应报 drift。
    it('does NOT flag semantic_drift when two turns share atom keys but params differ (Bug #1633)', () => {
      const rule = makeAndRule()
      const turn1 = {
        atomKeys: collectAtomKeysFromRules([rule]),
        phaseCounts: collectPhaseCountsFromRules([rule]),
      }
      const turn2 = {
        atomKeys: collectAtomKeysFromRules([rule]),
        phaseCounts: collectPhaseCountsFromRules([rule]),
      }
      // 兜底校验前置：sig 含 params，两轮 sig 必然相同（同 rule 引用）；
      // 即便 params 不同（构造 rule2 也行），atomKeys 仍一致。
      expect(turn1.atomKeys).toEqual(['action.open_long', 'indicator.above'])
      expect(detectSemanticDriftAndRegression([turn1, turn2])).toEqual([])
    })

    it('flags semantic_drift when final turn loses an atom key seen earlier', () => {
      const turns = [
        { atomKeys: ['action.open_long', 'indicator.above'], phaseCounts: { entry: 1 } },
        { atomKeys: ['action.open_long'], phaseCounts: { entry: 1 } },
      ]
      expect(detectSemanticDriftAndRegression(turns)).toEqual(['semantic_drift'])
    })

    it('flags semantic_regression when final turn has fewer rules for a phase', () => {
      const turns = [
        { atomKeys: ['action.open_long', 'indicator.above'], phaseCounts: { entry: 2 } },
        { atomKeys: ['action.open_long', 'indicator.above'], phaseCounts: { entry: 1 } },
      ]
      expect(detectSemanticDriftAndRegression(turns)).toEqual(['semantic_regression'])
    })

    // Bug #1691 s19：opaque `condition.sequence` atom ↔ 结构化 `kind:'sequence'`
    // 容器等价；collectAtomKeysFromCondition 必须把两种形式归一化为同一 leaf
    // 集合，否则跨轮归一化会被误判为 semantic_drift。
    it('normalizes opaque condition.sequence atom and structural sequence container to same atom-key set', () => {
      const opaqueRule = {
        id: 'r1',
        phase: 'entry',
        sideScope: 'long',
        condition: {
          kind: 'and',
          children: [
            { kind: 'atom', key: 'indicator.above', params: { indicator: 'ma', period: 50 } },
            {
              kind: 'atom',
              key: 'condition.sequence',
              params: {
                sequenceKind: 'threshold_then_cross',
                steps: [
                  { kind: 'atom', key: 'oscillator.rsi_lte', params: { value: 35, period: 14 } },
                  { kind: 'atom', key: 'indicator.cross_over', params: { value: 35, indicator: 'rsi' } },
                ],
              },
            },
          ],
        },
        effects: { actions: [{ kind: 'atom', key: 'action.open_long', params: {} }] },
      }
      const structuralRule = {
        id: 'r1',
        phase: 'entry',
        sideScope: 'long',
        condition: {
          kind: 'and',
          children: [
            { kind: 'atom', key: 'indicator.above', params: { indicator: 'ma', period: 50 } },
            {
              kind: 'sequence',
              steps: [
                { kind: 'atom', key: 'oscillator.rsi_lte', params: { value: 35, period: 14 } },
                { kind: 'atom', key: 'indicator.cross_over', params: { value: 35, indicator: 'rsi' } },
              ],
            },
          ],
        },
        effects: { actions: [{ kind: 'atom', key: 'action.open_long', params: {} }] },
      }
      const opaqueKeys = collectAtomKeysFromRule(opaqueRule)
      const structuralKeys = collectAtomKeysFromRule(structuralRule)
      expect(opaqueKeys).toEqual(structuralKeys)
      expect(opaqueKeys).toEqual(['action.open_long', 'indicator.above', 'indicator.cross_over', 'oscillator.rsi_lte'])
      // 跨轮 drift 检测：opaque → structural 不应触发 drift
      expect(detectSemanticDriftAndRegression([
        { atomKeys: opaqueKeys, phaseCounts: { entry: 1 } },
        { atomKeys: structuralKeys, phaseCounts: { entry: 1 } },
      ])).toEqual([])
    })

    it('collectAtomKeysFromCondition descends through all AtomExpr kinds (atom/and/or/not/sequence)', () => {
      const rule = {
        id: 'mixed',
        phase: 'entry',
        sideScope: 'long',
        condition: {
          kind: 'or',
          children: [
            { kind: 'atom', key: 'indicator.above', params: { indicator: 'ma' } },
            {
              kind: 'not',
              child: { kind: 'atom', key: 'oscillator.rsi_gte', params: { value: 70 } },
            },
            {
              kind: 'sequence',
              steps: [
                { kind: 'atom', key: 'oscillator.rsi_lte', params: { value: 35 } },
                {
                  kind: 'and',
                  children: [
                    { kind: 'atom', key: 'indicator.cross_over', params: { indicator: 'rsi' } },
                  ],
                },
              ],
            },
          ],
        },
        effects: { actions: [{ kind: 'atom', key: 'action.open_long', params: {} }] },
      }
      expect(collectAtomKeysFromRule(rule)).toEqual([
        'action.open_long',
        'indicator.above',
        'indicator.cross_over',
        'oscillator.rsi_gte',
        'oscillator.rsi_lte',
      ])
    })

    it('returns empty when no drift / regression', () => {
      const turns = [
        { atomKeys: ['action.open_long', 'indicator.above'], phaseCounts: { entry: 1 } },
        { atomKeys: ['action.open_long', 'indicator.above'], phaseCounts: { entry: 1 } },
      ]
      expect(detectSemanticDriftAndRegression(turns)).toEqual([])
    })
  })

  describe('#1633 staging s29 pyramiding token disambig + renderer surface', () => {
    it('drops take_profit token when prompt mixes "盈利X%" with pyramiding keyword', () => {
      const prompt = 'BTC 1h 突破前高开多，盈利 3% 后加仓 50%，最多加 3 层。'
      const tokens = extractStrategyTokens(prompt)
      expect(tokens).not.toContain('take_profit')
      // 数值百分比 token 仍应保留——report 的 scriptCoversStrategyToken 由
      //   pyramidingHint 在 scriptCode 端补全证据
      expect(tokens).toContain('3%')
      expect(tokens).toContain('50%')
    })

    it('keeps take_profit token when prompt has explicit 止盈 / takeprofit even with pyramiding', () => {
      const prompt = 'BTC 1h 突破前高开多，加仓 50%，止盈 5%'
      const tokens = extractStrategyTokens(prompt)
      expect(tokens).toContain('take_profit')
      expect(tokens).toContain('5%')
      expect(tokens).toContain('50%')
    })

    it('keeps take_profit when "盈利X%" appears without pyramiding keyword', () => {
      const prompt = 'BTC 1h 做多，盈利 5% 后平仓'
      const tokens = extractStrategyTokens(prompt)
      expect(tokens).toContain('take_profit')
      expect(tokens).toContain('5%')
    })

    it('scriptCoversStrategyToken reads pyramidingHint metadata to surface profit / sizing percent tokens', () => {
      const scriptCode = `
const EXECUTION_MODEL = {"venue":"binance","symbol":"BTCUSDT","instrumentType":"perpetual","primaryTimeframe":"1h"} as const
const DATA_REQUIREMENTS = {"requiredTimeframes":["1h"]} as const
const EXPR_POOL = [] as const
const GUARD_PROGRAMS = [] as const
const RISK_PREDICATES = [] as const
const DECISION_PROGRAMS = [{"id":"r1","phase":"entry","actions":[{"kind":"OPEN_LONG","quantity":{"mode":"pct_equity","value":5}}],"metadata":{"pyramidingHint":{"maxLayers":3,"layerSizing":50,"profitThreshold":3}}}] as const
const ORDER_PROGRAMS = [] as const
const ORCHESTRATION_PROGRAMS = [] as const
const ORCHESTRATION_PORTFOLIO_RISKS = [] as const
`
      expect(scriptCoversStrategyToken(scriptCode, '3%')).toBe(true)
      expect(scriptCoversStrategyToken(scriptCode, '50%')).toBe(true)
      // take_profit 不通过 pyramidingHint 自动补——属于 pyramiding profit trigger，
      //   不是出场止盈
      expect(scriptCoversStrategyToken(scriptCode, 'take_profit')).toBe(false)
    })
  })
})
