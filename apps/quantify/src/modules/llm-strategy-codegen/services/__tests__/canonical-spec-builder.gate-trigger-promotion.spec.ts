/**
 * #1358: gate-only substrategy path — CanonicalSpecBuilderService
 *
 * 当 LLM patch 将 portfolioRisk.* / scope.* atom 以 phase='gate' 放进
 * state.triggers（而非 orchestration.nodes）时，buildFromSemanticState 需要将
 * 这些 trigger 提升为 spec.orchestration.portfolioRisks / .scopes。
 *
 * 本 spec 覆盖三个场景：
 *   T1. drawdown_block gate trigger → orchestration.portfolioRisks scope='portfolio'
 *   T2. scope.symbol + symbol_exposure_cap gate triggers → scope + portfolioRisk
 *   T3. scope.subStrategy×2 + substrategy_exposure_cap gate trigger → 2 scopes + 2 portfolioRisks
 */

import type { SemanticState, SemanticTriggerState } from '../../types/semantic-state'
import { CanonicalSpecBuilderService } from '../canonical-spec-builder.service'
import { CanonicalSpecV2IrCompilerService } from '../canonical-spec-v2-ir-compiler.service'

function makeBaseState(triggers: SemanticTriggerState[]): SemanticState {
  return {
    version: 1,
    families: [],
    triggers,
    actions: [],
    risk: [],
    position: null,
    contextSlots: {
      exchange: {
        slotKey: 'context.exchange',
        fieldPath: 'exchange',
        value: 'OKX',
        status: 'locked',
        priority: 'context',
        questionHint: '交易所',
        affectsExecution: true,
      },
      symbol: null,
      marketType: {
        slotKey: 'context.marketType',
        fieldPath: 'marketType',
        value: 'perpetual',
        status: 'locked',
        priority: 'context',
        questionHint: '市场类型',
        affectsExecution: true,
      },
      timeframe: null,
    },
    normalizationNotes: [],
    updatedAt: '2026-05-14T00:00:00.000Z',
  }
}

function makeGateTrigger(
  id: string,
  key: string,
  params: Record<string, unknown>,
): SemanticTriggerState {
  return {
    id,
    key,
    phase: 'gate',
    params,
    status: 'locked',
    source: 'user_explicit',
    openSlots: [],
    contracts: [],
  }
}

const builder = new CanonicalSpecBuilderService()
const compiler = new CanonicalSpecV2IrCompilerService()

const FALLBACK = {
  exchange: 'okx' as const,
  symbol: 'BTCUSDT',
  baseTimeframe: '1h',
  positionPct: 10,
}

