import { parsePrismaEnums, generateEnumFile, collectEnumNames } from '../generate-prisma-enums'

describe('parsePrismaEnums', () => {
  it('parses simple enum', () => {
    const input = `enum TradeSide {\n  BUY\n  SELL\n}`
    const result = parsePrismaEnums(input, 'quantify')
    expect(result).toEqual([{
      name: 'TradeSide',
      source: 'quantify',
      members: [{ key: 'BUY', value: 'BUY' }, { key: 'SELL', value: 'SELL' }],
    }])
  })

  it('parses enum with @map annotation', () => {
    const input = `enum MarketTimeframe {\n  m1 @map("1m")\n  m5 @map("5m")\n}`
    const result = parsePrismaEnums(input, 'backend')
    expect(result).toEqual([{
      name: 'MarketTimeframe',
      source: 'backend',
      members: [{ key: 'm1', value: 'm1' }, { key: 'm5', value: 'm5' }],
    }])
  })

  it('ignores comments inside enum', () => {
    const input = `enum Foo {\n  // comment\n  A\n  /// doc comment\n  B\n}`
    const result = parsePrismaEnums(input, 'backend')
    expect(result).toEqual([{
      name: 'Foo',
      source: 'backend',
      members: [{ key: 'A', value: 'A' }, { key: 'B', value: 'B' }],
    }])
  })

  it('handles inline comments after member names', () => {
    const input = `enum StrategyInstanceMode {\n  BACKTEST // 历史回测\n  PAPER // 纸上交易\n  LIVE // 实盘交易\n}`
    const result = parsePrismaEnums(input, 'quantify')
    expect(result[0].members).toHaveLength(3)
    expect(result[0].members[0].key).toBe('BACKTEST')
  })

  it('parses multiple enums from one file', () => {
    const input = `enum A {\n  X\n}\n\nmodel Foo {\n  id Int @id\n}\n\nenum B {\n  Y\n  Z\n}`
    const result = parsePrismaEnums(input, 'backend')
    expect(result).toHaveLength(2)
    expect(result[0].name).toBe('A')
    expect(result[1].name).toBe('B')
  })
})

describe('generateEnumFile', () => {
  it('generates enum without prefix when name is unique', () => {
    const enums = [
      { name: 'TradeSide', source: 'quantify' as const, members: [{ key: 'BUY', value: 'BUY' }, { key: 'SELL', value: 'SELL' }] },
    ]
    const output = generateEnumFile(enums)
    expect(output).toContain('export const TradeSide')
    expect(output).toContain("BUY: 'BUY'")
    expect(output).toContain('// @generated')
  })

  it('adds prefix when same name appears in both sources', () => {
    const enums = [
      { name: 'InstrumentType', source: 'backend' as const, members: [{ key: 'SPOT', value: 'SPOT' }] },
      { name: 'InstrumentType', source: 'quantify' as const, members: [{ key: 'SPOT', value: 'SPOT' }] },
    ]
    const output = generateEnumFile(enums)
    expect(output).toContain('export const BackendInstrumentType')
    expect(output).toContain('export const QuantifyInstrumentType')
    expect(output).not.toContain('export const InstrumentType =')
  })
})

describe('collectEnumNames', () => {
  it('returns sorted unique names for non-duplicate enums', () => {
    const enums = [
      { name: 'TradeSide', source: 'quantify' as const, members: [{ key: 'BUY', value: 'BUY' }] },
      { name: 'PrincipalType', source: 'backend' as const, members: [{ key: 'USER', value: 'USER' }] },
    ]
    const names = collectEnumNames(enums)
    expect(names).toEqual(['PrincipalType', 'TradeSide'])
  })

  it('includes both prefixed and raw names for duplicates', () => {
    const enums = [
      { name: 'InstrumentType', source: 'backend' as const, members: [{ key: 'SPOT', value: 'SPOT' }] },
      { name: 'InstrumentType', source: 'quantify' as const, members: [{ key: 'SPOT', value: 'SPOT' }] },
    ]
    const names = collectEnumNames(enums)
    expect(names).toContain('BackendInstrumentType')
    expect(names).toContain('QuantifyInstrumentType')
    expect(names).toContain('InstrumentType')
  })

  it('returns empty array for empty input', () => {
    expect(collectEnumNames([])).toEqual([])
  })
})
