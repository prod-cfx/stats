import {
  applyTimeframeScopeAlignment,
  type CompiledOrchestrationScope,
} from '@ai/shared/script-engine/compiled-runtime'
import type { StrategyExecutionContextV1 } from '@ai/shared'

import type { SemanticOrchestrationNode, SemanticState } from '../../types/semantic-state'
import type { StrategyVersionInfo } from '../../nl-gateway/version-gate/version-gate.types'
import { CURRENT_SEMANTIC_VERSION, getDisplayToken, renderDisplayToken } from '../../nl-gateway'
import { NaturalLanguageGatewayService } from '../natural-language-gateway.service'
import { SemanticContractReadinessService } from '../semantic-contract-readiness.service'
import { SemanticOrchestrationRegistryService } from '../semantic-orchestration-registry.service'

/**
 * Phase 5 S3 (#1109): scope.timeframe substrate 6 段集成 golden corpus
 *
 * Section A: NL pipeline parseTimeframeScope 命中表（6 positive + 3 negative）
 * Section B: Readiness fail-closed（10 重 + ≥1 binding 强制 + open→locked + S2 共存 + dataSource unsupported）
 * Section C: Display 不泄漏内部 key（display token + clarification）
 * Section D: 略（spec/IR/AST 链路在 byte-equal spec 已覆盖）
 * Section E: runtime alignment fail-closed（决策表 + bar-bucket 边界由 apply-timeframe-scope-alignment.spec.ts 覆盖；此处补 1 case 验 portfolioRisk observedBreaches 二次包裹）
 * Section F: backtest 路径 parity 4 case 占位（normal / data_unavailable / required_missing / alignment_lag）
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

function timeframeScopeNode(overrides: Partial<SemanticOrchestrationNode> = {}): SemanticOrchestrationNode {
  return {
    id: 'tf-scope-1',
    kind: 'scope',
    key: 'scope.timeframe',
    status: 'locked',
    source: 'user_explicit',
    params: {},
    timeframeScopeKind: 'timeframe',
    primaryTimeframe: '15m',
    requiredTimeframes: ['1h'],
    alignmentPolicy: 'strict',
    openSlots: [],
    contracts: [],
    ...overrides,
  }
}

function symbolScopeNode(overrides: Partial<SemanticOrchestrationNode> = {}): SemanticOrchestrationNode {
  return {
    id: 'sym-scope-1',
    kind: 'scope',
    key: 'scope.symbol',
    status: 'locked',
    source: 'user_explicit',
    params: {},
    symbolScopeKind: 'symbol',
    symbols: ['BTCUSDT'],
    openSlots: [],
    contracts: [],
    ...overrides,
  }
}

describe('orchestration scope.timeframe — golden corpus (Phase 5 S3 #1109)', () => {
  // ============================================================
  // Section A: NL pipeline parseTimeframeScope
  // ============================================================
  describe('Section A: NL pipeline parseTimeframeScope', () => {
    const gateway = new NaturalLanguageGatewayService()

    const positives: Array<{
      id: string
      utterance: string
      primary: string
      required: string[]
      alignment: 'strict' | 'tolerant'
    }> = [
      {
        id: 'F1',
        utterance: '用 15m 主周期，1h 和 4h 做 scope 依赖周期',
        primary: '15m',
        required: ['1h', '4h'],
        alignment: 'strict',
      },
      {
        id: 'F2',
        utterance: 'Primary timeframe 15m, required timeframes 1h and 4h',
        primary: '15m',
        required: ['1h', '4h'],
        alignment: 'strict',
      },
      {
        id: 'F3',
        utterance: '执行周期 5m，依赖周期 15m 1h 严格对齐',
        primary: '5m',
        required: ['15m', '1h'],
        alignment: 'strict',
      },
      {
        id: 'F4',
        utterance: '主周期 1h，依赖周期 4h 1d 宽松对齐',
        primary: '1h',
        required: ['4h', '1d'],
        alignment: 'tolerant',
      },
      {
        id: 'F5',
        utterance: 'Multi-timeframe scope: primary 5m, required 15m + 1h',
        primary: '5m',
        required: ['15m', '1h'],
        alignment: 'strict',
      },
      {
        id: 'F6',
        utterance: '执行 15m，多时间框架 scope 1h + 4h，strict alignment',
        primary: '15m',
        required: ['1h', '4h'],
        alignment: 'strict',
      },
    ]

    for (const fixture of positives) {
      it(`${fixture.id} produces timeframe_scope frame: "${fixture.utterance}"`, () => {
        const frames = gateway.parse(fixture.utterance)
        const scope = frames.find(f => f.kind === 'timeframe_scope')
        expect(scope).toBeDefined()
        if (scope?.kind !== 'timeframe_scope') return
        expect(scope.primaryTimeframe).toBe(fixture.primary)
        expect([...scope.requiredTimeframes].sort()).toEqual([...fixture.required].sort())
        expect(scope.alignmentPolicy).toBe(fixture.alignment)
      })
    }

    it('N1 negative: 单周期 utterance 不产 timeframe_scope frame', () => {
      const frames = gateway.parse('只用 15m 一个周期，价格高于 EMA20 时开多')
      expect(frames.find(f => f.kind === 'timeframe_scope')).toBeUndefined()
    })

    it('N2 negative: HTF filter atom utterance 不产 timeframe_scope frame', () => {
      // strategy.multi_timeframe HTF filter atom utterance；触发短语不命中 scope-binding 词组
      const frames = gateway.parse('1h 高周期过滤 15m 信号，价格高于 EMA20 才允许做多')
      expect(frames.find(f => f.kind === 'timeframe_scope')).toBeUndefined()
    })

    it('N3 negative: symbol_scope utterance 不串到 timeframe_scope', () => {
      const frames = gateway.parse('BTCUSDT 主标的，ETHUSDT 跟随，均线金叉')
      expect(frames.find(f => f.kind === 'timeframe_scope')).toBeUndefined()
      // 但仍应产 symbol_scope frame（如果 utterance 命中 parseSymbolScope）
    })

    it('default alignmentPolicy is "strict" when utterance lacks explicit policy keyword', () => {
      const frames = gateway.parse('Multi-timeframe scope: primary 15m, required 1h')
      const scope = frames.find(f => f.kind === 'timeframe_scope')
      expect(scope).toBeDefined()
      if (scope?.kind !== 'timeframe_scope') return
      expect(scope.alignmentPolicy).toBe('strict')
    })
  })

  // ============================================================
  // Section B: Readiness fail-closed
  // ============================================================
  describe('Section B: Readiness fail-closed', () => {
    const readinessService = new SemanticContractReadinessService(
      undefined,
      undefined,
      undefined,
      new SemanticOrchestrationRegistryService(),
    )

    it('B1 supported timeframe scope alone (no owners) → ready (binding 强制只对 locked owner 生效)', () => {
      const node = timeframeScopeNode()
      const state = createSemanticState({ orchestration: { nodes: [node], contracts: [] } })
      const result = readinessService.normalize(state, CURRENT_VERSION)
      expect(result.ready).toBe(true)
    })

    it('B2 invalid primaryTimeframe → unsupported（registry 9 重 fail-closed 命中 primary_timeframe）', () => {
      const node = timeframeScopeNode({ primaryTimeframe: 'invalid-tf' as never })
      const state = createSemanticState({ orchestration: { nodes: [node], contracts: [] } })
      const result = readinessService.normalize(state, CURRENT_VERSION)
      expect(result.ready).toBe(false)
    })

    it('B3 primaryTimeframe ∈ requiredTimeframes（自引用拒绝）→ fail-closed', () => {
      const node = timeframeScopeNode({ primaryTimeframe: '15m', requiredTimeframes: ['15m', '1h'] })
      const state = createSemanticState({ orchestration: { nodes: [node], contracts: [] } })
      const result = readinessService.normalize(state, CURRENT_VERSION)
      expect(result.ready).toBe(false)
    })

    it('B4 primary 粒度 ≥ min(required)（颠倒）→ fail-closed primary_granularity', () => {
      const node = timeframeScopeNode({ primaryTimeframe: '1h', requiredTimeframes: ['15m'] })
      const state = createSemanticState({ orchestration: { nodes: [node], contracts: [] } })
      const result = readinessService.normalize(state, CURRENT_VERSION)
      expect(result.ready).toBe(false)
    })

    it('B5 requiredTimeframes 长度 9（>8）→ fail-closed required_length', () => {
      const node = timeframeScopeNode({
        primaryTimeframe: '1m',
        requiredTimeframes: ['3m', '5m', '15m', '30m', '1h', '2h', '4h', '6h', '8h'],
      })
      const state = createSemanticState({ orchestration: { nodes: [node], contracts: [] } })
      const result = readinessService.normalize(state, CURRENT_VERSION)
      expect(result.ready).toBe(false)
    })

    it('B6 ≥1 timeframe scope locked + trigger 缺 ref → missing_binding（strict ≥1 强制）', () => {
      const node = timeframeScopeNode()
      const state = createSemanticState({
        orchestration: { nodes: [node], contracts: [] },
        triggers: [{
          id: 't1', key: 'price.range_position_lte', phase: 'entry',
          params: {}, status: 'locked', source: 'user_explicit', openSlots: [],
        }],
      })
      const result = readinessService.normalize(state, CURRENT_VERSION)
      const trigger = result.state.triggers[0]
      expect(trigger.status).toBe('open')
      const slot = trigger.openSlots.find(s => s.slotKey === 'orchestration.scope.timeframe.missing_binding')
      expect(slot).toBeDefined()
    })

    it('B6b open→locked 流转：scope status="open" 时 owner 无 ref → ok=true（不触发 binding）', () => {
      const node = timeframeScopeNode({ status: 'open' })
      const state = createSemanticState({
        orchestration: { nodes: [node], contracts: [] },
        triggers: [{
          id: 't1', key: 'price.range_position_lte', phase: 'entry',
          params: {}, status: 'locked', source: 'user_explicit', openSlots: [],
        }],
      })
      const result = readinessService.normalize(state, CURRENT_VERSION)
      const trigger = result.state.triggers[0]
      const missingBindingSlot = trigger.openSlots.find(s => s.slotKey === 'orchestration.scope.timeframe.missing_binding')
      expect(missingBindingSlot).toBeUndefined()
    })

    it('B7 trigger 同时缺 symbolScopeRef + timeframeScopeRef → 双 missing_binding slot 各自上报', () => {
      const symScope1 = symbolScopeNode({ id: 's-btc', symbols: ['BTCUSDT'] })
      const symScope2 = symbolScopeNode({ id: 's-eth', symbols: ['ETHUSDT'] })
      const tfNode = timeframeScopeNode()
      const state = createSemanticState({
        orchestration: { nodes: [symScope1, symScope2, tfNode], contracts: [] },
        triggers: [{
          id: 't1', key: 'price.range_position_lte', phase: 'entry',
          params: {}, status: 'locked', source: 'user_explicit', openSlots: [],
        }],
      })
      const result = readinessService.normalize(state, CURRENT_VERSION)
      const trigger = result.state.triggers[0]
      const slots = trigger.openSlots.map(s => s.slotKey)
      expect(slots).toContain('orchestration.scope.symbol.missing_binding')
      expect(slots).toContain('orchestration.scope.timeframe.missing_binding')
    })

    it('B8 共存 spec：locked scope.symbol + locked scope.timeframe → 互不污染 missingSlot', () => {
      const symScope = symbolScopeNode({ id: 's-1', symbols: ['BTCUSDT'] })
      const tfNode = timeframeScopeNode({ id: 't-1' })
      const state = createSemanticState({ orchestration: { nodes: [symScope, tfNode], contracts: [] } })
      const result = readinessService.normalize(state, CURRENT_VERSION)
      // 两个 scope 各自合法（一 symbol 不需要 binding；一 timeframe 也不需要 binding 因为 0 个 owner）
      expect(result.ready).toBe(true)
    })

    it('B9 scope.dataSource (其他 scope kind) → unsupported_kind slot 仍生效（plan §A2 约定）', () => {
      const dsNode: SemanticOrchestrationNode = {
        id: 'ds-1',
        kind: 'scope',
        key: 'scope.dataSource',  // 未注册的 scope key
        status: 'locked',
        source: 'user_explicit',
        params: {},
        openSlots: [],
        contracts: [],
      }
      const state = createSemanticState({ orchestration: { nodes: [dsNode], contracts: [] } })
      const result = readinessService.normalize(state, CURRENT_VERSION)
      expect(result.ready).toBe(false)
    })
  })

  // ============================================================
  // Section C: Display 不泄漏内部 key
  // ============================================================
  describe('Section C: Display 不泄漏内部 key', () => {
    it('atom.scope.timeframe.name → 周期范围', () => {
      expect(getDisplayToken('atom.scope.timeframe.name').zh).toBe('周期范围')
    })

    it('atom.scope.timeframe.display.with_required → 渲染含 primary + required + alignmentPolicy', () => {
      const display = renderDisplayToken('atom.scope.timeframe.display.with_required', {
        primaryTimeframe: '15m',
        requiredTimeframes: '1h、4h',
        alignmentPolicy: 'strict',
      })
      expect(display).toContain('15m')
      expect(display).toContain('1h')
      expect(display).toContain('strict')
      expect(display).toContain('周期范围')
      expect(display).not.toContain('scope.timeframe')
    })

    it('clarification slot key tokens 全命中', () => {
      expect(getDisplayToken('slot.orchestration.scope.timeframe.primary_timeframe').zh).toContain('执行周期')
      expect(getDisplayToken('slot.orchestration.scope.timeframe.required_timeframes').zh).toContain('依赖周期')
      expect(getDisplayToken('slot.orchestration.scope.timeframe.alignment_policy').zh).toContain('strict')
      expect(getDisplayToken('slot.orchestration.scope.timeframe.missing_binding').zh).toContain('timeframe scope')
    })
  })

  // ============================================================
  // Section E: runtime alignment + applyOrchestrationGate 二次包裹
  // ============================================================
  describe('Section E: runtime alignment fail-closed', () => {
    const tfScope: CompiledOrchestrationScope = {
      id: 'tf-1',
      scopeKind: 'timeframe',
      primaryTimeframe: '15m',
      requiredTimeframes: ['1h'],
      alignmentPolicy: 'strict',
    }

    it('数据完整 + bucket diff=0 → continue', () => {
      const ctx = {
        timeframeBarStatus: {
          '15m': { lastClosedBarTs: 1700_000_000_000, lastClosedBarIndex: 0 },
          '1h':  { lastClosedBarTs: 1700_000_000_000, lastClosedBarIndex: 0 },
        },
      } as StrategyExecutionContextV1
      const result = applyTimeframeScopeAlignment(
        { metadata: { timeframeScopeRef: 'tf-1' } },
        ctx,
        [tfScope],
      )
      expect(result).toBe('continue')
    })

    it('data_unavailable when ctx 空 + scope 存在', () => {
      const result = applyTimeframeScopeAlignment(
        { metadata: { timeframeScopeRef: 'tf-1' } },
        {} as StrategyExecutionContextV1,
        [tfScope],
      )
      expect((result as { reason: string }).reason).toBe('compiled.orchestration.scope.timeframe.fail_closed.data_unavailable')
    })
  })

  // ============================================================
  // Section F: backtest parity 4 边界占位
  // ============================================================
  describe('Section F: backtest parity (4 边界)', () => {
    // 边界 1: normal supported (continue) — Section E 已覆盖
    // 边界 2: data_unavailable — Section E 已覆盖
    // 边界 3: required_missing
    // 边界 4: alignment_lag
    const tfScope: CompiledOrchestrationScope = {
      id: 'tf-1',
      scopeKind: 'timeframe',
      primaryTimeframe: '15m',
      requiredTimeframes: ['1h'],
      alignmentPolicy: 'strict',
    }

    it('required_missing parity case', () => {
      const ctx = {
        timeframeBarStatus: {
          '15m': { lastClosedBarTs: 1700_000_000_000, lastClosedBarIndex: 0 },
          // '1h' 缺失
        },
      } as StrategyExecutionContextV1
      const result = applyTimeframeScopeAlignment(
        { metadata: { timeframeScopeRef: 'tf-1' } },
        ctx,
        [tfScope],
      )
      expect((result as { reason: string }).reason).toBe('compiled.orchestration.scope.timeframe.fail_closed.required_missing')
    })

    it('alignment_lag parity case (strict bucket diff=1)', () => {
      const baseTs = 1700_000_000_000
      const ctx = {
        timeframeBarStatus: {
          '15m': { lastClosedBarTs: baseTs + 60 * 60_000, lastClosedBarIndex: 1 }, // 1h ahead
          '1h':  { lastClosedBarTs: baseTs, lastClosedBarIndex: 0 },
        },
      } as StrategyExecutionContextV1
      const result = applyTimeframeScopeAlignment(
        { metadata: { timeframeScopeRef: 'tf-1' } },
        ctx,
        [tfScope],
      )
      expect((result as { reason: string }).reason).toBe('compiled.orchestration.scope.timeframe.fail_closed.alignment_lag')
    })
  })
})
