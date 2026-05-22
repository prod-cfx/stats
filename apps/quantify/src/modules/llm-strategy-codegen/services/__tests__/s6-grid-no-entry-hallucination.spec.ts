import { collectAtomLeaves } from '../../types/atom-expr'
import { GenericSeedDispatcher } from '../generic-seed-dispatcher.service'

function conditionLeaves(out: ReturnType<GenericSeedDispatcher['dispatch']>) {
  return (out.rules ?? []).flatMap(rule =>
    collectAtomLeaves(rule.condition).map(leaf => ({ ...leaf, phase: rule.phase })),
  )
}

describe('Issue #1391 follow-up — S6 grid 网格策略不再误生成 entry 触发', () => {
  const dispatcher = new GenericSeedDispatcher()
  const S6 = 'OKX 现货 ETHUSDT、1m 网格以部署时当前价为中心，上下各0.4%共10格、每格10 USDT、限价单并相邻网格自动挂反向单、不用趋势信号开仓；当价格突破上下边界时执行立即停止并撤销所有未成交订单'

  it('"突破上下边界" 网格停止从句不再误匹 price.breakout_up / breakout_down 为 entry', () => {
    const out = dispatcher.dispatch(S6)
    const blob = JSON.stringify(out)
    expect(blob).not.toContain('"key":"price.breakout_up"')
    expect(blob).not.toContain('"key":"price.breakout_down"')
  })

  it('"相邻网格自动挂反向单" / "上下各0.4%共10格" / "立即停止并撤销订单" 被正确归为 grid.range_rebalance', () => {
    const out = dispatcher.dispatch(S6)
    const grids = conditionLeaves(out).filter(a => a.key === 'grid.range_rebalance')
    expect(grids.length).toBeGreaterThanOrEqual(1)
    expect(grids.every(g => g.phase === 'program')).toBe(true)
    expect(grids.some(g => g.params?.sideMode === 'both')).toBe(true)
    expect(grids.some(g => g.params?.breakoutAction === 'stop')).toBe(true)
    const sized = grids.find(g => g.params?.centerOffsetPct === 0.4)
    expect(sized).toBeDefined()
    expect(sized?.params?.levels).toBe(10)
    expect(sized?.params?.perGridSizing).toBe(10)
  })
})
