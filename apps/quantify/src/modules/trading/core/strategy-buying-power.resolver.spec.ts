import { Prisma } from '@/prisma/prisma.types'
import {
  resolveStrategyFundingFromExchangeBalance,
  resolveStrategyFundingFromStrategyAccount,
} from './strategy-buying-power.resolver'

describe('strategyBuyingPowerResolver', () => {
  it('keeps total equity separate from zero exchange buying power', () => {
    const funding = resolveStrategyFundingFromExchangeBalance({
      balance: { asset: 'USDT', free: 0, locked: 4901.58222, total: 4901.58222 },
      marketType: 'perp',
      mode: 'TESTNET',
      reservedQuote: 0,
    })

    expect(funding).toMatchObject({
      asset: 'USDT',
      totalEquity: 4901.58222,
      availableCash: null,
      availableEquity: 0,
      reservedQuote: 0,
      buyingPower: 0,
      executionCapital: 4901.58222,
      fundingSource: 'exchange_testnet',
      nonTradableReason: 'exchange_available_balance_zero',
    })
  })

  it('maps spot free balance to available cash and deducts reserved quote', () => {
    const funding = resolveStrategyFundingFromExchangeBalance({
      balance: { asset: 'USDT', free: 120, locked: 30, total: 150 },
      marketType: 'spot',
      mode: 'LIVE',
      reservedQuote: 25,
    })

    expect(funding).toMatchObject({
      availableCash: 120,
      availableEquity: null,
      buyingPower: 95,
      executionCapital: 150,
      fundingSource: 'exchange_live',
      nonTradableReason: null,
    })
  })

  it('derives funding from a local strategy account for legacy accounts', () => {
    const funding = resolveStrategyFundingFromStrategyAccount({
      account: {
        baseCurrency: 'USDT',
        balance: new Prisma.Decimal(0),
        equity: new Prisma.Decimal('4901.58222'),
        initialBalance: new Prisma.Decimal('4901.58222'),
      },
      mode: 'TESTNET',
      reservedQuote: 0,
    })

    expect(funding).toMatchObject({
      asset: 'USDT',
      totalEquity: 4901.58222,
      buyingPower: 0,
      executionCapital: 4901.58222,
      fundingSource: 'exchange_testnet',
      nonTradableReason: 'local_strategy_account_balance_zero',
    })
  })

  it('preserves zero local account equity instead of falling back to initial balance', () => {
    const funding = resolveStrategyFundingFromStrategyAccount({
      account: {
        baseCurrency: 'USDT',
        balance: new Prisma.Decimal(0),
        equity: new Prisma.Decimal(0),
        initialBalance: new Prisma.Decimal(1000),
      },
      mode: 'TESTNET',
      reservedQuote: 0,
    })

    expect(funding).toMatchObject({
      totalEquity: 0,
      buyingPower: 0,
      executionCapital: 0,
      nonTradableReason: null,
    })
  })
})
