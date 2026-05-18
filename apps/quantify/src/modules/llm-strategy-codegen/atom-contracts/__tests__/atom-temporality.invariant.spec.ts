/**
 * Issue #1457 闸 2 — atom temporality invariant 守门
 *
 * 反向断言：ATOM_CONTRACT_REGISTRY 中每个 atom 都必须声明 temporality（'state' | 'event'）。
 * TS exhaustive Record 已在编译期守门（ATOM_TEMPORALITY satisfies Record<AtomContractKey,
 * 'state' | 'event'>），本 spec 作为运行时兜底：
 *   - 完整覆盖检查：注册表所有 key 都能从 getAtomTemporality 读到非 undefined 值
 *   - 取值合法性：必须严格等于 'state' 或 'event'
 *   - 已知锚点：列出代表性 state / event atom，确保表语义未漂移
 *     （新增 atom 时必须按"持续真值 vs rising-edge"显式选边，spec 拒绝静默漂移）
 */
import {
  ATOM_CONTRACT_REGISTRY,
  getAllRegisteredAtomKeys,
  getAtomTemporality,
} from '../atom-contract-registry'

describe('ATOM_TEMPORALITY invariant (#1457 闸 2)', () => {
  it('declares temporality for every registered atom', () => {
    const missing: string[] = []
    for (const key of getAllRegisteredAtomKeys()) {
      const value = getAtomTemporality(key)
      if (value === undefined) missing.push(key)
    }
    expect(missing).toEqual([])
  })

  it('每个 atom 的 temporality 字段必须为 "state" / "event" / "structural"（review round 1 M4 引入 structural）', () => {
    for (const key of getAllRegisteredAtomKeys()) {
      const atom = ATOM_CONTRACT_REGISTRY[key]
      expect(['state', 'event', 'structural']).toContain(atom.temporality)
      expect(atom.temporality).toBe(getAtomTemporality(key))
    }
  })

  it('review round 1 M4 — scope / action / risk / orchestration / positionConstraint 类 atom 必须标为 structural', () => {
    const structuralAnchors = [
      'action.open_long',
      'action.close_long',
      'risk.stop_loss_pct',
      'risk.take_profit_pct',
      'scope.symbol',
      'scope.timeframe',
      'portfolioRisk.drawdown_block',
      'program.dynamic_grid',
      'gate.regime',
      'strategy.time_window',
      'execution.on_start',
    ] as const
    for (const key of structuralAnchors) {
      expect(getAtomTemporality(key)).toBe('structural')
    }
  })

  it('已知 state 锚点 atom 维持 "state" 标注', () => {
    const stateAnchors = [
      'indicator.above',
      'indicator.below',
      'oscillator.rsi_gte',
      'oscillator.rsi_lte',
      'position.has_position',
      'trend.direction',
      'market.regime',
      'volatility.state',
    ] as const

    for (const key of stateAnchors) {
      expect(getAtomTemporality(key)).toBe('state')
    }
  })

  it('已知 event 锚点 atom 维持 "event" 标注', () => {
    const eventAnchors = [
      'indicator.cross_over',
      'indicator.cross_under',
      'bollinger.touch_upper',
      'bollinger.touch_lower',
      'price.breakout_up',
      'price.breakout_down',
      'condition.sequence',
      'liquidity.sweep',
    ] as const

    for (const key of eventAnchors) {
      expect(getAtomTemporality(key)).toBe('event')
    }
  })
})
