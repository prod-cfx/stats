'use client'

import type {
  UpsertUserExchangeAccountPayload,
  UserExchangeAccountStatus,
  UserExchangeId,
} from '@/lib/api'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  deleteUserExchangeAccount,
  fetchUserExchangeAccountStatuses,
  upsertUserExchangeAccount,
} from '@/lib/api'
import { ApiError } from '@/lib/errors'

interface ExchangeApiSectionProps {
  highlighted?: boolean
}

interface ExchangeFormState {
  name: string
  isTestnet: boolean
  apiKey: string
  apiSecret: string
  passphrase: string
  mainWalletAddress: string
  agentPrivateKey: string
}

const EXCHANGES: UserExchangeId[] = ['binance', 'okx', 'hyperliquid']
const OKX_SAVE_ALLOWED_REDIRECTS = new Set(['/zh/ai-quant/plaza', '/en/ai-quant/plaza'])

export function getOkxSaveRedirect(): string | null {
  if (typeof window === 'undefined') return null
  const redirect = new URLSearchParams(window.location.search).get('redirect')
  if (!redirect || !OKX_SAVE_ALLOWED_REDIRECTS.has(redirect)) return null
  return redirect
}

export const accountExchangeNavigation = {
  redirectTo(redirect: string) {
    window.location.href = redirect
  },
}

function createEmptyFormState(): ExchangeFormState {
  return {
    name: '',
    isTestnet: false,
    apiKey: '',
    apiSecret: '',
    passphrase: '',
    mainWalletAddress: '',
    agentPrivateKey: '',
  }
}

function createInitialForms(): Record<UserExchangeId, ExchangeFormState> {
  return {
    binance: createEmptyFormState(),
    okx: {
      ...createEmptyFormState(),
      isTestnet: getOkxSaveRedirect() !== null,
    },
    hyperliquid: createEmptyFormState(),
  }
}

function buildEmptyStatus(exchangeId: UserExchangeId): UserExchangeAccountStatus {
  return {
    id: null,
    exchangeId,
    isBound: false,
    name: null,
    maskedCredential: null,
    isTestnet: null,
    lastValidatedAt: null,
    createdAt: null,
  }
}

function getApiErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof ApiError) {
    return error.message
  }

  if (error instanceof Error) {
    return error.message
  }

  return fallback
}

function getTitleKey(exchangeId: UserExchangeId): string {
  if (exchangeId === 'binance') return 'aiQuant.binanceApi'
  if (exchangeId === 'okx') return 'aiQuant.okxApi'
  return 'aiQuant.hyperliquidApi'
}

function trimToOptionalValue(value: string): string | undefined {
  const trimmed = value.trim()
  return trimmed || undefined
}

function buildValidationError(
  exchangeId: UserExchangeId,
  hasExistingBinding: boolean,
  form: ExchangeFormState,
  translate: (key: string, options?: { defaultValue?: string }) => string,
): string | null {
  if (hasExistingBinding) {
    return null
  }

  if (exchangeId === 'binance') {
    if (!trimToOptionalValue(form.apiKey) || !trimToOptionalValue(form.apiSecret)) {
      return translate('aiQuant.validation.requiredBinanceCredentials', {
        defaultValue: 'Binance API key and secret are required.',
      })
    }
    return null
  }

  if (exchangeId === 'okx') {
    if (!trimToOptionalValue(form.apiKey) || !trimToOptionalValue(form.apiSecret) || !trimToOptionalValue(form.passphrase)) {
      return translate('aiQuant.validation.requiredOkxCredentials', {
        defaultValue: 'OKX API key, secret, and passphrase are required.',
      })
    }
    return null
  }

  if (!trimToOptionalValue(form.mainWalletAddress) || !trimToOptionalValue(form.agentPrivateKey)) {
    return translate('aiQuant.validation.requiredHyperliquidCredentials', {
      defaultValue: 'Hyperliquid wallet address and agent private key are required.',
    })
  }

  return null
}

