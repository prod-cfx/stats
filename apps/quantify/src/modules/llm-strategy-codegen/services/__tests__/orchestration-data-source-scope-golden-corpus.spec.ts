import type { CompiledOrchestrationScope } from '@ai/shared/script-engine/compiled-runtime'
import type { CompiledGuardState } from '@ai/shared/script-engine/compiled-runtime/evaluate-guards'
import type { OrchestrationGateState } from '@ai/shared/script-engine/compiled-runtime/evaluate-orchestration-gates'
import type { OrchestrationPortfolioRiskState } from '@ai/shared/script-engine/compiled-runtime/evaluate-orchestration-portfolio-risks'
import type { StrategyDecisionV1, StrategyExecutionContextV1 } from '@ai/shared'
import {
  applyDataSourceScopeFailClosed,
  applyDataSourceScopeProgramRouting,
  applySymbolScopeRouting,
  runDecisionPrograms,
} from '@ai/shared/script-engine/compiled-runtime'

import type { SemanticOrchestrationNode, SemanticState } from '../../types/semantic-state'
import type { StrategyVersionInfo } from '../../nl-gateway/version-gate/version-gate.types'
import { CURRENT_SEMANTIC_VERSION, getDisplayToken, renderDisplayToken } from '../../nl-gateway'
import { CanonicalSpecBuilderService } from '../canonical-spec-builder.service'
import { CanonicalSpecV2IrCompilerService } from '../canonical-spec-v2-ir-compiler.service'
import { CanonicalStrategyAstCompilerService } from '../canonical-strategy-ast-compiler.service'
import { NaturalLanguageGatewayService } from '../natural-language-gateway.service'
import { SemanticContractReadinessService } from '../semantic-contract-readiness.service'
import { SemanticOrchestrationRegistryService } from '../semantic-orchestration-registry.service'

