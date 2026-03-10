export interface ExchangeAccount {
  accountId: string
  exchange: 'binance' | 'okx'
  accountName: string
  apiKeyMask: string
  status: 'available' | 'invalid'
}

const ACCOUNTS_KEY = 'ai_exchange_accounts_v1'
const LEGACY_KEY = 'exchange_api_configs_v1'

function mask(value: string) {
  if (!value) return '未配置'
  if (value.length <= 6) return `${value.slice(0, 2)}***`
  return `${value.slice(0, 3)}***${value.slice(-3)}`
}

export function listExchangeAccounts(): ExchangeAccount[] {
  if (typeof window === 'undefined') return []
  const raw = localStorage.getItem(ACCOUNTS_KEY)
  if (raw) {
    try {
      const parsed = JSON.parse(raw) as ExchangeAccount[]
      if (Array.isArray(parsed)) return parsed
    } catch {
      // ignore
    }
  }

  const legacyRaw = localStorage.getItem(LEGACY_KEY)
  if (!legacyRaw) return []
  try {
    const legacy = JSON.parse(legacyRaw) as {
      binanceApiKey?: string
      binanceSecretKey?: string
      okxApiKey?: string
      okxSecretKey?: string
      okxPassphrase?: string
    }
    const seeded: ExchangeAccount[] = []
    if (legacy.binanceApiKey && legacy.binanceSecretKey) {
      seeded.push({
        accountId: 'binance-default',
        exchange: 'binance',
        accountName: 'Binance 默认账户',
        apiKeyMask: mask(legacy.binanceApiKey),
        status: 'available',
      })
    }
    if (legacy.okxApiKey && legacy.okxSecretKey && legacy.okxPassphrase) {
      seeded.push({
        accountId: 'okx-default',
        exchange: 'okx',
        accountName: 'OKX 默认账户',
        apiKeyMask: mask(legacy.okxApiKey),
        status: 'available',
      })
    }
    if (seeded.length) {
      localStorage.setItem(ACCOUNTS_KEY, JSON.stringify(seeded))
    }
    return seeded
  } catch {
    return []
  }
}

export function saveExchangeAccounts(accounts: ExchangeAccount[]) {
  localStorage.setItem(ACCOUNTS_KEY, JSON.stringify(accounts))
}

export function upsertExchangeAccount(account: Omit<ExchangeAccount, 'accountId'> & { accountId?: string }) {
  const accounts = listExchangeAccounts()
  const id = account.accountId || `${account.exchange}-${Date.now()}`
  const next = [...accounts.filter(item => item.accountId !== id), { ...account, accountId: id }]
  saveExchangeAccounts(next)
  return id
}

