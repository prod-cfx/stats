/**
 * atom-contract-surface-presence.spec.ts — Issue #1279 PR1a Task 1.a.5 验收 spec
 *
 * 断言 ATOM_CONTRACT_REGISTRY 内**所有**已注册的 supported atom 都已声明
 * `surface.intent.keywords` 与 `surface.intent.verbs` 非空。
 *
 * PR1a 阶段 surface 是 optional 字段（PR1b 改 required）；这个 spec 在 PR1a 起
 * 即守护"已注册的 atom 必须有 surface.intent"，防止后续 PR 漏填。
 *
 * 若 PR1b 把 surface 改为 required，本 spec 仍保留 —— 作为运行期数据完整性兜底。
 */

import { ATOM_CONTRACT_REGISTRY } from '../atom-contract-registry'
import type { Direction } from '../atom-contract-types'

const ALL_DIRECTIONS: readonly Direction[] = [
  'gte',
  'lte',
  'cross_over',
  'cross_under',
  'touch_upper',
  'touch_lower',
  'touch_middle',
  'breakout_up',
  'breakout_down',
  'divergence',
  'fixed',
] as const

describe('ATOM_CONTRACT_REGISTRY surface.intent presence (issue #1279 PR1a)', () => {
  // critic M1 fix: 改派生而非硬编码 18，PR1b 新增 atom 时此 spec 自动跟随
  const entries = Object.entries(ATOM_CONTRACT_REGISTRY)
  const registryKeys = Object.keys(ATOM_CONTRACT_REGISTRY)

  it('iterates all registered atoms (no hardcoded count)', () => {
    expect(entries.length).toBe(registryKeys.length)
    expect(entries.length).toBeGreaterThan(0)
  })

  for (const [atomKey, contract] of entries) {
    describe(atomKey, () => {
      it('declares surface field', () => {
        expect(contract.surface).toBeDefined()
      })

      it('declares non-empty surface.intent.keywords', () => {
        expect(contract.surface).toBeDefined()
        const keywords = contract.surface!.intent.keywords
        expect(Array.isArray(keywords)).toBe(true)
        expect(keywords.length).toBeGreaterThan(0)
        // 每个 keyword 必须是非空字符串
        for (const keyword of keywords) {
          expect(typeof keyword).toBe('string')
          expect(keyword.length).toBeGreaterThan(0)
          // critic m3 fix: 防止 trailing whitespace / 全角空格污染
          expect(keyword).toBe(keyword.trim())
          expect(keyword).not.toMatch(/[　]/u)
        }
      })

      it('declares at least one direction in surface.intent.verbs with non-empty synonyms', () => {
        expect(contract.surface).toBeDefined()
        const verbs = contract.surface!.intent.verbs
        const directionKeys = Object.keys(verbs) as Direction[]
        expect(directionKeys.length).toBeGreaterThan(0)
        // critic m3 fix: 断言 direction key 不重复（Partial<Record> 运行期防御）
        const directionKeySet = new Set(directionKeys)
        expect(directionKeySet.size).toBe(directionKeys.length)
        for (const directionKey of directionKeys) {
          // direction key 必须是合法 Direction
          expect(ALL_DIRECTIONS).toContain(directionKey)
          const synonyms = verbs[directionKey]
          expect(Array.isArray(synonyms)).toBe(true)
          expect(synonyms!.length).toBeGreaterThan(0)
          for (const synonym of synonyms!) {
            expect(typeof synonym).toBe('string')
            expect(synonym.length).toBeGreaterThan(0)
            // critic m3 fix: 防止 trailing whitespace 污染
            expect(synonym).toBe(synonym.trim())
          }
        }
      })

      it('declares paramSlots (object) / phaseResolver / sideResolver (may be empty in PR1a)', () => {
        expect(contract.surface).toBeDefined()
        // critic m3 fix: 显式断言 paramSlots 是对象（PR1a 阶段默认 {}）
        expect(typeof contract.surface!.paramSlots).toBe('object')
        expect(contract.surface!.paramSlots).not.toBeNull()
        expect(contract.surface!.phaseResolver).toBeDefined()
        expect(contract.surface!.sideResolver).toBeDefined()
      })
    })
  }
})