describe('CanonicalSpecBuilderService — gate trigger promotion (#1358)', () => {
  // ---------------------------------------------------------------
  // T1: portfolioRisk.drawdown_block gate trigger → portfolio risk
  // ---------------------------------------------------------------
  describe('T1: drawdown_block gate trigger → orchestration.portfolioRisks scope=portfolio', () => {
    const state = makeBaseState([
      makeGateTrigger('trig-drawdown-1', 'portfolioRisk.drawdown_block', {
        thresholdPct: 15,
        mode: 'enforce',
      }),
    ])
    const spec = builder.buildFromSemanticState(state)

    it('spec.orchestration.portfolioRisks 应含 1 条 scope=portfolio 记录', () => {
      expect(spec.orchestration?.portfolioRisks).toHaveLength(1)
      const risk = spec.orchestration?.portfolioRisks?.[0]
      expect(risk).toMatchObject({
        id: 'trig-drawdown-1',
        scope: 'portfolio',
        mode: 'enforce',
        thresholdPct: 15,
        effectWhenTriggered: 'block_new_entries',
      })
    })

    it('IR orchestrationPortfolioRisks 透传 thresholdPct', () => {
      const { ir } = compiler.compile({ canonicalSpec: spec, fallback: FALLBACK })
      const risks = ir.orchestrationPortfolioRisks ?? []
      expect(risks).toHaveLength(1)
      expect(risks[0]).toMatchObject({ scope: 'portfolio', thresholdPct: 15 })
    })
  })

  // ---------------------------------------------------------------
  // T2: scope.symbol + symbol_exposure_cap
  // ---------------------------------------------------------------
  describe('T2: scope.symbol + symbol_exposure_cap gate triggers → scope + portfolioRisk', () => {
    const state = makeBaseState([
      makeGateTrigger('trig-sym-scope-1', 'scope.symbol', {
        symbols: ['BTCUSDT', 'ETHUSDT'],
        primarySymbol: 'BTCUSDT',
      }),
      makeGateTrigger('trig-sym-cap-1', 'portfolioRisk.symbol_exposure_cap', {
        notionalCapPct: 30,
        mode: 'enforce',
        effectWhenTriggered: 'block_new_entries',
      }),
    ])
    const spec = builder.buildFromSemanticState(state)

    it('spec.orchestration.scopes 含 symbol scope（symbols 已排序）', () => {
      const scopes = spec.orchestration?.scopes ?? []
      const symScope = scopes.find(s => s.scopeKind === 'symbol')
      expect(symScope).toBeDefined()
      if (symScope?.scopeKind === 'symbol') {
        expect(symScope.symbols).toEqual(['BTCUSDT', 'ETHUSDT'])
        expect(symScope.primarySymbol).toBe('BTCUSDT')
      }
    })

    it('spec.orchestration.portfolioRisks 含 symbol exposure cap，symbolScopeRef 指向 symbol scope', () => {
      const risks = spec.orchestration?.portfolioRisks ?? []
      const capRisk = risks.find(r => r.scope === 'symbol')
      expect(capRisk).toBeDefined()
      if (capRisk?.scope === 'symbol') {
        expect(capRisk.notionalCapPct).toBe(30)
        expect(capRisk.mode).toBe('enforce')
        expect(capRisk.symbolScopeRef).toBe('trig-sym-scope-1')
      }
    })
  })

  // ---------------------------------------------------------------
  // T3: scope.subStrategy×2 + substrategy_exposure_cap
  // ---------------------------------------------------------------
  describe('T3: scope.subStrategy×2 + substrategy_exposure_cap → 2 scopes + 2 portfolioRisks', () => {
    const state = makeBaseState([
      makeGateTrigger('trig-sub-scope-A', 'scope.subStrategy', {
        subStrategyId: 'A_RSI_reversal_long_BTC',
        positionHandlingOnDeactivate: 'close',
        orderHandlingOnDeactivate: 'cancel',
      }),
      makeGateTrigger('trig-sub-scope-B', 'scope.subStrategy', {
        subStrategyId: 'B_EMA_trend_follow_ETH',
        positionHandlingOnDeactivate: 'close',
        orderHandlingOnDeactivate: 'cancel',
      }),
      makeGateTrigger('trig-sub-cap-1', 'portfolioRisk.substrategy_exposure_cap', {
        notionalCapPct: 50,
        mode: 'enforce',
        effectWhenTriggered: 'block_new_entries',
      }),
      makeGateTrigger('trig-drawdown-2', 'portfolioRisk.drawdown_block', {
        thresholdPct: 15,
        mode: 'enforce',
      }),
    ])
    const spec = builder.buildFromSemanticState(state)

    it('spec.orchestration.scopes 含 2 个 subStrategy scope', () => {
      const scopes = spec.orchestration?.scopes ?? []
      const subScopes = scopes.filter(s => s.scopeKind === 'subStrategy')
      expect(subScopes).toHaveLength(2)
      const ids = subScopes.map(s => (s as { subStrategyId?: string }).subStrategyId).sort()
      expect(ids).toEqual(['A_RSI_reversal_long_BTC', 'B_EMA_trend_follow_ETH'])
    })

    it('每个 subStrategy scope positionHandlingOnDeactivate=close', () => {
      const scopes = spec.orchestration?.scopes ?? []
      const subScopes = scopes.filter(s => s.scopeKind === 'subStrategy')
      for (const scope of subScopes) {
        if (scope.scopeKind === 'subStrategy') {
          expect(scope.positionHandlingOnDeactivate).toBe('close')
        }
      }
    })

    it('spec.orchestration.portfolioRisks 含 2 条 subStrategy cap + 1 条 drawdown', () => {
      const risks = spec.orchestration?.portfolioRisks ?? []
      const subRisks = risks.filter(r => r.scope === 'subStrategy')
      const drawdownRisks = risks.filter(r => r.scope === 'portfolio')
      expect(subRisks).toHaveLength(2)
      expect(drawdownRisks).toHaveLength(1)
    })

    it('subStrategy portfolioRisk 各 subStrategyScopeRef 绑定到对应 scope trigger id', () => {
      const risks = spec.orchestration?.portfolioRisks ?? []
      const subRisks = risks.filter(r => r.scope === 'subStrategy')
      const refs = subRisks.map(r => (r as { subStrategyScopeRef?: string }).subStrategyScopeRef).sort()
      expect(refs).toEqual(['trig-sub-scope-A', 'trig-sub-scope-B'])
    })

    it('IR orchestrationPortfolioRisks 共 3 条（2 subStrategy + 1 portfolio）', () => {
      const { ir } = compiler.compile({ canonicalSpec: spec, fallback: FALLBACK })
      const risks = ir.orchestrationPortfolioRisks ?? []
      expect(risks.filter(r => r.scope === 'subStrategy')).toHaveLength(2)
      expect(risks.filter(r => r.scope === 'portfolio')).toHaveLength(1)
    })

    it('IR orchestrationScopes 含 2 个 subStrategy scope', () => {
      const { ir } = compiler.compile({ canonicalSpec: spec, fallback: FALLBACK })
      const scopes = ir.orchestrationScopes ?? []
      expect(scopes.filter(s => s.scopeKind === 'subStrategy')).toHaveLength(2)
    })
  })

  // ---------------------------------------------------------------
  // T4: 无 gate trigger → 无额外 portfolioRisk / scope（零侧效应）
  // ---------------------------------------------------------------
  describe('T4: no gate triggers → no extra portfolioRisks/scopes emitted', () => {
    const state = makeBaseState([])
    const spec = builder.buildFromSemanticState(state)

    it('spec.orchestration 为 undefined（无任何 orchestration 数据）', () => {
      expect(spec.orchestration).toBeUndefined()
    })
  })
})
