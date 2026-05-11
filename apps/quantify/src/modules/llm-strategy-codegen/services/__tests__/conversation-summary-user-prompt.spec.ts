/**
 * 端到端 conversation summary spec（Issue #1179）：
 *   用户原 prompt 灌入 buildConversationView.summary，验证：
 *   1. 恰好 1 条 "入场：" 前缀的段（marker 分组合并异质 AND）
 *   2. 该段含 "上穿" + RSI 关键词
 *   3. 恰好 1 条 "出场：" 前缀的段，含 "下穿"
 *   4. "trend.direction" internal key 不泄漏到 summary
 */

import { SemanticSeedExtractorService } from '../semantic-seed-extractor.service'
import { SemanticSeedStateBuilderService } from '../semantic-seed-state-builder.service'
import { SemanticStateProjectionService } from '../semantic-state-projection.service'

describe('conversation summary user prompt regression (Issue #1179)', () => {
  const extractor = new SemanticSeedExtractorService()
  const builder = new SemanticSeedStateBuilderService()
  const projection = new SemanticStateProjectionService()

  it('用户原 prompt → buildConversationView.summary 单条入场卡片合并', () => {
    const text
      = 'OKX 合约 BTCUSDT 15m，市场趋势向上且 MA20 上穿 MA50 且 RSI14 低于 35 开多，MA20 下穿 MA50 平多，单笔 10%，止损 5%，止盈 8%'

    const extracted = extractor.extract(text)
    const state = builder.build(extracted)
    expect(state).not.toBeNull()

    const cv = projection.buildConversationView(state!)

    // 断言：只有 1 条 "入场：" 段
    const entries = cv.summary.split('；').filter(s => s.startsWith('入场：'))
    expect(entries).toHaveLength(1)

    // 断言：入场段包含 "上穿"
    expect(entries[0]).toMatch(/上穿/)

    // 断言：入场段包含 RSI 相关关键词
    expect(entries[0]).toMatch(/RSI|低于/)

    // 断言：只有 1 条 "出场：" 段
    const exits = cv.summary.split('；').filter(s => s.startsWith('出场：'))
    expect(exits).toHaveLength(1)

    // 断言：出场段包含 "下穿"
    expect(exits[0]).toMatch(/下穿/)

    // 断言：trend.direction internal key 不泄漏到 summary
    expect(cv.summary).not.toMatch(/\btrend\.direction\b/)
  })
})
