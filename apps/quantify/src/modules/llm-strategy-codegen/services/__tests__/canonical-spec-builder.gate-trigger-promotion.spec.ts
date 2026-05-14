/**
 * #1364 AC-4 — CanonicalSpecBuilderService orchestration 节点直读
 *
 * 历史背景：本 spec 原名 "gate-trigger-promotion"，用于覆盖 PR #1359/#1360 引入的
 * 三段 promotion hack（buildOrchestrationPairsFromProgramActions /
 * buildOrchestration*FromGateTriggers），把 LLM 错放在 state.trigger[] 里的
 * portfolioRisk.* / scope.* atom 提升到 spec.orchestration。
 *
 * AC-4 之后：服务端归桶器已按 ATOM_CONTRACT_REGISTRY[key].bucket 单一真相源把
 * orchestration atom 直接落到 state.orchestration[]，三段 hack 已物理删除。
 * 本 spec 改为直接验证 builder 从 state.orchestration[] 正确派生
 * spec.orchestration.portfolioRisks / .scopes。
 */

import type { SemanticOrchestrationNode, SemanticState } from '../../types/semantic-state'
import { CanonicalSpecBuilderService } from '../canonical-spec-builder.service'
import { CanonicalSpecV2IrCompilerService } from '../canonical-spec-v2-ir-compiler.service'

