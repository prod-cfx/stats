/**
 * Issue #1279 PR2c5b — dispatcher condition.expression gap 文档化（spec-only）
 *
 * 背景：
 *   legacy SemanticSeedExtractorService 对 OHLC 比较类 utterance
 *   （如"15m 收盘价高于开盘价开多"）产 `condition.expression` 复合 trigger。
 *   该 key 被整个 legacy pipeline 作为"结构性复合条件包装器"使用：
 *     - semantic-frame-normalizer.service.ts 直接 emit literal
 *     - semantic-atom-invariant.service.ts 内含特判分支
 *     - canonical-spec-builder.service.ts 3 处 composite-condition 包裹逻辑
 *     - internal-key-leak-guard 把 condition.expression 显式列为
 *       PUBLIC_RESPONSE_INTERNAL_IDENTIFIERS（不得泄漏到公开响应）
 *
 *   GenericSeedDispatcher（PR2 新路径）当前对此类 utterance **零命中**：
 *     - ATOM_CONTRACT_REGISTRY 中无 condition.expression surface 条目
 *     - 原因：将 condition.expression 接入 registry 需同步修改 ≥9 个下游文件
 *       （超过 PR2c5b 红线 >5 个联动文件即停规则），属 PR3 IR 重构范畴
 *
 * 本 spec 的两重作用（gap fixation）：
 *   1. 锁定 dispatcher 当前对 OHLC compare utterance 的"零命中"状态，防止回归：
 *      若有人误把 legacy condition.expression 硬接进 dispatcher，此 spec 会 fail，
 *      提醒走 PR3 IR 重构路径而非临时 hack。
 *   2. 文档化 gap 存在，便于 PR3 引入 condition.expression IR 化后将断言反转为
 *      "dispatcher 必须产 ≥1 等价 trigger"的正向验收 spec。
 *
 * PR3 TODO：
 *   当 condition.expression 在 IR compiler 中被结构化重构后：
 *   - 将下方 `expect(hasConditionExpression).toBe(false)` 反转为 `toBe(true)`
 *   - 不可只把 toBe(false) 改 toBe(true)；必须同时断言 trigger 结构包含 OHLC 字段引用
 *     （如 op / lhs.field / rhs.field 等），避免空壳 condition.expression trigger 通过
 *   - 同步删除"当前 gap 状态"注释，改写为正向验收
 *   - 确认 internal-key-leak-guard 的分类策略随 IR 重构同步更新
 *
 * Refs: #1279
 */

import { GenericSeedDispatcher } from '../generic-seed-dispatcher.service'
import type { CodegenSemanticPatch } from '../../types/codegen-semantic-patch'

const dispatcher = new GenericSeedDispatcher()

interface OhlcGapCase {
  readonly id: string
  readonly utterance: string
  readonly description: string
}

const OHLC_COMPARE_GAP_CASES: readonly OhlcGapCase[] = [
  {
    id: 'ohlc-gap-close-gt-open-long',
    utterance: '15m 收盘价高于开盘价开多，亏损 5% 止损',
    description: '收盘价 > 开盘价 → 做多（典型 OHLC 比较入场条件）',
  },
  {
    id: 'ohlc-gap-open-gt-close-short',
    utterance: '开盘价低于收盘价开空',
    description: '开盘价 < 收盘价 → 做空（反向 OHLC 比较）',
  },
  {
    id: 'ohlc-gap-high-breakout-long',
    utterance: 'BTC 1h 最高价突破前根最高价开多',
    description: '最高价突破前根最高价 → 做多（K 线间 OHLC 比较）',
  },
  {
    id: 'ohlc-gap-and-composite',
    utterance: '15m 收盘价高于开盘价且最高价突破前高，开多止损 5%',
    description: 'AND 复合 OHLC 比较 → 做多（多条件 composite，condition.expression 典型场景）',
  },
]

function collectTotalNodes(patch: CodegenSemanticPatch): number {
  return (
    (patch.triggers?.length ?? 0)
    + (patch.actions?.length ?? 0)
    + (patch.risk?.length ?? 0)
  )
}

describe('issue #1279 PR2c5b — dispatcher condition.expression gap（OHLC compare）', () => {
  describe.each(OHLC_COMPARE_GAP_CASES)('$id: $description', ({ id: _id, utterance }) => {
    let patch: CodegenSemanticPatch

    beforeEach(() => {
      patch = dispatcher.dispatch(utterance)
    })

    it('dispatcher 不产 condition.expression trigger（当前已知 gap，PR3 再处理）', () => {
      // 当前 gap 状态：dispatcher 无 condition.expression surface，故不应命中。
      // 若此断言 fail → 说明有人绕过 PR3 路径把 condition.expression 硬接进 dispatcher，
      //   需要评审是否同步处理了 ≥9 个下游文件的联动（见文件头说明）。
      const hasConditionExpression = (patch.triggers ?? []).some(
        t => t.key === 'condition.expression',
      )
      expect(hasConditionExpression).toBe(false)
    })

    it('dispatcher.dispatch 不抛异常（throw-free，即使 gap 存在）', () => {
      // 零命中是可接受的 gap 状态；但 dispatcher 必须不抛异常。
      expect(() => dispatcher.dispatch(utterance)).not.toThrow()
    })

    it('dispatcher 总节点数 >= 1（OHLC trigger 缺失时其余子句仍被识别）', () => {
      // OHLC 比较触发条件缺失（gap），但 dispatcher 对 utterance 中其他子句
      // （价格突破、时间窗口等）仍会产出至少 1 个节点，证明 gap 是精确命中
      // condition.expression 这一特定语义，而非 dispatcher 对整条 utterance 完全失效。
      const total = collectTotalNodes(patch)
      expect(total).toBeGreaterThanOrEqual(1)
    })
  })
})
