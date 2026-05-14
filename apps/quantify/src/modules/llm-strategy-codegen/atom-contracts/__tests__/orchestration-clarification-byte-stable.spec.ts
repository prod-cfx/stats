/**
 * #1279 #1329 Wave 2B：13 orchestration/scope atom 的 clarificationQuestion 字节稳定锁。
 *
 * 与 W1 summaryTemplate 守门成对：summaryTemplate 锁住"参数 → 自然语言"渲染面，
 * clarificationQuestion 锁住"缺槽 → 追问文案"提示面。两者共同防止 user-facing 文案
 * 静默 drift（空格 / 标点 / unicode / token 替换）。
 *
 * 每个 atom 遍历 `surface.paramSlots` 全部 slotKey，对 zh/en 两个 locale 各打一次快照，
 * snapshot 形态 `{ atomKey, slotKey, locale, output }`。
 *
 * 维护：clarificationQuestion 输出有意调整时同步改本 spec 期望（带 PR 说明）。
 */
import { ATOM_CONTRACT_REGISTRY } from '../atom-contract-registry'
import type { AtomContractKey } from '../atom-contract-types'

/** 13 orchestration/scope atom（与 orchestration-summary-template.spec 对齐）。 */
const ATOM_KEYS: ReadonlyArray<AtomContractKey> = [
  'gate.regime',
  'portfolioRisk.drawdown_block',
  'portfolioRisk.symbol_exposure_cap',
  'portfolioRisk.substrategy_exposure_cap',
  'program.dynamic_grid',
  'program.fixed_grid_gated',
  'program.adaptive_volatility_grid',
  'program.event_listener',
  'scope.symbol',
  'scope.leg',
  'scope.timeframe',
  'scope.dataSource',
  'scope.subStrategy',
]

const LOCALES = ['zh', 'en'] as const

interface Case {
  readonly atomKey: AtomContractKey
  readonly slotKey: string
  readonly locale: 'zh' | 'en'
}

function buildCases(): readonly Case[] {
  const cases: Case[] = []
  for (const atomKey of ATOM_KEYS) {
    const entry = ATOM_CONTRACT_REGISTRY[atomKey]
    const slotKeys = Object.keys(entry.surface.paramSlots)
    for (const slotKey of slotKeys) {
      for (const locale of LOCALES) {
        cases.push({ atomKey, slotKey, locale })
      }
    }
  }
  return cases
}

const CASES = buildCases()

describe('#1279 #1329 Wave 2B：13 orchestration atom clarificationQuestion 字节稳定锁', () => {
  it('CASES 数量覆盖 13 atom × N slot × 2 locale（防止静默削减 slot）', () => {
    expect(CASES.length).toBeGreaterThanOrEqual(26) // 至少 13 atom × 1 slot × 2 locale
    expect(ATOM_KEYS.length).toBe(13)
  })

  it.each(CASES)(
    'clarificationQuestion 非空 string：$atomKey / $slotKey / $locale',
    ({ atomKey, slotKey, locale }) => {
      const entry = ATOM_CONTRACT_REGISTRY[atomKey]
      const clarify = entry.clarificationQuestion
      // 13 orchestration atom 全部使用 inline fn 形态；遇到 sentinel 视为契约破坏。
      if (typeof clarify !== 'function') {
        throw new Error(
          `[#1329 Wave 2B] ${atomKey}.clarificationQuestion 不是 fn 形态；` +
            `13 orchestration atom 期望全部内联自定义文案，sentinel 视为契约 drift`,
        )
      }
      const output = clarify(slotKey, {}, locale)
      expect(typeof output).toBe('string')
      expect(output.length).toBeGreaterThan(0)
      expect({ atomKey, slotKey, locale, output }).toMatchSnapshot()
    },
  )
})
