/**
 * Issue #1446 — 闸 2：evidence invariant 落地（默认 drop）专项 spec
 *
 * 覆盖矩阵：
 *   - 三种 reason: missing_text / empty_string / not_substring
 *   - 三种 mode:   drop / throw / off
 *   - metric stub: drop 模式下 emit `metric=evidence_invariant_drop_total reason=<r> value=<n>`
 *
 * 注意：相关「drop / throw / off」核心行为已在 semantic-seed-state-builder.service.spec.ts
 *   末段覆盖；本 spec 聚焦 #1446 升级后的差异点：
 *     1) drop 模式下 missing_text 不再 warn-only，与 empty_string / not_substring 一致 drop
 *     2) metric 输出语义（per-reason value）
 */
import { Logger } from '@nestjs/common'
import {
  type EvidenceInvariantMode,
  SemanticSeedStateBuilderService,
} from '../semantic-seed-state-builder.service'

function makeService(mode: EvidenceInvariantMode): SemanticSeedStateBuilderService {
  return new SemanticSeedStateBuilderService(undefined, undefined, undefined, mode)
}

const MSG = '当收盘价在 EMA20 上方时开多，止损 2%'

describe('SemanticSeedStateBuilderService — #1446 evidence invariant 升级（drop 模式 missing_text）', () => {
  describe('drop 模式：三类违规都剔除 + emit per-reason metric', () => {
    let warnSpy: jest.SpyInstance

    beforeEach(() => {
      warnSpy = jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => {})
    })

    afterEach(() => {
      warnSpy.mockRestore()
    })

    it('missing_text: 缺 evidence 字段的 trigger 被 drop 出 flat 桶（#1446 升级）', () => {
      const svc = makeService('drop')
      const state = svc.build({
        triggers: [
          {
            key: 'indicator.above',
            phase: 'entry',
            source: 'user_explicit',
            // 完全没有 evidence 字段 — #1446 前是 warn-only，升级后剔除
            params: { indicator: 'ema', 'reference.period': 20 },
          },
          {
            key: 'rsi.oversold',
            phase: 'entry',
            source: 'user_explicit',
            evidence: { text: 'EMA20 上方', source: 'user_explicit' },
            params: { period: 14 },
          },
        ],
      }, MSG)

      // 缺 evidence 的 indicator.above 被 drop，只保留 rsi.oversold
      expect(state?.trigger).toHaveLength(1)
      expect(state?.trigger[0]?.key).toBe('rsi.oversold')
    })

    it('emit `metric=evidence_invariant_drop_total reason=missing_text value=N`', () => {
      const svc = makeService('drop')
      svc.build({
        triggers: [
          { key: 'indicator.above', phase: 'entry', source: 'user_explicit', params: {} },
          { key: 'rsi.oversold', phase: 'entry', source: 'user_explicit', params: {} },
        ],
      }, MSG)

      const calls = warnSpy.mock.calls.map(c => String(c[0]))
      expect(calls.some(s => /metric=evidence_invariant_drop_total reason=missing_text value=2/.test(s))).toBe(true)
    })

    it('emit `metric=evidence_invariant_drop_total reason=empty_string value=N`', () => {
      const svc = makeService('drop')
      svc.build({
        triggers: [{
          key: 'indicator.above',
          phase: 'entry',
          source: 'user_explicit',
          evidence: { text: '', source: 'user_explicit' },
          params: {},
        }],
      }, MSG)

      const calls = warnSpy.mock.calls.map(c => String(c[0]))
      expect(calls.some(s => /metric=evidence_invariant_drop_total reason=empty_string value=1/.test(s))).toBe(true)
    })

    it('emit `metric=evidence_invariant_drop_total reason=not_substring value=N`', () => {
      const svc = makeService('drop')
      svc.build({
        triggers: [{
          key: 'indicator.above',
          phase: 'entry',
          source: 'user_explicit',
          evidence: { text: '完全不相关', source: 'user_explicit' },
          params: {},
        }],
      }, MSG)

      const calls = warnSpy.mock.calls.map(c => String(c[0]))
      expect(calls.some(s => /metric=evidence_invariant_drop_total reason=not_substring value=1/.test(s))).toBe(true)
    })

    it('混合三 reason: per-reason value 独立累计', () => {
      const svc = makeService('drop')
      svc.build({
        triggers: [
          // missing_text × 2
          { key: 'a.b', phase: 'entry', source: 'user_explicit', params: {} },
          { key: 'a.c', phase: 'entry', source: 'user_explicit', params: {} },
          // empty_string × 1
          { key: 'a.d', phase: 'entry', source: 'user_explicit', evidence: { text: '', source: 'user_explicit' }, params: {} },
          // not_substring × 1
          { key: 'a.e', phase: 'entry', source: 'user_explicit', evidence: { text: '完全不相关', source: 'user_explicit' }, params: {} },
        ],
      }, MSG)

      const calls = warnSpy.mock.calls.map(c => String(c[0]))
      expect(calls.some(s => /reason=missing_text value=2/.test(s))).toBe(true)
      expect(calls.some(s => /reason=empty_string value=1/.test(s))).toBe(true)
      expect(calls.some(s => /reason=not_substring value=1/.test(s))).toBe(true)
    })

    it('source=system_default 跳过 invariant，不进 drop / metric', () => {
      const svc = makeService('drop')
      svc.build({
        triggers: [{
          key: 'indicator.above',
          phase: 'entry',
          source: 'system_default',
          params: {},
        }],
      }, MSG)

      const calls = warnSpy.mock.calls.map(c => String(c[0]))
      expect(calls.some(s => /evidence_invariant_drop/.test(s))).toBe(false)
    })

    it('message 未提供：跳过 invariant 完全（向后兼容旧 caller）', () => {
      const svc = makeService('drop')
      const state = svc.build({
        triggers: [{
          key: 'indicator.above',
          phase: 'entry',
          source: 'user_explicit',
          params: {},
        }],
      })
      // message 缺失 → 不检查，原 atom 保留
      expect(state?.trigger).toHaveLength(1)

      const calls = warnSpy.mock.calls.map(c => String(c[0]))
      expect(calls.some(s => /evidence_invariant_drop/.test(s))).toBe(false)
    })
  })

  describe('throw 模式：三类违规均抛出（仅 spec 注入使用）', () => {
    it('missing_text → throw', () => {
      const svc = makeService('throw')
      expect(() => svc.build({
        triggers: [{ key: 'indicator.above', phase: 'entry', source: 'user_explicit', params: {} }],
      }, MSG)).toThrow(/missing_text/)
    })

    it('empty_string → throw', () => {
      const svc = makeService('throw')
      expect(() => svc.build({
        triggers: [{
          key: 'indicator.above', phase: 'entry', source: 'user_explicit',
          evidence: { text: '', source: 'user_explicit' }, params: {},
        }],
      }, MSG)).toThrow(/empty_string/)
    })

    it('not_substring → throw', () => {
      const svc = makeService('throw')
      expect(() => svc.build({
        triggers: [{
          key: 'indicator.above', phase: 'entry', source: 'user_explicit',
          evidence: { text: '完全不相关', source: 'user_explicit' }, params: {},
        }],
      }, MSG)).toThrow(/not_substring/)
    })
  })

  describe('off 模式：完全跳过', () => {
    it('missing_text / empty_string / not_substring 均不 drop 不 throw 不 emit metric', () => {
      const warnSpy = jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => {})
      try {
        const svc = makeService('off')
        expect(() => svc.build({
          triggers: [
            { key: 'a.b', phase: 'entry', source: 'user_explicit', params: {} },
            { key: 'a.c', phase: 'entry', source: 'user_explicit', evidence: { text: '', source: 'user_explicit' }, params: {} },
            { key: 'a.d', phase: 'entry', source: 'user_explicit', evidence: { text: '不相关', source: 'user_explicit' }, params: {} },
          ],
        }, MSG)).not.toThrow()

        const calls = warnSpy.mock.calls.map(c => String(c[0]))
        expect(calls.some(s => /evidence_invariant_drop/.test(s))).toBe(false)
      } finally {
        warnSpy.mockRestore()
      }
    })
  })

  describe('默认 mode = drop（#1446 偏离 Issue 描述，env-aware 留待 follow-up）', () => {
    it('未注入 mode 时构造器默认 drop', () => {
      // 不传第 4 参数 → 默认 'drop'，违规走 drop 路径，不抛
      const svc = new SemanticSeedStateBuilderService()
      expect(() => svc.build({
        triggers: [{ key: 'a.b', phase: 'entry', source: 'user_explicit', params: {} }],
      }, MSG)).not.toThrow()
    })
  })
})