/**
 * Phase 5 S9 (#1110): scope.dataSource substrate 5 段集成 golden corpus
 *
 * Section A: NL pipeline parseDataSourceScope 命中表 6 fixture + 2 negative
 * Section B: Readiness 9 重 fail-closed + binding fail-closed + S2/S9 共存互斥
 * Section C: Display 不泄漏内部 key
 * Section D: canonical → IR → AST 全链路 + 0/1/N scope 兜底
 * Section E: runtime fail-closed 路由 8 reason + N5 共存
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

function dataSourceScopeNode(overrides: Partial<SemanticOrchestrationNode> = {}): SemanticOrchestrationNode {
  return {
    id: 'scope-data-source-1',
    kind: 'scope',
    key: 'scope.dataSource',
    status: 'locked',
    source: 'user_explicit',
    params: {},
    dataSourceScopeKind: 'dataSource',
    dataSourceRole: 'primary',
    dataSourceFeedId: 'binance.spot.btcusdt',
    dataSourceSchemaRef: 'ohlcv',
    openSlots: [],
    contracts: [],
    ...overrides,
  }
}

describe('orchestration scope.dataSource — golden corpus (Phase 5 S9 Task 11)', () => {
  // ============================================================
  // Section A: NL pipeline
  // ============================================================
  describe('Section A: NL pipeline parseDataSourceScope', () => {
    const gateway = new NaturalLanguageGatewayService()

    const positiveFixtures: Array<{
      id: string
      utterance: string
      expectedRoles: ReadonlyArray<'primary' | 'confirmation' | 'event'>
      expectedFeedIds: readonly string[]
    }> = [
      {
        id: 'F1',
        utterance: '主行情源 binance.spot.btcusdt 用 OHLCV 数据',
        expectedRoles: ['primary'],
        expectedFeedIds: ['binance.spot.btcusdt'],
      },
      {
        id: 'F2',
        utterance: '确认源 binance.perp.btcusdt orderbook',
        expectedRoles: ['confirmation'],
        expectedFeedIds: ['binance.perp.btcusdt'],
      },
      {
        id: 'F3',
        utterance: '事件源 webhook.tradingview.alpha 接收外部信号',
        expectedRoles: ['event'],
        expectedFeedIds: ['webhook.tradingview.alpha'],
      },
      {
        id: 'F4',
        utterance: 'primary feed binance.spot.ethusdt OHLCV，confirmation feed okx.spot.ethusdt orderbook',
        expectedRoles: ['primary', 'confirmation'],
        expectedFeedIds: ['binance.spot.ethusdt', 'okx.spot.ethusdt'],
      },
      {
        id: 'F5',
        utterance: '主源 binance.spot.btcusdt（K线），确认源 binance.perp.btcusdt（订单簿）',
        expectedRoles: ['primary', 'confirmation'],
        expectedFeedIds: ['binance.spot.btcusdt', 'binance.perp.btcusdt'],
      },
      {
        id: 'F6',
        utterance: '外部信号 webhook.discord.bull_signal 事件',
        expectedRoles: ['event'],
        expectedFeedIds: ['webhook.discord.bull_signal'],
      },
    ]

    for (const fixture of positiveFixtures) {
      it(`${fixture.id} produces data_source_scope frame: "${fixture.utterance}"`, () => {
        const frames = gateway.parse(fixture.utterance)
        const dsFrames = frames.filter(f => f.kind === 'data_source_scope')
        expect(dsFrames.length).toBe(fixture.expectedRoles.length)
        const roles = dsFrames.map(f => f.kind === 'data_source_scope' ? f.role : null).filter((r): r is 'primary' | 'confirmation' | 'event' => r !== null)
        const feedIds = dsFrames.map(f => f.kind === 'data_source_scope' ? f.feedId : null).filter((f): f is string => f !== null)
        for (const role of fixture.expectedRoles) {
          expect(roles).toContain(role)
        }
        for (const feedId of fixture.expectedFeedIds) {
          expect(feedIds).toContain(feedId)
        }
      })
    }

    it('N1 negative: 单 BTCUSDT 现货 utterance 不命中（无触发短语 / 无显式 feedId）', () => {
      const frames = gateway.parse('只用 BTCUSDT 现货')
      expect(frames.find(f => f.kind === 'data_source_scope')).toBeUndefined()
    })

    it('N2 negative: 触发短语命中但 feedId 提取空 → 不写 frame', () => {
      const frames = gateway.parse('数据源很丰富')
      expect(frames.find(f => f.kind === 'data_source_scope')).toBeUndefined()
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

    it('B1 dataSourceScopeKind ≠ dataSource → unsupported', () => {
      const node = dataSourceScopeNode({ dataSourceScopeKind: undefined })
      const state = createSemanticState({ orchestration: { nodes: [node], contracts: [] } })
      const result = readinessService.normalize(state, CURRENT_VERSION)
      expect(result.ready).toBe(false)
    })

    it('B2 dataSourceRole 非法 → fail-closed', () => {
      const node = dataSourceScopeNode({ dataSourceRole: undefined })
      const state = createSemanticState({ orchestration: { nodes: [node], contracts: [] } })
      const result = readinessService.normalize(state, CURRENT_VERSION)
      expect(result.ready).toBe(false)
    })

    it('B3 dataSourceFeedId 格式不合法 → fail-closed（大写/含空格）', () => {
      const node = dataSourceScopeNode({ dataSourceFeedId: 'BINANCE.spot.btcusdt' })
      const state = createSemanticState({ orchestration: { nodes: [node], contracts: [] } })
      const result = readinessService.normalize(state, CURRENT_VERSION)
      expect(result.ready).toBe(false)
    })

    it('B4 dataSourceSchemaRef 非白名单 → fail-closed', () => {
      const node = dataSourceScopeNode({ dataSourceSchemaRef: 'unknown_schema' as never })
      const state = createSemanticState({ orchestration: { nodes: [node], contracts: [] } })
      const result = readinessService.normalize(state, CURRENT_VERSION)
      expect(result.ready).toBe(false)
    })

    it('B5 dataSourceSchemaRef 缺失 → fail-closed（所有 role 必填）', () => {
      const node = dataSourceScopeNode({ dataSourceSchemaRef: undefined })
      const state = createSemanticState({ orchestration: { nodes: [node], contracts: [] } })
      const result = readinessService.normalize(state, CURRENT_VERSION)
      expect(result.ready).toBe(false)
    })

    it('B6 双 scope 同 feedId 重复 → registry feed_id_overlap fail-closed', () => {
      const registry = new SemanticOrchestrationRegistryService()
      const scope1 = dataSourceScopeNode({ id: 'ds-1', dataSourceFeedId: 'binance.spot.btcusdt', dataSourceRole: 'primary' })
      const scope2 = dataSourceScopeNode({ id: 'ds-2', dataSourceFeedId: 'binance.spot.btcusdt', dataSourceRole: 'confirmation' })
      const result = registry.validate(scope2, [scope1, scope2])
      expect(result.ok).toBe(false)
      expect(result.missingSlots.find(s => s.slotKey === 'orchestration.scope.dataSource.feed_id_overlap')).toBeDefined()
    })

    it('B7 双 scope 多 primary → registry primary_collision fail-closed', () => {
      const registry = new SemanticOrchestrationRegistryService()
      const scope1 = dataSourceScopeNode({ id: 'ds-1', dataSourceFeedId: 'binance.spot.btcusdt', dataSourceRole: 'primary' })
      const scope2 = dataSourceScopeNode({ id: 'ds-2', dataSourceFeedId: 'binance.perp.btcusdt', dataSourceRole: 'primary' })
      const result = registry.validate(scope2, [scope1, scope2])
      expect(result.ok).toBe(false)
      expect(result.missingSlots.find(s => s.slotKey === 'orchestration.scope.dataSource.primary_collision')).toBeDefined()
    })

    it('B8 单 scope locked + trigger dataSourceScopeRef 不在 supported → missing_binding open slot', () => {
      const dsNode = dataSourceScopeNode({ id: 'ds-1' })
      const state = createSemanticState({
        orchestration: { nodes: [dsNode], contracts: [] },
        triggers: [{
          id: 't1', key: 'price.range_position_lte', phase: 'entry',
          params: {}, status: 'locked', source: 'user_explicit', openSlots: [],
          dataSourceScopeRef: 'ds-unknown',
        }],
      })
      const result = readinessService.normalize(state, CURRENT_VERSION)
      const trigger = result.state.triggers[0]
      expect(trigger.status).toBe('open')
      const slot = trigger.openSlots.find(s => s.slotKey === 'orchestration.scope.dataSource.missing_binding')
      expect(slot).toBeDefined()
    })

    it('B9 (S2/S9 共存互斥) trigger 同时声明 symbolScopeRef + dataSourceScopeRef，binding 校验互不串扰', () => {
      // 多 scope.symbol 触发 S2 binding 校验；scope.dataSource 触发 S9 binding 校验。
      // trigger 同时声明 symbolScopeRef（S2 命中）+ dataSourceScopeRef（S9 命中）→ 都通过。
      const symbolNode1: SemanticOrchestrationNode = {
        id: 's-btc', kind: 'scope', key: 'scope.symbol', status: 'locked', source: 'user_explicit',
        params: {}, openSlots: [], contracts: [],
        symbolScopeKind: 'symbol', symbols: ['BTCUSDT'],
      }
      const symbolNode2: SemanticOrchestrationNode = {
        id: 's-eth', kind: 'scope', key: 'scope.symbol', status: 'locked', source: 'user_explicit',
        params: {}, openSlots: [], contracts: [],
        symbolScopeKind: 'symbol', symbols: ['ETHUSDT'],
      }
      const dsNode = dataSourceScopeNode({ id: 'ds-1' })
      const state = createSemanticState({
        orchestration: { nodes: [symbolNode1, symbolNode2, dsNode], contracts: [] },
        triggers: [{
          id: 't1', key: 'price.range_position_lte', phase: 'entry',
          params: {}, status: 'locked', source: 'user_explicit', openSlots: [],
          symbolScopeRef: 's-btc',
          dataSourceScopeRef: 'ds-1',
        }],
      })
      const result = readinessService.normalize(state, CURRENT_VERSION)
      const trigger = result.state.triggers[0]
      // 双 ref 都合法 → trigger 仍 locked
      expect(trigger.status).toBe('locked')
    })
  })

  // ============================================================
  // Section C: Display 不泄漏
  // ============================================================
  describe('Section C: Display 不泄漏内部 key', () => {
    it('public name token = "数据源"，render 不含字面 scope.dataSource', () => {
      expect(getDisplayToken('atom.scope.dataSource.name').zh).toBe('数据源')
      const display = renderDisplayToken('atom.scope.dataSource.display', {
        role: 'primary', feedId: 'binance.spot.btcusdt', schema: 'ohlcv',
      })
      expect(display).toBe('数据源：primary（binance.spot.btcusdt / ohlcv）')
      expect(display).not.toContain('scope.dataSource')
    })

    it('clarification token slot keys 全部命中', () => {
      expect(getDisplayToken('slot.orchestration.scope.dataSource.role').zh).toBe('请确认数据源角色（primary/confirmation/event）')
      expect(getDisplayToken('slot.orchestration.scope.dataSource.feed_id').zh).toBe('请确认数据源 feedId（如 binance.spot.btcusdt）')
      expect(getDisplayToken('slot.orchestration.scope.dataSource.schema_ref').zh).toBe('请确认数据源 schema（ohlcv/orderbook/liquidation/webhook_event）')
      expect(getDisplayToken('slot.orchestration.scope.dataSource.feed_id_overlap').zh).toBe('多 scope 间 feedId 不能重复')
      expect(getDisplayToken('slot.orchestration.scope.dataSource.primary_collision').zh).toBe('primary 数据源最多一个')
      expect(getDisplayToken('slot.orchestration.scope.dataSource.missing_binding').zh).toBe('请确认该规则绑定到哪个 dataSource scope')
    })

    it('C3 (critic M2) unsupported_kind 文案包含 scope.dataSource', () => {
      expect(getDisplayToken('slot.orchestration.scope.unsupported_kind').zh).toContain('scope.dataSource')
    })
  })

  // ============================================================
  // Section D: canonical → IR → AST 全链路
  // ============================================================
  describe('Section D: canonical → IR → AST 全链路 + 0/1/N scope 兜底', () => {
    const builder = new CanonicalSpecBuilderService()
    const irCompiler = new CanonicalSpecV2IrCompilerService()
    const astCompiler = new CanonicalStrategyAstCompilerService()

    function lockedContext() {
      return {
        contextSlots: {
          exchange: { slotKey: 'context.exchange', fieldPath: 'context.exchange', value: 'binance', status: 'locked' as const, priority: 'context' as const, questionHint: '', affectsExecution: true },
          symbol: { slotKey: 'context.symbol', fieldPath: 'context.symbol', value: 'BTCUSDT', status: 'locked' as const, priority: 'context' as const, questionHint: '', affectsExecution: true },
          marketType: { slotKey: 'context.marketType', fieldPath: 'context.marketType', value: 'spot', status: 'locked' as const, priority: 'context' as const, questionHint: '', affectsExecution: true },
          timeframe: { slotKey: 'context.timeframe', fieldPath: 'context.timeframe', value: '1h', status: 'locked' as const, priority: 'context' as const, questionHint: '', affectsExecution: true },
        },
      }
    }

    it('D1 双 dataSource scope → spec.orchestration.scopes / IR.orchestrationScopes / AST.orchestrationScopes 透传', () => {
      const dsBtc = dataSourceScopeNode({ id: 'ds-binance-btc', dataSourceFeedId: 'binance.spot.btcusdt', dataSourceRole: 'primary', dataSourceSchemaRef: 'ohlcv' })
      const dsEth = dataSourceScopeNode({ id: 'ds-okx-eth', dataSourceFeedId: 'okx.spot.ethusdt', dataSourceRole: 'confirmation', dataSourceSchemaRef: 'orderbook' })
      const state = createSemanticState({
        orchestration: { nodes: [dsBtc, dsEth], contracts: [] },
        ...lockedContext(),
      })
      const spec = builder.buildFromSemanticState(state)
      expect(spec.orchestration?.scopes?.length).toBe(2)
      // 顺序按 node.id 字典序：ds-binance-btc < ds-okx-eth
      expect(spec.orchestration?.scopes?.[0].id).toBe('ds-binance-btc')
      expect(spec.orchestration?.scopes?.[1].id).toBe('ds-okx-eth')
      const firstScope = spec.orchestration?.scopes?.[0]
      expect(firstScope?.scopeKind).toBe('dataSource')
      if (firstScope?.scopeKind === 'dataSource') {
        expect(firstScope.role).toBe('primary')
        expect(firstScope.feedId).toBe('binance.spot.btcusdt')
        expect(firstScope.schemaRef).toBe('ohlcv')
      }

      const ir = irCompiler.compile({
        canonicalSpec: spec,
        fallback: { exchange: 'binance', symbol: 'BTCUSDT', baseTimeframe: '1h', positionPct: 100 },
      })
      expect(ir.ir.orchestrationScopes?.length).toBe(2)

      const ast = astCompiler.compile(ir.ir)
      expect(ast.orchestrationScopes?.length).toBe(2)
    })

    it('D2 0 scope locked → spec.orchestration.scopes 缺省（旧策略零侵入）', () => {
      const state = createSemanticState({ ...lockedContext() })
      const spec = builder.buildFromSemanticState(state)
      expect(spec.orchestration?.scopes).toBeUndefined()
    })

    it('D3 1 dataSource scope locked → spec 含单 scope；无 binding 强制', () => {
      const dsNode = dataSourceScopeNode({ id: 'ds-1' })
      const state = createSemanticState({
        orchestration: { nodes: [dsNode], contracts: [] },
        ...lockedContext(),
      })
      const spec = builder.buildFromSemanticState(state)
      expect(spec.orchestration?.scopes?.length).toBe(1)
    })

    it('D5 (critic C1 防回归) silent-skip：rule 声明孤儿 dataSourceScopeRef → IR ruleBlock metadata 不含该字段', () => {
      const dsNode = dataSourceScopeNode({ id: 'ds-real' })
      const state = createSemanticState({
        orchestration: { nodes: [dsNode], contracts: [] },
        ...lockedContext(),
      })
      const spec = builder.buildFromSemanticState(state)
      // 手工注入 rule.metadata.dataSourceScopeRef='ds-orphan'（不在 supported scope 集合）
      if (spec.rules && spec.rules.length > 0) {
        spec.rules[0].metadata = { ...spec.rules[0].metadata, dataSourceScopeRef: 'ds-orphan' }
      }
      const ir = irCompiler.compile({
        canonicalSpec: spec,
        fallback: { exchange: 'binance', symbol: 'BTCUSDT', baseTimeframe: '1h', positionPct: 100 },
      })
      // silent skip：IR ruleBlock metadata 不应含孤儿 dataSourceScopeRef
      for (const block of ir.ir.ruleBlocks ?? []) {
        expect(block.metadata?.dataSourceScopeRef).toBeUndefined()
      }
    })

    it('D4 1 symbol + 1 dataSource scope 混合 → 顺序按 node.id 字典序（不按 scopeKind 分组）', () => {
      const symbolNode: SemanticOrchestrationNode = {
        id: 's-btc', kind: 'scope', key: 'scope.symbol', status: 'locked', source: 'user_explicit',
        params: {}, openSlots: [], contracts: [],
        symbolScopeKind: 'symbol', symbols: ['BTCUSDT'],
      }
      const dsNode = dataSourceScopeNode({ id: 'ds-binance' })
      const state = createSemanticState({
        orchestration: { nodes: [symbolNode, dsNode], contracts: [] },
        ...lockedContext(),
      })
      const spec = builder.buildFromSemanticState(state)
      const scopes = spec.orchestration?.scopes ?? []
      expect(scopes.length).toBe(2)
      // 'ds-binance' < 's-btc' 字典序
      expect(scopes[0].id).toBe('ds-binance')
      expect(scopes[1].id).toBe('s-btc')
      expect(scopes[0].scopeKind).toBe('dataSource')
      expect(scopes[1].scopeKind).toBe('symbol')
    })
  })

  // ============================================================
  // Section E: runtime fail-closed 路由
  // ============================================================
  describe('Section E: runtime fail-closed 路由（8 reason + N5 共存）', () => {
    const noopGuard: CompiledGuardState = {
      blockNewEntry: false, forceExit: false, strategyHalt: false,
      cancelOrderPrograms: false, triggered: [],
    }
    const noopGate: OrchestrationGateState = {
      blockEntryLong: false, blockEntryShort: false,
    }
    const noopPortfolio: OrchestrationPortfolioRiskState = {
      blockEntryLong: false, blockEntryShort: false, observedBreaches: [],
    }
    const baseProgram = {
      id: 'p1',
      phase: 'entry' as const,
      priority: 1,
      when: 'expr_true',
      metadata: {} as { dataSourceScopeRef?: string; symbolScopeRef?: string },
      actions: [{ kind: 'OPEN_LONG' as const, quantity: { mode: 'pct_equity' as const, value: 100 } }],
    }
    const exprValues = { expr_true: true } as const

    const dsScopes: CompiledOrchestrationScope[] = [
      { id: 'ds-primary', scopeKind: 'dataSource', role: 'primary', feedId: 'binance.spot.btcusdt', schemaRef: 'ohlcv' },
      { id: 'ds-confirm', scopeKind: 'dataSource', role: 'confirmation', feedId: 'binance.perp.btcusdt', schemaRef: 'orderbook' },
    ]

    function reason(decision: 'continue' | StrategyDecisionV1): string | null {
      return typeof decision === 'object' ? decision.reason ?? null : null
    }

    it('E1 (feeds_unprovided) 多 dataSource scope + ctx.dataSourceFeeds 缺失 → fail-closed', () => {
      const ctx = {} as StrategyExecutionContextV1
      const result = applyDataSourceScopeFailClosed(ctx, dsScopes)
      expect(reason(result)).toBe('compiled.orchestration.scope.fail_closed.feeds_unprovided')
    })

    it('E2 (primary_feed_missing) primary feedId 不在 ctx.dataSourceFeeds → fail-closed', () => {
      const ctx = {
        dataSourceFeeds: { 'binance.perp.btcusdt': { schema: 'orderbook' as const, permissionGranted: true, hasData: true } },
      } as StrategyExecutionContextV1
      const result = applyDataSourceScopeFailClosed(ctx, dsScopes)
      expect(reason(result)).toBe('compiled.orchestration.scope.fail_closed.primary_feed_missing')
    })

    it('E3 (permission_denied) primary feed permissionGranted=false → fail-closed', () => {
      const ctx = {
        dataSourceFeeds: {
          'binance.spot.btcusdt': { schema: 'ohlcv' as const, permissionGranted: false, hasData: true },
        },
      } as StrategyExecutionContextV1
      const result = applyDataSourceScopeFailClosed(ctx, dsScopes)
      expect(reason(result)).toBe('compiled.orchestration.scope.fail_closed.permission_denied')
    })

    it('E4 (schema_mismatch) primary feed schema 不一致 → fail-closed', () => {
      const ctx = {
        dataSourceFeeds: {
          'binance.spot.btcusdt': { schema: 'orderbook' as const, permissionGranted: true, hasData: true },
        },
      } as StrategyExecutionContextV1
      const result = applyDataSourceScopeFailClosed(ctx, dsScopes)
      expect(reason(result)).toBe('compiled.orchestration.scope.fail_closed.schema_mismatch')
    })

    it('E5 (no_data) primary feed hasData=false → fail-closed', () => {
      const ctx = {
        dataSourceFeeds: {
          'binance.spot.btcusdt': { schema: 'ohlcv' as const, permissionGranted: true, hasData: false },
        },
      } as StrategyExecutionContextV1
      const result = applyDataSourceScopeFailClosed(ctx, dsScopes)
      expect(reason(result)).toBe('compiled.orchestration.scope.fail_closed.no_data')
    })

    it('E6 (confirmation_feed_missing) primary 全过 + confirmation feedId 缺失 → fail-closed', () => {
      const ctx = {
        dataSourceFeeds: {
          'binance.spot.btcusdt': { schema: 'ohlcv' as const, permissionGranted: true, hasData: true },
          // 'binance.perp.btcusdt' 缺失
        },
      } as StrategyExecutionContextV1
      const result = applyDataSourceScopeFailClosed(ctx, dsScopes)
      expect(reason(result)).toBe('compiled.orchestration.scope.fail_closed.confirmation_feed_missing')
    })

    it('E7 (unbound_program) program 声明 ref 但不在 supported scope ids → fail-closed', () => {
      const result = applyDataSourceScopeProgramRouting({ metadata: { dataSourceScopeRef: 'ds-unknown' } }, dsScopes)
      expect(reason(result)).toBe('compiled.orchestration.scope.fail_closed.unbound_program')
    })

    it('E8 (event_feed_missing) event role primary 全过 + event feedId 缺失 → fail-closed', () => {
      const eventScopes: CompiledOrchestrationScope[] = [
        { id: 'ds-primary', scopeKind: 'dataSource', role: 'primary', feedId: 'binance.spot.btcusdt', schemaRef: 'ohlcv' },
        { id: 'ds-event', scopeKind: 'dataSource', role: 'event', feedId: 'webhook.tradingview.alpha', schemaRef: 'webhook_event' },
      ]
      const ctx = {
        dataSourceFeeds: {
          'binance.spot.btcusdt': { schema: 'ohlcv' as const, permissionGranted: true, hasData: true },
        },
      } as StrategyExecutionContextV1
      const result = applyDataSourceScopeFailClosed(ctx, eventScopes)
      expect(reason(result)).toBe('compiled.orchestration.scope.fail_closed.event_feed_missing')
    })

    it('E9 (continue) feeds 全部合法 → continue', () => {
      const ctx = {
        dataSourceFeeds: {
          'binance.spot.btcusdt': { schema: 'ohlcv' as const, permissionGranted: true, hasData: true },
          'binance.perp.btcusdt': { schema: 'orderbook' as const, permissionGranted: true, hasData: true },
        },
      } as StrategyExecutionContextV1
      const result = applyDataSourceScopeFailClosed(ctx, dsScopes)
      expect(result).toBe('continue')
    })

    it('E10 (N5 共存) 1 symbol + 1 dataSource scope: applySymbolScopeRouting 按 scopeKind 过滤后不误中', () => {
      const mixedScopes: CompiledOrchestrationScope[] = [
        { id: 'ds-primary', scopeKind: 'dataSource', role: 'primary', feedId: 'binance.spot.btcusdt', schemaRef: 'ohlcv' },
        { id: 's-btc', scopeKind: 'symbol', symbols: ['BTCUSDT'] },
      ]
      const ctx = {} as StrategyExecutionContextV1
      const result = applySymbolScopeRouting(baseProgram, ctx, mixedScopes)
      // symbolScopes.length == 1 → 'continue'
      expect(result).toBe('continue')
    })

    it('E11 (runDecisionPrograms) feeds_unprovided 时全局短路返回 NOOP fail-closed', () => {
      const ctx = {} as StrategyExecutionContextV1
      const programs = [baseProgram]
      const decision = runDecisionPrograms(
        ctx, programs, exprValues, noopGuard, ['p1'], noopGate, noopPortfolio, dsScopes,
      )
      expect(decision.action).toBe('NOOP')
      expect(decision.reason).toBe('compiled.orchestration.scope.fail_closed.feeds_unprovided')
    })

    it('E13 (critic M3 修复) 多 scope.symbol + 多 scope.dataSource 共存：孤儿 dataSourceScopeRef 不被 S2 skip 绕过 → unbound_program', () => {
      const mixedScopes: CompiledOrchestrationScope[] = [
        { id: 's-btc', scopeKind: 'symbol', symbols: ['BTCUSDT'] },
        { id: 's-eth', scopeKind: 'symbol', symbols: ['ETHUSDT'] },
        { id: 'ds-real', scopeKind: 'dataSource', role: 'primary', feedId: 'binance.spot.btcusdt', schemaRef: 'ohlcv' },
      ]
      const ctx = {
        activeSymbolScopeId: 's-btc',
        dataSourceFeeds: {
          'binance.spot.btcusdt': { schema: 'ohlcv' as const, permissionGranted: true, hasData: true },
        },
      } as StrategyExecutionContextV1
      // program 同时声明合法 symbolScopeRef='s-eth'（S2 视角下应 skip）+ 孤儿 dataSourceScopeRef='ds-orphan'
      // M3 修复后：dataSource program routing 提前于 symbol routing → unbound_program 优先返回
      const program = {
        ...baseProgram,
        metadata: { symbolScopeRef: 's-eth', dataSourceScopeRef: 'ds-orphan' },
      }
      const decision = runDecisionPrograms(
        ctx, [program], exprValues, noopGuard, ['p1'], noopGate, noopPortfolio, mixedScopes,
      )
      expect(decision.action).toBe('NOOP')
      expect(decision.reason).toBe('compiled.orchestration.scope.fail_closed.unbound_program')
    })

    it('E12 (forceExit 优先) forceExit + feeds_unprovided → CLOSE_LONG（forceExit short-circuit 在 dataSource fail-closed 之前）', () => {
      const guardForceExit: CompiledGuardState = {
        blockNewEntry: false, forceExit: true, strategyHalt: false,
        cancelOrderPrograms: false, triggered: [],
      }
      const ctx = {
        position: { qty: 1, side: 'long' as const },
      } as StrategyExecutionContextV1
      const decision = runDecisionPrograms(
        ctx, [baseProgram], exprValues, guardForceExit, ['p1'], noopGate, noopPortfolio, dsScopes,
      )
      expect(decision.action).toBe('CLOSE_LONG')
    })
  })
})
