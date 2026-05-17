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

function createBlankFormForExchange(exchangeId: UserExchangeId): ExchangeFormState {
  return {
    ...createEmptyFormState(),
    isTestnet: exchangeId === 'okx' && getOkxSaveRedirect() !== null,
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

export function ExchangeApiSection() {
  const { t } = useTranslation()
  const [accounts, setAccounts] = useState<Record<UserExchangeId, UserExchangeAccountStatus>>({
    binance: buildEmptyStatus('binance'),
    okx: buildEmptyStatus('okx'),
    hyperliquid: buildEmptyStatus('hyperliquid'),
  })
  const [forms, setForms] = useState<Record<UserExchangeId, ExchangeFormState>>(createInitialForms)
  const [configExchangeId, setConfigExchangeId] = useState<UserExchangeId | null>(null)
  const [deleteExchangeId, setDeleteExchangeId] = useState<UserExchangeId | null>(null)
  const [submittingExchange, setSubmittingExchange] = useState<UserExchangeId | null>(null)
  const [deletingExchange, setDeletingExchange] = useState<UserExchangeId | null>(null)
  const [errors, setErrors] = useState<Record<UserExchangeId, string | null>>({
    binance: null,
    okx: null,
    hyperliquid: null,
  })
  const [loading, setLoading] = useState(true)

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

  function openConfigDialog(exchangeId: UserExchangeId) {
    const account = accounts[exchangeId]
    setConfigExchangeId(exchangeId)
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

  function closeConfigDialog(exchangeId: UserExchangeId) {
    setConfigExchangeId(null)
    setForms(prev => ({
      ...prev,
      [exchangeId]: createBlankFormForExchange(exchangeId),
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
        [exchangeId]: createBlankFormForExchange(exchangeId),
      }))
      setConfigExchangeId(null)
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
        [exchangeId]: createBlankFormForExchange(exchangeId),
      }))
      setDeleteExchangeId(null)
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

  const configAccount = configExchangeId ? accounts[configExchangeId] : null
  const deleteAccount = deleteExchangeId ? accounts[deleteExchangeId] : null

  return (
    <>
      <div id="exchange-api">
        {loading ? (
          <div className="rounded-2xl border border-[color:var(--cf-border)] bg-[color:var(--cf-surface)] p-4 text-[13px] text-[color:var(--cf-muted)]">
            {t('aiQuant.loading')}
          </div>
        ) : (
          <div className="overflow-hidden rounded-2xl border border-[color:var(--cf-border)] bg-[color:var(--cf-surface)]">
            {EXCHANGES.map(exchangeId => {
              const account = accounts[exchangeId]
              const isDeleting = deletingExchange === exchangeId

              return (
                <article
                  key={exchangeId}
                  className="flex min-h-[72px] flex-col gap-3 border-b border-[color:var(--cf-border)] px-5 py-4 last:border-b-0 md:flex-row md:items-center md:justify-between"
                >
                  <div className="flex min-w-0 items-start gap-3">
                    <span className="mt-0.5 inline-flex h-7 w-7 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-[color:var(--cf-border)] bg-[color:var(--cf-bg)] p-1">
                      <img
                        src={`/images/exchanges/${exchangeId}.png`}
                        alt=""
                        className="h-full w-full object-contain"
                      />
                    </span>
                    <div className="min-w-0">
                      <p className="text-[13px] font-semibold text-[color:var(--cf-text-strong)]">{t(getTitleKey(exchangeId))}</p>
                      {account.isBound ? (
                        <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm leading-[22px]">
                          <span className="text-emerald-500">{t('aiQuant.configured')}</span>
                          <span className="text-[color:var(--cf-muted)]">
                            {t('aiQuant.currentKey')}{account.maskedCredential ?? '-'}
                          </span>
                          {account.lastValidatedAt && (
                            <span className="text-[color:var(--cf-muted)]">
                              {t('aiQuant.lastValidatedAt')} {new Date(account.lastValidatedAt).toLocaleString()}
                            </span>
                          )}
                        </div>
                      ) : (
                        <p className="mt-1 text-sm text-amber-500">{t('aiQuant.notConfigured')}</p>
                      )}
                      {errors[exchangeId] && configExchangeId !== exchangeId && (
                        <p className="mt-2 text-xs text-red-500">{errors[exchangeId]}</p>
                      )}
                    </div>
                  </div>

                  <div
                    data-testid={`exchange-api-actions-${exchangeId}`}
                    className="flex shrink-0 flex-wrap justify-end gap-2 md:justify-start"
                  >
                    {account.isBound ? (
                      <>
                        <button
                          type="button"
                          onClick={() => openConfigDialog(exchangeId)}
                          className="rounded-full border border-[color:var(--cf-border)] bg-[color:var(--cf-bg)] px-3.5 py-1.5 text-xs font-semibold leading-5 text-[color:var(--cf-text-strong)] transition hover:bg-[color:var(--cf-surface-hover)]"
                        >
                          {t('aiQuant.editApiConfig')}
                        </button>
                        <button
                          type="button"
                          onClick={() => setDeleteExchangeId(exchangeId)}
                          disabled={isDeleting}
                          className="rounded-full border border-red-500/30 px-3.5 py-1.5 text-xs font-semibold leading-5 text-red-500 transition hover:bg-red-500/10 disabled:opacity-60"
                        >
                          {isDeleting ? t('aiQuant.deleting') : t('aiQuant.unbindApiConfig')}
                        </button>
                      </>
                    ) : (
                      <button
                        type="button"
                        onClick={() => openConfigDialog(exchangeId)}
                        className="rounded-full border border-[color:var(--cf-border)] bg-[color:var(--cf-bg)] px-3.5 py-1.5 text-xs font-semibold leading-5 text-[color:var(--cf-text-strong)] transition hover:bg-[color:var(--cf-surface-hover)]"
                      >
                        {t('aiQuant.notConfigured')}
                      </button>
                    )}
                  </div>
                </article>
              )
            })}
          </div>
        )}
      </div>

      {configExchangeId && configAccount && (
        <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/50 px-4 py-4" onClick={() => closeConfigDialog(configExchangeId)}>
          <div
            className="max-h-[calc(100dvh-2rem)] w-full max-w-[480px] overflow-y-auto rounded-xl border border-[color:var(--cf-border)] bg-[color:var(--cf-surface)] p-4 shadow-2xl sm:p-5"
            role="dialog"
            aria-modal="true"
            onClick={event => event.stopPropagation()}
          >
            <h3 className="!text-[15px] !font-semibold !leading-[22px] text-[color:var(--cf-text-strong)]">{t(getTitleKey(configExchangeId))}</h3>
            <p className="mt-1 !text-sm !font-normal !leading-[22px] text-[color:var(--cf-muted)]">
              {configAccount.isBound ? t('aiQuant.editApiConfig') : t('aiQuant.saveApiConfig')}
            </p>
            <div className="mt-4 space-y-3">
              <input
                value={forms[configExchangeId].name}
                onChange={event => setFormValue(configExchangeId, 'name', event.target.value)}
                placeholder={t('aiQuant.accountName')}
                className="h-9 w-full rounded-lg border border-[color:var(--cf-border)] bg-[color:var(--cf-bg)] px-3 !text-sm !font-normal !leading-[22px] text-[color:var(--cf-text)] placeholder:text-[color:var(--cf-muted)]"
              />
              <label className="flex items-center gap-2 !text-sm !font-semibold !leading-[22px] text-[color:var(--cf-muted)]">
                <input
                  type="checkbox"
                  checked={forms[configExchangeId].isTestnet}
                  onChange={event => setForms(prev => ({
                    ...prev,
                    [configExchangeId]: {
                      ...prev[configExchangeId],
                      isTestnet: event.target.checked,
                    },
                  }))}
                  className="h-4 w-4 rounded border border-[color:var(--cf-border)]"
                />
                {t('aiQuant.useTestnet')}
              </label>
              {configExchangeId !== 'hyperliquid' && (
                <>
                  <input
                    value={forms[configExchangeId].apiKey}
                    onChange={event => setFormValue(configExchangeId, 'apiKey', event.target.value)}
                    placeholder={t('aiQuant.apiKey')}
                    className="h-9 w-full rounded-lg border border-[color:var(--cf-border)] bg-[color:var(--cf-bg)] px-3 !text-sm !font-normal !leading-[22px] text-[color:var(--cf-text)] placeholder:text-[color:var(--cf-muted)]"
                  />
                  <input
                    value={forms[configExchangeId].apiSecret}
                    type="password"
                    autoComplete="off"
                    onChange={event => setFormValue(configExchangeId, 'apiSecret', event.target.value)}
                    placeholder={t('aiQuant.secretKey')}
                    className="h-9 w-full rounded-lg border border-[color:var(--cf-border)] bg-[color:var(--cf-bg)] px-3 !text-sm !font-normal !leading-[22px] text-[color:var(--cf-text)] placeholder:text-[color:var(--cf-muted)]"
                  />
                </>
              )}
              {configExchangeId === 'okx' && (
                <input
                  value={forms[configExchangeId].passphrase}
                  type="password"
                  autoComplete="off"
                  onChange={event => setFormValue(configExchangeId, 'passphrase', event.target.value)}
                  placeholder={t('aiQuant.passphrase')}
                  className="h-9 w-full rounded-lg border border-[color:var(--cf-border)] bg-[color:var(--cf-bg)] px-3 !text-sm !font-normal !leading-[22px] text-[color:var(--cf-text)] placeholder:text-[color:var(--cf-muted)]"
                />
              )}
              {configExchangeId === 'hyperliquid' && (
                <>
                  <input
                    value={forms[configExchangeId].mainWalletAddress}
                    onChange={event => setFormValue(configExchangeId, 'mainWalletAddress', event.target.value)}
                    placeholder={t('aiQuant.walletAddress')}
                    className="h-9 w-full rounded-lg border border-[color:var(--cf-border)] bg-[color:var(--cf-bg)] px-3 !text-sm !font-normal !leading-[22px] text-[color:var(--cf-text)] placeholder:text-[color:var(--cf-muted)]"
                  />
                  <input
                    value={forms[configExchangeId].agentPrivateKey}
                    type="password"
                    autoComplete="off"
                    onChange={event => setFormValue(configExchangeId, 'agentPrivateKey', event.target.value)}
                    placeholder={t('aiQuant.agentPrivateKey')}
                    className="h-9 w-full rounded-lg border border-[color:var(--cf-border)] bg-[color:var(--cf-bg)] px-3 !text-sm !font-normal !leading-[22px] text-[color:var(--cf-text)] placeholder:text-[color:var(--cf-muted)]"
                  />
                </>
              )}

              {errors[configExchangeId] && (
                <p className="text-xs text-red-500">{errors[configExchangeId]}</p>
              )}
            </div>
            <div className="mt-5 flex flex-wrap justify-end gap-2">
              <button
                type="button"
                onClick={() => closeConfigDialog(configExchangeId)}
                disabled={submittingExchange === configExchangeId}
                className="inline-flex min-h-9 items-center justify-center rounded-full border border-[color:var(--cf-border)] px-3.5 py-1.5 !text-xs !font-semibold !leading-5 text-[color:var(--cf-text-strong)]"
              >
                {t('common.cancel')}
              </button>
              <button
                type="button"
                onClick={() => void save(configExchangeId)}
                disabled={submittingExchange === configExchangeId}
                className="inline-flex min-h-9 items-center justify-center rounded-full bg-gradient-to-r from-violet-500 to-purple-600 px-3.5 py-1.5 !text-xs !font-semibold !leading-5 text-white transition hover:from-violet-600 hover:to-purple-700 disabled:opacity-60"
              >
                {submittingExchange === configExchangeId
                  ? t('aiQuant.saving')
                  : configAccount.isBound ? t('aiQuant.updateApiConfig') : t('aiQuant.saveApiConfig')}
              </button>
            </div>
          </div>
        </div>
      )}

      {deleteExchangeId && deleteAccount && (
        <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/50 px-4 py-4" onClick={() => setDeleteExchangeId(null)}>
          <div
            className="w-full max-w-[380px] rounded-xl border border-[color:var(--cf-border)] bg-[color:var(--cf-surface)] p-4 shadow-2xl sm:p-5"
            role="dialog"
            aria-modal="true"
            onClick={event => event.stopPropagation()}
          >
            <h3 className="!text-[15px] !font-semibold !leading-[22px] text-[color:var(--cf-text-strong)]">{t('aiQuant.unbindApiConfig')}</h3>
            <p className="mt-2 !text-sm !font-normal !leading-[22px] text-[color:var(--cf-muted)]">
              {t(getTitleKey(deleteExchangeId))} / {deleteAccount.name ?? deleteAccount.maskedCredential ?? '-'}
            </p>
            {errors[deleteExchangeId] && (
              <p className="mt-3 text-xs text-red-500">{errors[deleteExchangeId]}</p>
            )}
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setDeleteExchangeId(null)}
                disabled={deletingExchange === deleteExchangeId}
                className="inline-flex min-h-9 items-center justify-center rounded-full border border-[color:var(--cf-border)] px-3.5 py-1.5 !text-xs !font-semibold !leading-5 text-[color:var(--cf-text-strong)]"
              >
                {t('common.cancel')}
              </button>
              <button
                type="button"
                onClick={() => void remove(deleteExchangeId)}
                disabled={deletingExchange === deleteExchangeId}
                className="inline-flex min-h-9 items-center justify-center rounded-full border border-red-500/30 px-3.5 py-1.5 !text-xs !font-semibold !leading-5 text-red-500 disabled:opacity-60"
              >
                {deletingExchange === deleteExchangeId ? t('aiQuant.deleting') : t('aiQuant.unbindApiConfig')}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
