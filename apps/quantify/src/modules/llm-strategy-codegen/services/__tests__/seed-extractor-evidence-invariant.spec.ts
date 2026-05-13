import { GenericSeedDispatcher } from '../generic-seed-dispatcher.service'

// Issue #1223 / #1279 PR2c6b：dispatcher 出口 evidence invariant
//
// 历史背景：
//   原 spec（PR2c6 之前）测的是 SemanticSeedStateBuilderService.build 的 evidence
//   invariant —— 即 builder 在收到 source !== 'system_default' 但缺 evidence 的
//   trigger / risk / action 时 throw（test mode）/ drop（prod mode）。
//
// PR2c6b 重写理由（用户裁定 turn 6）：
//   PR2 把 codegen 入口从 SemanticSeedExtractorService 切到 GenericSeedDispatcher。
//   新 dispatcher 的契约更强：所有产出节点恒带 evidence: { text, source: 'user_explicit' }
//   （见 generic-seed-dispatcher.service.ts:436 的 emit 路径），不存在 "缺 evidence
//   要靠 builder 兜 throw" 的情形。因此原 5 条 builder-only invariant 中：
//     - AC1/AC2/AC3/未提供 message 4 条 → builder 行为，PR3 SeedStateBuilder 重构
//       会延续覆盖（builder 仍是 patch → SemanticState 的 last guard）
//     - Case 2 regression 是 extractor → builder 链路，已迁到 dispatcher 层重新表述
//
// 本 spec 守住的不变量（dispatcher patch 出口形态）：
//   I1：dispatcher 产出的每条 trigger / action / risk 都自带 evidence.text 与 evidence.source
//   I2：evidence.text 必须是原 message 的子串（不允许幻觉短语）
//   I3：evidence.source 当前恒为 'user_explicit'（PR2c 内 source 注入未接入；webhook
//       AC-12 case 应为 'webhook'，TODO 已在 dispatcher line 434 标注）
//   I4：Case 2 (#1218) MA stack utterance 不产生无 evidence 的 condition.expression phase=gate
//   I5：dispatcher 接受空 message / 未提供 message，不抛异常且产空 patch
//
// 与其它 spec 的边界：
//   - dispatcher-self-baseline.spec：守 byte-equal regression（任何字段漂移立即 fail）
//   - dispatcher-semantic-equivalence.spec：守 AC-7/AC-12 prompt 必有可执行节点
//   - 本 spec：守 dispatcher 出口的 evidence 字段级 invariant（structural，非 baseline）
describe('GenericSeedDispatcher — evidence invariant (Issue #1223 / #1279 PR2c6b)', () => {
  const dispatcher = new GenericSeedDispatcher()

  type EvidenceBearing = { evidence?: { text?: string, source?: string } }

  function collectAllNodes(patch: ReturnType<GenericSeedDispatcher['dispatch']>): EvidenceBearing[] {
    return [
      ...(patch.triggers ?? []),
      ...(patch.actions ?? []),
      ...(patch.risk ?? []),
    ] as EvidenceBearing[]
  }

  describe('I1：dispatcher 产出的每条节点必带 evidence.text 与 evidence.source', () => {
    it('AC-7-style utterance 所有节点 evidence 字段完整', () => {
      const message = 'BTCUSDT 1m 收盘价高于开盘价开多，亏损 5% 止损'
      const patch = dispatcher.dispatch(message)
      const nodes = collectAllNodes(patch)
      expect(nodes.length).toBeGreaterThan(0)
      for (const node of nodes) {
        expect(node.evidence).toBeDefined()
        expect(typeof node.evidence?.text).toBe('string')
        // review m3：从 `length > 0` 收紧到 `trim().length > 0`，防 whitespace-only text
        expect((node.evidence?.text ?? '').trim().length).toBeGreaterThan(0)
        expect(typeof node.evidence?.source).toBe('string')
      }
    })
  })

  describe('I2：evidence.text 必须是原 message 子串（不允许幻觉短语）', () => {
    it('节点 evidence.text 全部命中原 message', () => {
      const message = 'BTCUSDT 1m 收盘价高于开盘价开多，亏损 5% 止损'
      const patch = dispatcher.dispatch(message)
      const nodes = collectAllNodes(patch)
      const phantom = nodes.filter(n => !n.evidence?.text || !message.includes(n.evidence.text))
      expect(phantom).toEqual([])
    })
  })

  describe('I3：evidence.source 当前恒为 user_explicit（PR2c 内 source 注入未接入）', () => {
    it('所有节点 evidence.source === "user_explicit"', () => {
      const message = '价格突破 EMA20 开多，止损 3%'
      const patch = dispatcher.dispatch(message)
      const nodes = collectAllNodes(patch)
      expect(nodes.length).toBeGreaterThan(0)
      const wrongSource = nodes.filter(n => n.evidence?.source !== 'user_explicit')
      // review m2：当 PR2c TODO（generic-seed-dispatcher.service.ts line 434
      // 的 webhook source 注入）落地时，本断言会 fail——届时应升级为按 case
      // 区分 source（'user_explicit' / 'webhook' / ...）
      expect(wrongSource).toEqual([])
    })
  })

  describe('I4：回归 Case 2 (#1218) MA stack 不产生无 evidence 的 condition.expression phase=gate', () => {
    const case2Message = 'Binance BTCUSDT 永续 15m，价格在 EMA20、EMA60、EMA144 上方只做多，价格都位于 EMA20、EMA60、EMA144 下方只做空；入场是布林带下轨开多、上轨开空，亏损 5% 止损，每次 20 USDT'

    it('dispatcher 输出不含无 evidence 的 condition.expression phase=gate', () => {
      const patch = dispatcher.dispatch(case2Message)
      const phantomGateAtoms = (patch.triggers ?? []).filter((t) => {
        const trigger = t as { key?: string, phase?: string, evidence?: { text?: string } }
        return trigger.key === 'condition.expression'
          && trigger.phase === 'gate'
          && (!trigger.evidence?.text || !case2Message.includes(trigger.evidence.text))
      })
      expect(phantomGateAtoms).toEqual([])
    })
  })

  describe('I5：dispatcher 接受空 / 未提供 message，不抛且产空 patch', () => {
    it('未提供 message 不抛且不产 trigger / action / risk', () => {
      const patch = dispatcher.dispatch()
      expect(patch.triggers ?? []).toEqual([])
      expect(patch.actions ?? []).toEqual([])
      expect(patch.risk ?? []).toEqual([])
    })

    it('空字符串 message 不抛且不产 trigger / action / risk', () => {
      const patch = dispatcher.dispatch('')
      expect(patch.triggers ?? []).toEqual([])
      expect(patch.actions ?? []).toEqual([])
      expect(patch.risk ?? []).toEqual([])
    })

    it('whitespace-only message 不抛且不产 trigger / action / risk（review m1）', () => {
      // 包含空格 / 制表符 / 换行：dispatcher 内部 `(message ?? '').trim()` 后应等价于空 message
      const patch = dispatcher.dispatch('   \n\t  ')
      expect(patch.triggers ?? []).toEqual([])
      expect(patch.actions ?? []).toEqual([])
      expect(patch.risk ?? []).toEqual([])
    })
  })
})
