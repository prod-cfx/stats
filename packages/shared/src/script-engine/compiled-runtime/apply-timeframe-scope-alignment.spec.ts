import type { StrategyExecutionContextV1 } from '../../strategy-protocol'
import {
  applyTimeframeScopeAlignment,
  type CompiledOrchestrationScope,
  type CompiledTimeframeScope,
} from './run-decision-programs'

/**
 * Phase 5 S3 (#1109): scope.timeframe runtime alignment 决策表 + bar-bucket 数学边界
 *
 * 测试覆盖：
 *   - 0 个 timeframe scope → 'continue'
 *   - unbound_program / unknown_scope / data_unavailable / primary_missing / required_missing
 *   - strict / tolerant bucket diff 边界（diff=0/1/2）
 *   - 多 required tf 任一不对齐即 fail-closed
 */

const baseCtx = (overrides: Partial<StrategyExecutionContextV1> = {}): StrategyExecutionContextV1 => ({
  ...overrides,
})

const tfScope = (overrides: Partial<CompiledTimeframeScope> = {}): CompiledTimeframeScope => ({
  id: 'tf-scope-1',
  scopeKind: 'timeframe',
  primaryTimeframe: '15m',
  requiredTimeframes: ['1h'],
  alignmentPolicy: 'strict',
  ...overrides,
})

