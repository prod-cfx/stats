'use client'

import { useEffect, useState } from 'react'
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
  if (!value) return '未配置'
  if (value.length <= 6) return `${value.slice(0, 2)}***`
  return `${value.slice(0, 3)}***${value.slice(-3)}`
}

export function ExchangeApiSection({ highlighted = false }: ExchangeApiSectionProps) {
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
      binanceApiKey: form.binanceApiKey || saved?.binanceApiKey || '',
      binanceSecretKey: form.binanceSecretKey || saved?.binanceSecretKey || '',
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
        <h2 className="text-lg font-semibold text-[color:var(--cf-text-strong)]">交易所 API 配置</h2>
        <div className="flex gap-2 text-xs">
          <span className={`rounded-lg px-2 py-1 ${binanceReady ? 'bg-emerald-500/10 text-emerald-500' : 'bg-amber-500/10 text-amber-500'}`}>
            Binance {binanceReady ? '已配置' : '未配置'}
          </span>
          <span className={`rounded-lg px-2 py-1 ${okxReady ? 'bg-emerald-500/10 text-emerald-500' : 'bg-amber-500/10 text-amber-500'}`}>
            OKX {okxReady ? '已配置' : '未配置'}
          </span>
        </div>
      </div>

      <p className="text-sm text-[color:var(--cf-muted)]">MVP 前端占位实现：仅用于本地演示部署校验流程，真实环境需后端安全托管。</p>

      <div className="grid gap-4 md:grid-cols-2">
        <article className="space-y-3 rounded-xl border border-[color:var(--cf-border)] bg-[color:var(--cf-bg)] p-4">
          <h3 className="text-sm font-semibold text-[color:var(--cf-text-strong)]">Binance API</h3>
          <p className="text-xs text-[color:var(--cf-muted)]">当前 Key: {mask(saved?.binanceApiKey || '')}</p>
          <input
            value={form.binanceAccountName}
            onChange={event => setForm(prev => ({ ...prev, binanceAccountName: event.target.value }))}
            placeholder="账户名称（例如：Binance 主账户）"
            className="h-9 w-full rounded-lg border border-[color:var(--cf-border)] bg-[color:var(--cf-surface)] px-2 text-sm"
          />
          <input
            value={form.binanceApiKey}
            onChange={event => setForm(prev => ({ ...prev, binanceApiKey: event.target.value }))}
            placeholder="Binance API Key"
            className="h-9 w-full rounded-lg border border-[color:var(--cf-border)] bg-[color:var(--cf-surface)] px-2 text-sm"
          />
          <input
            value={form.binanceSecretKey}
            onChange={event => setForm(prev => ({ ...prev, binanceSecretKey: event.target.value }))}
            placeholder="Binance Secret Key"
            className="h-9 w-full rounded-lg border border-[color:var(--cf-border)] bg-[color:var(--cf-surface)] px-2 text-sm"
          />
        </article>

        <article className="space-y-3 rounded-xl border border-[color:var(--cf-border)] bg-[color:var(--cf-bg)] p-4">
          <h3 className="text-sm font-semibold text-[color:var(--cf-text-strong)]">OKX API</h3>
          <p className="text-xs text-[color:var(--cf-muted)]">当前 Key: {mask(saved?.okxApiKey || '')}</p>
          <input
            value={form.okxAccountName}
            onChange={event => setForm(prev => ({ ...prev, okxAccountName: event.target.value }))}
            placeholder="账户名称（例如：OKX 子账户A）"
            className="h-9 w-full rounded-lg border border-[color:var(--cf-border)] bg-[color:var(--cf-surface)] px-2 text-sm"
          />
          <input
            value={form.okxApiKey}
            onChange={event => setForm(prev => ({ ...prev, okxApiKey: event.target.value }))}
            placeholder="OKX API Key"
            className="h-9 w-full rounded-lg border border-[color:var(--cf-border)] bg-[color:var(--cf-surface)] px-2 text-sm"
          />
          <input
            value={form.okxSecretKey}
            onChange={event => setForm(prev => ({ ...prev, okxSecretKey: event.target.value }))}
            placeholder="OKX Secret Key"
            className="h-9 w-full rounded-lg border border-[color:var(--cf-border)] bg-[color:var(--cf-surface)] px-2 text-sm"
          />
          <input
            value={form.okxPassphrase}
            onChange={event => setForm(prev => ({ ...prev, okxPassphrase: event.target.value }))}
            placeholder="OKX Passphrase"
            className="h-9 w-full rounded-lg border border-[color:var(--cf-border)] bg-[color:var(--cf-surface)] px-2 text-sm"
          />
        </article>
      </div>

      <button
        type="button"
        onClick={save}
        className="from-primary to-secondary rounded-xl bg-gradient-to-r px-4 py-2 text-sm font-bold text-white"
      >
        保存 API 配置
      </button>

      {accounts.length > 0 && (
        <div className="rounded-xl border border-[color:var(--cf-border)] bg-[color:var(--cf-bg)] p-3">
          <p className="text-xs font-semibold text-[color:var(--cf-text-strong)]">已绑定交易账户</p>
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