export function ExchangeApiSection({ highlighted = false }: ExchangeApiSectionProps) {
  const { t } = useTranslation()
  const [accounts, setAccounts] = useState<Record<UserExchangeId, UserExchangeAccountStatus>>({
    binance: buildEmptyStatus('binance'),
    okx: buildEmptyStatus('okx'),
    hyperliquid: buildEmptyStatus('hyperliquid'),
  })
  const [forms, setForms] = useState<Record<UserExchangeId, ExchangeFormState>>(createInitialForms)
  const [editing, setEditing] = useState<Record<UserExchangeId, boolean>>({
    binance: false,
    okx: false,
    hyperliquid: false,
  })
  const [submittingExchange, setSubmittingExchange] = useState<UserExchangeId | null>(null)
  const [deletingExchange, setDeletingExchange] = useState<UserExchangeId | null>(null)
  const [errors, setErrors] = useState<Record<UserExchangeId, string | null>>({
    binance: null,
    okx: null,
    hyperliquid: null,
  })
  const [loading, setLoading] = useState(true)
  const boundExchangeIds = EXCHANGES.reduce<UserExchangeId[]>((result, exchangeId) => {
    if (accounts[exchangeId].isBound) {
      result.push(exchangeId)
    }
    return result
  }, [])

  useEffect(() => {
    void loadStatuses()
  }, [])

  async function loadStatuses() {
    setLoading(true)
    try {
      const items = await fetchUserExchangeAccountStatuses()
      setAccounts({
        binance: items.find(item => item.exchangeId === 'binance') ?? buildEmptyStatus('binance'),
        okx: items.find(item => item.exchangeId === 'okx') ?? buildEmptyStatus('okx'),
        hyperliquid: items.find(item => item.exchangeId === 'hyperliquid') ?? buildEmptyStatus('hyperliquid'),
      })
    }
    catch (error) {
      const message = getApiErrorMessage(error, t('aiQuant.loadFailed'))
      setErrors({
        binance: message,
        okx: message,
        hyperliquid: message,
      })
    }
    finally {
      setLoading(false)
    }
  }

  function setFormValue(exchangeId: UserExchangeId, key: keyof ExchangeFormState, value: string) {
    setForms(prev => ({
      ...prev,
      [exchangeId]: {
        ...prev[exchangeId],
        [key]: value,
      },
    }))
  }

  function startEditing(exchangeId: UserExchangeId) {
    const account = accounts[exchangeId]
    setEditing(prev => ({ ...prev, [exchangeId]: true }))
    setErrors(prev => ({ ...prev, [exchangeId]: null }))
    setForms(prev => ({
      ...prev,
      [exchangeId]: {
        ...prev[exchangeId],
        name: account.name ?? prev[exchangeId].name,
        isTestnet: account.isTestnet ?? prev[exchangeId].isTestnet,
      },
    }))
  }

  function cancelEditing(exchangeId: UserExchangeId) {
    setEditing(prev => ({ ...prev, [exchangeId]: false }))
    setForms(prev => ({
      ...prev,
      [exchangeId]: createEmptyFormState(),
    }))
    setErrors(prev => ({ ...prev, [exchangeId]: null }))
  }

  function buildPayload(exchangeId: UserExchangeId): UpsertUserExchangeAccountPayload {
    const form = forms[exchangeId]
    const name = trimToOptionalValue(form.name)
    const apiKey = trimToOptionalValue(form.apiKey)
    const apiSecret = trimToOptionalValue(form.apiSecret)
    const passphrase = trimToOptionalValue(form.passphrase)
    const mainWalletAddress = trimToOptionalValue(form.mainWalletAddress)
    const agentPrivateKey = trimToOptionalValue(form.agentPrivateKey)

    if (exchangeId === 'binance') {
      return {
        exchangeId,
        name,
        isTestnet: form.isTestnet,
        apiKey,
        apiSecret,
        marketType: 'spot',
      }
    }

    if (exchangeId === 'okx') {
      return {
        exchangeId,
        name,
        isTestnet: form.isTestnet,
        apiKey,
        apiSecret,
        passphrase,
        marketType: 'spot',
      }
    }

    return {
      exchangeId,
      name,
      isTestnet: form.isTestnet,
      mainWalletAddress,
      agentPrivateKey,
    }
  }

  async function save(exchangeId: UserExchangeId) {
    const validationError = buildValidationError(exchangeId, accounts[exchangeId].isBound, forms[exchangeId], t)
    if (validationError) {
      setErrors(prev => ({
        ...prev,
        [exchangeId]: validationError,
      }))
      return
    }
    const okxRecoveryRedirect = exchangeId === 'okx' ? getOkxSaveRedirect() : null
    if (okxRecoveryRedirect && !forms.okx.isTestnet) {
      setErrors(prev => ({
        ...prev,
        okx: t('aiQuant.validation.requiredOkxDemoCredentials', {
          defaultValue: 'Please save an OKX demo trading API key before returning to Strategy Plaza.',
        }),
      }))
      return
    }

    setSubmittingExchange(exchangeId)
    setErrors(prev => ({ ...prev, [exchangeId]: null }))
    try {
      await upsertUserExchangeAccount(buildPayload(exchangeId))
      const redirect = okxRecoveryRedirect
      if (redirect) {
        accountExchangeNavigation.redirectTo(redirect)
        return
      }
      setForms(prev => ({
        ...prev,
        [exchangeId]: createEmptyFormState(),
      }))
      setEditing(prev => ({ ...prev, [exchangeId]: false }))
      await loadStatuses()
    }
    catch (error) {
      setErrors(prev => ({
        ...prev,
        [exchangeId]: getApiErrorMessage(error, t('aiQuant.saveFailed')),
      }))
    }
    finally {
      setSubmittingExchange(null)
    }
  }

  async function remove(exchangeId: UserExchangeId) {
    setDeletingExchange(exchangeId)
    setErrors(prev => ({ ...prev, [exchangeId]: null }))
    try {
      await deleteUserExchangeAccount(exchangeId)
      setForms(prev => ({
        ...prev,
        [exchangeId]: createEmptyFormState(),
      }))
      setEditing(prev => ({ ...prev, [exchangeId]: false }))
      await loadStatuses()
    }
    catch (error) {
      setErrors(prev => ({
        ...prev,
        [exchangeId]: getApiErrorMessage(error, t('aiQuant.deleteFailed')),
      }))
    }
    finally {
      setDeletingExchange(null)
    }
  }

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
          {EXCHANGES.map(exchangeId => {
            const isBound = accounts[exchangeId].isBound
            return (
              <span
                key={exchangeId}
                className={`rounded-lg px-2 py-1 ${isBound ? 'bg-emerald-500/10 text-emerald-500' : 'bg-amber-500/10 text-amber-500'}`}
              >
                {exchangeId === 'hyperliquid' ? 'Hyperliquid' : exchangeId.toUpperCase()} {isBound ? t('aiQuant.configured') : t('aiQuant.notConfigured')}
              </span>
            )
          })}
        </div>
      </div>

      <p className="text-sm text-[color:var(--cf-muted)]">{t('aiQuant.apiConfigDesc')}</p>

      {loading ? (
        <div className="rounded-xl border border-[color:var(--cf-border)] bg-[color:var(--cf-bg)] p-4 text-sm text-[color:var(--cf-muted)]">
          {t('aiQuant.loading')}
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-3">
          {EXCHANGES.map(exchangeId => {
            const account = accounts[exchangeId]
            const isEditing = editing[exchangeId] || !account.isBound
            const form = forms[exchangeId]
            const isSubmitting = submittingExchange === exchangeId
            const isDeleting = deletingExchange === exchangeId

            return (
              <article key={exchangeId} className="space-y-3 rounded-xl border border-[color:var(--cf-border)] bg-[color:var(--cf-bg)] p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="text-sm font-semibold text-[color:var(--cf-text-strong)]">{t(getTitleKey(exchangeId))}</h3>
                    <p className="mt-1 text-xs text-[color:var(--cf-muted)]">
                      {account.isBound
                        ? `${t('aiQuant.currentKey')}${account.maskedCredential ?? '-'}`
                        : t('aiQuant.notConfigured')}
                    </p>
                    {account.lastValidatedAt && (
                      <p className="mt-1 text-xs text-[color:var(--cf-muted)]">
                        {t('aiQuant.lastValidatedAt')} {new Date(account.lastValidatedAt).toLocaleString()}
                      </p>
                    )}
                  </div>
                  <span className={`rounded-lg px-2 py-1 text-xs ${account.isBound ? 'bg-emerald-500/10 text-emerald-500' : 'bg-amber-500/10 text-amber-500'}`}>
                    {account.isBound ? t('aiQuant.configured') : t('aiQuant.notConfigured')}
                  </span>
                </div>

                {isEditing ? (
                  <div className="space-y-3">
                    <input
                      value={form.name}
                      onChange={event => setFormValue(exchangeId, 'name', event.target.value)}
                      placeholder={t('aiQuant.accountName')}
                      className="h-9 w-full rounded-lg border border-[color:var(--cf-border)] bg-[color:var(--cf-surface)] px-2 text-sm"
                    />
                    <label className="flex items-center gap-2 text-xs text-[color:var(--cf-muted)]">
                      <input
                        type="checkbox"
                        checked={form.isTestnet}
                        onChange={event => setForms(prev => ({
                          ...prev,
                          [exchangeId]: {
                            ...prev[exchangeId],
                            isTestnet: event.target.checked,
                          },
                        }))}
                        className="h-4 w-4 rounded border border-[color:var(--cf-border)]"
                      />
                      {t('aiQuant.useTestnet')}
                    </label>
                    {exchangeId !== 'hyperliquid' && (
                      <>
                        <input
                          value={form.apiKey}
                          onChange={event => setFormValue(exchangeId, 'apiKey', event.target.value)}
                          placeholder={t('aiQuant.apiKey')}
                          className="h-9 w-full rounded-lg border border-[color:var(--cf-border)] bg-[color:var(--cf-surface)] px-2 text-sm"
                        />
                        <input
                          value={form.apiSecret}
                          type="password"
                          autoComplete="off"
                          onChange={event => setFormValue(exchangeId, 'apiSecret', event.target.value)}
                          placeholder={t('aiQuant.secretKey')}
                          className="h-9 w-full rounded-lg border border-[color:var(--cf-border)] bg-[color:var(--cf-surface)] px-2 text-sm"
                        />
                      </>
                    )}
                    {exchangeId === 'okx' && (
                      <input
                        value={form.passphrase}
                        type="password"
                        autoComplete="off"
                        onChange={event => setFormValue(exchangeId, 'passphrase', event.target.value)}
                        placeholder={t('aiQuant.passphrase')}
                        className="h-9 w-full rounded-lg border border-[color:var(--cf-border)] bg-[color:var(--cf-surface)] px-2 text-sm"
                      />
                    )}
                    {exchangeId === 'hyperliquid' && (
                      <>
                        <input
                          value={form.mainWalletAddress}
                          onChange={event => setFormValue(exchangeId, 'mainWalletAddress', event.target.value)}
                          placeholder={t('aiQuant.walletAddress')}
                          className="h-9 w-full rounded-lg border border-[color:var(--cf-border)] bg-[color:var(--cf-surface)] px-2 text-sm"
                        />
                        <input
                          value={form.agentPrivateKey}
                          type="password"
                          autoComplete="off"
                          onChange={event => setFormValue(exchangeId, 'agentPrivateKey', event.target.value)}
                          placeholder={t('aiQuant.agentPrivateKey')}
                          className="h-9 w-full rounded-lg border border-[color:var(--cf-border)] bg-[color:var(--cf-surface)] px-2 text-sm"
                        />
                      </>
                    )}

                    {errors[exchangeId] && (
                      <p className="text-xs text-red-500">{errors[exchangeId]}</p>
                    )}

                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => void save(exchangeId)}
                        disabled={isSubmitting}
                        className="rounded-xl bg-gradient-to-r from-violet-500 to-purple-600 px-4 py-2 text-sm font-bold text-white transition-all hover:from-violet-600 hover:to-purple-700 disabled:opacity-60"
                      >
                        {isSubmitting
                          ? t('aiQuant.saving')
                          : account.isBound ? t('aiQuant.updateApiConfig') : t('aiQuant.saveApiConfig')}
                      </button>
                      {account.isBound && (
                        <button
                          type="button"
                          onClick={() => cancelEditing(exchangeId)}
                          disabled={isSubmitting}
                          className="rounded-xl border border-[color:var(--cf-border)] px-4 py-2 text-sm font-semibold text-[color:var(--cf-text-strong)]"
                        >
                          {t('aiQuant.cancelEdit')}
                        </button>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <div className="rounded-lg border border-[color:var(--cf-border)] bg-[color:var(--cf-surface)] p-3 text-xs text-[color:var(--cf-muted)]">
                      <p>{t('aiQuant.boundAccountName')} {account.name ?? '-'}</p>
                      <p className="mt-1">{t('aiQuant.currentKey')} {account.maskedCredential ?? '-'}</p>
                    </div>

                    {errors[exchangeId] && (
                      <p className="text-xs text-red-500">{errors[exchangeId]}</p>
                    )}

                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => startEditing(exchangeId)}
                        className="rounded-xl border border-[color:var(--cf-border)] px-4 py-2 text-sm font-semibold text-[color:var(--cf-text-strong)]"
                      >
                        {t('aiQuant.editApiConfig')}
                      </button>
                      <button
                        type="button"
                        onClick={() => void remove(exchangeId)}
                        disabled={isDeleting}
                        className="rounded-xl border border-red-500/30 px-4 py-2 text-sm font-semibold text-red-500 disabled:opacity-60"
                      >
                        {isDeleting ? t('aiQuant.deleting') : t('aiQuant.unbindApiConfig')}
                      </button>
                    </div>
                  </div>
                )}
              </article>
            )
          })}
        </div>
      )}

      <div className="rounded-xl border border-[color:var(--cf-border)] bg-[color:var(--cf-bg)] p-3">
        <p className="text-xs font-semibold text-[color:var(--cf-text-strong)]">{t('aiQuant.boundAccounts')}</p>
        <div className="mt-2 space-y-2">
          {boundExchangeIds.map(exchangeId => (
            <div key={exchangeId} className="flex items-center justify-between text-xs text-[color:var(--cf-muted)]">
              <span>{exchangeId === 'hyperliquid' ? 'Hyperliquid' : exchangeId.toUpperCase()} / {accounts[exchangeId].name ?? '-'}</span>
              <span>{accounts[exchangeId].maskedCredential}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
