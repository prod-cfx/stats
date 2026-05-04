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

    expect(id).toHaveLength(32)
    expect(id).toMatch(/^[A-Za-z0-9]+$/u)
    expect(id).toMatch(/^ggcmoqyqixx08zs4qqs1b8pf[a-f0-9]{8}$/u)
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

    expect(id).toHaveLength(32)
    expect(id).toMatch(/^s0123456789abcdefghijklm[a-f0-9]{8}$/u)
  })

  it('avoids collisions when source ids only differ by sanitized characters', () => {
    const service = new ClientOrderIdFactoryService()

    const dashed = service.create({
      exchangeId: 'okx',
      source: 'grid',
      sourceId: 'abc-def',
      maxLength: 32,
      pattern: '^[A-Za-z0-9]+$',
    })
    const plain = service.create({
      exchangeId: 'okx',
      source: 'grid',
      sourceId: 'abcdef',
      maxLength: 32,
      pattern: '^[A-Za-z0-9]+$',
    })

    expect(dashed).not.toBe(plain)
    expect(dashed).toMatch(/^gabcdef[a-f0-9]{8}$/u)
    expect(plain).toMatch(/^gabcdef[a-f0-9]{8}$/u)
  })

  it('avoids collisions for long ids sharing the same readable prefix', () => {
    const service = new ClientOrderIdFactoryService()

    const first = service.create({
      exchangeId: 'okx',
      source: 'signal',
      sourceId: '0123456789abcdefghijklmnopqrstuvwxyz-first',
      maxLength: 32,
      pattern: '^[A-Za-z0-9]+$',
    })
    const second = service.create({
      exchangeId: 'okx',
      source: 'signal',
      sourceId: '0123456789abcdefghijklmnopqrstuvwxyz-second',
      maxLength: 32,
      pattern: '^[A-Za-z0-9]+$',
    })

    expect(first).not.toBe(second)
    expect(first).toHaveLength(32)
    expect(second).toHaveLength(32)
    expect(first.slice(0, 24)).toBe(second.slice(0, 24))
    expect(first).toMatch(/^[A-Za-z0-9]+$/u)
    expect(second).toMatch(/^[A-Za-z0-9]+$/u)
  })

  it('rejects generated ids that do not match generic exchange constraints', () => {
    const service = new ClientOrderIdFactoryService()

    expect(() => service.create({
      exchangeId: 'binance',
      source: 'grid',
      sourceId: 'abc-def',
      maxLength: 32,
      pattern: '^[0-9]+$',
    })).toThrow('trading_execution_invalid_client_order_id')
  })

  it('generates deterministic Hyperliquid cloids from signal execution ids', () => {
    const service = new ClientOrderIdFactoryService()

    const id = service.create({
      exchangeId: 'hyperliquid',
      source: 'signal',
      sourceId: 'exec-hl-signal-1',
      maxLength: 34,
      pattern: '^0x[0-9a-f]{32}$',
    })
    const again = service.create({
      exchangeId: 'hyperliquid',
      source: 'signal',
      sourceId: 'exec-hl-signal-1',
      maxLength: 34,
      pattern: '^0x[0-9a-f]{32}$',
    })

    expect(id).toBe(again)
    expect(id).toHaveLength(34)
    expect(id).toMatch(/^0x[0-9a-f]{32}$/u)
  })
})
