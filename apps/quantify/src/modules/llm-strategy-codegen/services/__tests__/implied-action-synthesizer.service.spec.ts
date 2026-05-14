/**
 * Issue #1364 PR4 — ImpliedActionSynthesizerService + UnsupportedFallbackClassifierService 单测
 *
 * 覆盖 issue #1364 AC-5 策略 1（cross_under 隐含 close_long 合成）+ 策略 4
 * （回撤暂停定投走 unsupported_fallback）。
 */

import {
  ImpliedActionSynthesizerService,
  UnsupportedFallbackClassifierService,
} from '../implied-action-synthesizer.service'
import type { SemanticActionState, SemanticTriggerState } from '../../types/semantic-state'

function buildTrigger(overrides: Partial<SemanticTriggerState>): SemanticTriggerState {
  return {
    id: 'trigger-1',
    key: 'indicator.cross_under',
    phase: 'exit',
    params: {},
    sideScope: 'long',
    status: 'open',
    source: 'user_explicit',
    ...overrides,
  } as SemanticTriggerState
}

describe('ImpliedActionSynthesizerService (issue #1364 PR4 — AC-5 策略 1)', () => {
  const service = new ImpliedActionSynthesizerService()

  it('cross_under exit + sideScope=long 合成 action.close_long', () => {
    const triggers = [buildTrigger({ key: 'indicator.cross_under', phase: 'exit', sideScope: 'long' })]
    const synthesized = service.synthesizeImpliedActions(triggers, [])
    expect(synthesized).toHaveLength(1)
    expect(synthesized[0].key).toBe('action.close_long')
    expect(synthesized[0].source).toBe('inferred')
  })

  it('cross_under exit + sideScope=short 合成 action.close_short', () => {
    const triggers = [buildTrigger({ key: 'indicator.cross_under', phase: 'exit', sideScope: 'short' })]
    const synthesized = service.synthesizeImpliedActions(triggers, [])
    expect(synthesized).toHaveLength(1)
    expect(synthesized[0].key).toBe('action.close_short')
  })

  it('cross_over exit + sideScope=long 合成 action.close_long', () => {
    const triggers = [buildTrigger({ key: 'indicator.cross_over', phase: 'exit', sideScope: 'long' })]
    const synthesized = service.synthesizeImpliedActions(triggers, [])
    expect(synthesized).toHaveLength(1)
    expect(synthesized[0].key).toBe('action.close_long')
  })

  it('phase=entry 不合成（仅 exit phase 触发隐含 close）', () => {
    const triggers = [buildTrigger({ key: 'indicator.cross_under', phase: 'entry', sideScope: 'long' })]
    const synthesized = service.synthesizeImpliedActions(triggers, [])
    expect(synthesized).toHaveLength(0)
  })

  it('已有显式 action.close_long 时不重复合成', () => {
    const triggers = [buildTrigger({ key: 'indicator.cross_under', phase: 'exit', sideScope: 'long' })]
    const existingActions: SemanticActionState[] = [
      {
        id: 'existing-1',
        key: 'action.close_long',
        params: {},
        status: 'locked',
        source: 'user_explicit',
      },
    ]
    const synthesized = service.synthesizeImpliedActions(triggers, existingActions)
    expect(synthesized).toHaveLength(0)
  })

  it('non-cross trigger 不合成（如 oscillator.rsi_lte）', () => {
    const triggers = [buildTrigger({ key: 'oscillator.rsi_lte', phase: 'exit', sideScope: 'long' })]
    const synthesized = service.synthesizeImpliedActions(triggers, [])
    expect(synthesized).toHaveLength(0)
  })

  it('AC-5 策略 1 完整流：EMA 上穿开多 + EMA 下穿（隐含 close_long） → 合成 action.close_long', () => {
    const triggers: SemanticTriggerState[] = [
      buildTrigger({ id: 't-cross-over', key: 'indicator.cross_over', phase: 'entry', sideScope: 'long' }),
      buildTrigger({ id: 't-cross-under', key: 'indicator.cross_under', phase: 'exit', sideScope: 'long' }),
    ]
    // 用户已显式声明 open_long，但忘了 close_long
    const existingActions: SemanticActionState[] = [
      {
        id: 'a-open-long',
        key: 'action.open_long',
        params: {},
        status: 'locked',
        source: 'user_explicit',
      },
    ]
    const synthesized = service.synthesizeImpliedActions(triggers, existingActions, 'turn-1')
    expect(synthesized).toHaveLength(1)
    expect(synthesized[0].key).toBe('action.close_long')
    expect(synthesized[0].id).toMatch(/^turn-1:implied:t-cross-under:action\.close_long$/)
  })
})

describe('UnsupportedFallbackClassifierService (issue #1364 PR4 — AC-5 策略 4)', () => {
  const service = new UnsupportedFallbackClassifierService()

  it('AC-5 策略 4：回撤暂停定投 → drawdown_pause_dca_unsupported', () => {
    const result = service.classify('BTC 现货 1d 每周一定投 100 U，单笔回撤 8% 暂停定投')
    expect(result).not.toBeNull()
    expect(result!.publicReason).toBe('drawdown_pause_dca_unsupported')
    expect(result!.publicReasonZh).toContain('回撤暂停定投')
    expect(result!.publicReasonEn).toContain('Pause-DCA')
  })

  it('「回撤暂停加仓」也命中（同一 pattern 的加仓变体）', () => {
    const result = service.classify('账户回撤超过 10% 时停止加仓')
    expect(result).not.toBeNull()
    expect(result!.publicReason).toBe('drawdown_pause_dca_unsupported')
  })

  it('非匹配文本返回 null', () => {
    const result = service.classify('BTC 永续 1h，EMA20 上穿 EMA50 开多')
    expect(result).toBeNull()
  })

  it('仅含「回撤」无「暂停」上下文不命中', () => {
    const result = service.classify('账户回撤 10% 时全平仓')
    expect(result).toBeNull()
  })
})
