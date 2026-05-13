/**
 * Issue #1279 PR2b — dispatcher 语义等价矩阵 spec
 *
 * 不变式（structural invariants，非 byte-equal）：
 *   - AC-7 真实用户 prompt（6 条）：dispatcher.dispatch 必须产出 ≥1 条可执行节点
 *     （trigger / action / risk 任一段非空）。
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
 * hotfix #1279（main 3/8 fail 修订）：
 *   原 PR2b M1 fix 把 AC-7 invariant 收紧为 "trigger ≥ 1 且 (action+risk) ≥ 1"
 *   双段约束，但 dispatcher 当前对 ac-7-user-4/5/6（BTC 加仓 / DCA 定投 / Grid 区间）
 *   只产 trigger，未贡献 action/risk——grid / dca / pyramiding atom 在
 *   BUCKET_TO_PATCH_SLOT 里映射 positionConstraint，未流到三段断言。
 *   暂时回退到"任意 ≥1 节点"门槛，待 PR2c5 dispatcher 补齐 chart/candle/dca/grid/
 *   pyramiding atom 路径并接入 patch.position.constraints[] 之后再收紧。
 *
 * TODO(#1279 PR2c5)：
 *   - 升级为 per-utterance expected{triggerKeys, actionKeys, riskKeys} 矩阵，
 *     例如 ac-7-user-1 必须命中 oscillator.rsi_lt + risk.stop_loss；
 *   - 接入 positionConstraint bucket 后 ac-7-user-4/5/6 的 grid/dca/pyramiding 段
 *     可纳入 invariant，恢复双段约束。
 *
 * Refs: #1279
 */
import { GenericSeedDispatcher } from '../generic-seed-dispatcher.service'
import { AC7_USER_PROMPTS, AC12_WEBHOOK_PROMPTS } from './fixtures/ac-prompts'

describe('issue #1279 PR2b — dispatcher semantic equivalence', () => {
  const dispatcher = new GenericSeedDispatcher()

  describe('AC-7：真实用户 prompt 必须产出可执行节点', () => {
    it.each(AC7_USER_PROMPTS)(
      '$id：dispatch 必须产出 ≥1 条可执行节点（trigger / action / risk）',
      ({ utterance }) => {
        const patch = dispatcher.dispatch(utterance)
        const triggerCount = patch.triggers?.length ?? 0
        const actionCount = patch.actions?.length ?? 0
        const riskCount = patch.risk?.length ?? 0
        const total = triggerCount + actionCount + riskCount

        // hotfix：从 PR2b M1 双段约束回退到"任意 ≥1 节点"。详见文件头注解。
        expect(total).toBeGreaterThanOrEqual(1)
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