describe('applyTimeframeScopeAlignment (Phase 5 S3 #1109)', () => {
  describe('0 timeframe scope path', () => {
    it('returns "continue" when scopes is undefined', () => {
      const result = applyTimeframeScopeAlignment({}, baseCtx(), undefined)
      expect(result).toBe('continue')
    })

    it('returns "continue" when scopes contains only symbol scopes', () => {
      const symbolOnly: CompiledOrchestrationScope[] = [
        { id: 's-1', scopeKind: 'symbol', symbols: ['BTCUSDT'] },
      ]
      const result = applyTimeframeScopeAlignment({}, baseCtx(), symbolOnly)
      expect(result).toBe('continue')
    })
  })

  describe('binding fail-closed', () => {
    it('unbound_program when program has no metadata.timeframeScopeRef', () => {
      const result = applyTimeframeScopeAlignment({}, baseCtx(), [tfScope()])
      expect(result).toEqual({
        action: 'NOOP',
        reason: 'compiled.orchestration.scope.timeframe.fail_closed.unbound_program',
      })
    })

    it('unbound_program when timeframeScopeRef trims to empty', () => {
      const result = applyTimeframeScopeAlignment({ metadata: { timeframeScopeRef: '   ' } }, baseCtx(), [tfScope()])
      expect((result as { reason: string }).reason).toBe('compiled.orchestration.scope.timeframe.fail_closed.unbound_program')
    })

    it('unknown_scope when ref does not match any scope id', () => {
      const result = applyTimeframeScopeAlignment(
        { metadata: { timeframeScopeRef: 'tf-scope-X' } },
        baseCtx(),
        [tfScope()],
      )
      expect((result as { reason: string }).reason).toBe('compiled.orchestration.scope.timeframe.fail_closed.unknown_scope')
    })
  })

  describe('data_unavailable / primary_missing / required_missing', () => {
    it('data_unavailable when ctx.timeframeBarStatus is undefined', () => {
      const result = applyTimeframeScopeAlignment(
        { metadata: { timeframeScopeRef: 'tf-scope-1' } },
        baseCtx(),
        [tfScope()],
      )
      expect((result as { reason: string }).reason).toBe('compiled.orchestration.scope.timeframe.fail_closed.data_unavailable')
    })

    it('primary_missing when primary tf not in status', () => {
      const ctx = baseCtx({ timeframeBarStatus: { '1h': { lastClosedBarTs: 1_700_000_000_000, lastClosedBarIndex: 0 } } })
      const result = applyTimeframeScopeAlignment(
        { metadata: { timeframeScopeRef: 'tf-scope-1' } },
        ctx,
        [tfScope()],
      )
      expect((result as { reason: string }).reason).toBe('compiled.orchestration.scope.timeframe.fail_closed.primary_missing')
    })

    it('primary_missing when lastClosedBarTs is NaN', () => {
      const ctx = baseCtx({ timeframeBarStatus: {
        '15m': { lastClosedBarTs: Number.NaN, lastClosedBarIndex: 0 },
        '1h': { lastClosedBarTs: 1_700_000_000_000, lastClosedBarIndex: 0 },
      } })
      const result = applyTimeframeScopeAlignment(
        { metadata: { timeframeScopeRef: 'tf-scope-1' } },
        ctx,
        [tfScope()],
      )
      expect((result as { reason: string }).reason).toBe('compiled.orchestration.scope.timeframe.fail_closed.primary_missing')
    })

    it('required_missing when required tf not in status', () => {
      const ctx = baseCtx({ timeframeBarStatus: { '15m': { lastClosedBarTs: 1_700_000_000_000, lastClosedBarIndex: 0 } } })
      const result = applyTimeframeScopeAlignment(
        { metadata: { timeframeScopeRef: 'tf-scope-1' } },
        ctx,
        [tfScope()],
      )
      expect((result as { reason: string }).reason).toBe('compiled.orchestration.scope.timeframe.fail_closed.required_missing')
    })
  })

  describe('bar-bucket alignment math (critic Round 1 C3)', () => {
    // primary=15m, required=1h；requiredDurationMs = 3,600,000
    // 14:00:00 UTC = 1700_000_000_000 假设作 base（实际不重要，bucket 计算用相对值）
    const baseTs = 1700_000_000_000

    it('strict & diff=0 (same hour bucket) → continue', () => {
      const ctx = baseCtx({ timeframeBarStatus: {
        '15m': { lastClosedBarTs: baseTs, lastClosedBarIndex: 0 },
        '1h': { lastClosedBarTs: baseTs, lastClosedBarIndex: 0 },
      } })
      const result = applyTimeframeScopeAlignment(
        { metadata: { timeframeScopeRef: 'tf-scope-1' } },
        ctx,
        [tfScope({ alignmentPolicy: 'strict' })],
      )
      expect(result).toBe('continue')
    })

    it('strict & diff=1 (primary 1 hour ahead of required) → alignment_lag', () => {
      const ctx = baseCtx({ timeframeBarStatus: {
        '15m': { lastClosedBarTs: baseTs + 60 * 60_000, lastClosedBarIndex: 1 }, // 1h ahead
        '1h': { lastClosedBarTs: baseTs, lastClosedBarIndex: 0 },
      } })
      const result = applyTimeframeScopeAlignment(
        { metadata: { timeframeScopeRef: 'tf-scope-1' } },
        ctx,
        [tfScope({ alignmentPolicy: 'strict' })],
      )
      expect((result as { reason: string }).reason).toBe('compiled.orchestration.scope.timeframe.fail_closed.alignment_lag')
    })

    it('tolerant & diff=1 → continue', () => {
      const ctx = baseCtx({ timeframeBarStatus: {
        '15m': { lastClosedBarTs: baseTs + 60 * 60_000, lastClosedBarIndex: 1 },
        '1h': { lastClosedBarTs: baseTs, lastClosedBarIndex: 0 },
      } })
      const result = applyTimeframeScopeAlignment(
        { metadata: { timeframeScopeRef: 'tf-scope-1' } },
        ctx,
        [tfScope({ alignmentPolicy: 'tolerant' })],
      )
      expect(result).toBe('continue')
    })

    it('tolerant & diff=2 → alignment_lag', () => {
      const ctx = baseCtx({ timeframeBarStatus: {
        '15m': { lastClosedBarTs: baseTs + 2 * 60 * 60_000, lastClosedBarIndex: 2 },
        '1h': { lastClosedBarTs: baseTs, lastClosedBarIndex: 0 },
      } })
      const result = applyTimeframeScopeAlignment(
        { metadata: { timeframeScopeRef: 'tf-scope-1' } },
        ctx,
        [tfScope({ alignmentPolicy: 'tolerant' })],
      )
      expect((result as { reason: string }).reason).toBe('compiled.orchestration.scope.timeframe.fail_closed.alignment_lag')
    })

    it('within-hour primary bar tick (15m advance, still same hour bucket) → strict continue', () => {
      const ctx = baseCtx({ timeframeBarStatus: {
        '15m': { lastClosedBarTs: baseTs + 15 * 60_000, lastClosedBarIndex: 1 }, // +15m, same hour
        '1h': { lastClosedBarTs: baseTs, lastClosedBarIndex: 0 },
      } })
      const result = applyTimeframeScopeAlignment(
        { metadata: { timeframeScopeRef: 'tf-scope-1' } },
        ctx,
        [tfScope({ alignmentPolicy: 'strict' })],
      )
      expect(result).toBe('continue')
    })

    it('PR critic Round 1 M2: negative bucketDiff (required tf 比 primary 新) → alignment_lag', () => {
      // Edge case: required tf timestamp jumped past primary (feed race / data corruption)
      // Old impl silently passes (bucketDiff < 0 ≤ maxBucketDiff); new impl fail-closed
      const baseTs = 1700_000_000_000
      const ctx = baseCtx({ timeframeBarStatus: {
        '15m': { lastClosedBarTs: baseTs, lastClosedBarIndex: 0 },
        '1h':  { lastClosedBarTs: baseTs + 60 * 60_000, lastClosedBarIndex: 1 }, // required ahead by 1 hour
      } })
      const result = applyTimeframeScopeAlignment(
        { metadata: { timeframeScopeRef: 'tf-scope-1' } },
        ctx,
        [tfScope({ alignmentPolicy: 'strict' })],
      )
      expect((result as { reason: string }).reason).toBe('compiled.orchestration.scope.timeframe.fail_closed.alignment_lag')
    })

    it('multiple required tfs: any one not aligned → alignment_lag', () => {
      const ctx = baseCtx({ timeframeBarStatus: {
        '5m':  { lastClosedBarTs: baseTs, lastClosedBarIndex: 0 },
        '15m': { lastClosedBarTs: baseTs, lastClosedBarIndex: 0 },
        '1h':  { lastClosedBarTs: baseTs - 60 * 60_000, lastClosedBarIndex: 0 }, // 1h late → bucketDiff=1 strict ✗
      } })
      const result = applyTimeframeScopeAlignment(
        { metadata: { timeframeScopeRef: 'tf-scope-1' } },
        ctx,
        [tfScope({
          primaryTimeframe: '5m',
          requiredTimeframes: ['15m', '1h'],
          alignmentPolicy: 'strict',
        })],
      )
      expect((result as { reason: string }).reason).toBe('compiled.orchestration.scope.timeframe.fail_closed.alignment_lag')
    })
  })

  describe('coexistence with symbol scopes', () => {
    it('passes through when only symbol scopes present (S2 unaffected)', () => {
      const mixed: CompiledOrchestrationScope[] = [
        { id: 's-btc', scopeKind: 'symbol', symbols: ['BTCUSDT'] },
        { id: 's-eth', scopeKind: 'symbol', symbols: ['ETHUSDT'] },
      ]
      const result = applyTimeframeScopeAlignment({ metadata: { symbolScopeRef: 's-btc' } }, baseCtx(), mixed)
      expect(result).toBe('continue')
    })
  })
})
