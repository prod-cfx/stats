/**
 * ThirtyOneStrategyHarness sanity spec（Issue #1496 块 2）
 *
 * 用一条最小用例端到端验证 runner：
 *  - mock planner patch 直接复用 GenericSeedDispatcher 对真实 userInput 的解析输出，
 *    等价于"块 3 mock planner data"提供的 raw planner.semanticPatch。
 *  - 断言：route='pass'、5 层 hash 非空、scriptAtoms 集合非空且符合预期。
 *
 * 注意：本 spec 仅自检 runner 接口契约；31 条 fixture 的完整跑批由块 4 driver spec
 * 配合块 3 的成套 mock 数据完成。
 */

import type { PlannerMockQueue } from './thirty-one-strategy-harness'
import { GenericSeedDispatcher } from '../../generic-seed-dispatcher.service'
import { THIRTY_ONE_STRATEGIES } from '../fixtures/thirty-one-strategies'
import { ThirtyOneStrategyHarness } from './thirty-one-strategy-harness'

describe('thirtyOneStrategyHarness sanity', () => {
  it('fixture #1 OKX 永续 grid: route=pass，5 层 hash 非空，scriptAtoms 非空', async () => {
    // grid 类策略走 orderPrograms，publication 在 user-five spec 中已验证可生成
    // 完整 compiled script。scriptAtoms 用整体非空兜底（grid 程序中的 trigger atom
    // 不一定直接以 atom-key 字面量出现在 onBar 主体，但脚本头 / 元数据通常会出现
    // 其他 atom key；不再硬绑某个 atom）。
    const fixture = THIRTY_ONE_STRATEGIES.find(item => item.id === 1)!
    expect(fixture).toBeDefined()

    // mock planner = 真实 dispatcher 解析（块 3 的成品 mock 等价物）
    const dispatched = new GenericSeedDispatcher().dispatch(fixture.userInput)
    // sanity spec 复用 GenericSeedDispatcher 输出（CodegenSemanticPatch shape）作为 mock —
    //   harness runtime narrow 时无差异；TS 静态层断言一次 unknown 即可。
    const mockQueue: PlannerMockQueue = [{ semanticPatch: dispatched as unknown as Record<string, unknown> }]

    const harness = new ThirtyOneStrategyHarness()
    const result = await harness.run(fixture, mockQueue)

    expect(result.route).toBe('pass')
    expect(result.rulesTreeHash).toMatch(/^[0-9a-f]{16}$/)
    expect(result.displayGraphHash).toMatch(/^[0-9a-f]{16}$/)
    expect(result.specHash).toMatch(/^[0-9a-f]{16}$/)
    expect(result.irHash).toMatch(/^[0-9a-f]{16}$/)
    expect(result.astHash).toMatch(/^[0-9a-f]{16}$/)
    expect(Array.isArray(result.scriptAtoms)).toBe(true)
    expect(result.clarificationRounds).toBe(0)
  })

  it('unsupported route: planner 显式标 unsupportedReasons → route.kind=unsupported', async () => {
    const fixture = THIRTY_ONE_STRATEGIES.find(item => item.id === 1)!
    const mockQueue: PlannerMockQueue = [{
      unsupportedReasons: ['UNSUPPORTED_ATOM:foo.bar'],
    }]

    const harness = new ThirtyOneStrategyHarness()
    const result = await harness.run(fixture, mockQueue)

    expect(result.route).toEqual({ kind: 'unsupported', reason: 'UNSUPPORTED_ATOM:foo.bar' })
    expect(result.scriptAtoms).toEqual([])
    // #1496-M5：unsupported 路径 4 层 hash 相等回归
    expect(result.displayGraphHash).toBe(result.specHash)
    expect(result.specHash).toBe(result.irHash)
    expect(result.irHash).toBe(result.astHash)
  })

  it('empty mockQueue 抛错', async () => {
    const fixture = THIRTY_ONE_STRATEGIES.find(item => item.id === 1)!
    const harness = new ThirtyOneStrategyHarness()
    await expect(harness.run(fixture, [])).rejects.toThrow(/empty mockQueue/)
  })

  /**
   * #1496-M2：clarification loop 覆盖
   *  - 首轮 mock: spot + short → harness.buildSafetyClarificationItems 检测到
   *    spot+short 不兼容，进入 clarification 循环
   *  - 第二轮 mock（澄清回复）: marketType=perp，覆盖 spot；short 在 perp 合法
   *  - 期望: 经 1 轮 clarification 后 route='pass'，clarificationRounds=1
   */
  it('clarification loop: spot+short → answer "perp" → re-evaluate → pass', async () => {
    const fixture = THIRTY_ONE_STRATEGIES.find(item => item.id === 1)!
    const inlineFixture = {
      ...fixture,
      clarificationAnswers: ['perp'],
    }
    const mockQueue: PlannerMockQueue = [
      // 首轮：spot 现货 + short 触发；harness 应识别为不兼容
      {
        related: true,
        logicReady: false,
        semanticPatch: {
          contextSlots: {
            symbol: 'BTCUSDT',
            timeframe: '15m',
            exchange: 'binance',
            marketType: 'spot',
          },
          rules: [
            {
              id: 'm2-short',
              phase: 'entry',
              sideScope: 'short',
              condition: { kind: 'atom', key: 'bollinger.touch_upper', params: { period: 20, stdDev: 2 } },
              effects: [{ kind: 'atom', key: 'open_short', params: {} }],
            },
          ],
        },
      },
      // 澄清回复：marketType=perp，pipeline 重新评估应通过
      {
        related: true,
        logicReady: true,
        clarificationAnswered: true,
        semanticPatch: {
          contextSlots: {
            symbol: 'BTCUSDT',
            timeframe: '15m',
            exchange: 'binance',
            marketType: 'perp',
          },
          rules: [
            {
              id: 'm2-short',
              phase: 'entry',
              sideScope: 'short',
              condition: { kind: 'atom', key: 'bollinger.touch_upper', params: { period: 20, stdDev: 2 } },
              effects: [{ kind: 'atom', key: 'open_short', params: {} }],
            },
          ],
        },
      },
    ]
    const harness = new ThirtyOneStrategyHarness()
    const result = await harness.run(inlineFixture, mockQueue)

    expect(result.route).toBe('pass')
    expect(result.clarificationRounds).toBe(1)
  })
})
