'use client'

import { Copy, Eye, EyeOff, LogOut, Mail, Send } from 'lucide-react'
import { useRouter, useSearchParams } from 'next/navigation'
import React, { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { AiQuantSection } from '@/components/account/AiQuantSection'
import { ExchangeApiSection } from '@/components/account/ExchangeApiSection'
import { UserAvatar } from '@/components/account/UserAvatar'
import { useToast } from '@/components/ui/toast'
import { shouldSuppressAuthGate, suppressNextAuthGate } from '@/features/auth/auth-gate-suppression'
import { useAuthSheet } from '@/features/auth/AuthSheetProvider'
import { TelegramLoginButtons } from '@/features/auth/components/TelegramLoginButtons'
import { useAuth } from '@/hooks/use-auth'

function maskEmail(email: string) {
  const [name, domain] = email.split('@')
  if (!name || !domain) return email
  if (name.length <= 2) return `${name[0]}*@${domain}`
  return `${name.slice(0, 2)}***@${domain}`
}

function shortenUserId(userId: string) {
  if (userId.length <= 14) return userId
  return `${userId.slice(0, 5)}...${userId.slice(-6)}`
}

type AccountTab = 'settings' | 'ai-quant'

interface AccountPageClientProps {
  lng: 'zh' | 'en'
}

export function AccountPageClient({ lng }: AccountPageClientProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { t } = useTranslation()
  const { error, success } = useToast()
  const { session, isLoading, sendEmailCode, bindEmail, logout } = useAuth()
  const { openAuth } = useAuthSheet()
  const [bindEmailValue, setBindEmailValue] = useState('')
  const [bindEmailCode, setBindEmailCode] = useState('')
  const [busy, setBusy] = useState(false)
  const [showAccountEmail, setShowAccountEmail] = useState(false)
  const [telegramAvailability, setTelegramAvailability] = useState({
    webAvailable: false,
    desktopAvailable: false,
  })

  const searchParamString = searchParams?.toString() ?? ''
  const accountRedirect = useMemo(() => {
    return searchParamString ? `/${lng}/account?${searchParamString}` : `/${lng}/account`
  }, [lng, searchParamString])

  useEffect(() => {
    if (!isLoading && !session) {
      if (shouldSuppressAuthGate()) return
      openAuth({ lng, redirect: accountRedirect, closeRedirect: `/${lng}` })
    }
  }, [accountRedirect, isLoading, lng, openAuth, session])

  const loginMethods = useMemo(() => new Set(session?.loginMethods || []), [session?.loginMethods])
  const tabParam = searchParams?.get('tab')
  const currentTab: AccountTab = tabParam === 'ai-quant' ? 'ai-quant' : 'settings'

  if (!session) {
    return null
  }

  const accountName = session.email ? maskEmail(session.email) : session.telegram?.username ? `@${session.telegram.username}` : shortenUserId(session.userId)
  const visibleAccountName = session.email && showAccountEmail ? session.email : accountName
  const accountIdLabel = `id:${shortenUserId(session.userId)}`

  const onBindEmail = async () => {
    if (!bindEmailValue || bindEmailCode.length !== 6) return
    setBusy(true)
    try {
      await bindEmail(bindEmailValue, bindEmailCode)
      success(t('account.emailBound'))
      setBindEmailValue('')
      setBindEmailCode('')
    } catch (err) {
      error(err instanceof Error && err.message.trim() ? err.message : t('account.bindEmailFailed'))
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
    } catch (err) {
      error(err instanceof Error && err.message.trim() ? err.message : t('account.sendCodeFailed'))
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
    <main className="mx-auto flex w-full max-w-[1224px] flex-1 flex-col gap-6 px-4 py-6 md:px-8">
      <div className="mx-auto flex w-full max-w-[960px] gap-6 overflow-x-auto border-b border-[color:var(--cf-border)]">
        <button
          type="button"
          onClick={() => router.replace(`/${lng}/account?tab=settings`)}
          className={`shrink-0 border-b-2 px-0 pb-2.5 text-[13px] font-semibold transition ${
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
          className={`shrink-0 border-b-2 px-0 pb-2.5 text-[13px] font-semibold transition ${
            currentTab === 'ai-quant'
              ? 'border-[color:var(--cf-text-strong)] text-[color:var(--cf-text-strong)]'
              : 'border-transparent text-[color:var(--cf-muted)] hover:text-[color:var(--cf-text-strong)]'
          }`}
        >
          {t('aiQuant.title')}
        </button>
      </div>

      {currentTab === 'settings' && (
        <div className="mx-auto flex w-full max-w-[920px] flex-col gap-6">
          <section className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div className="flex min-w-0 items-center gap-4">
              <UserAvatar
                userId={session.userId}
                name={accountName}
                src={session.avatarUrl}
                size="lg"
                testId="account-local-avatar"
              />
              <div className="min-w-0">
                <div className="flex min-w-0 items-center gap-2">
                  <h1 className="truncate !text-base !font-semibold !leading-6 text-[color:var(--cf-text-strong)]">
                    {visibleAccountName}
                  </h1>
                  {session.email && (
                    <button
                      type="button"
                      aria-label={showAccountEmail
                        ? t('account.hideEmail', { defaultValue: '隐藏邮箱' })
                        : t('account.showEmail', { defaultValue: '显示完整邮箱' })}
                      title={showAccountEmail
                        ? t('account.hideEmail', { defaultValue: '隐藏邮箱' })
                        : t('account.showEmail', { defaultValue: '显示完整邮箱' })}
                      onClick={() => setShowAccountEmail(previous => !previous)}
                      className="inline-flex h-7 w-7 shrink-0 cursor-pointer items-center justify-center rounded-lg border border-[color:var(--cf-border)] text-[color:var(--cf-muted)] transition-colors duration-150 hover:border-primary/40 hover:bg-[color:var(--cf-surface-hover)] hover:text-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                    >
                      {showAccountEmail ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  )}
                </div>
                <div className="mt-1.5 flex items-center gap-2 text-xs text-[color:var(--cf-muted)]">
                  <span className="break-all font-mono">{accountIdLabel}</span>
                  <button
                    type="button"
                    aria-label={t('common.copy')}
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
                suppressNextAuthGate()
                logout()
                router.replace(`/${lng}`)
              }}
              className="inline-flex w-fit self-end items-center gap-2 rounded-full border border-[color:var(--cf-border)] px-4 py-2 text-xs font-semibold text-[color:var(--cf-text-strong)] transition hover:border-red-500/30 hover:bg-red-500/10 hover:text-red-500 md:self-auto"
            >
              <LogOut className="h-4 w-4" />
              {t('account.logout')}
            </button>
          </section>

          <section className="space-y-4">
            <h2 className="text-[15px] font-semibold text-[color:var(--cf-text-strong)]">{t('account.accountInfo')}</h2>
            <div className="overflow-hidden rounded-2xl border border-[color:var(--cf-border)] bg-[color:var(--cf-surface)]">
              <div className="flex min-h-[72px] flex-col gap-3 border-b border-[color:var(--cf-border)] px-5 py-4 md:flex-row md:items-center md:justify-between">
                <div className="flex min-w-0 items-start gap-3">
                  <span className="mt-0.5 inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-[color:var(--cf-border)] bg-[color:var(--cf-bg)] text-[color:var(--cf-muted)]">
                    <Mail className="h-4 w-4" />
                  </span>
                  <div className="min-w-0">
                    <p className="text-[13px] font-semibold text-[color:var(--cf-text-strong)]">{t('account.loginMethods')}</p>
                    <p className="mt-1 text-[13px] text-[color:var(--cf-muted)]">
                      {session.email ? maskEmail(session.email) : t('account.notBound')}
                    </p>
                  </div>
                </div>
                {loginMethods.has('email') ? (
                  <span className="inline-flex w-fit self-end rounded-full bg-[color:var(--cf-bg)] px-3.5 py-1.5 text-xs font-semibold text-[color:var(--cf-text-strong)] md:self-auto">
                    {t('account.mainAccount')}
                  </span>
                ) : (
                  <div className="flex flex-col items-end gap-2 sm:flex-row sm:items-center">
                    <input
                      value={bindEmailValue}
                      onChange={event => setBindEmailValue(event.target.value)}
                      placeholder={t('account.inputEmail')}
                      className="h-9 w-full rounded-lg border border-[color:var(--cf-border)] bg-[color:var(--cf-bg)] px-3 text-xs text-[color:var(--cf-text)] outline-none transition focus:border-violet-500 sm:w-[180px]"
                    />
                    <input
                      value={bindEmailCode}
                      onChange={event => setBindEmailCode(event.target.value.replace(/\D/g, '').slice(0, 6))}
                      placeholder={t('account.inputCode')}
                      className="h-9 w-full rounded-lg border border-[color:var(--cf-border)] bg-[color:var(--cf-bg)] px-3 text-xs text-[color:var(--cf-text)] outline-none transition focus:border-violet-500 sm:w-[110px]"
                    />
                    <button
                      type="button"
                      onClick={onSendBindEmailCode}
                      disabled={busy || !bindEmailValue}
                      className="rounded-full bg-[color:var(--cf-bg)] px-4 py-2 text-xs font-semibold text-[color:var(--cf-text-strong)] transition hover:bg-[color:var(--cf-surface-hover)] disabled:opacity-50"
                    >
                      {t('account.sendCode')}
                    </button>
                    <button
                      type="button"
                      onClick={onBindEmail}
                      disabled={busy || !bindEmailValue || bindEmailCode.length !== 6}
                      className="rounded-full bg-[color:var(--cf-bg)] px-4 py-2 text-xs font-semibold text-[color:var(--cf-text-strong)] transition hover:bg-[color:var(--cf-surface-hover)] disabled:opacity-50"
                    >
                      {t('account.bindEmail')}
                    </button>
                  </div>
                )}
              </div>

              <div className="flex min-h-[72px] flex-col gap-3 px-5 py-4 md:flex-row md:items-center md:justify-between">
                <div className="flex min-w-0 items-start gap-3">
                  <span className="mt-0.5 inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-[color:var(--cf-border)] bg-[color:var(--cf-bg)] text-sky-500">
                    <Send className="h-4 w-4" />
                  </span>
                  <div className="min-w-0">
                    <p className="text-[13px] font-semibold text-[color:var(--cf-text-strong)]">{t('account.telegramLogin')}</p>
                    <p className={`mt-1 text-[13px] ${telegramStatusClassName}`}>
                      {telegramStatusText}
                    </p>
                  </div>
                </div>
                <div className="flex w-full justify-end md:w-auto">
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
              <h2 className="text-[15px] font-semibold text-[color:var(--cf-text-strong)]">{t('aiQuant.apiConfigTitle')}</h2>
              <p className="mt-1.5 text-[13px] text-[color:var(--cf-muted)] opacity-80">{t('aiQuant.apiConfigDesc')}</p>
            </div>
            <ExchangeApiSection />
          </section>
        </div>
      )}

      {currentTab === 'ai-quant' && (
        <div className="mx-auto w-full max-w-[960px]">
          <AiQuantSection lng={lng} />
        </div>
      )}
    </main>
  )
}
