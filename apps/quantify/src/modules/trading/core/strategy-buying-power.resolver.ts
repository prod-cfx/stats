import type { MarketType, UnifiedBalance } from './types'

type DeployMode = 'TESTNET' | 'LIVE'

export interface StrategyFundingSnapshot {
  asset: string
  totalEquity: number
  availableCash: number | null
  availableEquity: number | null
  reservedQuote: number
  usedMargin: number | null
  buyingPower: number
  executionCapital: number
  fundingSource: 'exchange_live' | 'exchange_testnet' | 'paper'
  accountMode?: string | null
  marginMode?: string | null
  nonTradableReason?: string | null
}

interface ResolveExchangeFundingInput {
  balance: UnifiedBalance | null
  marketType: MarketType
  mode?: DeployMode | null
  reservedQuote?: unknown
}

interface ResolveStrategyAccountFundingInput {
  account: {
    baseCurrency: string | null
    balance: unknown
    equity?: unknown
    initialBalance?: unknown
  }
  mode?: DeployMode | null
  reservedQuote?: unknown
}

export function resolveStrategyFundingFromExchangeBalance(input: ResolveExchangeFundingInput): StrategyFundingSnapshot {
  const asset = normalizeAsset(input.balance?.asset)
  const totalEquity = toNonNegativeFiniteNumber(input.balance?.total)
  const available = toNonNegativeFiniteNumber(input.balance?.free)
  const reservedQuote = toNonNegativeFiniteNumber(input.reservedQuote)
  const buyingPower = Math.max(0, roundFundingNumber(available - reservedQuote))
  const isSpot = input.marketType === 'spot'

  return {
    asset,
    totalEquity,
    availableCash: isSpot ? available : null,
    availableEquity: isSpot ? null : available,
    reservedQuote,
    usedMargin: null,
    buyingPower,
    executionCapital: resolveExecutionCapital(totalEquity, buyingPower),
    fundingSource: resolveFundingSource(input.mode),
    accountMode: null,
    marginMode: null,
    nonTradableReason: resolveNonTradableReason(totalEquity, buyingPower, 'exchange_available_balance_zero'),
  }
}

export function resolveStrategyFundingFromStrategyAccount(input: ResolveStrategyAccountFundingInput): StrategyFundingSnapshot {
  const asset = normalizeAsset(input.account.baseCurrency)
  const balance = toNonNegativeFiniteNumber(input.account.balance)
  const equity = toFiniteFundingNumber(input.account.equity)
  const initialBalance = toNonNegativeFiniteNumber(input.account.initialBalance)
  const reservedQuote = toNonNegativeFiniteNumber(input.reservedQuote)
  const buyingPower = Math.max(0, roundFundingNumber(balance - reservedQuote))
  const totalEquity = resolveTotalEquity(equity, initialBalance, balance)

  return {
    asset,
    totalEquity,
    availableCash: null,
    availableEquity: balance,
    reservedQuote,
    usedMargin: null,
    buyingPower,
    executionCapital: resolveExecutionCapital(totalEquity, buyingPower),
    fundingSource: resolveFundingSource(input.mode),
    accountMode: null,
    marginMode: null,
    nonTradableReason: resolveNonTradableReason(totalEquity, buyingPower, 'local_strategy_account_balance_zero'),
  }
}

function resolveFundingSource(mode: DeployMode | null | undefined): StrategyFundingSnapshot['fundingSource'] {
  return mode === 'LIVE' ? 'exchange_live' : 'exchange_testnet'
}

function resolveTotalEquity(equity: number | null, initialBalance: number, balance: number): number {
  if (equity !== null) return equity
  if (initialBalance > 0) return initialBalance
  return balance
}

function resolveExecutionCapital(totalEquity: number, buyingPower: number): number {
  if (totalEquity > 0) return totalEquity
  return buyingPower
}

function resolveNonTradableReason(totalEquity: number, buyingPower: number, reason: string): string | null {
  if (totalEquity > 0 && buyingPower <= 0) return reason
  return null
}

function normalizeAsset(value: unknown): string {
  if (typeof value !== 'string') return 'USDT'
  const normalized = value.trim().toUpperCase()
  return normalized.length > 0 ? normalized : 'USDT'
}

function toNonNegativeFiniteNumber(value: unknown): number {
  const numeric = Number(value)
  if (!Number.isFinite(numeric) || numeric <= 0) return 0
  return roundFundingNumber(numeric)
}

function toFiniteFundingNumber(value: unknown): number | null {
  if (value === null || value === undefined) return null
  const numeric = Number(value)
  if (!Number.isFinite(numeric)) return null
  return roundFundingNumber(Math.max(0, numeric))
}

function roundFundingNumber(value: number): number {
  return Number(value.toFixed(8))
}
