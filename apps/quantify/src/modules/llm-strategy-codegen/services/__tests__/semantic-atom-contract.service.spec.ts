import { SemanticAtomContractService } from '../semantic-atom-contract.service'

describe('SemanticAtomContractService', () => {
  const service = new SemanticAtomContractService()

  it('matches capabilities by structured domain verb object shape, not string key or families', () => {
    const contracts = [
      {
        id: 'trigger-1',
        kind: 'trigger',
        capabilities: [
          {
            domain: 'price',
            verb: 'define',
            object: 'level_set',
            shape: { lower: 60000, upper: 80000, gridCount: 100, spacingMode: 'arithmetic' },
          },
        ],
        requires: [],
        params: {},
      },
      {
        id: 'action-1',
        kind: 'action',
        capabilities: [
          {
            domain: 'order_program',
            verb: 'maintain',
            object: 'limit_ladder',
            shape: { timeInForce: 'gtc', recycleOnFill: true },
          },
        ],
        requires: [
          { domain: 'price', verb: 'define', object: 'level_set' },
          { domain: 'capital', verb: 'allocate', object: 'per_order_budget' },
        ],
        params: {},
      },
      {
        id: 'position-1',
        kind: 'position',
        capabilities: [
          {
            domain: 'capital',
            verb: 'allocate',
            object: 'per_order_budget',
            shape: { value: 20, asset: 'USDT' },
          },
        ],
        requires: [],
        params: {},
      },
    ] as const

    const result = service.resolve(contracts)

    expect(result.missingRequirements).toEqual([])
    expect(result.capabilities.map(item => `${item.domain}:${item.verb}:${item.object}`)).toEqual([
      'price:define:level_set',
      'order_program:maintain:limit_ladder',
      'capital:allocate:per_order_budget',
    ])
  })

  it('reports missing requirements without downgrading order programs to signals', () => {
    const result = service.resolve([
      {
        id: 'action-1',
        kind: 'action',
        capabilities: [
          {
            domain: 'order_program',
            verb: 'maintain',
            object: 'limit_ladder',
            shape: { timeInForce: 'gtc', recycleOnFill: true },
          },
        ],
        requires: [
          { domain: 'price', verb: 'define', object: 'level_set' },
        ],
        params: {},
      },
    ])

    expect(result.missingRequirements).toEqual([
      { contractId: 'action-1', domain: 'price', verb: 'define', object: 'level_set' },
    ])
    expect(result.canCompileOrderProgram).toBe(false)
  })
})
