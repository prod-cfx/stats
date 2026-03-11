'use client'

import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { listExchangeAccounts, upsertExchangeAccount } from './exchange-account-store'

interface ExchangeApiSectionProps {
  highlighted?: boolean
}

interface ApiConfigState {
  binanceAccountName: string
  binanceApiKey: string
  binanceSecretKey: string
  okxAccountName: string
  okxApiKey: string
  okxSecretKey: string
  okxPassphrase: string
}

const STORAGE_KEY = 'exchange_api_configs_v1'

function mask(value: string) {
  if (!value) return null
  if (value.length <= 6) return `${value.slice(0, 2)}***`
  return `${value.slice(0, 3)}***${value.slice(-3)}`
}

export function ExchangeApiSection({ highlighted = false }: ExchangeApiSectionProps) {
  const { t } = useTranslation()
  const [form, setForm] = useState<ApiConfigState>({
    binanceAccountName: '',
    binanceApiKey: '',
    binanceSecretKey: '',
    okxAccountName: '',
    okxApiKey: '',
    okxSecretKey: '',
    okxPassphrase: '',
  })
  const [saved, setSaved] = useState<ApiConfigState | null>(null)

  useEffect(() => {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return
    try {
      const parsed = JSON.parse(raw) as ApiConfigState
      setSaved(parsed)
    } catch {
      // ignore invalid local data
    }
  }, [])

  const save = () => {
    const next: ApiConfigState = {
      binanceAccountName: form.binanceAccountName || saved?.binanceAccountName || '',
      binanceApiKey: form.binanceApiKey || saved?.binanceApiKey || '',
      binanceSecretKey: form.binanceSecretKey || saved?.binanceSecretKey || '',
      okxAccountName: form.okxAccountName || saved?.okxAccountName || '',
      okxApiKey: form.okxApiKey || saved?.okxApiKey || '',
      okxSecretKey: form.okxSecretKey || saved?.okxSecretKey || '',
      okxPassphrase: form.okxPassphrase || saved?.okxPassphrase || '',
    }

    localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
    if (next.binanceApiKey && next.binanceSecretKey) {
      upsertExchangeAccount({
        exchange: 'binance',
        accountName: form.binanceAccountName || 'Binance 默认账户',
        apiKeyMask: mask(next.binanceApiKey),
        status: 'available',
      })
    }
    if (next.okxApiKey && next.okxSecretKey && next.okxPassphrase) {
      upsertExchangeAccount({
        exchange: 'okx',
        accountName: form.okxAccountName || 'OKX 默认账户',
        apiKeyMask: mask(next.okxApiKey),
        status: 'available',
      })
    }
    setSaved(next)
    setForm({
      binanceAccountName: '',
      binanceApiKey: '',
      binanceSecretKey: '',
      okxAccountName: '',
      okxApiKey: '',
      okxSecretKey: '',
      okxPassphrase: '',
    })
  }

  const binanceReady = Boolean(saved?.binanceApiKey && saved?.binanceSecretKey)
  const okxReady = Boolean(saved?.okxApiKey && saved?.okxSecretKey && saved?.okxPassphrase)
  const accounts = listExchangeAccounts()

  return (
    <section
      id="exchange-api"
      className={`space-y-4 rounded-2xl border bg-[color:var(--cf-surface)] p-5 ${
        highlighted ? 'border-violet-500/40' : 'border-[color:var(--cf-border)]'
      }`}
    >
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-[color:var(--cf-text-strong)]">{t('aiQuant.apiConfigTitle')}</h2>
        <div className="flex gap-2 text-xs">
          <span className={`rounded-lg px-2 py-1 ${binanceReady ? 'bg-emerald-500/10 text-emerald-500' : 'bg-amber-500/10 text-amber-500'}`}>
            Binance {binanceReady ? t('aiQuant.configured') : t('aiQuant.notConfigured')}
          </span>
          <span className={`rounded-lg px-2 py-1 ${okxReady ? 'bg-emerald-500/10 text-emerald-500' : 'bg-amber-500/10 text-amber-500'}`}>
            OKX {okxReady ? t('aiQuant.configured') : t('aiQuant.notConfigured')}
          </span>
        </div>
      </div>

      <p className="text-sm text-[color:var(--cf-muted)]">{t('aiQuant.apiConfigDesc')}</p>

      <div className="grid gap-4 md:grid-cols-2">
        <article className="space-y-3 rounded-xl border border-[color:var(--cf-border)] bg-[color:var(--cf-bg)] p-4">
          <h3 className="text-sm font-semibold text-[color:var(--cf-text-strong)]">{t('aiQuant.binanceApi')}</h3>
          <p className="text-xs text-[color:var(--cf-muted)]">{t('aiQuant.currentKey')} {mask(saved?.binanceApiKey || '') || t('aiQuant.notConfigured')}</p>
          <input
            value={form.binanceAccountName}
            onChange={event => setForm(prev => ({ ...prev, binanceAccountName: event.target.value }))}
            placeholder={t('aiQuant.accountName')}
            className="h-9 w-full rounded-lg border border-[color:var(--cf-border)] bg-[color:var(--cf-surface)] px-2 text-sm"
          />
          <input
            value={form.binanceApiKey}
            onChange={event => setForm(prev => ({ ...prev, binanceApiKey: event.target.value }))}
            placeholder={t('aiQuant.apiKey')}
            className="h-9 w-full rounded-lg border border-[color:var(--cf-border)] bg-[color:var(--cf-surface)] px-2 text-sm"
          />
          <input
            value={form.binanceSecretKey}
            onChange={event => setForm(prev => ({ ...prev, binanceSecretKey: event.target.value }))}
            placeholder={t('aiQuant.secretKey')}
            className="h-9 w-full rounded-lg border border-[color:var(--cf-border)] bg-[color:var(--cf-surface)] px-2 text-sm"
          />
        </article>

        <article className="space-y-3 rounded-xl border border-[color:var(--cf-border)] bg-[color:var(--cf-bg)] p-4">
          <h3 className="text-sm font-semibold text-[color:var(--cf-text-strong)]">{t('aiQuant.okxApi')}</h3>
          <p className="text-xs text-[color:var(--cf-muted)]">{t('aiQuant.currentKey')} {mask(saved?.okxApiKey || '') || t('aiQuant.notConfigured')}</p>
          <input
            value={form.okxAccountName}
            onChange={event => setForm(prev => ({ ...prev, okxAccountName: event.target.value }))}
            placeholder={t('aiQuant.accountName')}
            className="h-9 w-full rounded-lg border border-[color:var(--cf-border)] bg-[color:var(--cf-surface)] px-2 text-sm"
          />
          <input
            value={form.okxApiKey}
            onChange={event => setForm(prev => ({ ...prev, okxApiKey: event.target.value }))}
            placeholder={t('aiQuant.apiKey')}
            className="h-9 w-full rounded-lg border border-[color:var(--cf-border)] bg-[color:var(--cf-surface)] px-2 text-sm"
          />
          <input
            value={form.okxSecretKey}
            onChange={event => setForm(prev => ({ ...prev, okxSecretKey: event.target.value }))}
            placeholder={t('aiQuant.secretKey')}
            className="h-9 w-full rounded-lg border border-[color:var(--cf-border)] bg-[color:var(--cf-surface)] px-2 text-sm"
          />
          <input
            value={form.okxPassphrase}
            onChange={event => setForm(prev => ({ ...prev, okxPassphrase: event.target.value }))}
            placeholder={t('aiQuant.passphrase')}
            className="h-9 w-full rounded-lg border border-[color:var(--cf-border)] bg-[color:var(--cf-surface)] px-2 text-sm"
          />
        </article>
      </div>

      <button
        type="button"
        onClick={save}
        className="rounded-xl bg-gradient-to-r from-violet-500 to-purple-600 px-4 py-2 text-sm font-bold text-white transition-all hover:from-violet-600 hover:to-purple-700"
      >
        {t('aiQuant.saveApiConfig')}
      </button>

      {accounts.length > 0 && (
        <div className="rounded-xl border border-[color:var(--cf-border)] bg-[color:var(--cf-bg)] p-3">
          <p className="text-xs font-semibold text-[color:var(--cf-text-strong)]">{t('aiQuant.boundAccounts')}</p>
          <div className="mt-2 space-y-2">
            {accounts.map(account => (
              <div key={account.accountId} className="flex items-center justify-between text-xs text-[color:var(--cf-muted)]">
                <span>{account.exchange.toUpperCase()} / {account.accountName}</span>
                <span>{account.apiKeyMask}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </section>
  )
}
