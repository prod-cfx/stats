'use client'

import { Copy, LogOut, Send } from 'lucide-react'
import { useParams, useRouter } from 'next/navigation'
import React, { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Footer } from '@/components/layout/Footer'
import { Navbar } from '@/components/layout/Navbar'
import { useToast } from '@/components/ui/toast'
import { TelegramLoginButtons } from '@/features/auth/components/telegram-login-buttons'
import { useAuth } from '@/hooks/use-auth'

function maskEmail(email: string) {
  const [name, domain] = email.split('@')
  if (!name || !domain) return email
  if (name.length <= 2) return `${name[0]}*@${domain}`
  return `${name.slice(0, 2)}***@${domain}`
}

export default function AccountPage() {
  const router = useRouter()
  const params = useParams<{ lng: string }>()
  const lng = params?.lng === 'en' ? 'en' : 'zh'
  const { t } = useTranslation()
  const { success } = useToast()
  const { session, isLoading, sendEmailCode, bindEmail, logout } = useAuth()
  const [bindEmailValue, setBindEmailValue] = useState('')
  const [bindEmailCode, setBindEmailCode] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (!isLoading && !session) {
      router.replace(`/${lng}/auth/login`)
    }
  }, [isLoading, lng, router, session])

  const loginMethods = useMemo(() => new Set(session?.loginMethods || []), [session?.loginMethods])

  if (!session) {
    return null
  }

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

  return (
    <div className="flex min-h-screen flex-col bg-[color:var(--cf-bg)] text-[color:var(--cf-text)]">
      <Navbar />
      <main className="mx-auto flex w-full max-w-[920px] flex-1 flex-col gap-6 px-4 py-8 md:px-8">
        <h1 className="bg-gradient-to-r from-violet-500 to-fuchsia-500 bg-clip-text text-2xl font-bold text-transparent">{t('account.title')}</h1>

        <section className="space-y-4 rounded-2xl border border-[color:var(--cf-border)] bg-[color:var(--cf-surface)] p-5">
          <h2 className="text-lg font-semibold text-[color:var(--cf-text-strong)]">{t('account.loginMethods')}</h2>

          <div className="space-y-3 rounded-xl border border-[color:var(--cf-border)] bg-[color:var(--cf-bg)] p-4">
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-2 text-sm font-medium text-[color:var(--cf-text-strong)]">
                <Send className="h-4 w-4 text-violet-500 dark:text-violet-400" />
                {t('account.telegramLogin')}
              </div>
              {loginMethods.has('telegram') ? (
                <span className="rounded-lg border border-violet-500/30 bg-transparent px-3 py-1 text-xs font-semibold text-[color:var(--cf-text-strong)] dark:text-white">
                  {t('account.bound')}
                </span>
              ) : (
                <div className="w-[320px]">
                  <TelegramLoginButtons lng={lng} intent="bind" />
                </div>
              )}
            </div>

            <div className="flex items-center justify-between gap-4">
              <div className="text-sm text-[color:var(--cf-text)]">
                {session.email ? maskEmail(session.email) : t('account.notBound')}
              </div>
              {loginMethods.has('email') ? (
                <span className="rounded-lg border border-violet-500/30 bg-transparent px-3 py-1 text-xs font-semibold text-[color:var(--cf-text-strong)] dark:text-white">
                  {t('account.mainAccount')}
                </span>
              ) : (
                <div className="flex items-center gap-2">
                  <input
                    value={bindEmailValue}
                    onChange={event => setBindEmailValue(event.target.value)}
                    placeholder={t('account.inputEmail')}
                    className="h-8 w-[180px] rounded-lg border border-[color:var(--cf-border)] bg-[color:var(--cf-surface)] px-2 text-xs text-[color:var(--cf-text)] outline-none transition focus:border-violet-500"
                  />
                  <input
                    value={bindEmailCode}
                    onChange={event => setBindEmailCode(event.target.value.replace(/\D/g, '').slice(0, 6))}
                    placeholder={t('account.inputCode')}
                    className="h-8 w-[110px] rounded-lg border border-[color:var(--cf-border)] bg-[color:var(--cf-surface)] px-2 text-xs text-[color:var(--cf-text)] outline-none transition focus:border-violet-500"
                  />
                  <button
                    type="button"
                    onClick={onSendBindEmailCode}
                    disabled={busy || !bindEmailValue}
                    className="rounded-lg border border-violet-500/30 px-3 py-1 text-xs font-semibold text-[color:var(--cf-text-strong)] transition hover:bg-violet-500/5 disabled:opacity-50 dark:text-white"
                  >
                    {t('account.sendCode')}
                  </button>
                  <button
                    type="button"
                    onClick={onBindEmail}
                    disabled={busy || !bindEmailValue || bindEmailCode.length !== 6}
                    className="rounded-lg border border-violet-500/30 px-3 py-1 text-xs font-semibold text-[color:var(--cf-text-strong)] transition hover:bg-violet-500/5 disabled:opacity-50 dark:text-white"
                  >
                    {t('account.bindEmail')}
                  </button>
                </div>
              )}
            </div>
          </div>
        </section>

        <section className="space-y-4 rounded-2xl border border-[color:var(--cf-border)] bg-[color:var(--cf-surface)] p-5">
          <h2 className="text-lg font-semibold text-[color:var(--cf-text-strong)]">{t('account.accountInfo')}</h2>
          <div className="flex items-center justify-between rounded-xl border border-[color:var(--cf-border)] bg-[color:var(--cf-bg)] p-4">
            <div>
              <p className="text-xs text-[color:var(--cf-muted)]">{t('account.userId')}</p>
              <p className="mt-1 font-mono text-sm text-[color:var(--cf-text-strong)]">{session.userId}</p>
            </div>
            <button
              type="button"
              onClick={() => {
                navigator.clipboard.writeText(session.userId)
                success(t('account.userIdCopied'))
              }}
              className="rounded-lg border border-[color:var(--cf-border)] p-2 transition hover:bg-[color:var(--cf-surface-hover)] hover:text-violet-500"
            >
              <Copy className="h-4 w-4" />
            </button>
          </div>
        </section>

        <button
          type="button"
          onClick={() => {
            logout()
            router.replace(`/${lng}/auth/login`)
          }}
          className="inline-flex w-fit items-center gap-2 rounded-xl border border-[color:var(--cf-border)] px-4 py-2 text-sm font-semibold text-[color:var(--cf-text-strong)] transition hover:bg-red-500/10 hover:border-red-500/30 hover:text-red-500"
        >
          <LogOut className="h-4 w-4" />
          {t('account.logout')}
        </button>
      </main>
      <Footer />
    </div>
  )
}
