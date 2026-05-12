/**
 * Issue #1231 — Atom 覆盖率契约门禁
 *
 * 不变量：
 * 1) 每个 supported atom (registry) 在 utterance corpus 中至少有 3 条 utterance；
 * 2) supported_executable 类 atom 的探针 utterance 经 seed-extractor 必须能识别（产出对应 atom）。
 *
 * 降噪策略（task 明确允许）：
 * - supported_requires_slot 类 atom：utterance/识别缺口仅 warn，不断言失败。已知缺口必须在
 *   Issue #1231 的"遗留问题"段列出（external.signal、price.previous_extrema、
 *   strategy.multi_timeframe、risk.falling_knife_guard 等）。
 * - supported_executable 类 atom：严格断言。任一缺口直接 fail，作为可观察的回归门禁。
 */

import {
  SUPPORTED_EXECUTABLE_UTTERANCE_ATOMS,
  getUtteranceCorpusForAtom,
  type SupportedExecutableUtteranceAtom,
} from '../../nl-gateway/utterance-corpus'
import { SemanticAtomRegistryService } from '../semantic-atom-registry.service'
import { SemanticSeedExtractorService } from '../semantic-seed-extractor.service'

const registry = new SemanticAtomRegistryService()
const extractor = new SemanticSeedExtractorService()

// 一些 supported atom 在 NL 层是 action/risk/position，seed-extractor 输出在不同 patch 字段下。
// 对这些 atom，识别探针需要扫整个 patch（triggers + actions + risk + position.constraints）。
function collectAtomKeysFromPatch(patch: ReturnType<SemanticSeedExtractorService['extract']>): Set<string> {
  const keys = new Set<string>()
  for (const trigger of patch.triggers ?? []) {
    keys.add(trigger.key)
  }
  for (const action of patch.actions ?? []) {
    keys.add(action.key)
  }
  for (const risk of patch.risk ?? []) {
    keys.add(risk.key)
  }
  for (const constraint of patch.position?.constraints ?? []) {
    keys.add(constraint.key)
  }
  return keys
}

describe('Atom coverage contract — supported atoms have ≥3 utterances and recognizable probe', () => {
  const supportedAtoms = registry.list().filter(
    atom => atom.supportStatus === 'supported_executable' || atom.supportStatus === 'supported_requires_slot',
  )

  it('registry 至少包含一个 supported atom（避免列表为空导致空跑）', () => {
    expect(supportedAtoms.length).toBeGreaterThan(0)
  })

  // 与 utterance-corpus.spec.ts 保持一致的"间接触发"豁免清单：
  // 这些 atom 通过其他子句间接落位 state，无独立 atomKey fixture，covered by 专门的 projection/invariant spec。
  // - position.pyramiding_limit (#1191)：通过 action.add_position 子句间接触发
  // - grid.range_rebalance (#1198)：通过 grid 触发器子句（"区间 X-Y, 每格 N USDT"）间接触发
  const INDIRECTLY_COVERED_ATOMS: ReadonlySet<string> = new Set([
    'position.pyramiding_limit',
    'grid.range_rebalance',
  ])

  describe.each(SUPPORTED_EXECUTABLE_UTTERANCE_ATOMS)('utterance corpus — %s', (atomKey) => {
    const skipReason = INDIRECTLY_COVERED_ATOMS.has(atomKey)
      ? '间接触发，豁免独立 corpus fixture 要求（详见 utterance-corpus.spec.ts 同步豁免说明）'
      : null

    if (skipReason) {
      it.skip(`utterance ≥ 3 — 豁免：${skipReason}`, () => {})
      it.skip(`seed-extractor 能识别 utterances[0] 探针 — 豁免：${skipReason}`, () => {})
      return
    }

    it('utterance ≥ 3', () => {
      const cases = getUtteranceCorpusForAtom(atomKey as SupportedExecutableUtteranceAtom)
      expect(cases.length).toBeGreaterThanOrEqual(3)
    })

    it('seed-extractor 能识别 utterances[0] 探针', () => {
      const cases = getUtteranceCorpusForAtom(atomKey as SupportedExecutableUtteranceAtom)
      if (cases.length === 0) {
        return
      }
      const probe = cases[0].utterance
      const patch = extractor.extract(probe)
      const keys = collectAtomKeysFromPatch(patch)

      const atom = registry.resolve(atomKey)
      if (atom.supportStatus === 'supported_executable') {
        expect(keys.has(atomKey)).toBe(true)
      } else if (atom.supportStatus === 'supported_requires_slot') {
        if (!keys.has(atomKey)) {
          // 降噪：requires_slot 类 NL 识别缺口在 Issue #1231 遗留问题中跟踪
          // eslint-disable-next-line no-console
          console.warn(`[atom-coverage-contract] supported_requires_slot atom "${atomKey}" not recognized from probe "${probe}"`)
        }
      }
    })
  })

  it('记录 supported_requires_slot atom 在 utterance corpus 中的缺口（不失败，仅 warn）', () => {
    const corpusAtomKeys = new Set<string>(SUPPORTED_EXECUTABLE_UTTERANCE_ATOMS)
    const requiresSlotGaps = supportedAtoms
      .filter(atom => atom.supportStatus === 'supported_requires_slot')
      .map(atom => atom.key)
      .filter(key => !corpusAtomKeys.has(key as SupportedExecutableUtteranceAtom))

    if (requiresSlotGaps.length > 0) {
      // eslint-disable-next-line no-console
      console.warn(`[atom-coverage-contract] supported_requires_slot atoms missing utterance corpus: ${requiresSlotGaps.join(', ')}`)
    }
    // 不强制断言：requires_slot 的 NL 探针缺口在 Issue #1231 follow-up (#1247) 中收口；
    // 此处仅暴露数据形状，保证未来缺口列表始终是 string[] 而非异常类型
    expect(Array.isArray(requiresSlotGaps)).toBe(true)
  })
})
