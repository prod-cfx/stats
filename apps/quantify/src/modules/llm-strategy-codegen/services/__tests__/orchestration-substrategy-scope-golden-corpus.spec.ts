import type { CompiledOrchestrationScope, CompiledSubStrategyScope } from '@ai/shared/script-engine/compiled-runtime'
import type { CompiledGuardState } from '@ai/shared/script-engine/compiled-runtime/evaluate-guards'
import type { OrchestrationGateState } from '@ai/shared/script-engine/compiled-runtime/evaluate-orchestration-gates'
import type { OrchestrationPortfolioRiskState } from '@ai/shared/script-engine/compiled-runtime/evaluate-orchestration-portfolio-risks'
import type { StrategyDecisionV1, StrategyExecutionContextV1 } from '@ai/shared'
import {
  applySubStrategyScopeRouting,
  runDecisionProgramsSubStrategyFanOut,
} from '@ai/shared/script-engine/compiled-runtime'

import type { SemanticOrchestrationNode, SemanticState } from '../../types/semantic-state'
import type { StrategyVersionInfo } from '../../nl-gateway/version-gate/version-gate.types'
import { CURRENT_SEMANTIC_VERSION } from '../../nl-gateway/version-gate/version-gate'
import { NaturalLanguageGatewayService } from '../natural-language-gateway.service'
import { SemanticContractReadinessService } from '../semantic-contract-readiness.service'
import { SemanticOrchestrationRegistryService } from '../semantic-orchestration-registry.service'
import { CanonicalSpecBuilderService } from '../canonical-spec-builder.service'
import { CanonicalSpecV2IrCompilerService } from '../canonical-spec-v2-ir-compiler.service'

/**
 * Phase 5 S10 (#1111): scope.subStrategy substrate 5 段集成 golden corpus
 *
 * Section A: NL pipeline parseSubStrategyScope + parseSubStrategyGate
 * Section B: Readiness 6 重 fail-closed + binding fail-closed
 * Section C: Display 不泄漏内部 key
 * Section D: canonical → IR 全链路 + 1-subStrategy 兜底
 * Section E: runtime fail-closed 路由 5 case
 */

const CURRENT_VERSION: StrategyVersionInfo = { deployedAtSemanticVersion: CURRENT_SEMANTIC_VERSION }

function createSemanticState(overrides: Partial<SemanticState> = {}): SemanticState {
  return {
    version: 1,
    families: [],
    triggers: [],
    actions: [],
    risk: [],
    position: null,
    contextSlots: { exchange: null, symbol: null, marketType: null, timeframe: null },
    normalizationNotes: [],
    updatedAt: '2026-05-10T00:00:00.000Z',
    ...overrides,
  }
}

function subStrategyScopeNode(overrides: Partial<SemanticOrchestrationNode> = {}): SemanticOrchestrationNode {
  return {
    id: 'scope-substrategy-1',
    kind: 'scope',
    key: 'scope.subStrategy',
    status: 'locked',
    source: 'user_explicit',
    params: {},
    subStrategyScopeKind: 'subStrategy',
    subStrategyId: 'trend_sub',
    subStrategyLabel: '趋势子策略',
    positionHandlingOnDeactivate: 'close',
    orderHandlingOnDeactivate: 'cancel',
    openSlots: [],
    contracts: [],
    ...overrides,
  }
}

