/**
 * #1496 块 5 — 8 条 pass 策略五层一致性 spec
 *
 * 抽样 8 条阶段 A 实际 pass 的策略，对每条断言：
 *  - 五层产物 hash（rulesTree / displayGraph / spec / ir / ast）非空
 *  - inline snapshot 锁 5 个 hash 前 16 位 + scriptAtoms 集合
 *
 * #1496-M3.2 五层抽样：保留 #1 / #2 / #4 / #8 / #9 / #24 / #26（覆盖 grid /
 *  AND 嵌套 / BOLL trio / candle pattern / cross / multi-timeframe / RSI 阈值），
 *  额外加入 #21（SOL 30m MA100 + MACD 金叉买入 / 跌破 MA100 OR MACD 死叉卖出），
 *  显式覆盖出场子句含 OR 嵌套的 AtomExpr 树（C1 修复后该策略路由由
 *  publication_context_missing → pass）。
 */

import { THIRTY_ONE_STRATEGIES } from '../fixtures/thirty-one-strategies'
import { PLANNER_MOCKS_BY_STRATEGY } from '../fixtures/thirty-one-strategies-planner-mocks'
import { ThirtyOneStrategyHarness } from './thirty-one-strategy-harness'

const SAMPLE_PASS_IDS = [1, 2, 4, 8, 9, 21, 24, 26] as const

describe('#1496 31-strategy golden harness — five-layer consistency (sample)', () => {
  const harness = new ThirtyOneStrategyHarness()

  for (const id of SAMPLE_PASS_IDS) {
    const fixture = THIRTY_ONE_STRATEGIES.find(item => item.id === id)
    if (!fixture) throw new Error(`fixture #${id} missing in THIRTY_ONE_STRATEGIES`)

    it(`#${fixture.id} ${fixture.name} — 五层 hash + scriptAtoms inline snapshot`, async () => {
      const mockQueue = [...(PLANNER_MOCKS_BY_STRATEGY[fixture.id] ?? [])]
      const artifacts = await harness.run(fixture, mockQueue)

      expect(artifacts.route).toBe('pass')
      expect(artifacts.rulesTreeHash).toMatch(/^[0-9a-f]{16}$/)
      expect(artifacts.displayGraphHash).toMatch(/^[0-9a-f]{16}$/)
      expect(artifacts.specHash).toMatch(/^[0-9a-f]{16}$/)
      expect(artifacts.irHash).toMatch(/^[0-9a-f]{16}$/)
      expect(artifacts.astHash).toMatch(/^[0-9a-f]{16}$/)

      // inline snapshot 锁 5 个 hash + scriptAtoms 列表（形态、不是数值）
      expect({
        id: fixture.id,
        rulesTreeHash: artifacts.rulesTreeHash,
        displayGraphHash: artifacts.displayGraphHash,
        specHash: artifacts.specHash,
        irHash: artifacts.irHash,
        astHash: artifacts.astHash,
        scriptAtoms: artifacts.scriptAtoms,
      }).toMatchSnapshot()
    })
  }
})
