/**
 * Issue #1279 PR2b: grid.range_rebalance dispatcher fixtures
 *
 * 这些 fixture 仅供 dispatcher-self-baseline.spec.ts readdir 加载消费（filename pattern
 * 自动拾取），故意 **不**导入到 utterance-corpus/index.ts 的 utteranceCorpus 总线。
 *
 * 原因：
 *   - grid.range_rebalance 由 INDIRECTLY_COVERED_ATOMS 全面豁免 corpus 三大约束，其
 *     语义由 grid 触发器子句 ('区间 X-Y, 每格 N USDT') 间接经
 *     `buildGridOrderProgramActionContracts` emit positionConstraint。
 *   - 加入 utteranceCorpus 总线会触发 corpus invariants A-I，要求 seed-extractor 直接
 *     输出 atomKey='grid.range_rebalance'；这会破坏 PR2b 不动 legacy extractor 的红线。
 *
 * 仅 utterance 列表用于 dispatcher self-baseline；不携带 `expected` 字段——
 * 真正的 oracle 是 `dispatcher-self-baseline.json`，fixture 重复 expected 只会
 * 制造"看似有契约但无人校验"的悬空文档（review M2）。
 *
 * Refs: #1279
 */

interface DispatcherFixtureCase {
  readonly id: string
  readonly atomKey: 'grid.range_rebalance'
  readonly locale: 'zh' | 'en'
  readonly utterance: string
}

export const gridRangeRebalanceUtterances = [
  {
    id: 'grid-range-rebalance-zh-locked-spot-grid',
    atomKey: 'grid.range_rebalance',
    locale: 'zh',
    utterance: 'BTC 现货 1h，区间 60000-70000，每格 100 USDT，挂 20 格，双向网格。',
  },
  {
    id: 'grid-range-rebalance-en-locked-perp-grid',
    atomKey: 'grid.range_rebalance',
    locale: 'en',
    utterance: 'OKX BTCUSDT 15m, grid range 60000-70000, each grid 100 USDT, 20 grids, recycle on.',
  },
  {
    id: 'grid-range-rebalance-zh-locked-narrow-range-long-only',
    atomKey: 'grid.range_rebalance',
    locale: 'zh',
    utterance: 'ETH 现货 4h，区间 2000-2500，每格 50 USDT，挂 10 格，仅做多，突破停止。',
  },
] satisfies readonly DispatcherFixtureCase[]
