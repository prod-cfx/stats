/**
 * Issue #1383 follow-up：S1 "价格区间 + 双向网格 + 每格间距 X%" → grid.range_rebalance
 *
 * 锁定回归不变量：GenericSeedDispatcher 接收 S1 风格 utterance（中文/英文，任意
 * range / step 数值），必须在 typed rules program condition 中产出
 * key='grid.range_rebalance'，并且 paramSlots 全部抽出。
 *
 * 与 dispatcher-self-baseline 不同：这里是「shape-only / number-agnostic」的语义
 * 不变量断言，不依赖具体 baseline.json，能在新增 atom / 调整 baseline 时独立守门。
 *
 * 注意：grid.range_rebalance 的 stepPct 在 paramSlot 中 range=[0,100]，因此抽取
 * 结果保留「百分点数值」（0.5 而非 0.005）；该数值含义由 atom-contract 的
 * paramRenderer / emit 决定，不在 dispatcher 责任内。
 *
 * Refs: #1383
 */
import { collectAtomLeaves } from '../../types/atom-expr'
import { GenericSeedDispatcher } from '../generic-seed-dispatcher.service'

type PatchAtom = {
  key: string
  phase: 'entry' | 'exit' | 'gate' | 'program' | null
  params: Record<string, unknown>
  sideScope?: 'long' | 'short' | 'both' | null
}

describe('GenericSeedDispatcher - grid.range_rebalance extraction (Issue #1383 S1)', () => {
  const dispatcher = new GenericSeedDispatcher()

  function findGridAtom(message: string): PatchAtom | undefined {
    const result = dispatcher.dispatch(message)
    return (result.rules ?? [])
      .flatMap(rule => collectAtomLeaves(rule.condition).map(leaf => ({ ...leaf, phase: rule.phase })))
      .find(a => a.key === 'grid.range_rebalance')
  }

  it('emits grid.range_rebalance for S1 full utterance (60000-80000 / 0.5% / 双向)', () => {
    const s1 = '在 OKX 交易 BTCUSDT 永续合约，15m 周期，价格区间 60000-80000，采用双向网格，每格间距 0.5%，单笔使用 10% 资金，按入场均价亏损 5% 止损、盈利 10% 止盈'
    const atom = findGridAtom(s1)
    expect(atom).toBeDefined()
    expect(atom!.phase).toBe('program')
    expect(atom!.params).toMatchObject({
      rangeLower: 60000,
      rangeUpper: 80000,
      sideMode: 'both',
      stepPct: 0.5,
    })
    expect(atom!.params).not.toHaveProperty('breakoutAction')
  })

  it('emits grid breakoutAction only when user explicitly says boundary stop behavior', () => {
    const msg = 'OKX 现货 ETHUSDT、1m 网格以部署时当前价为中心，上下各0.4%共10格、每格10 USDT；当价格突破上下边界时立即停止并撤销所有未成交订单'
    const atom = findGridAtom(msg)
    expect(atom).toBeDefined()
    expect(atom!.params.breakoutAction).toBe('stop')
  })

  it('emits grid.range_rebalance for narrow-range / long-only variant (number-agnostic)', () => {
    // dispatcher 是 per-clause 匹配 + 跨 clause 兼容合并；sideMode='仅做多' 与
    // "价格区间 X-Y" 出现在同一片段时，会落到同一 grid atom（"做多" 也会被
    // EVENT_TERMINATOR_RE 切走，但 detectExplicitActionSide 兜底将 sideScope 派生
    // 为 'long'，atom params.sideMode 由 enum-zh-map 抽取保持 'long_only'）。
    const msg = 'ETH 现货 4h，价格区间 2000-2500 仅做多'
    const atom = findGridAtom(msg)
    expect(atom).toBeDefined()
    expect(atom!.params).toMatchObject({
      rangeLower: 2000,
      rangeUpper: 2500,
      sideMode: 'long_only',
    })
  })

  it('emits grid.range_rebalance with English keywords (range X-Y / each grid)', () => {
    const msg = 'OKX BTCUSDT 15m, grid range 30000-40000, each grid 0.8%, recycle on.'
    const atom = findGridAtom(msg)
    expect(atom).toBeDefined()
    expect(atom!.params.rangeLower).toBe(30000)
    expect(atom!.params.rangeUpper).toBe(40000)
  })

  it('does not emit grid.range_rebalance when no grid/range vocabulary present', () => {
    const msg = '在 OKX 交易 BTCUSDT 永续合约，15m，RSI(14) ≤ 30 时市价开多'
    const atom = findGridAtom(msg)
    expect(atom).toBeUndefined()
  })
})
