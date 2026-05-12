import { parsePerOrderSizing, toPerOrderBudgetCapabilityShape } from './natural-language-gateway.service'

describe('parsePerOrderSizing', () => {
  // ── 正向用例 ──────────────────────────────────────────────

  it('识别"每次下单 100 USDT" → notional_quote 100', () => {
    const result = parsePerOrderSizing('每次下单 100 USDT')
    expect(result).toEqual({ mode: 'notional_quote', value: 100 })
  })

  it('识别"每次 50 U" → notional_quote 50', () => {
    const result = parsePerOrderSizing('每次 50 U')
    expect(result).toEqual({ mode: 'notional_quote', value: 50 })
  })

  it('识别"200 USDT 每次" → notional_quote 200', () => {
    const result = parsePerOrderSizing('200 USDT 每次')
    expect(result).toEqual({ mode: 'notional_quote', value: 200 })
  })

  it('识别"账户 20%" → equity_ratio 0.2', () => {
    const result = parsePerOrderSizing('账户 20%')
    expect(result).toEqual({ mode: 'equity_ratio', value: 0.2 })
  })

  it('识别"10% 仓位" → equity_ratio 0.1', () => {
    const result = parsePerOrderSizing('10% 仓位')
    expect(result).toEqual({ mode: 'equity_ratio', value: 0.1 })
  })

  it('识别"每次 5%" → equity_ratio 0.05', () => {
    const result = parsePerOrderSizing('每次 5%')
    expect(result).toEqual({ mode: 'equity_ratio', value: 0.05 })
  })

  it('识别"2 张" → fixed_base_qty 2', () => {
    const result = parsePerOrderSizing('2 张')
    expect(result).toEqual({ mode: 'fixed_base_qty', value: 2 })
  })

  it('识别"3 张合约" → fixed_base_qty 3', () => {
    const result = parsePerOrderSizing('3 张合约')
    expect(result).toEqual({ mode: 'fixed_base_qty', value: 3 })
  })

  // ── 边界与负向用例 ─────────────────────────────────────────

  it('空字符串 → null', () => {
    expect(parsePerOrderSizing('')).toBeNull()
  })

  it('纯文字无金额 → null', () => {
    expect(parsePerOrderSizing('每次下单很少')).toBeNull()
  })

  it('负数不识别 → null（"-100 USDT 每次"）', () => {
    // 正则只匹配 \d+，不会匹配负号前缀，因此应返回 null
    expect(parsePerOrderSizing('-100 USDT 每次')).toBeNull()
  })

  it('超大数仍能正确识别 → notional_quote 9999999', () => {
    const result = parsePerOrderSizing('每次下单 9999999 USDT')
    expect(result).toEqual({ mode: 'notional_quote', value: 9999999 })
  })

  // #1232 Round 1 m4 — 零值边界守卫
  it('零值 notional_quote 被 value>0 守卫拦截 → null', () => {
    expect(parsePerOrderSizing('每次下单 0 USDT')).toBeNull()
  })

  it('零值 equity_ratio 被 value>0 守卫拦截 → null', () => {
    expect(parsePerOrderSizing('账户 0%')).toBeNull()
  })

  it('零值 fixed_base_qty 被 value>0 守卫拦截 → null', () => {
    expect(parsePerOrderSizing('0 张合约')).toBeNull()
  })
})

describe('toPerOrderBudgetCapabilityShape', () => {
  it('notional_quote → kind=quote', () => {
    const shape = toPerOrderBudgetCapabilityShape(
      { mode: 'notional_quote', value: 100 },
      'nl.per_order_sizing',
    )
    expect(shape).toEqual({ kind: 'quote', value: 100, triggerSource: 'nl.per_order_sizing' })
  })

  it('equity_ratio → kind=ratio', () => {
    const shape = toPerOrderBudgetCapabilityShape(
      { mode: 'equity_ratio', value: 0.2 },
      'nl.per_order_sizing',
    )
    expect(shape).toEqual({ kind: 'ratio', value: 0.2, triggerSource: 'nl.per_order_sizing' })
  })

  it('fixed_base_qty → kind=base_qty', () => {
    const shape = toPerOrderBudgetCapabilityShape(
      { mode: 'fixed_base_qty', value: 2 },
      'nl.per_order_sizing',
    )
    expect(shape).toEqual({ kind: 'base_qty', value: 2, triggerSource: 'nl.per_order_sizing' })
  })
})
