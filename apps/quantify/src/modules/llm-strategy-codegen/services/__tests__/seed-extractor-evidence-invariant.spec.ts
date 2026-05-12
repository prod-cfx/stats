import { SemanticSeedExtractorService } from '../semantic-seed-extractor.service'
import { SemanticSeedStateBuilderService } from '../semantic-seed-state-builder.service'

// Issue #1223: seed extractor 出口建立 evidence invariant
//
// 不变量定义：SemanticSeedStateBuilderService.build 输出的所有 trigger/risk/action，
// 若 source !== 'system_default'，则必须满足 evidence.text 存在且为 message 子串；
// 测试期违反则 throw，生产期 drop + 记 normalizationNote。
describe('SemanticSeedStateBuilderService — evidence invariant (Issue #1223)', () => {
  const extractor = new SemanticSeedExtractorService()
  // 显式传 'throw' 模式：验收[1][2]期望违规立即抛出；全环境默认是 'drop'，spec 必须显式指定
  const buildState = (patch: unknown, message?: string) => new SemanticSeedStateBuilderService(undefined, undefined, undefined, 'throw').build(patch, message)

  describe('验收 [1]: 非默认 trigger 缺 evidence → 测试模式 throw', () => {
    it('throws when a non-default trigger has no evidence', () => {
      const message = '随便一句话'
      const patch = {
        triggers: [
          {
            key: 'condition.expression',
            phase: 'gate',
            sideScope: 'long',
            params: { expression: { kind: 'predicate', op: 'GT', left: { kind: 'series', source: 'bar', field: 'close' }, right: { kind: 'constant', value: 1 } } },
            // evidence 缺失
          },
        ],
      }
      expect(() => buildState(patch, message)).toThrow(/evidence/i)
    })
  })

  describe('验收 [2]: evidence.text 不命中 message → 测试模式 throw', () => {
    it('throws when evidence.text is not a substring of the original message', () => {
      const message = 'BTCUSDT 1m 收盘价高于开盘价开多'
      const patch = {
        triggers: [
          {
            key: 'condition.expression',
            phase: 'entry',
            sideScope: 'long',
            params: { expression: { kind: 'predicate', op: 'GT', left: { kind: 'series', source: 'bar', field: 'close' }, right: { kind: 'series', source: 'bar', field: 'open' } } },
            evidence: { text: '幻觉短语不在消息里', source: 'user_explicit' },
          },
        ],
      }
      expect(() => buildState(patch, message)).toThrow(/evidence/i)
    })
  })

  describe('验收 [3]: source=system_default 的 atom 跳过检查', () => {
    it('skips invariant for atoms tagged with source system_default', () => {
      const message = '占位消息'
      const patch = {
        triggers: [
          {
            key: 'condition.expression',
            phase: 'gate',
            sideScope: 'long',
            source: 'system_default',
            params: { expression: { kind: 'predicate', op: 'GT', left: { kind: 'series', source: 'bar', field: 'close' }, right: { kind: 'constant', value: 0 } } },
            // 无 evidence 但 source=system_default 应被跳过
          },
        ],
      }
      expect(() => buildState(patch, message)).not.toThrow()
    })
  })

  describe('回归 Case 2 (#1218): MA stack 不再产生无 evidence 的 condition.expression phase=gate', () => {
    const case2Message = 'Binance BTCUSDT 永续 15m，价格在 EMA20、EMA60、EMA144 上方只做多，价格都位于 EMA20、EMA60、EMA144 下方只做空；入场是布林带下轨开多、上轨开空，亏损 5% 止损，每次 20 USDT'

    it('extractor 输出不含无 evidence 的 condition.expression phase=gate', () => {
      const patch = extractor.extract(case2Message)
      const phantomGateAtoms = (patch.triggers ?? []).filter(t =>
        t.key === 'condition.expression'
        && t.phase === 'gate'
        && (!t.evidence?.text || !case2Message.includes(t.evidence.text)),
      )
      expect(phantomGateAtoms).toEqual([])
    })

    it('builder 在测试模式不会因 Case 2 utterance 抛出 evidence 不变量错误', () => {
      const patch = extractor.extract(case2Message)
      expect(() => buildState(patch, case2Message)).not.toThrow()
    })
  })

  describe('message 未提供时 invariant 不触发', () => {
    it('does not throw when build is invoked without message', () => {
      const patch = {
        triggers: [
          {
            key: 'condition.expression',
            phase: 'gate',
            sideScope: 'long',
            params: { expression: { kind: 'predicate', op: 'GT', left: { kind: 'series', source: 'bar', field: 'close' }, right: { kind: 'constant', value: 1 } } },
            // 无 evidence
          },
        ],
      }
      expect(() => buildState(patch)).not.toThrow()
    })
  })
})
