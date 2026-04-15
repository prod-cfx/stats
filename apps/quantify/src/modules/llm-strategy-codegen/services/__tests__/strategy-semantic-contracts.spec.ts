import { resolveSemanticContract } from '../strategy-semantic-contracts'

describe('strategySemanticContracts', () => {
  it('requires period and confirmation mode for moving-average breakout semantics', () => {
    const contract = resolveSemanticContract('indicator.above')

    expect(contract.requiredParams).toEqual(expect.arrayContaining([
      'indicator',
      'referenceRole',
      'reference.period',
      'confirmationMode',
    ]))
  })

  it('keeps grid touch executable when range, stepPct, and sideMode are present', () => {
    const contract = resolveSemanticContract('grid_touch')

    expect(contract.requiredParams).toEqual(['range.lower', 'range.upper', 'stepPct', 'sideMode'])
    expect(contract.defaultableParams).toEqual(expect.arrayContaining(['recycle']))
  })
})
