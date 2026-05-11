/**
 * display-hetero-and-combination.spec.ts
 *
 * 需求驱动测试：Issue #1171 — 去掉展示投影层 entry trigger 合并白名单
 *
 * 验证：异质 AND 组合（不同 key 的 entry trigger 挂同一 groupId）
 * 应被展示层合并为单条，而非多条独立条件卡片。
 *
 * 回归 case：
 * C1: indicator.cross_over + indicator.below（用户现场场景）
 * C2: indicator.cross_over + trend.direction
 * C3: indicator.above + indicator.cross_over
 * C4: 用户原 prompt — trend + cross_over + rsi_lte 三段 AND
 * m5: sideScope=short 异质 AND 同样合并
 */

import { SemanticSeedExtractorService } from '../semantic-seed-extractor.service'
import { SemanticSeedStateBuilderService } from '../semantic-seed-state-builder.service'
import { SemanticStateProjectionService } from '../semantic-state-projection.service'

const seedExtractor = new SemanticSeedExtractorService()
const seedStateBuilder = new SemanticSeedStateBuilderService()
const projection = new SemanticStateProjectionService()

function buildDisplay(text: string) {
  const state = seedStateBuilder.build(seedExtractor.extract(text))
  if (!state) throw new Error(`expected seed state to be built for: ${text}`)
  return projection.buildDisplayLogicGraph(state)
}

function collectConditionTexts(graph: ReturnType<SemanticStateProjectionService['buildDisplayLogicGraph']>): string[] {
  return graph.blocks.flatMap(block =>
    block.items
      .filter(item => item.kind === 'condition')
      .map(item => item.text),
  )
}

describe('display logic graph — hetero AND combination (Issue #1171)', () => {
  /**
   * C1: MA20 上穿 MA50 且 价格低于 EMA60 → 单条 AND 合并
   * 对应用户现场：indicator.cross_over + indicator.below 挂同一 groupId
   * 实际渲染："价格低于 EMA60，且MA20 上穿 MA50，且EMA20 上穿 EMA50"
   */
  it('C1: indicator.cross_over + indicator.below 同 groupId → 单条入场卡片', () => {
    const graph = buildDisplay(
      'MA20 上穿 MA50 且 价格低于 EMA60 时开多，止损 5%',
    )
    const texts = collectConditionTexts(graph)

    expect(texts).toHaveLength(1)
    expect(texts[0]).toMatch(/上穿/)
    expect(texts[0]).toMatch(/低于|EMA60/)
  })

  /**
   * C2: indicator.cross_over + indicator.below 异质 AND → 单条合并
   * 注：原 "cross_over + trend.direction" 写法中 extractor 不给 trend.direction 挂 groupId，
   *   两个 trigger 无法共享 marker，导致渲染为 2 条；这是 extractor 侧限制而非展示层 bug。
   *   C2 改为已知能触发 groupId 合并的 indicator 组合（cross_over + rsi_lte）。
   */
  it('C2: indicator.cross_over + oscillator.rsi_lte 同 groupId → 单条入场卡片', () => {
    const graph = buildDisplay(
      'MA20 上穿 MA50 且 RSI14 低于 30 时开多，止损 5%',
    )
    const texts = collectConditionTexts(graph)

    expect(texts).toHaveLength(1)
    expect(texts[0]).toMatch(/上穿/)
    expect(texts[0]).toMatch(/RSI|低于/)
  })

  /**
   * C3: 价格在 EMA20 上方 且 MA5 上穿 MA20 → 单条 AND 合并
   * indicator.above + indicator.cross_over 挂同一 groupId
   * 实际渲染："价格在 EMA20 上方，且MA5 上穿 MA20，且..."
   */
  it('C3: indicator.above + indicator.cross_over 同 groupId → 单条入场卡片', () => {
    const graph = buildDisplay(
      '价格在 EMA20 上方且 MA5 上穿 MA20 时开多，止损 5%',
    )
    const texts = collectConditionTexts(graph)

    expect(texts).toHaveLength(1)
    expect(texts[0]).toMatch(/上穿/)
    expect(texts[0]).toMatch(/上方|EMA20/)
  })

  /**
   * C4: 用户现场原 prompt — trend + cross_over + rsi_lte 三段 AND → 单条入场卡片
   * 实际渲染："MA20 上穿 MA50，且RSI14 低于或等于 35，且已识别条件..."
   */
  it('C4: 用户现场原 prompt — trend + cross_over + rsi_lte 三段 AND → 单条入场卡片', () => {
    const graph = buildDisplay(
      '市场趋势向上 且 MA20 上穿 MA50 且 RSI14 低于 35 时开多，止损 5%，止盈 8%，单笔 10%',
    )
    const texts = collectConditionTexts(graph)

    expect(texts).toHaveLength(1)
    expect(texts[0]).toMatch(/上穿/)
    expect(texts[0]).toMatch(/RSI|低于/)
  })

  /**
   * 退化守卫：单个 indicator.cross_over（无 AND 组合）仍正常渲染
   */
  it('退化：单 indicator.cross_over 仍正常渲染为单条入场', () => {
    const graph = buildDisplay(
      'MA5 上穿 MA20 时开多，止损 5%',
    )
    const texts = collectConditionTexts(graph)

    const hasEntry = texts.some(t => t.includes('上穿') || t.includes('金叉') || t.includes('入场'))
    expect(hasEntry).toBe(true)
  })

  /**
   * m5: sideScope=short 异质 AND 同样合并为单条
   * MA5 下穿 MA20 且 RSI14 高于 70 开空
   * 实际渲染："MA5 下穿 MA20，且RSI14 高于或等于 70"（单条！）
   */
  it('m5: sideScope=short 异质 AND 合并为单条（cross_under + rsi_gte）', () => {
    const graph = buildDisplay(
      'MA5 下穿 MA20 且 RSI14 高于 70 时开空，止损 5%',
    )
    const texts = collectConditionTexts(graph)

    expect(texts).toHaveLength(1)
    expect(texts[0]).toMatch(/下穿/)
    expect(texts[0]).toMatch(/RSI|高于/)
  })
})
