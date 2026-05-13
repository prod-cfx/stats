/**
 * Issue #1279 PR1c: 36 atom display.publicName.en 真翻译运行时哨兵
 *
 * 不变量（每条 atom）:
 *   1. publicName.en 非空
 *   2. publicName.en !== publicName.zh（PR1b "{ zh, en: zh }" 同值兜底已彻底替换）
 *   3. publicName.en 不含 CJK 字符（含主区段 U+4E00–U+9FFF、扩展 A U+3400–U+4DBF、
 *      CJK 标点 U+3000–U+303F、全角符号 U+FF00–U+FFEF；防止粘贴顿号/全角空格绕过）
 *   4. publicName.zh === ATOM_PUBLIC_NAMES[key].zh（PR1b 现有 zh 数据未回归）
 *
 * 与 PR1b 现有 atom-coverage-full-registration.spec 的关系:
 *   - PR1b 只断言 publicName.en.length > 0（同值兜底也能过）
 *   - 本 spec 强化为 en != zh + 无中文字符，对 "假装翻译" 做硬隔离
 *
 * renderer / paramRenderers / summaryTemplate 的等价性断言留待 PR3c
 * （PR1c 范围缩窄说明详见对应 commit message 与本地 plan 文档）。
 */

import type { AtomContract, AtomContractKey } from '../atom-contract-types'
import { ATOM_CONTRACT_REGISTRY, ATOM_PUBLIC_NAMES } from '../atom-contract-registry'

// CJK 覆盖：主区段 + 扩展 A + CJK 标点 + 全角符号（review M4：防止顿号/全角空格绕过）
const CJK_PATTERN = /[　-〿㐀-䶿一-鿿＀-￯]/u

describe('ATOM_CONTRACT_REGISTRY display.publicName.en coverage (#1279 PR1c)', () => {
  const entries = Object.entries(ATOM_CONTRACT_REGISTRY) as Array<[AtomContractKey, AtomContract]>

  it('registry entry count matches ATOM_PUBLIC_NAMES single source of truth', () => {
    // 长度从 ATOM_PUBLIC_NAMES 派生（review M3：消除魔数 36）；
    // PR2/PR3 增删 atom 时两侧自然同步增长。
    expect(entries).toHaveLength(Object.keys(ATOM_PUBLIC_NAMES).length)
  })

  describe.each(entries)('atom %s', (key, contract) => {
    const { zh, en } = contract.display.publicName

    it('has non-empty publicName.en', () => {
      expect(typeof en).toBe('string')
      expect(en.length).toBeGreaterThan(0)
    })

    it('has publicName.en distinct from publicName.zh', () => {
      expect(en).not.toBe(zh)
    })

    it('publicName.en contains no CJK characters', () => {
      expect(CJK_PATTERN.test(en)).toBe(false)
    })

    it('publicName.zh matches ATOM_PUBLIC_NAMES baseline', () => {
      expect(zh).toBe(ATOM_PUBLIC_NAMES[key].zh)
    })
  })
})
