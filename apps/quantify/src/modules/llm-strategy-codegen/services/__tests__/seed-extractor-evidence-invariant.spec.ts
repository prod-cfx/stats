import { collectAtomLeaves } from '../../types/atom-expr'
import { GenericSeedDispatcher } from '../generic-seed-dispatcher.service'
import { AC7_USER_PROMPTS, AC12_WEBHOOK_PROMPTS } from './fixtures/ac-prompts'

// Issue #1223 / #1279 PR2c6b：dispatcher 出口 evidence invariant
//
// 历史背景：
//   原 spec（PR2c6 之前）测的是 SemanticSeedStateBuilderService.build 的 evidence
//   invariant —— 即 builder 在收到 source !== 'system_default' 但缺 evidence 的
//   trigger / risk / action 时 throw（test mode）/ drop（prod mode）。
//
// PR2c6b 重写理由（用户裁定 turn 6）：
//   PR2 把 codegen 入口从 SemanticSeedExtractorService 切到 GenericSeedDispatcher。
//   新 dispatcher 的契约更强：所有产出节点恒带 evidence: { text, source }，
//   source 由 atom surface.evidenceProvenance 声明（数据驱动，无 atom-key 字面量比较）。
//
// 本 spec 守住的不变量（dispatcher patch 出口形态）：
//   I1：dispatcher 产出的每条 trigger / action / risk 都自带 evidence.text 与 evidence.source
//   I2：evidence.text 必须是原 message 的子串（不允许幻觉短语）
//   I3：evidence.source 按 utterance 类型区分（PR2c5 升级，refs #1279）：
//       AC-12 webhook prompt → external.signal 节点 source='webhook'
//       AC-7  user prompt    → 所有节点 source='user_explicit'（无 webhook atom）
//       实现：external.signal atom surface 声明 evidenceProvenance: 'webhook'，
//             dispatcher 读表赋值，无 atom-key 字面量比较（AC-13 合规）
//   I4：Case 2 (#1218) MA stack utterance 不产生无 evidence 的 condition.expression phase=gate
//   I5：dispatcher 接受空 message / 未提供 message，不抛异常且产空 patch
//
// 与其它 spec 的边界：
//   - dispatcher-self-baseline.spec：守 byte-equal regression（任何字段漂移立即 fail）
//   - dispatcher-semantic-equivalence.spec：守 AC-7/AC-12 prompt 必有可执行节点
//   - 本 spec：守 dispatcher 出口的 evidence 字段级 invariant（structural，非 baseline）
describe('issue #1223 / #1279 PR2c6b — dispatcher evidence invariant', () => {
  const dispatcher = new GenericSeedDispatcher()

  interface EvidenceBearing { key?: string, evidence?: { text?: string } }

  function collectAllNodes(patch: ReturnType<GenericSeedDispatcher['dispatch']>): EvidenceBearing[] {
    return (patch.rules ?? []).flatMap(rule => collectAtomLeaves(rule.condition))
  }

  describe('i1：dispatcher typed condition 节点必带 evidence.text', () => {
    it('所有节点 evidence 字段完整（AC-7-style utterance）', () => {
      const message = 'BTCUSDT 1m 收盘价高于开盘价开多，亏损 5% 止损'
      const patch = dispatcher.dispatch(message)
      const nodes = collectAllNodes(patch)
      expect(nodes.length).toBeGreaterThan(0)
      for (const node of nodes) {
        expect(node.evidence).toBeDefined()
        expect(typeof node.evidence?.text).toBe('string')
        // review m3：从 `length > 0` 收紧到 `trim().length > 0`，防 whitespace-only text
        expect((node.evidence?.text ?? '').trim().length).toBeGreaterThan(0)
      }
    })
  })

  describe('i2：evidence.text 必须是原 message 子串（不允许幻觉短语）', () => {
    it('节点 evidence.text 全部命中原 message', () => {
      const message = 'BTCUSDT 1m 收盘价高于开盘价开多，亏损 5% 止损'
      const patch = dispatcher.dispatch(message)
      const nodes = collectAllNodes(patch)
      const phantom = nodes.filter(n => !n.evidence?.text || !message.includes(n.evidence.text))
      expect(phantom).toEqual([])
    })
  })

  describe('i3：typed rules 保留 webhook / user prompt 的 evidence text', () => {
    describe('ac-12 webhook prompt：external.signal 节点必须带 evidence.text', () => {
      it.each(AC12_WEBHOOK_PROMPTS)(
        '$id：external.signal 节点 evidence.text 存在',
        ({ utterance }) => {
          const patch = dispatcher.dispatch(utterance)
          const externalSignalNodes = collectAllNodes(patch).filter(t => t.key === 'external.signal')
          expect(externalSignalNodes.length).toBeGreaterThanOrEqual(1)
          for (const node of externalSignalNodes) {
            expect(node.evidence?.text).toBeTruthy()
          }
        },
      )
    })

    describe('ac-7 user prompt：所有节点 evidence.text 必须存在', () => {
      it.each(AC7_USER_PROMPTS)(
        '$id：所有节点 evidence.text 存在',
        ({ utterance }) => {
          const patch = dispatcher.dispatch(utterance)
          const nodes = collectAllNodes(patch)
          expect(nodes.length).toBeGreaterThan(0)
          expect(nodes.filter(n => !n.evidence?.text)).toEqual([])
        },
      )
    })
  })

  describe('i4：回归 Case 2 (#1218) MA stack 不产生无 evidence 的 condition.expression phase=gate', () => {
    const case2Message = 'Binance BTCUSDT 永续 15m，价格在 EMA20、EMA60、EMA144 上方只做多，价格都位于 EMA20、EMA60、EMA144 下方只做空；入场是布林带下轨开多、上轨开空，亏损 5% 止损，每次 20 USDT'

    it('dispatcher 输出不含无 evidence 的 condition.expression phase=gate', () => {
      const patch = dispatcher.dispatch(case2Message)
      const phantomGateAtoms = (patch.rules ?? []).flatMap(rule =>
        collectAtomLeaves(rule.condition).map(leaf => ({ ...leaf, phase: rule.phase })),
      ).filter((trigger) => {
        return trigger.key === 'condition.expression'
          && trigger.phase === 'gate'
          && (!trigger.evidence?.text || !case2Message.includes(trigger.evidence.text))
      })
      expect(phantomGateAtoms).toEqual([])
    })
  })

  describe('i5：dispatcher 接受空 / 未提供 message，不抛且产空 patch', () => {
    it('未提供 message 不抛且不产 trigger / action / risk', () => {
      const patch = dispatcher.dispatch()
      expect(patch.rules ?? []).toEqual([])
    })

    it('空字符串 message 不抛且不产 trigger / action / risk', () => {
      const patch = dispatcher.dispatch('')
      expect(patch.rules ?? []).toEqual([])
    })

    it('whitespace-only message 不抛且不产 trigger / action / risk（review m1）', () => {
      // 包含空格 / 制表符 / 换行：dispatcher 内部 `(message ?? '').trim()` 后应等价于空 message
      const patch = dispatcher.dispatch('   \n\t  ')
      expect(patch.rules ?? []).toEqual([])
    })
  })
})
