import { NaturalLanguageGatewayService } from '../natural-language-gateway.service'
import { SemanticFrameNormalizerService } from '../semantic-frame-normalizer.service'
import { SemanticSeedExtractorService } from '../semantic-seed-extractor.service'
import { SemanticSeedStateBuilderService } from '../semantic-seed-state-builder.service'
import { SemanticStateProjectionService } from '../semantic-state-projection.service'

/**
 * 需求驱动回归测试：多周期 EMA 堆叠语句的展示卡片合并
 *
 * Bug A：单一合取入场 "ema20 ema60 ema144 上方时做多" 必须以单卡片呈现
 * Bug B：方向性 EMA 过滤器（多向/空向）必须按 sideScope 各自合并为单卡片，
 *        并避免与 condition.expression gate 重复表达
 */
const BUG_A = '15m 价格在 ema20 ema60 ema144 上方时做多开仓；价格低于 ema20 时平多；止损 5%；仓位 10 USDT'
const BUG_B = '15min，价格在 ema20 ema60 ema144 上方时做多开仓 都位于下方只开空，入场是 boll 下轨开多 上轨开空，币安 BTCUSDT 永续，亏损 5% 止损'

describe('display logic graph — multi-EMA stack regression', () => {
  const gateway = new NaturalLanguageGatewayService()
  const frameNormalizer = new SemanticFrameNormalizerService()
  const seedExtractor = new SemanticSeedExtractorService()
  const seedStateBuilder = new SemanticSeedStateBuilderService()
  const projection = new SemanticStateProjectionService()

  function buildDisplay(text: string) {
    const state = seedStateBuilder.build(seedExtractor.extract(text))
    if (!state) throw new Error('expected seed state to be built')
    return projection.buildDisplayLogicGraph(state)
  }

  function collectConditionTexts(graph: ReturnType<SemanticStateProjectionService['buildDisplayLogicGraph']>): string[] {
    return graph.blocks.flatMap(block =>
      block.items
        .filter(item => item.kind === 'condition')
        .map(item => item.text),
    )
  }

  it('BUG A: 合并 EMA20/EMA60/EMA144 为单条入场卡片', () => {
    const graph = buildDisplay(BUG_A)
    const texts = collectConditionTexts(graph)

    // 入场条件 EMA stack：必须是合并后的单条
    const stackEntry = texts.find(text => text.includes('EMA20') && text.includes('EMA60') && text.includes('EMA144'))
    expect(stackEntry).toBeDefined()
    expect(stackEntry).toEqual(expect.stringMatching(/价格在\s?EMA20\s?\/\s?EMA60\s?\/\s?EMA144\s?上方/))

    // 不应该出现 3 张独立 EMA 卡片
    const singleEmaCardCount = texts.filter(text =>
      /^价格在\s?EMA(20|60|144)\s?上方$/.test(text),
    ).length
    expect(singleEmaCardCount).toBe(0)

    // 平多出场仍为单条
    expect(texts.some(text => /价格低于\s?EMA20/.test(text))).toBe(true)
  })

  it('BUG A: NL gateway 主线必然产出 long-side condition.expression gate（AND + ≥2 子项）', () => {
    // m2 (PR #1147 review)：当前实现对 Bug A 输入必然命中；将软断言改为硬断言，消除非确定性
    const frames = gateway.parse(BUG_A)
    const patch = frameNormalizer.normalize(frames)
    const longGate = patch.triggers?.find(t =>
      t.key === 'condition.expression' && t.sideScope === 'long' && t.phase === 'gate',
    )
    expect(longGate).toBeDefined()
    const expression = longGate!.params.expression as { kind: string, children?: unknown[] }
    expect(expression.kind).toBe('AND')
    expect(Array.isArray(expression.children)).toBe(true)
    expect(expression.children!.length).toBeGreaterThanOrEqual(2)
  })

  it('BUG B: 多空两侧 EMA stack 分别合并，且不与同向 condition.expression gate 重复', () => {
    const graph = buildDisplay(BUG_B)
    const texts = collectConditionTexts(graph)

    // 同向 EMA stack 合并后的入场卡片至少出现一次（短向卡显式 "价格在 EMA20/EMA60/EMA144 上方"，方向歧义由 action 表达）
    const stackText = texts.find(text =>
      /价格在\s?EMA20\s?\/\s?EMA60\s?\/\s?EMA144\s?上方/.test(text),
    )
    expect(stackText).toBeDefined()

    // 入场卡片不应被 condition.expression gate 文本重复追加，即不应出现 "且收盘价低于EMA20且收盘价低于EMA60且收盘价低于EMA144" 形态紧跟在合并后的 EMA stack 卡片之后
    const duplicated = texts.find(text =>
      /价格在\s?EMA20\s?\/\s?EMA60\s?\/\s?EMA144\s?上方.*收盘价(高于|低于)\s?EMA/.test(text),
    )
    expect(duplicated).toBeUndefined()

    // 不应该出现 3 张独立 "价格在 EMA20 上方" / "价格在 EMA60 上方" / "价格在 EMA144 上方" 卡片
    const singleEmaShortCards = texts.filter(text =>
      /^价格在\s?EMA(20|60|144)\s?上方$/.test(text),
    )
    expect(singleEmaShortCards.length).toBe(0)

    // BOLL 下轨/上轨入场仍存在
    expect(texts.some(text => /BOLL\s?下轨/.test(text))).toBe(true)
    expect(texts.some(text => /BOLL\s?上轨/.test(text))).toBe(true)
  })

  it('退化：单 EMA period（仅 EMA20）不应被错误合并', () => {
    const graph = buildDisplay('15m 价格在 ema20 上方时做多开仓；价格低于 ema20 时平多；止损 5%；仓位 10 USDT')
    const texts = collectConditionTexts(graph)
    // 不应出现 "/" 合并语法
    expect(texts.some(text => /EMA20.*\/.*EMA/.test(text))).toBe(false)
  })
})

