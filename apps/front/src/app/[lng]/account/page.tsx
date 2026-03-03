'use client'

import { Copy, LogOut, Send } from 'lucide-react'
import { useParams, useRouter } from 'next/navigation'
import React, { useEffect, useMemo, useState } from 'react'
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
      success('邮箱已绑定')
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
      success('验证码已发送')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex min-h-screen flex-col bg-[color:var(--cf-bg)] text-[color:var(--cf-text)]">
      <Navbar />
      <main className="mx-auto flex w-full max-w-[920px] flex-1 flex-col gap-6 px-4 py-8 md:px-8">
        <h1 className="text-2xl font-bold text-[color:var(--cf-text-strong)]">个人中心</h1>

        <section className="space-y-4 rounded-2xl border border-[color:var(--cf-border)] bg-[color:var(--cf-surface)] p-5">
          <h2 className="text-lg font-semibold text-[color:var(--cf-text-strong)]">账户登录方式</h2>

          <div className="space-y-3 rounded-xl border border-[color:var(--cf-border)] bg-[color:var(--cf-bg)] p-4">
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-2 text-sm font-medium text-[color:var(--cf-text-strong)]">
                <Send className="h-4 w-4 text-cyan-300" />
                Telegram 登录
              </div>
              {loginMethods.has('telegram') ? (
                <span className="rounded-lg bg-emerald-500/15 px-3 py-1 text-xs font-semibold text-emerald-300">
                  已绑定
                </span>
              ) : (
                <div className="w-[320px]">
                  <TelegramLoginButtons lng={lng} intent="bind" />
                </div>
              )}
            </div>

            <div className="flex items-center justify-between gap-4">
              <div className="text-sm text-[color:var(--cf-text)]">
                {session.email ? maskEmail(session.email) : '未绑定邮箱'}
              </div>
              {loginMethods.has('email') ? (
                <span className="rounded-lg bg-emerald-500/15 px-3 py-1 text-xs font-semibold text-emerald-300">
                  主账户
                </span>
              ) : (
                <div className="flex items-center gap-2">
                  <input
                    value={bindEmailValue}
                    onChange={event => setBindEmailValue(event.target.value)}
                    placeholder="输入邮箱"
                    className="h-8 w-[180px] rounded-lg border border-[color:var(--cf-border)] bg-[color:var(--cf-surface)] px-2 text-xs"
                  />
                  <input
                    value={bindEmailCode}
                    onChange={event => setBindEmailCode(event.target.value.replace(/\D/g, '').slice(0, 6))}
                    placeholder="验证码"
                    className="h-8 w-[110px] rounded-lg border border-[color:var(--cf-border)] bg-[color:var(--cf-surface)] px-2 text-xs"
                  />
                  <button
                    type="button"
                    onClick={onSendBindEmailCode}
                    disabled={busy || !bindEmailValue}
                    className="rounded-lg border border-[color:var(--cf-border)] px-3 py-1 text-xs font-semibold"
                  >
                    发送验证码
                  </button>
                  <button
                    type="button"
                    onClick={onBindEmail}
                    disabled={busy || !bindEmailValue || bindEmailCode.length !== 6}
                    className="rounded-lg border border-[color:var(--cf-border)] px-3 py-1 text-xs font-semibold"
                  >
                    绑定邮箱
                  </button>
                </div>
              )}
            </div>
          </div>
        </section>

        <section className="space-y-4 rounded-2xl border border-[color:var(--cf-border)] bg-[color:var(--cf-surface)] p-5">
          <h2 className="text-lg font-semibold text-[color:var(--cf-text-strong)]">账户</h2>
          <div className="flex items-center justify-between rounded-xl border border-[color:var(--cf-border)] bg-[color:var(--cf-bg)] p-4">
            <div>
              <p className="text-xs text-[color:var(--cf-muted)]">UserId</p>
              <p className="mt-1 font-mono text-sm text-[color:var(--cf-text-strong)]">{session.userId}</p>
            </div>
            <button
              type="button"
              onClick={() => {
                navigator.clipboard.writeText(session.userId)
                success('UserId 已复制')
              }}
              className="rounded-lg border border-[color:var(--cf-border)] p-2"
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
          className="inline-flex w-fit items-center gap-2 rounded-xl border border-[color:var(--cf-border)] px-4 py-2 text-sm font-semibold text-[color:var(--cf-text-strong)]"
        >
          <LogOut className="h-4 w-4" />
          登出
        </button>
      </main>
      <Footer />
    </div>
  )
}