function makeBaseState(orchestration: SemanticOrchestrationNode[]): SemanticState {
  return {
    version: 1,
    families: [],
    trigger: [],
    action: [],
    risk: [],
    positionConstraint: [],
    orchestration,
    orchestrationContracts: [],
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

function makeDrawdownBlockNode(id: string, thresholdPct: number): SemanticOrchestrationNode {
  return {
    id,
    kind: 'portfolioRisk',
    key: 'portfolioRisk.drawdown_block',
    params: { thresholdPct, mode: 'enforce' },
    status: 'locked',
    source: 'user_explicit',
    openSlots: [],
    contracts: [],
    scope: 'portfolio',
    mode: 'enforce',
    thresholdPct,
  }
}

function makeSymbolScopeNode(
  id: string,
  symbols: readonly string[],
  primarySymbol?: string,
): SemanticOrchestrationNode {
  return {
    id,
    kind: 'scope',
    key: 'scope.symbol',
    params: { symbols: [...symbols], ...(primarySymbol ? { primarySymbol } : {}) },
    status: 'locked',
    source: 'user_explicit',
    openSlots: [],
    contracts: [],
    symbolScopeKind: 'symbol',
    symbols,
    ...(primarySymbol ? { primarySymbol } : {}),
  }
}

function makeSubStrategyScopeNode(
  id: string,
  subStrategyId: string,
): SemanticOrchestrationNode {
  return {
    id,
    kind: 'scope',
    key: 'scope.subStrategy',
    params: {
      subStrategyId,
      positionHandlingOnDeactivate: 'close',
      orderHandlingOnDeactivate: 'cancel',
    },
    status: 'locked',
    source: 'user_explicit',
    openSlots: [],
    contracts: [],
    subStrategyScopeKind: 'subStrategy',
    subStrategyId,
    positionHandlingOnDeactivate: 'close',
    orderHandlingOnDeactivate: 'cancel',
  }
}

function makeSymbolExposureCapNode(
  id: string,
  notionalCapPct: number,
  boundSymbolScopeRef: string,
): SemanticOrchestrationNode {
  return {
    id,
    kind: 'portfolioRisk',
    key: 'portfolioRisk.symbol_exposure_cap',
    params: {
      notionalCapPct,
      mode: 'enforce',
      effectWhenTriggered: 'block_new_entries',
      boundSymbolScopeRef,
    },
    status: 'locked',
    source: 'user_explicit',
    openSlots: [],
    contracts: [],
    scope: 'symbol',
    mode: 'enforce',
    notionalCapPct,
    effectWhenTriggered: 'block_new_entries',
    boundSymbolScopeRef,
  }
}

function makeSubStrategyExposureCapNode(
  id: string,
  notionalCapPct: number,
  boundSubStrategyScopeRef: string,
): SemanticOrchestrationNode {
  return {
    id,
    kind: 'portfolioRisk',
    key: 'portfolioRisk.substrategy_exposure_cap',
    params: {
      notionalCapPct,
      mode: 'enforce',
      effectWhenTriggered: 'block_new_entries',
      boundSubStrategyScopeRef,
    },
    status: 'locked',
    source: 'user_explicit',
    openSlots: [],
    contracts: [],
    scope: 'subStrategy',
    mode: 'enforce',
    notionalCapPct,
    effectWhenTriggered: 'block_new_entries',
    boundSubStrategyScopeRef,
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

describe('CanonicalSpecBuilderService — orchestration nodes → spec.orchestration (#1364 AC-4)', () => {
  // ---------------------------------------------------------------
  // T1: portfolioRisk.drawdown_block node → portfolio risk
  // ---------------------------------------------------------------
  describe('T1: drawdown_block orchestration node → orchestration.portfolioRisks scope=portfolio', () => {
    const state = makeBaseState([
      makeDrawdownBlockNode('node-drawdown-1', 15),
    ])
    const spec = builder.buildFromSemanticState(state)

    it('spec.orchestration.portfolioRisks 应含 1 条 scope=portfolio 记录', () => {
      expect(spec.orchestration?.portfolioRisks).toHaveLength(1)
      const risk = spec.orchestration?.portfolioRisks?.[0]
      expect(risk).toMatchObject({
        id: 'node-drawdown-1',
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
  // T2: scope.symbol + symbol_exposure_cap orchestration nodes
  // ---------------------------------------------------------------
  describe('T2: scope.symbol + symbol_exposure_cap orchestration nodes → scope + portfolioRisk', () => {
    const state = makeBaseState([
      makeSymbolScopeNode('node-sym-scope-1', ['BTCUSDT', 'ETHUSDT'], 'BTCUSDT'),
      makeSymbolExposureCapNode('node-sym-cap-1', 30, 'node-sym-scope-1'),
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
        expect(capRisk.symbolScopeRef).toBe('node-sym-scope-1')
      }
    })
  })

  // ---------------------------------------------------------------
  // T3: scope.subStrategy×2 + substrategy_exposure_cap×2
  // ---------------------------------------------------------------
  describe('T3: scope.subStrategy×2 + substrategy_exposure_cap×2 → 2 scopes + 2 portfolioRisks', () => {
    const state = makeBaseState([
      makeSubStrategyScopeNode('node-sub-scope-A', 'A_RSI_reversal_long_BTC'),
      makeSubStrategyScopeNode('node-sub-scope-B', 'B_EMA_trend_follow_ETH'),
      makeSubStrategyExposureCapNode('node-sub-cap-A', 50, 'node-sub-scope-A'),
      makeSubStrategyExposureCapNode('node-sub-cap-B', 50, 'node-sub-scope-B'),
      makeDrawdownBlockNode('node-drawdown-2', 15),
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

    it('subStrategy portfolioRisk 各 subStrategyScopeRef 绑定到对应 scope node id', () => {
      const risks = spec.orchestration?.portfolioRisks ?? []
      const subRisks = risks.filter(r => r.scope === 'subStrategy')
      const refs = subRisks.map(r => (r as { subStrategyScopeRef?: string }).subStrategyScopeRef).sort()
      expect(refs).toEqual(['node-sub-scope-A', 'node-sub-scope-B'])
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
  // T4: 空 orchestration → 无 spec.orchestration
  // ---------------------------------------------------------------
  describe('T4: empty orchestration → no orchestration emitted', () => {
    const state = makeBaseState([])
    const spec = builder.buildFromSemanticState(state)

    it('spec.orchestration 为 undefined（无任何 orchestration 数据）', () => {
      expect(spec.orchestration).toBeUndefined()
    })
  })
})
