// #1169 回归测试：buildPositionSummary 在 position.mode='constraint_only' 时
//   sizing=null 不得早退；locked constraints（如 dca_schedule）必须仍能渲染。
//
// PR #1166 引入 constraint 渲染循环但放在 sizing 早退之后，导致用户报告的
// "RSI 触发 + 纯 DCA 入场" utterance summary 完全丢失 DCA 段；本 spec 永久守门。

import type { SemanticPositionState, SemanticState } from '../../types/semantic-state'
import { SemanticSeedExtractorService } from '../semantic-seed-extractor.service'
import { SemanticSeedStateBuilderService } from '../semantic-seed-state-builder.service'
import { SemanticStateProjectionService } from '../semantic-state-projection.service'

function emptyState(position: SemanticPositionState | null): SemanticState {
  return {
    version: 1,
    families: [],
    triggers: [],
    actions: [],
    risk: [],
    position,
    contextSlots: { exchange: null, symbol: null, marketType: null, timeframe: null },
    normalizationNotes: [],
    updatedAt: '2026-05-11T00:00:00.000Z',
  }
}

describe('SemanticStateProjectionService — DCA constraint_only positionSummary (#1169)', () => {
  const service = new SemanticStateProjectionService()

  it('constraint_only 模式 + locked dca_schedule → positionSummary 渲染 DCA（不早退）', () => {
    const position: SemanticPositionState = {
      mode: 'constraint_only',
      value: 0,
      positionMode: 'long_only',
      sizing: null as never, // 强制无 sizing，模拟 constraint_only 真实形态
      status: 'locked',
      source: 'user_explicit',
      openSlots: [],
      constraints: [{
        id: 'dca-1',
        key: 'position.dca_schedule',
        params: {
          maxCount: 4,
          triggerMode: 'price_interval',
          priceIntervalPct: 5,
          perOrderSizing: { kind: 'quote', value: 100, asset: 'USDT' },
          capitalCap: { kind: 'quote', value: 500, asset: 'USDT' },
        },
        status: 'locked',
        source: 'user_explicit',
        openSlots: [],
      }],
    }
    const view = service.buildConversationView(emptyState(position))
    // 守门：sizing=null 不再早退，DCA 内容必须出现
    expect(view.positionSummary).not.toBe('')
    expect(view.positionSummary).toMatch(/DCA|补仓/iu)
  })

  it('用户原始 utterance 端到端：RSI + DCA → summary 含 DCA 段', () => {
    const utterance = 'OKX 现货 BTCUSDT 1h，RSI14 低于 30 开始 DCA，价格每跌 5% 补仓一次，每次 100 USDT，最多 4 次，总投入不超过 500 USDT，RSI14 高于 70 卖出。'
    const extractor = new SemanticSeedExtractorService()
    const seedBuilder = new SemanticSeedStateBuilderService()
    const state = seedBuilder.build(extractor.extract(utterance))
    expect(state).not.toBeNull()
    if (!state) return
    const view = service.buildConversationView(state)
    // 入场 + 出场 + DCA 三段必须都在
    expect(view.summary).toMatch(/RSI/iu)
    expect(view.summary).toMatch(/DCA|补仓/iu)
  })
})
