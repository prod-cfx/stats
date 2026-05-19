/**
 * Issue #1412 — spec-builder levels+range→stepPct 派生回归 spec
 *
 * 背景：
 *   #1409 把 resolver 通道收成 atom-driven 单 slot 抽参后，grid clarification
 *   「20格」答复能正确写到 `trigger.params.levels = 20`，但
 *   `CanonicalSpecBuilderService.resolveGridParamsFromSemanticTrigger` 仅读
 *   `trigger.params.stepPct`，stepPct === null 直接 return null → orderPrograms 空。
 *
 *   本 spec 验证 #1412 派生器修复：stepPct 缺席而 levels + range 在场时，
 *   按几何间距反推 stepPct = (ratio - 1) * 100，其中 ratio = (upper/lower)^(1/(levels-1))。
 *
 *   产品 UI 实测路径「15m + 区间 79200-80200 + 双向 + 20格 + okx + BTC + 合约 + 3% 止损」
 *   由此派生 stepPct ≈ 0.0664%，orderPrograms 不再空。
 *
 * Refs: #1412 #1409
 */

import { CanonicalSpecBuilderService } from '../canonical-spec-builder.service'
import type { SemanticTriggerState } from '../../types/semantic-state'

interface PrivateBuilder {
  resolveGridParamsFromSemanticTrigger: (
    trigger: SemanticTriggerState,
    defaultTimeframe: string | null,
  ) => Record<string, number | string | boolean> | null
}

function makeBuilder(): PrivateBuilder {
  return new CanonicalSpecBuilderService() as unknown as PrivateBuilder
}

function makeGridTrigger(params: Record<string, unknown>): SemanticTriggerState {
  return {
    id: 'trigger-grid-test',
    key: 'grid.range_rebalance',
    phase: 'entry',
    sideScope: 'both',
    params,
    status: 'locked',
    source: 'user_explicit',
    evidence: { text: 'test', source: 'user_explicit' },
    openSlots: [],
  } as SemanticTriggerState
}

describe('CanonicalSpecBuilderService.resolveGridParamsFromSemanticTrigger — #1412 派生器', () => {
  const builder = makeBuilder()

  it('显式 stepPct 在场时直接使用（不触发派生）', () => {
    const trigger = makeGridTrigger({
      rangeLower: 79200,
      rangeUpper: 80200,
      stepPct: 0.5,
    })
    const result = builder.resolveGridParamsFromSemanticTrigger(trigger, '15m')
    expect(result).not.toBeNull()
    expect(result!.stepPct).toBe(0.5)
    expect(result!.rangeMin).toBe(79200)
    expect(result!.rangeMax).toBe(80200)
  })

  it('stepPct 缺席 + levels=20 + 区间 79200-80200 → 派生 stepPct ≈ 0.0664%（产品 UI 实测路径）', () => {
    const trigger = makeGridTrigger({
      rangeLower: 79200,
      rangeUpper: 80200,
      levels: 20,
      sideMode: 'bidirectional',
    })
    const result = builder.resolveGridParamsFromSemanticTrigger(trigger, '15m')
    expect(result).not.toBeNull()
    // 几何派生：(80200/79200)^(1/19) - 1 ≈ 0.0006640 → 0.06640%
    expect(result!.stepPct).toBeCloseTo(0.0664, 3)
    expect(result!.rangeMin).toBe(79200)
    expect(result!.rangeMax).toBe(80200)
    expect(result!.timeframe).toBe('15m')
  })

  it('stepPct 缺席 + levels=10 + 区间 100-200 → 派生 stepPct ≈ 8.006%', () => {
    const trigger = makeGridTrigger({
      rangeLower: 100,
      rangeUpper: 200,
      levels: 10,
    })
    const result = builder.resolveGridParamsFromSemanticTrigger(trigger, null)
    expect(result).not.toBeNull()
    // (200/100)^(1/9) - 1 ≈ 0.080060 → 8.006%
    expect(result!.stepPct).toBeCloseTo(8.0060, 3)
  })

  it('m2 守卫：levels 非整数（如 2.5）不触发派生', () => {
    const trigger = makeGridTrigger({
      rangeLower: 79200,
      rangeUpper: 80200,
      levels: 2.5,
    })
    const result = builder.resolveGridParamsFromSemanticTrigger(trigger, '15m')
    expect(result).toBeNull()
  })

  it('m1 守卫：派生 stepPct toFixed(4) 后 → 0.0000 时拒绝（极端窄区间 + 高 levels）', () => {
    // lower=79200 upper=79201 levels=200 → ratio ≈ 1.0000000631 → stepPct ≈ 6.31e-6 %
    //   toFixed(4) = 0.0000 → 必须 return null 而非传 0 下游
    const trigger = makeGridTrigger({
      rangeLower: 79200,
      rangeUpper: 79201,
      levels: 200,
    })
    const result = builder.resolveGridParamsFromSemanticTrigger(trigger, '15m')
    expect(result).toBeNull()
  })

  it('levels 缺席且 stepPct 缺席 → 默认 20 格派生 stepPct', () => {
    const trigger = makeGridTrigger({
      rangeLower: 79200,
      rangeUpper: 80200,
    })
    const result = builder.resolveGridParamsFromSemanticTrigger(trigger, '15m')
    expect(result).toEqual(expect.objectContaining({
      rangeMin: 79200,
      rangeMax: 80200,
      timeframe: '15m',
    }))
    expect(result?.levelCount).toBeGreaterThanOrEqual(19)
    expect(result?.stepPct).toBeGreaterThan(0)
  })

  it('centerOffsetPct=0 + stepPct + levels → 按当前价中心哨兵归一相对网格', () => {
    const trigger = makeGridTrigger({
      centerOffsetPct: 0,
      stepPct: 0.4,
      levels: 10,
      sideMode: 'both',
    })
    const result = builder.resolveGridParamsFromSemanticTrigger(trigger, '1m')
    expect(result).toEqual(expect.objectContaining({
      rangeMin: 0.996,
      rangeMax: 1.004,
      stepPct: 0.08,
      timeframe: '1m',
    }))
    expect(result?.levelCount).toBeGreaterThanOrEqual(10)
  })

  it('levels < 2 → 派生不触发（return null）', () => {
    const trigger = makeGridTrigger({
      rangeLower: 79200,
      rangeUpper: 80200,
      levels: 1,
    })
    const result = builder.resolveGridParamsFromSemanticTrigger(trigger, '15m')
    expect(result).toBeNull()
  })

  it('range 非法（upper <= lower）→ return null 不触发派生', () => {
    const trigger = makeGridTrigger({
      rangeLower: 80000,
      rangeUpper: 80000,
      levels: 20,
    })
    const result = builder.resolveGridParamsFromSemanticTrigger(trigger, '15m')
    expect(result).toBeNull()
  })

  it('派生 stepPct 后 deriveGridLevelCount 仍能恢复至 levels（容差 1）', () => {
    // 验证派生公式与 deriveGridLevelCount 反向一致：
    //   levels=20 → stepPct ≈ 0.0664 → log(80200/79200)/log(1+0.0664/100) + 1
    const trigger = makeGridTrigger({
      rangeLower: 79200,
      rangeUpper: 80200,
      levels: 20,
    })
    const result = builder.resolveGridParamsFromSemanticTrigger(trigger, '15m')
    expect(result).not.toBeNull()
    const levelCount = result!.levelCount as number
    // toFixed(4) 截断可能让派生器的 deriveGridLevelCount 略偏一格，容差 ±1
    expect(levelCount).toBeGreaterThanOrEqual(19)
    expect(levelCount).toBeLessThanOrEqual(20)
  })
})
