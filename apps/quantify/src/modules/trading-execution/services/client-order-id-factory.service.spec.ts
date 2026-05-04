import { ClientOrderIdFactoryService } from './client-order-id-factory.service'

describe('ClientOrderIdFactoryService', () => {
  it('generates OKX-compatible ids from arbitrary source ids', () => {
    const service = new ClientOrderIdFactoryService()

    const id = service.create({
      exchangeId: 'okx',
      source: 'grid',
      sourceId: 'g-cmoqyqixx08zs4qqs1b8pfv3o',
      maxLength: 32,
      pattern: '^[A-Za-z0-9]+$',
    })

    expect(id).toBe('ggcmoqyqixx08zs4qqs1b8pfv3o')
    expect(id).toHaveLength(27)
    expect(id).toMatch(/^[A-Za-z0-9]+$/u)
  })

  it('keeps ids within the exchange max length', () => {
    const service = new ClientOrderIdFactoryService()

    const id = service.create({
      exchangeId: 'okx',
      source: 'signal',
      sourceId: '0123456789abcdefghijklmnopqrstuvwxyz-extra',
      maxLength: 32,
      pattern: '^[A-Za-z0-9]+$',
    })

    expect(id).toBe('s0123456789abcdefghijklmnopqrstu')
    expect(id).toHaveLength(32)
  })
})
