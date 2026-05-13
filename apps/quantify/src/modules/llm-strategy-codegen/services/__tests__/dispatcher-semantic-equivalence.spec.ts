/**
 * Issue #1279 PR2b — dispatcher 语义等价矩阵 spec
 *
 * 不变式（structural invariants，非 byte-equal）：
 *   - AC-7 真实用户 prompt（6 条）：dispatcher.dispatch 必须产出 ≥1 条 trigger，
 *     且 actions + risk 总计 ≥1 条。即"何时进场"与"怎么进场 / 怎么风控"两段
 *     都必须落到至少 1 条节点；其中一段为 0 视为语义崩塌。
 *   - AC-12 webhook prompt（2 条）：dispatcher.dispatch 必须产出 ≥1 条
 *     external.signal trigger 节点。
 *
 * 设计取舍：
 *   - byte-equal 与 legacy SemanticSeedExtractorService 的对比已被证伪
 *     （见 dispatcher-self-baseline.spec.ts 头注解），故此 spec 改测语义等价 invariants。
 *   - 此 spec 与 dispatcher-self-baseline.spec.ts 的边界：
 *     baseline 守"任何 dispatcher 改动必须显式重录"；本 spec 守"每条 prompt 至少有
 *     可执行节点"。两者互不替代——前者捕获回归，后者捕获语义崩塌。
 *   - prompt 列表共享自 ./fixtures/ac-prompts.ts，与 dispatcher-self-baseline.spec.ts
 *     校准同一组语料，避免 silent drift。
 *
 * TODO(#1279 PR2c)：
 *   - 升级为 per-utterance expected{triggerKeys, actionKeys, riskKeys} 矩阵，
 *     例如 ac-7-user-1 必须命中 oscillator.rsi_lt + risk.stop_loss；
 *   - 接入 positionConstraint bucket 后 ac-7-user-4/5/6 的 grid/dca/pyramiding 段
 *     可纳入 invariant。
 *
 * Refs: #1279
 */
import { GenericSeedDispatcher } from '../generic-seed-dispatcher.service'
import { AC7_USER_PROMPTS, AC12_WEBHOOK_PROMPTS } from './fixtures/ac-prompts'

describe('issue #1279 PR2b — dispatcher semantic equivalence', () => {
  const dispatcher = new GenericSeedDispatcher()

  describe('AC-7：真实用户 prompt 必须产出 trigger + (action 或 risk) 双段', () => {
    it.each(AC7_USER_PROMPTS)(
      '$id：dispatch 必须产出 ≥1 条 trigger 且 ≥1 条 action/risk',
      ({ utterance }) => {
        const patch = dispatcher.dispatch(utterance)
        const triggerCount = patch.triggers?.length ?? 0
        const actionCount = patch.actions?.length ?? 0
        const riskCount = patch.risk?.length ?? 0

        // 双段约束：trigger 段必须 ≥1（"何时"），action+risk 段必须 ≥1（"怎么"）。
        // 任一段为 0 即视为语义崩塌；不允许"任意 1 节点"蒙混过关。
        expect(triggerCount).toBeGreaterThanOrEqual(1)
        expect(actionCount + riskCount).toBeGreaterThanOrEqual(1)
      },
    )
  })

  describe('AC-12：webhook prompt 必须命中 external.signal trigger', () => {
    it.each(AC12_WEBHOOK_PROMPTS)(
      '$id：dispatch 必须包含 ≥1 条 external.signal trigger',
      ({ utterance }) => {
        const patch = dispatcher.dispatch(utterance)
        const triggers = patch.triggers ?? []
        const externalSignalHits = triggers.filter(t => t.key === 'external.signal')
        expect(externalSignalHits.length).toBeGreaterThanOrEqual(1)
      },
    )
  })
})
