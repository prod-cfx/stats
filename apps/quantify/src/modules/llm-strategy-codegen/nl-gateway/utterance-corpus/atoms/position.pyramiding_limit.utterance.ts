/**
 * Issue #1279 PR2b: position.pyramiding_limit dispatcher fixtures
 *
 * 这些 fixture 仅供 dispatcher-self-baseline.spec.ts readdir 加载消费（filename pattern
 * 自动拾取），故意 **不**导入到 utterance-corpus/index.ts 的 utteranceCorpus 总线。
 *
 * 原因：
 *   - position.pyramiding_limit 由 INDIRECTLY_COVERED_ATOMS 全面豁免 corpus 三大约束
 *     （≥3 utterances / open-slot / open-slot 覆盖），其语义由 action.add_position 子句
 *     ('最多加仓 N 次' / '加仓层数=N') 间接落位 state.position.constraints[]。
 *   - 加入 utteranceCorpus 总线会触发 corpus invariants A-I，要求 seed-extractor 直接
 *     输出 atomKey='position.pyramiding_limit'；这会破坏 PR2b 不动 legacy extractor 的红线。
 *
 * 仅 utterance 列表用于 dispatcher self-baseline；不携带 `expected` 字段——
 * 真正的 oracle 是 `dispatcher-self-baseline.json`，fixture 重复 expected 只会
 * 制造"看似有契约但无人校验"的悬空文档（review M2）。
 *
 * Refs: #1279
 */

interface DispatcherFixtureCase {
  readonly id: string
  readonly atomKey: 'position.pyramiding_limit'
  readonly locale: 'zh' | 'en'
  readonly utterance: string
}

export const positionPyramidingLimitUtterances = [
  {
    id: 'position-pyramiding-limit-zh-locked-max-layers-fixed-pct',
    atomKey: 'position.pyramiding_limit',
    locale: 'zh',
    utterance: 'OKX 合约 BTCUSDT 15m，MA20 上穿 MA50 开多，每次加仓 20%，最多加仓 3 层。',
  },
  {
    id: 'position-pyramiding-limit-en-locked-pyramiding-keyword',
    atomKey: 'position.pyramiding_limit',
    locale: 'en',
    utterance: 'OKX BTCUSDT 1h, MA20 cross above MA50 open long, pyramiding up to 4 layers, each layer 25%.',
  },
  {
    id: 'position-pyramiding-limit-zh-locked-jinzita',
    atomKey: 'position.pyramiding_limit',
    locale: 'zh',
    utterance: 'BTC 1h 突破前高开多，盈利 3% 后加仓 50%，金字塔最多 3 层。',
  },
] satisfies readonly DispatcherFixtureCase[]