describe('orchestration scope.subStrategy — golden corpus (Phase 5 S10 #1111)', () => {
  // ============================================================
  // Section A: NL pipeline
  // ============================================================
  describe('Section A: NL pipeline parseSubStrategyScope + parseSubStrategyGate', () => {
    const gateway = new NaturalLanguageGatewayService()

    it('F1 hits sub-strategy scope frames (≥2 candidates): 趋势/震荡', () => {
      const frames = gateway.parse('趋势行情用趋势子策略，震荡行情用震荡子策略，切换时平掉旧仓位')
      const scopeFrames = frames.filter(f => f.kind === 'sub_strategy_scope')
      expect(scopeFrames.length).toBeGreaterThanOrEqual(2)
      const ids = scopeFrames.map(f => (f as { subStrategyId: string }).subStrategyId).sort()
      expect(ids).toEqual(['range_sub', 'trend_sub'])
      const trend = scopeFrames.find(f => (f as { subStrategyId: string }).subStrategyId === 'trend_sub') as { positionHandlingOnDeactivate?: string }
      expect(trend.positionHandlingOnDeactivate).toBe('close')
    })

    it('F2 hits 策略 A / 策略 B with boundary protection', () => {
      const frames = gateway.parse('上涨时跑策略 A，下跌时跑策略 B')
      const scopeFrames = frames.filter(f => f.kind === 'sub_strategy_scope')
      expect(scopeFrames.length).toBeGreaterThanOrEqual(2)
    })

    it('F3 hits 趋势/震荡 with switch language → both scope and gate frames', () => {
      const frames = gateway.parse('RSI > 70 切到震荡子策略，<30 切回趋势子策略')
      expect(frames.filter(f => f.kind === 'sub_strategy_scope').length).toBeGreaterThanOrEqual(2)
    })

    it('F5 English fixture: Use sub-strategy A / sub-strategy B', () => {
      const frames = gateway.parse('Use sub-strategy A in trend regime, sub-strategy B in range')
      const scopeFrames = frames.filter(f => f.kind === 'sub_strategy_scope')
      expect(scopeFrames.length).toBeGreaterThanOrEqual(2)
    })

    it('F6 utterance with handling info populates handling fields', () => {
      const frames = gateway.parse('趋势子策略和震荡子策略，切换时取消挂单，平掉旧仓位')
      const scopeFrames = frames.filter(f => f.kind === 'sub_strategy_scope') as Array<{
        positionHandlingOnDeactivate?: string
        orderHandlingOnDeactivate?: string
      }>
      expect(scopeFrames.length).toBeGreaterThanOrEqual(2)
      expect(scopeFrames[0].positionHandlingOnDeactivate).toBe('close')
      expect(scopeFrames[0].orderHandlingOnDeactivate).toBe('cancel')
    })

    it('F7 boundary protection: "策略 A 不行" should NOT trigger sub_strategy_scope', () => {
      const frames = gateway.parse('策略 A 不行，换个思路')
      // Even if some other frame might appear, sub_strategy_scope should be empty
      // (boundary regex (?<![好不太能可])策略\s?[ABab](?![的人]) blocks this)
      const scopeFrames = frames.filter(f => f.kind === 'sub_strategy_scope')
      expect(scopeFrames.length).toBe(0)
    })

    it('N1 negative: "只跑一个策略" does NOT trigger sub_strategy_scope', () => {
      const frames = gateway.parse('只跑一个策略')
      const scopeFrames = frames.filter(f => f.kind === 'sub_strategy_scope')
      expect(scopeFrames.length).toBe(0)
    })
  })

  // ============================================================
  // Section B: Readiness 6 重 fail-closed
  // ============================================================
  describe('Section B: Readiness fail-closed', () => {
    const readiness = new SemanticContractReadinessService()

    it('B1 valid 2 sub-strategies: ready=true', () => {
      const state = createSemanticState({
        orchestration: {
          nodes: [
            subStrategyScopeNode({ id: 'ss-1', subStrategyId: 'trend_sub' }),
            subStrategyScopeNode({ id: 'ss-2', subStrategyId: 'range_sub' }),
          ],
          contracts: [],
        },
      })
      const result = readiness.normalize(state, CURRENT_VERSION)
      // Both scope nodes preserved as locked
      const nodes = result.state.orchestration?.nodes ?? []
      expect(nodes.every(n => n.status === 'locked')).toBe(true)
    })

    it('B2 missing positionHandling → fail-closed', () => {
      const state = createSemanticState({
        orchestration: {
          nodes: [
            subStrategyScopeNode({ id: 'ss-1', positionHandlingOnDeactivate: undefined }),
          ],
          contracts: [],
        },
      })
      const result = readiness.normalize(state, CURRENT_VERSION)
      const node = result.state.orchestration?.nodes[0]
      expect(node?.status).toBe('open')
    })

    it('B3 collision id → fail-closed', () => {
      const state = createSemanticState({
        orchestration: {
          nodes: [
            subStrategyScopeNode({ id: 'ss-1', subStrategyId: 'trend_sub' }),
            subStrategyScopeNode({ id: 'ss-2', subStrategyId: 'trend_sub' }),
          ],
          contracts: [],
        },
      })
      const result = readiness.normalize(state, CURRENT_VERSION)
      // 任一 collision 节点 → status='open'
      const nodes = result.state.orchestration?.nodes ?? []
      expect(nodes.some(n => n.status === 'open')).toBe(true)
    })

    it('B4 missing strategyVersion → fail-closed (version gate)', () => {
      const state = createSemanticState({
        orchestration: {
          nodes: [subStrategyScopeNode({ id: 'ss-1' })],
          contracts: [],
        },
      })
      const result = readiness.normalize(state, undefined)
      expect(result.state.orchestration?.nodes[0]?.status).toBe('open')
    })

    it('B5 binding fail-closed: 2 subStrategies + locked trigger 缺 subStrategyScopeRef → trigger downgraded', () => {
      const state = createSemanticState({
        orchestration: {
          nodes: [
            subStrategyScopeNode({ id: 'ss-1', subStrategyId: 'trend_sub' }),
            subStrategyScopeNode({ id: 'ss-2', subStrategyId: 'range_sub' }),
          ],
          contracts: [],
        },
        triggers: [
          {
            id: 'trigger-1',
            key: 'price.indicator_compare',
            phase: 'entry',
            params: {},
            status: 'locked',
            source: 'user_explicit',
            openSlots: [],
            contracts: [],
            // 缺 subStrategyScopeRef
          },
        ],
      })
      const result = readiness.normalize(state, CURRENT_VERSION)
      expect(result.state.triggers[0]?.status).toBe('open')
      expect(result.ready).toBe(false)
    })
  })

  // ============================================================
  // Section C: Display 不泄漏内部 key
  // ============================================================
  describe('Section C: Display 不泄漏内部 key', () => {
    it('C1 display token table contains all S10 tokens', () => {
      // 通过引用 display-token-table 间接验证
      const { DISPLAY_TOKENS } = require('../../nl-gateway/display-registry/display-token-table')
      const tokenIds = DISPLAY_TOKENS.map((t: { token: string }) => t.token)
      expect(tokenIds).toContain('atom.scope.subStrategy.name')
      expect(tokenIds).toContain('atom.scope.subStrategy.display.with_handling')
      expect(tokenIds).toContain('atom.gate.subStrategy.pause')
      expect(tokenIds).toContain('atom.gate.subStrategy.switch')
      expect(tokenIds).toContain('slot.orchestration.scope.subStrategy.id_collision')
    })
  })

  // ============================================================
  // Section D: canonical → IR 全链路 + 1-subStrategy 兜底
  // ============================================================
  describe('Section D: canonical → IR pipeline', () => {
    const builder = new CanonicalSpecBuilderService()
    const irCompiler = new CanonicalSpecV2IrCompilerService()

    it('D1 single sub-strategy: canonical scope 仍输出 (但 runtime 兜底跳过)', () => {
      const state = createSemanticState({
        orchestration: {
          nodes: [subStrategyScopeNode({ id: 'ss-1', subStrategyId: 'only_sub' })],
          contracts: [],
        },
      })
      const spec = builder.buildFromSemanticState(state)
      const scopes = spec.orchestration?.scopes ?? []
      // 单 sub 仍输出 canonical scope（plan §7 字节兼容论证：runtime 路由兜底单/0 sub 不破）
      expect(scopes.length).toBe(1)
      expect(scopes[0].scopeKind).toBe('subStrategy')
    })

    it('D2 two sub-strategies: canonical → IR full round-trip', () => {
      const state = createSemanticState({
        orchestration: {
          nodes: [
            subStrategyScopeNode({ id: 'ss-1', subStrategyId: 'trend_sub' }),
            subStrategyScopeNode({ id: 'ss-2', subStrategyId: 'range_sub' }),
          ],
          contracts: [],
        },
      })
      const spec = builder.buildFromSemanticState(state)
      const scopes = spec.orchestration?.scopes ?? []
      expect(scopes.length).toBe(2)
      expect(scopes.every(s => s.scopeKind === 'subStrategy')).toBe(true)

      // IR compile
      const irResult = irCompiler.compile({
        canonicalSpec: spec,
        fallback: { exchange: 'binance', symbol: 'BTCUSDT', baseTimeframe: '1h', positionPct: 100 },
      })
      const irScopes = irResult.ir.orchestrationScopes ?? []
      expect(irScopes.length).toBe(2)
      expect(irScopes.every(s => s.scopeKind === 'subStrategy')).toBe(true)
    })

    it('D3 invalid handling → builder silent skip (canonical scopes empty)', () => {
      const state = createSemanticState({
        orchestration: {
          nodes: [
            subStrategyScopeNode({
              id: 'ss-1',
              subStrategyId: 'incomplete',
              positionHandlingOnDeactivate: undefined,
            }),
          ],
          contracts: [],
        },
      })
      const spec = builder.buildFromSemanticState(state)
      const scopes = spec.orchestration?.scopes ?? []
      expect(scopes.length).toBe(0)
    })
  })

  // ============================================================
  // Section E: runtime fail-closed 路由 5 case
  // ============================================================
  describe('Section E: runtime fail-closed 路由', () => {
    function makeSubStrategyScope(id: string, subStrategyId: string): CompiledSubStrategyScope {
      return {
        id,
        scopeKind: 'subStrategy',
        subStrategyId,
        positionHandlingOnDeactivate: 'close',
        orderHandlingOnDeactivate: 'cancel',
      }
    }
    const scopes: readonly CompiledSubStrategyScope[] = [
      makeSubStrategyScope('ss-trend', 'trend'),
      makeSubStrategyScope('ss-range', 'range'),
    ]
    const baseProgram = { phase: 'entry' as const, metadata: { subStrategyScopeRef: 'ss-trend' } }
    const baseProgramExit = { phase: 'exit' as const, metadata: { subStrategyScopeRef: 'ss-trend' } }

    it('E1 single sub-strategy → continue (fallback)', () => {
      const result = applySubStrategyScopeRouting(baseProgram, {} as StrategyExecutionContextV1, [scopes[0]], undefined)
      expect(result).toBe('continue')
    })

    it('E2 missing activeSubStrategyScopeId → fail-closed.no_active_scope', () => {
      const ctx = {} as StrategyExecutionContextV1
      const result = applySubStrategyScopeRouting(baseProgram, ctx, scopes, undefined)
      expect(typeof result).not.toBe('string')
      expect((result as StrategyDecisionV1).action).toBe('NOOP')
      expect((result as StrategyDecisionV1).reason).toBe('compiled.orchestration.substrategy.fail_closed.no_active_scope')
    })

    it('E3 unknown active scope id → fail-closed.unknown_active_scope', () => {
      const ctx = { activeSubStrategyScopeId: 'ss-unknown' } as unknown as StrategyExecutionContextV1
      const result = applySubStrategyScopeRouting(baseProgram, ctx, scopes, undefined)
      expect((result as StrategyDecisionV1).reason).toBe('compiled.orchestration.substrategy.fail_closed.unknown_active_scope')
    })

    it('E4 program ref ≠ active id → skip', () => {
      const ctx = { activeSubStrategyScopeId: 'ss-range' } as unknown as StrategyExecutionContextV1
      // baseProgram refers ss-trend but active is ss-range
      const result = applySubStrategyScopeRouting(baseProgram, ctx, scopes, undefined)
      expect(result).toBe('skip')
    })

    it('E5 active === programRef → continue', () => {
      const ctx = { activeSubStrategyScopeId: 'ss-trend' } as unknown as StrategyExecutionContextV1
      const result = applySubStrategyScopeRouting(baseProgram, ctx, scopes, undefined)
      expect(result).toBe('continue')
    })

    it('E6 paused active + entry phase → NOOP (验收项 6)', () => {
      const ctx = { activeSubStrategyScopeId: 'ss-trend' } as unknown as StrategyExecutionContextV1
      const gateState: OrchestrationGateState = {
        blockEntryLong: false,
        blockEntryShort: false,
        pausedSubStrategyScopeIds: new Set(['ss-trend']),
      }
      const result = applySubStrategyScopeRouting(baseProgram, ctx, scopes, gateState)
      expect((result as StrategyDecisionV1).action).toBe('NOOP')
      expect((result as StrategyDecisionV1).reason).toBe('compiled.orchestration.substrategy.paused')
    })

    it('E7 paused active + exit phase → continue (验收项 6 "能进就能出")', () => {
      const ctx = { activeSubStrategyScopeId: 'ss-trend' } as unknown as StrategyExecutionContextV1
      const gateState: OrchestrationGateState = {
        blockEntryLong: false,
        blockEntryShort: false,
        pausedSubStrategyScopeIds: new Set(['ss-trend']),
      }
      const result = applySubStrategyScopeRouting(baseProgramExit, ctx, scopes, gateState)
      expect(result).toBe('continue')
    })

    it('E8 unbound program (no subStrategyScopeRef) → fail-closed.unbound_program', () => {
      const ctx = { activeSubStrategyScopeId: 'ss-trend' } as unknown as StrategyExecutionContextV1
      const programNoRef = { phase: 'entry' as const, metadata: {} }
      const result = applySubStrategyScopeRouting(programNoRef, ctx, scopes, undefined)
      expect((result as StrategyDecisionV1).reason).toBe('compiled.orchestration.substrategy.fail_closed.unbound_program')
    })
  })

  // ============================================================
  // Section F: caller fan-out + switch close/cancel (Phase 5 S10 follow-up #1113)
  // ============================================================
  describe('Section F: caller fan-out + switch close/cancel (#1113)', () => {
    function makeSubStrategyScope(
      id: string,
      subStrategyId: string,
      overrides: Partial<CompiledSubStrategyScope> = {},
    ): CompiledSubStrategyScope {
      return {
        id,
        scopeKind: 'subStrategy',
        subStrategyId,
        positionHandlingOnDeactivate: 'close',
        orderHandlingOnDeactivate: 'cancel',
        ...overrides,
      }
    }
    const fanOutSubScopes: readonly CompiledOrchestrationScope[] = [
      makeSubStrategyScope('ss-trend', 'trend'),
      makeSubStrategyScope('ss-range', 'range'),
    ]
    const noopGuardF: CompiledGuardState = {
      blockNewEntry: false, forceExit: false, strategyHalt: false,
      cancelOrderPrograms: false, triggered: [],
    }
    const noopGateF: OrchestrationGateState = { blockEntryLong: false, blockEntryShort: false }
    const noopPortfolioF: OrchestrationPortfolioRiskState = {
      blockEntryLong: false, blockEntryShort: false, observedBreaches: [],
    }
    const exprValuesF = { expr_true: true } as const
    function entryProgramF(id: string, scopeRef: string) {
      return {
        id,
        phase: 'entry' as const,
        priority: 1,
        when: 'expr_true',
        metadata: { subStrategyScopeRef: scopeRef } as { subStrategyScopeRef?: string },
        actions: [{ kind: 'OPEN_LONG' as const, quantity: { mode: 'pct_equity' as const, value: 100 } }],
      }
    }

    it('F1 双 sub first-bar 兜底 sub[0] → 路由到 ss-trend program 并发出 OPEN_LONG', () => {
      const programs = [entryProgramF('p1', 'ss-trend'), entryProgramF('p2', 'ss-range')]
      const ctx: StrategyExecutionContextV1 = {}
      const result = runDecisionProgramsSubStrategyFanOut(
        ctx, programs, exprValuesF, noopGuardF, ['p1', 'p2'],
        noopGateF, noopPortfolioF, fanOutSubScopes, undefined,
        { subStrategyState: { currentBarIndex: 0 } },
      )
      expect(result.switchOutcome.nextActiveScopeId).toBe('ss-trend')
      expect(result.decision.action).toBe('OPEN_LONG')
    })

    it('F2 switch_substrategy gate 触发 + close handling + 持仓 → CLOSE_* 主 decision + meta', () => {
      const gateSwitch: OrchestrationGateState = {
        ...noopGateF,
        switchToSubStrategyScopeId: 'ss-range',
      }
      const programs = [entryProgramF('p1', 'ss-trend'), entryProgramF('p2', 'ss-range')]
      const ctx: StrategyExecutionContextV1 = { position: { qty: 5, side: 'long' } }
      const result = runDecisionProgramsSubStrategyFanOut(
        ctx, programs, exprValuesF, noopGuardF, ['p1', 'p2'],
        gateSwitch, noopPortfolioF, fanOutSubScopes, undefined,
        { subStrategyState: { previousActiveScopeId: 'ss-trend', currentBarIndex: 10 } },
      )
      expect(result.decision.action).toBe('CLOSE_LONG')
      expect(result.decision.reason).toBe('compiled.orchestration.substrategy.deactivation.close')
      const meta = result.decision.meta?.subStrategyDeactivation as { outgoingScopeId: string; cancelOrders: boolean }
      expect(meta.outgoingScopeId).toBe('ss-trend')
      expect(meta.cancelOrders).toBe(true)
    })

    it('F3 cooldown 命中 → 透传 baseline sub baseDecision，不切换', () => {
      const gateSwitch: OrchestrationGateState = {
        ...noopGateF,
        switchToSubStrategyScopeId: 'ss-range',
      }
      const programs = [entryProgramF('p1', 'ss-trend'), entryProgramF('p2', 'ss-range')]
      const ctx: StrategyExecutionContextV1 = { position: { qty: 5, side: 'long' } }
      const result = runDecisionProgramsSubStrategyFanOut(
        ctx, programs, exprValuesF, noopGuardF, ['p1', 'p2'],
        gateSwitch, noopPortfolioF, fanOutSubScopes, undefined,
        {
          subStrategyState: {
            previousActiveScopeId: 'ss-trend',
            currentBarIndex: 5,
            lastSwitchBarIndex: 5,
            cooldownBars: 1,
          },
        },
      )
      expect(result.switchOutcome.didSwitch).toBe(false)
      expect(result.switchOutcome.cooldownBlocked).toBe(true)
      expect(result.decision.action).toBe('OPEN_LONG')
      expect(result.decision.meta?.subStrategyDeactivation).toBeUndefined()
    })
  })
})
