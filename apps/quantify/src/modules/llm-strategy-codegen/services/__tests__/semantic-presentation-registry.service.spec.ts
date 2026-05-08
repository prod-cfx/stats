import { SemanticAtomRegistryService } from '../semantic-atom-registry.service'
import { SemanticPresentationRegistryService } from '../semantic-presentation-registry.service'

describe('SemanticPresentationRegistryService', () => {
  const atomRegistry = new SemanticAtomRegistryService()
  const presentation = new SemanticPresentationRegistryService()

  it('has presentation metadata for every supported atom used by the P0 gateway', () => {
    const requiredKeys = [
      'condition.expression',
      'indicator.boundary_touch',
      'price.detect.indicator_boundary',
      'risk.stop_loss_pct',
      'open_long',
      'open_short',
      'position.fixed_pct',
      'position.fixed_notional',
      'position.fixed_quantity',
    ]

    for (const key of requiredKeys) {
      const atom = atomRegistry.resolve(key)
      expect(atom.supportStatus).toMatch(/^supported_/u)
      expect(presentation.get(key)).toEqual(expect.objectContaining({
        key,
        publicName: expect.any(String),
        aliases: expect.arrayContaining([expect.any(String)]),
        positiveExamples: expect.arrayContaining([expect.any(String)]),
        displayRenderer: expect.any(Function),
        clarificationRenderer: expect.any(Function),
      }))
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
})
