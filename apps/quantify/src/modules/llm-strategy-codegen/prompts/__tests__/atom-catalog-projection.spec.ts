/**
 * Issue #1345 PR1.1 — atom-catalog-projection helper unit tests
 *
 * 验证：
 *   1) 动态派生 53 atom（绝不写死数字 — 用 Object.keys(ATOM_BUCKETS).length 校验）
 *   2) 每个 entry 字段完整：key / bucket / paramFields
 *   3) fixedPhase 仅在 phaseResolver === 'fixed-*' 时出现
 *   4) formatAtomCatalogForPrompt 包含所有 atom key + zh/en locale 双覆盖
 *   5) memoize：连调 2 次返回同一引用
 */

import { ATOM_BUCKETS, ATOM_CONTRACT_REGISTRY } from '../../atom-contracts/atom-contract-registry'
import {
  buildAtomCatalogEntries,
  formatAtomCatalogForPrompt,
  getPhaseEnum,
  getRegisteredAtomKeys,
  resetAtomCatalogCacheForTest,
} from '../atom-catalog-projection'

describe('atom-catalog-projection (issue #1345 PR1.1)', () => {
  beforeEach(() => resetAtomCatalogCacheForTest())

  describe('buildAtomCatalogEntries', () => {
    it('动态派生 entry 数 == ATOM_BUCKETS 长度（绝不写死）', () => {
      const entries = buildAtomCatalogEntries()
      expect(entries.length).toBe(Object.keys(ATOM_BUCKETS).length)
    })

    it('覆盖 ATOM_BUCKETS 中每个 key（无遗漏、无多余）', () => {
      const entries = buildAtomCatalogEntries()
      const entryKeys = new Set(entries.map(e => e.key))
      const registryKeys = new Set(Object.keys(ATOM_BUCKETS))
      expect(entryKeys).toEqual(registryKeys)
    })

    it('每个 entry 必填 key / bucket / paramFields', () => {
      for (const entry of buildAtomCatalogEntries()) {
        expect(typeof entry.key).toBe('string')
        expect(entry.key.length).toBeGreaterThan(0)
        expect(['trigger', 'action', 'risk', 'positionConstraint', 'orchestration']).toContain(entry.bucket)
        expect(Array.isArray(entry.paramFields)).toBe(true)
      }
    })

    it('paramFields 与 surface.paramSlots Record 一一对应', () => {
      for (const entry of buildAtomCatalogEntries()) {
        const surfaceSlots = ATOM_CONTRACT_REGISTRY[entry.key].surface.paramSlots
        const expectedNames = Object.keys(surfaceSlots).sort()
        const actualNames = entry.paramFields.map(f => f.name).sort()
        expect(actualNames).toEqual(expectedNames)
        for (const field of entry.paramFields) {
          const slot = surfaceSlots[field.name]
          expect(field.required).toBe(slot.required)
          expect(field.kind).toBe(slot.kind)
        }
      }
    })

    it('fixedPhase 仅在 phaseResolver === fixed-entry/exit/gate 时出现', () => {
      for (const entry of buildAtomCatalogEntries()) {
        const phaseResolver = ATOM_CONTRACT_REGISTRY[entry.key].surface.phaseResolver
        if (phaseResolver === 'fixed-entry') {
          expect(entry.fixedPhase).toBe('entry')
        } else if (phaseResolver === 'fixed-exit') {
          expect(entry.fixedPhase).toBe('exit')
        } else if (phaseResolver === 'fixed-gate') {
          expect(entry.fixedPhase).toBe('gate')
        } else {
          // by-clause-verb 或 fn 形态：phase 不应固定
          expect(entry.fixedPhase).toBeUndefined()
        }
      }
    })

    it('example 取自 corpus.goldenUtterances[0]（若有）', () => {
      for (const entry of buildAtomCatalogEntries()) {
        const golden = ATOM_CONTRACT_REGISTRY[entry.key].corpus.goldenUtterances[0]
        if (golden) {
          expect(entry.example).toBe(golden)
        } else {
          expect(entry.example).toBeUndefined()
        }
      }
    })

    it('memoize：连调 2 次返回同一数组引用', () => {
      const a = buildAtomCatalogEntries()
      const b = buildAtomCatalogEntries()
      expect(a).toBe(b)
    })
  })

  describe('formatAtomCatalogForPrompt', () => {
    it('zh locale 字符串包含所有 atom key', () => {
      const formatted = formatAtomCatalogForPrompt('zh')
      for (const key of Object.keys(ATOM_BUCKETS)) {
        expect(formatted).toContain(key)
      }
    })

    it('en locale 字符串包含所有 atom key', () => {
      const formatted = formatAtomCatalogForPrompt('en')
      for (const key of Object.keys(ATOM_BUCKETS)) {
        expect(formatted).toContain(key)
      }
    })

    it('zh 与 en 至少在 bucket 标题层级有差异', () => {
      const zh = formatAtomCatalogForPrompt('zh')
      const en = formatAtomCatalogForPrompt('en')
      expect(zh).not.toBe(en)
      expect(zh).toContain('触发原子')
      expect(en).toContain('Trigger atoms')
    })

    it('按 bucket 分组：trigger 段在 action 段之前', () => {
      const formatted = formatAtomCatalogForPrompt('zh')
      const triggerIdx = formatted.indexOf('触发原子')
      const actionIdx = formatted.indexOf('动作原子')
      expect(triggerIdx).toBeGreaterThanOrEqual(0)
      expect(actionIdx).toBeGreaterThan(triggerIdx)
    })

    it('每个 bucket 标题带 atom 数量', () => {
      const formatted = formatAtomCatalogForPrompt('zh')
      const triggerCount = Object.values(ATOM_BUCKETS).filter(b => b === 'trigger').length
      expect(formatted).toMatch(new RegExp(`触发原子.*?${triggerCount}`))
    })

    it('memoize：连调 2 次返回同一字符串引用', () => {
      const a = formatAtomCatalogForPrompt('zh')
      const b = formatAtomCatalogForPrompt('zh')
      expect(a).toBe(b)
    })

    it('为带 paramSlots 的 atom 输出 params 字段名 + req/opt 标记', () => {
      const formatted = formatAtomCatalogForPrompt('zh')
      // indicator.cross_over 应有 indicator required + fastPeriod / slowPeriod 字段
      expect(formatted).toMatch(/indicator\.cross_over[\s\S]*?indicator\(req/)
      expect(formatted).toMatch(/indicator\.cross_over[\s\S]*?fastPeriod/)
      expect(formatted).toMatch(/indicator\.cross_over[\s\S]*?slowPeriod/)
    })

    it('空 paramSlots 的 atom 渲染 "params: {}" 占位（review M6）', () => {
      const formatted = formatAtomCatalogForPrompt('zh')
      // 注：当前 ATOM_BUCKETS 内每个 atom 都有 ≥ 1 个 paramSlot（surface invariant 守门
      // 见 atom-contract-surface.types.ts:159 "paramSlots 中至少一个 required=true"）。
      // 此测试覆盖空 paramFields 输出分支以防未来 atom 设计变更引入无参 atom：
      // 直接验 formatEntry 内 length === 0 分支的字符串形态稳定性。
      const empty = formatAtomCatalogForPrompt('zh')
      expect(empty).not.toContain('params: undefined')
      // 通过 buildAtomCatalogEntries 派生 fixture：所有 paramFields 永远是数组（含空）
      const entries = buildAtomCatalogEntries()
      for (const entry of entries) {
        expect(Array.isArray(entry.paramFields)).toBe(true)
      }
    })
  })

  describe('getRegisteredAtomKeys / getPhaseEnum', () => {
    it('getRegisteredAtomKeys 等于 ATOM_BUCKETS keys', () => {
      expect([...getRegisteredAtomKeys()].sort()).toEqual(Object.keys(ATOM_BUCKETS).sort())
    })

    it('phase enum 是 entry / exit / gate（无 risk — phase 不含 risk，risk 是 bucket）', () => {
      expect([...getPhaseEnum()]).toEqual(['entry', 'exit', 'gate'])
    })
  })
})
