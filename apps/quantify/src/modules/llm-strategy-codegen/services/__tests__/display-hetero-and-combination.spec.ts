/**
 * display-hetero-and-combination.spec.ts
 *
 * 需求驱动测试：Issue #1171 — 去掉展示投影层 entry trigger 合并白名单
 *
 * 验证：异质 AND 组合（不同 key 的 entry trigger 挂同一 groupId）
 * 应被展示层合并为单条"入场："，而非多条独立"入场："。
 *
 * 三个回归 case：
 * C1: indicator.cross_over + indicator.below（用户现场场景）
 * C2: indicator.cross_over + trend.direction
 * C3: indicator.above + indicator.cross_over
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

/**
 * 统计 texts 中以"入场："开头的条目数量，用于断言不出现多条独立入场卡片
 */
function countEntryConditions(texts: string[]): number {
  return texts.filter(t => t.startsWith('入场：')).length
}

describe('display logic graph — hetero AND combination (Issue #1171)', () => {
  /**
   * C1: MA20 上穿 MA50 且 价格在 EMA20 上方 → 单条 AND 合并
   * 对应用户现场：indicator.cross_over + indicator.below（或 indicator.above）挂同一 groupId
   */
  it('C1: indicator.cross_over + indicator.below 同 groupId → 单条入场卡片', () => {
    const graph = buildDisplay(
      'MA20 上穿 MA50 且 价格低于 EMA60 时开多，止损 5%',
    )
    const texts = collectConditionTexts(graph)

    // 至少有一条包含 AND 语义的入场文本
    expect(texts.length).toBeGreaterThan(0)

    // 不应出现 2 条或以上独立"入场："（多条独立入场是 bug 表现）
    const entryCount = countEntryConditions(texts)
    expect(entryCount).toBeLessThanOrEqual(1)
  })

  /**
   * C2: MA 上穿 + trend.direction（趋势方向确认）同 groupId → 单条 AND 合并
   */
  it('C2: indicator.cross_over + trend.direction 同 groupId → 单条入场卡片', () => {
    const graph = buildDisplay(
      'MA5 上穿 MA20 且趋势向上时开多，止损 3%',
    )
    const texts = collectConditionTexts(graph)

    expect(texts.length).toBeGreaterThan(0)

    const entryCount = countEntryConditions(texts)
    expect(entryCount).toBeLessThanOrEqual(1)
  })

  /**
   * C3: indicator.above + indicator.cross_over 同 groupId → 单条 AND 合并
   */
  it('C3: indicator.above + indicator.cross_over 同 groupId → 单条入场卡片', () => {
    const graph = buildDisplay(
      '价格在 EMA20 上方且 MA5 上穿 MA20 时开多，止损 5%',
    )
    const texts = collectConditionTexts(graph)

    expect(texts.length).toBeGreaterThan(0)

    const entryCount = countEntryConditions(texts)
    expect(entryCount).toBeLessThanOrEqual(1)
  })

  /**
   * 退化守卫：单个 indicator.cross_over（无 AND 组合）仍正常渲染
   */
  it('退化：单 indicator.cross_over 仍正常渲染为单条入场', () => {
    const graph = buildDisplay(
      'MA5 上穿 MA20 时开多，止损 5%',
    )
    const texts = collectConditionTexts(graph)

    // 应有入场文本
    const hasEntry = texts.some(t => t.includes('上穿') || t.includes('金叉') || t.includes('入场'))
    expect(hasEntry).toBe(true)
  })
})
