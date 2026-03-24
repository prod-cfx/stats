import type { DeployExchangeAccount } from '@/components/ai-quant/DeployDialog'

const API_STORAGE_KEY = 'exchange_api_configs_v1'

type ExchangeId = DeployExchangeAccount['exchange']

function maskCredential(raw: unknown): string {
  const value = typeof raw === 'string' ? raw.trim() : ''
  if (!value) return '****'
  if (value.length <= 6) return `${value.slice(0, 2)}***`
  return `${value.slice(0, 4)}****${value.slice(-2)}`
}

function normalizeExchange(raw: unknown): ExchangeId | null {
  if (raw === 'binance' || raw === 'okx' || raw === 'hyperliquid') return raw
  return null
}

function buildLegacyAccounts(record: Record<string, unknown>): DeployExchangeAccount[] {
  const items: DeployExchangeAccount[] = []

  if (typeof record.binanceApiKey === 'string' && record.binanceApiKey.trim()) {
    items.push({
      accountId: 'legacy-binance',
      exchange: 'binance',
      accountName: 'Binance',
      apiKeyMask: maskCredential(record.binanceApiKey),
      status: 'available',
    })
  }

  if (typeof record.okxApiKey === 'string' && record.okxApiKey.trim()) {
    items.push({
      accountId: 'legacy-okx',
      exchange: 'okx',
      accountName: 'OKX',
      apiKeyMask: maskCredential(record.okxApiKey),
      status: 'available',
    })
  }

  return items
}

function buildStructuredAccounts(rawItems: unknown): DeployExchangeAccount[] {
  if (!Array.isArray(rawItems)) return []
  const items: DeployExchangeAccount[] = []

  for (const raw of rawItems) {
    if (!raw || typeof raw !== 'object') continue
    const row = raw as Record<string, unknown>
    const exchange = normalizeExchange(row.exchange)
    if (!exchange) continue
    const accountId = typeof row.accountId === 'string' && row.accountId.trim()
      ? row.accountId.trim()
      : `${exchange}-${items.length + 1}`
    const accountName = typeof row.accountName === 'string' && row.accountName.trim()
      ? row.accountName.trim()
      : exchange.toUpperCase()
    const status = row.status === 'invalid' ? 'invalid' : 'available'

    items.push({
      accountId,
      exchange,
      accountName,
      apiKeyMask: maskCredential(row.apiKeyMask ?? row.apiKey),
      status,
    })
  }

  return items
}

export function listExchangeAccounts(): DeployExchangeAccount[] {
  if (typeof window === 'undefined') return []
  const raw = window.localStorage.getItem(API_STORAGE_KEY)
  if (!raw) return []

  try {
    const parsed = JSON.parse(raw) as unknown
    if (!parsed || typeof parsed !== 'object') return []
    const record = parsed as Record<string, unknown>

    const structured = buildStructuredAccounts(record.accounts)
    if (structured.length > 0) return structured
    return buildLegacyAccounts(record)
  } catch {
    return []
  }
}