/**
 * 表达式 AST 层（formatSemanticExpression）合并回归：
 *   BOLL 入场卡 gate 文本路径走 condition.expression → formatSemanticExpression，
 *   AND 表达式 children 全为「bar.close OP indicator(ema/sma/ma, period)」时，
 *   必须复用 trigger 路径相同的合并 renderer，输出「价格在 EMA20/EMA60/EMA144 上方/下方」。
 */
describe('formatSemanticExpression — multi-EMA AND merge', () => {
  const projection = new SemanticStateProjectionService()
  const formatExpr = (expression: unknown): string =>
    (projection as unknown as { formatSemanticExpression(e: unknown): string }).formatSemanticExpression(expression)

  function mkPredicate(period: number, op: 'GT' | 'LT' | 'GTE' | 'LTE', indicator: string = 'ema') {
    return {
      kind: 'predicate' as const,
      op,
      left: { kind: 'series' as const, source: 'bar' as const, field: 'close' as const },
      right: { kind: 'indicator' as const, name: indicator, params: { period }, output: 'value' },
    }
  }

  it('BOLL 下轨入场 + 三 EMA 上方过滤器：AND 表达式合并为 "价格在 EMA20/EMA60/EMA144 上方"', () => {
    const expression = {
      kind: 'AND' as const,
      children: [mkPredicate(60, 'GT'), mkPredicate(20, 'GT'), mkPredicate(144, 'GT')],
    }
    expect(formatExpr(expression)).toBe('价格在 EMA20 / EMA60 / EMA144 上方')
  })

  it('BOLL 上轨入场 + 三 EMA 下方过滤器：AND 表达式合并为 "价格低于 EMA20/EMA60/EMA144"', () => {
    const expression = {
      kind: 'AND' as const,
      children: [mkPredicate(20, 'LT'), mkPredicate(60, 'LT'), mkPredicate(144, 'LT')],
    }
    expect(formatExpr(expression)).toBe('价格低于 EMA20 / EMA60 / EMA144')
  })

  it('退化：AND 只有 1 个 EMA period → 不命中合并，落回原 predicate 串接（含「收盘价高于 EMA20」）', () => {
    const expression = {
      kind: 'AND' as const,
      children: [mkPredicate(20, 'GT')],
    }
    // 单 child 退化：不触发合并；走原 children.join 路径，输出唯一 child 文本
    const out = formatExpr(expression)
    expect(out).toBe('收盘价高于EMA20')
    expect(out).not.toMatch(/价格在.*上方/)
  })

  it('退化：AND 中混入非 EMA 谓词（如 RSI） → 不命中合并，回退原平铺「且」串接', () => {
    const rsiPredicate = {
      kind: 'predicate' as const,
      op: 'GT' as const,
      left: { kind: 'indicator' as const, name: 'rsi', params: { period: 14 }, output: 'value' },
      right: { kind: 'constant' as const, value: 70 },
    }
    const expression = {
      kind: 'AND' as const,
      children: [mkPredicate(20, 'GT'), mkPredicate(60, 'GT'), rsiPredicate],
    }
    const out = formatExpr(expression)
    // 必须是逐谓词 join 路径（含 且 分隔符 + RSI 谓词），不能被错误折叠成 "价格在 EMA20/EMA60 上方"
    expect(out).toContain('且')
    expect(out).not.toMatch(/价格在\s?EMA\d+\s?\/\s?EMA\d+\s?上方/)
    expect(out).toContain('RSI14')
  })

  it('退化：AND children operator 方向不一致（GT 与 LT 混合） → 不命中合并', () => {
    const expression = {
      kind: 'AND' as const,
      children: [mkPredicate(20, 'GT'), mkPredicate(60, 'LT')],
    }
    const out = formatExpr(expression)
    expect(out).not.toMatch(/价格在|价格低于/)
    expect(out).toContain('且')
  })

  // M4 (PR #1147 review) edge cases
  it('退化：AND 中 period 重复（ema20 出现两次）→ 不命中合并，回退平铺', () => {
    const expression = {
      kind: 'AND' as const,
      children: [mkPredicate(20, 'GT'), mkPredicate(20, 'GT'), mkPredicate(60, 'GT')],
    }
    const out = formatExpr(expression)
    expect(out).not.toMatch(/价格在\s?EMA20\s?\/\s?EMA60\s?上方/)
    expect(out).toContain('且')
  })

  it('退化：AND children indicator 名混用（EMA + SMA）→ 不命中合并', () => {
    const expression = {
      kind: 'AND' as const,
      children: [mkPredicate(20, 'GT', 'ema'), mkPredicate(60, 'GT', 'sma')],
    }
    const out = formatExpr(expression)
    expect(out).not.toMatch(/价格在/)
    expect(out).toContain('且')
  })

  it('退化：AND 主语为 bar.high（非 bar.close）→ 不命中合并', () => {
    const expression = {
      kind: 'AND' as const,
      children: [
        {
          kind: 'predicate' as const,
          op: 'GT' as const,
          left: { kind: 'series' as const, source: 'bar' as const, field: 'high' as const },
          right: { kind: 'indicator' as const, name: 'ema', params: { period: 20 }, output: 'value' },
        },
        {
          kind: 'predicate' as const,
          op: 'GT' as const,
          left: { kind: 'series' as const, source: 'bar' as const, field: 'high' as const },
          right: { kind: 'indicator' as const, name: 'ema', params: { period: 60 }, output: 'value' },
        },
      ],
    }
    const out = formatExpr(expression)
    expect(out).not.toMatch(/价格在/)
  })

  it('退化：AND children=1（单 child）退化为非合并候选', () => {
    const expression = {
      kind: 'AND' as const,
      children: [mkPredicate(20, 'GT')],
    }
    const out = formatExpr(expression)
    expect(out).not.toMatch(/价格在\s?EMA/)
  })

  it('退化：嵌套 AND(AND(x,y), z) 外层不直接命中合并（外层 child 是 AND，非 predicate）', () => {
    const inner = {
      kind: 'AND' as const,
      children: [mkPredicate(20, 'GT'), mkPredicate(60, 'GT')],
    }
    const expression = {
      kind: 'AND' as const,
      children: [inner, mkPredicate(144, 'GT')],
    }
    const out = formatExpr(expression)
    // 外层 AND 不能误把含嵌套 AND 的 children 折叠为「价格在 EMA20/EMA60/EMA144 上方」
    expect(out).not.toMatch(/价格在\s?EMA20\s?\/\s?EMA60\s?\/\s?EMA144\s?上方/)
    // 内层 AND 在递归渲染时仍可合并
    expect(out).toContain('价格在 EMA20 / EMA60 上方')
  })
})
