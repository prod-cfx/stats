'use client'

import { Copy, LogOut } from 'lucide-react'
import { useRouter, useSearchParams } from 'next/navigation'
import React, { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { AiQuantSection } from '@/components/account/AiQuantSection'
import { ExchangeApiSection } from '@/components/account/ExchangeApiSection'
import { useToast } from '@/components/ui/toast'
import { TelegramLoginButtons } from '@/features/auth/components/TelegramLoginButtons'
import { useAuth } from '@/hooks/use-auth'

function maskEmail(email: string) {
  const [name, domain] = email.split('@')
  if (!name || !domain) return email
  if (name.length <= 2) return `${name[0]}*@${domain}`
  return `${name.slice(0, 2)}***@${domain}`
}

function shortenUserId(userId: string) {
  if (userId.length <= 12) return userId
  return `${userId.slice(0, 6)}...${userId.slice(-4)}`
}

type AccountTab = 'settings' | 'ai-quant'

interface AccountPageClientProps {
  lng: 'zh' | 'en'
}

export function AccountPageClient({ lng }: AccountPageClientProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { t } = useTranslation()
  const { success } = useToast()
  const { session, isLoading, sendEmailCode, bindEmail, logout } = useAuth()
  const [bindEmailValue, setBindEmailValue] = useState('')
  const [bindEmailCode, setBindEmailCode] = useState('')
  const [busy, setBusy] = useState(false)
  const [telegramAvailability, setTelegramAvailability] = useState({
    webAvailable: false,
    desktopAvailable: false,
  })

  useEffect(() => {
    if (!isLoading && !session) {
      router.replace(`/${lng}/auth/login`)
    }
  }, [isLoading, lng, router, session])

  const loginMethods = useMemo(() => new Set(session?.loginMethods || []), [session?.loginMethods])
  const tabParam = searchParams?.get('tab')
  const currentTab: AccountTab = tabParam === 'ai-quant' ? 'ai-quant' : 'settings'

  if (!session) {
    return null
  }

  const accountName = session.email ? maskEmail(session.email) : session.telegram?.username ? `@${session.telegram.username}` : shortenUserId(session.userId)
  const accountAvatarSrc = `https://api.dicebear.com/7.x/identicon/svg?seed=${encodeURIComponent(session.userId)}`

  const onBindEmail = async () => {
    if (!bindEmailValue || bindEmailCode.length !== 6) return
    setBusy(true)
    try {
      await bindEmail(bindEmailValue, bindEmailCode)
      success(t('account.emailBound'))
      setBindEmailValue('')
      setBindEmailCode('')
    } finally {
      setBusy(false)
    }
  }

  const onSendBindEmailCode = async () => {
    if (!bindEmailValue) return
    setBusy(true)
    try {
      await sendEmailCode(bindEmailValue)
      success(t('account.codeSent'))
    } finally {
      setBusy(false)
    }
  }

  const telegramStatusText = telegramAvailability.webAvailable && telegramAvailability.desktopAvailable
    ? t('account.telegramAvailable')
    : telegramAvailability.webAvailable
      ? t('account.telegramWebAvailable')
      : telegramAvailability.desktopAvailable
        ? t('account.telegramDesktopAvailable')
        : t('account.telegramNotConfigured')
  const telegramStatusClassName = telegramAvailability.webAvailable || telegramAvailability.desktopAvailable
    ? 'text-emerald-500'
    : 'text-amber-500'

  return (
    <main className="mx-auto flex w-full max-w-[1224px] flex-1 flex-col gap-8 px-4 py-8 md:px-8">
      <div className="flex gap-8 overflow-x-auto border-b border-[color:var(--cf-border)]">
        <button
          type="button"
          onClick={() => router.replace(`/${lng}/account?tab=settings`)}
          className={`shrink-0 border-b-2 px-0 pb-3 text-sm font-semibold transition ${
            currentTab === 'settings'
              ? 'border-[color:var(--cf-text-strong)] text-[color:var(--cf-text-strong)]'
              : 'border-transparent text-[color:var(--cf-muted)] hover:text-[color:var(--cf-text-strong)]'
          }`}
        >
          {t('account.settings')}
        </button>
        <button
          type="button"
          onClick={() => router.replace(`/${lng}/account?tab=ai-quant`)}
          className={`shrink-0 border-b-2 px-0 pb-3 text-sm font-semibold transition ${
            currentTab === 'ai-quant'
              ? 'border-[color:var(--cf-text-strong)] text-[color:var(--cf-text-strong)]'
              : 'border-transparent text-[color:var(--cf-muted)] hover:text-[color:var(--cf-text-strong)]'
          }`}
        >
          {t('aiQuant.title')}
        </button>
      </div>

      {currentTab === 'settings' && (
        <div className="mx-auto flex w-full max-w-[920px] flex-col gap-8">
          <section className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div className="flex min-w-0 items-center gap-6">
              <div className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-full border border-[color:var(--cf-border)] bg-[color:var(--cf-surface)] p-2">
                <img
                  src={accountAvatarSrc}
                  alt=""
                  className="h-full w-full object-contain"
                />
              </div>
              <div className="min-w-0">
                <h1 className="truncate text-2xl font-bold text-[color:var(--cf-text-strong)]">
                  {t('account.title')}{lng === 'zh' ? '，' : ', '}{accountName}
                </h1>
                <div className="mt-2 flex items-center gap-2 text-sm text-[color:var(--cf-muted)]">
                  <span className="break-all font-mono">{session.userId}</span>
                  <button
                    type="button"
                    onClick={() => {
                      navigator.clipboard.writeText(session.userId)
                      success(t('account.userIdCopied'))
                    }}
                    className="rounded-md p-1 transition hover:bg-[color:var(--cf-surface-hover)] hover:text-violet-500"
                  >
                    <Copy className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={() => {
                logout()
                router.replace(`/${lng}/auth/login`)
              }}
              className="inline-flex w-fit items-center gap-2 rounded-full border border-[color:var(--cf-border)] px-5 py-2 text-sm font-semibold text-[color:var(--cf-text-strong)] transition hover:border-red-500/30 hover:bg-red-500/10 hover:text-red-500"
            >
              <LogOut className="h-4 w-4" />
              {t('account.logout')}
            </button>
          </section>

          <section className="space-y-4">
            <h2 className="text-lg font-semibold text-[color:var(--cf-text-strong)]">{t('account.accountInfo')}</h2>
            <div className="overflow-hidden rounded-2xl border border-[color:var(--cf-border)] bg-[color:var(--cf-surface)]">
              <div className="flex flex-col gap-4 border-b border-[color:var(--cf-border)] px-6 py-5 md:flex-row md:items-center md:justify-between">
                <div>
                  <p className="text-sm font-semibold text-[color:var(--cf-text-strong)]">{t('account.userId')}</p>
                  <p className="mt-1 break-all font-mono text-sm text-[color:var(--cf-muted)]">{session.userId}</p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    navigator.clipboard.writeText(session.userId)
                    success(t('account.userIdCopied'))
                  }}
                  className="inline-flex w-fit items-center gap-2 rounded-full bg-[color:var(--cf-bg)] px-4 py-2 text-sm font-semibold text-[color:var(--cf-text-strong)] transition hover:bg-[color:var(--cf-surface-hover)]"
                >
                  <Copy className="h-4 w-4" />
                  {t('common.copy')}
                </button>
              </div>

              <div className="flex flex-col gap-4 border-b border-[color:var(--cf-border)] px-6 py-5 md:flex-row md:items-center md:justify-between">
                <div>
                  <p className="text-sm font-semibold text-[color:var(--cf-text-strong)]">{t('account.loginMethods')}</p>
                  <p className="mt-1 text-sm text-[color:var(--cf-muted)]">
                    {session.email ? maskEmail(session.email) : t('account.notBound')}
                  </p>
                </div>
                {loginMethods.has('email') ? (
                  <span className="inline-flex w-fit rounded-full bg-[color:var(--cf-bg)] px-4 py-2 text-sm font-semibold text-[color:var(--cf-text-strong)]">
                    {t('account.mainAccount')}
                  </span>
                ) : (
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                    <input
                      value={bindEmailValue}
                      onChange={event => setBindEmailValue(event.target.value)}
                      placeholder={t('account.inputEmail')}
                      className="h-9 w-full rounded-lg border border-[color:var(--cf-border)] bg-[color:var(--cf-bg)] px-3 text-sm text-[color:var(--cf-text)] outline-none transition focus:border-violet-500 sm:w-[180px]"
                    />
                    <input
                      value={bindEmailCode}
                      onChange={event => setBindEmailCode(event.target.value.replace(/\D/g, '').slice(0, 6))}
                      placeholder={t('account.inputCode')}
                      className="h-9 w-full rounded-lg border border-[color:var(--cf-border)] bg-[color:var(--cf-bg)] px-3 text-sm text-[color:var(--cf-text)] outline-none transition focus:border-violet-500 sm:w-[110px]"
                    />
                    <button
                      type="button"
                      onClick={onSendBindEmailCode}
                      disabled={busy || !bindEmailValue}
                      className="rounded-full bg-[color:var(--cf-bg)] px-4 py-2 text-sm font-semibold text-[color:var(--cf-text-strong)] transition hover:bg-[color:var(--cf-surface-hover)] disabled:opacity-50"
                    >
                      {t('account.sendCode')}
                    </button>
                    <button
                      type="button"
                      onClick={onBindEmail}
                      disabled={busy || !bindEmailValue || bindEmailCode.length !== 6}
                      className="rounded-full bg-[color:var(--cf-bg)] px-4 py-2 text-sm font-semibold text-[color:var(--cf-text-strong)] transition hover:bg-[color:var(--cf-surface-hover)] disabled:opacity-50"
                    >
                      {t('account.bindEmail')}
                    </button>
                  </div>
                )}
              </div>

              <div className="flex flex-col gap-4 px-6 py-5 md:flex-row md:items-center md:justify-between">
                <div>
                  <p className="text-sm font-semibold text-[color:var(--cf-text-strong)]">{t('account.telegramLogin')}</p>
                  <p className={`mt-1 text-sm ${telegramStatusClassName}`}>
                    {telegramStatusText}
                  </p>
                </div>
                <div className="w-full md:w-auto">
                  <TelegramLoginButtons
                    lng={lng}
                    intent="bind"
                    variant="compact"
                    onAvailabilityChange={setTelegramAvailability}
                  />
                </div>
              </div>
            </div>
          </section>

          <section className="space-y-4">
            <div>
              <h2 className="text-lg font-semibold text-[color:var(--cf-text-strong)]">{t('aiQuant.apiConfigTitle')}</h2>
              <p className="mt-2 text-sm text-[color:var(--cf-muted)]">{t('aiQuant.apiConfigDesc')}</p>
            </div>
            <ExchangeApiSection />
          </section>
        </div>
      )}

      {currentTab === 'ai-quant' && (
        <div className="mx-auto w-full max-w-[920px]">
          <AiQuantSection lng={lng} />
        </div>
      )}
    </main>
  )
}
