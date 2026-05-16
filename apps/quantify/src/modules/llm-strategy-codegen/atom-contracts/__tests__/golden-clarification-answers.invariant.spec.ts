/**
 * Golden clarification answers invariant — Issue #1409
 *
 * 红线：原子若声明了 `goldenClarificationAnswers`，则其中每一条 answer 经过
 * `GenericSeedDispatcher.extractSingleSlot(atomKey, slotKey, answer)` 抽取后，
 * 必须能产出与 `expectParams` 完全一致的 slot 值。
 *
 * 这条 invariant 把过去散落在 resolver 内 ad-hoc regex / parseLevelSetDensityAnswer
 * 的「短答抽参」语义沉淀回 atom 自身。新增 atom = 加一行 golden，自动校验。
 *
 * Refs: #1409
 */
import type { AtomContractSurface } from '../atom-contract-surface.types'
import { ATOM_CONTRACT_REGISTRY } from '../atom-contract-registry'
import { GenericSeedDispatcher } from '../../services/generic-seed-dispatcher.service'

describe('ATOM_CONTRACT_REGISTRY goldenClarificationAnswers invariant', () => {
  const dispatcher = new GenericSeedDispatcher()

  for (const [atomKey, contract] of Object.entries(ATOM_CONTRACT_REGISTRY)) {
    const surface = contract.surface as AtomContractSurface | undefined
    const goldens = surface?.goldenClarificationAnswers
    if (!goldens?.length) continue

    describe(atomKey, () => {
      for (const golden of goldens) {
        const expected = golden.expectParams
        const slotKeys = Object.keys(expected)
        const desc = golden.description ? ` (${golden.description})` : ''
        it(`extracts ${JSON.stringify(expected)} from "${golden.answer}"${desc}`, () => {
          for (const slotKey of slotKeys) {
            const result = dispatcher.extractSingleSlot(atomKey, slotKey, golden.answer)
            expect(result.ok).toBe(true)
            if (result.ok) {
              expect(result.value).toEqual(expected[slotKey])
            }
          }
        })
      }
    })
  }

  it('registry has at least one atom with goldenClarificationAnswers', () => {
    const atomsWithGoldens = Object.entries(ATOM_CONTRACT_REGISTRY).filter(
      ([, contract]) => ((contract.surface as AtomContractSurface | undefined)?.goldenClarificationAnswers?.length ?? 0) > 0,
    )
    expect(atomsWithGoldens.length).toBeGreaterThan(0)
  })

  it('grid.range_rebalance declares the 4 canonical clarification goldens', () => {
    const gridSurface = ATOM_CONTRACT_REGISTRY['grid.range_rebalance'].surface as AtomContractSurface | undefined
    const goldens = gridSurface?.goldenClarificationAnswers ?? []
    const summaries = goldens.map(g => ({ answer: g.answer, expectParams: g.expectParams }))
    expect(summaries).toEqual(expect.arrayContaining([
      { answer: '20格', expectParams: { levels: 20 } },
      { answer: '区间 79200-80200', expectParams: { rangeLower: 79200, rangeUpper: 80200 } },
      { answer: '双向', expectParams: { sideMode: 'both' } },
      { answer: '停止', expectParams: { breakoutAction: 'stop' } },
    ]))
  })
})
