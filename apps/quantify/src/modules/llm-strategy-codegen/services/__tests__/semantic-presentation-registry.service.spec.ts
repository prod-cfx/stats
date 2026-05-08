import { SemanticAtomRegistryService } from '../semantic-atom-registry.service'
import { SemanticPresentationRegistryService } from '../semantic-presentation-registry.service'

describe('SemanticPresentationRegistryService', () => {
  const atomRegistry = new SemanticAtomRegistryService()
  const presentation = new SemanticPresentationRegistryService(atomRegistry)

  it('has presentation metadata and contract completion fields for every supported atom', () => {
    const supportedAtoms = atomRegistry.list().filter(atom => atom.supportStatus.startsWith('supported_'))

    expect(supportedAtoms.length).toBeGreaterThan(0)

    for (const supportedAtom of supportedAtoms) {
      const key = supportedAtom.key
      expect(supportedAtom.supportStatus).toMatch(/^supported_/u)
      expect(supportedAtom.contractSubstrate).toEqual(expect.objectContaining({
        runtimeRequirements: expect.any(Array),
        stateRequirements: expect.any(Array),
        orderRequirements: expect.any(Array),
        openSlots: expect.any(Array),
      }))
      expect(supportedAtom.executableProjection.length).toBeGreaterThan(0)
      expect(presentation.get(key)).toEqual(expect.objectContaining({
        key,
        publicName: expect.any(String),
        aliases: expect.arrayContaining([expect.any(String)]),
        positiveExamples: expect.arrayContaining([expect.any(String)]),
        negativeExamples: expect.arrayContaining([expect.any(String)]),
        goldenUtterances: expect.arrayContaining([expect.any(String)]),
        displayRenderer: expect.any(Function),
        clarificationRenderer: expect.any(Function),
      }))
    }
  })

  it('rejects missing presentation metadata instead of generating supported fallbacks', () => {
    expect(() => presentation.get('market.trend')).toThrow('semantic_presentation_not_registered:market.trend')
  })

  it('keeps presentation metadata free of internal atom identifiers', () => {
    const internalKeys = atomRegistry.list().map(atom => atom.key)
    const internalPattern = new RegExp(
      `(^|[^A-Za-z0-9_.])(?:${internalKeys.map(escapeRegExp).join('|')}|generic_boundary)(?=$|[^A-Za-z0-9_])`,
      'u',
    )

    for (const supportedAtom of atomRegistry.list().filter(atom => atom.supportStatus.startsWith('supported_'))) {
      const metadata = presentation.get(supportedAtom.key)
      const publicText = [
        metadata.publicName,
        ...metadata.aliases,
        ...metadata.positiveExamples,
        ...metadata.negativeExamples,
        ...metadata.goldenUtterances,
      ].join('\n')

      expect(publicText).not.toMatch(internalPattern)
    }
  })

  it('formats BOLL and EMA semantics without leaking internal keys', () => {
    const bollText = presentation.renderDisplay('price.detect.indicator_boundary', {
      indicator: { name: 'bollinger', period: 20, stdDev: 2 },
      boundaryRole: 'lower',
      confirmationMode: 'touch',
    })
    const emaText = presentation.renderDisplay('condition.expression', {
      label: '价格同时位于 EMA20、EMA60、EMA144 上方',
    })

    expect(bollText).toBe('触及 BOLL 下轨（20, 2）')
    expect(emaText).toBe('价格同时位于 EMA20、EMA60、EMA144 上方')
    expect(`${bollText} ${emaText}`).not.toMatch(/generic_boundary|indicator\.above|indicator\.below|price\.detect\.indicator_boundary/u)
  })

  it('formats fixed percent position values as either ratios or percents', () => {
    expect(presentation.renderDisplay('position.fixed_pct', { value: 0.1 })).toBe('单笔 10% 仓位')
    expect(presentation.renderDisplay('position.fixed_pct', { value: 10 })).toBe('单笔 10% 仓位')
  })

  it('rejects display output that contains P0 internal identifiers', () => {
    expect(() => presentation.renderDisplay('condition.expression', {
      label: 'risk.stop_loss_pct',
    })).toThrow('semantic_presentation_internal_key_leak:condition.expression')
    expect(() => presentation.renderDisplay('condition.expression', {
      label: 'position.fixed_pct',
    })).toThrow('semantic_presentation_internal_key_leak:condition.expression')
    expect(() => presentation.renderDisplay('condition.expression', {
      label: 'open_long',
    })).toThrow('semantic_presentation_internal_key_leak:condition.expression')
  })

  it('rejects display output that contains compound internal slot paths', () => {
    expect(() => presentation.renderDisplay('condition.expression', {
      label: 'risk.stop_loss_pct.valuePct',
    })).toThrow('semantic_presentation_internal_key_leak:condition.expression')
    expect(() => presentation.renderDisplay('condition.expression', {
      label: 'position.fixed_pct.value',
    })).toThrow('semantic_presentation_internal_key_leak:condition.expression')
  })

  it('renders clarification text without leaking raw slot keys', () => {
    const text = presentation.renderClarification('risk.stop_loss_pct', 'risk.stop_loss_pct.valuePct', {})

    expect(text).toBe('请补充百分比止损的止损比例。')
    expect(text).not.toContain('risk.stop_loss_pct.valuePct')
    expect(text).not.toContain('valuePct')
  })
})

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&')
}
