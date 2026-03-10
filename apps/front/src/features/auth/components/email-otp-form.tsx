'use client'

import React, { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useAuth } from '@/hooks/use-auth'

interface EmailOtpFormProps {
  onSuccess: () => void
}

export function EmailOtpForm({ onSuccess }: EmailOtpFormProps) {
  const { t } = useTranslation()
  const { sendEmailCode, loginWithEmailCode } = useAuth()
  const [email, setEmail] = useState('')
  const [code, setCode] = useState('')
  const [cooldown, setCooldown] = useState(0)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  const canSendCode = useMemo(() => cooldown <= 0 && !submitting, [cooldown, submitting])

  const startCooldown = () => {
    let remaining = 60
    setCooldown(remaining)

    const timer = window.setInterval(() => {
      remaining -= 1
      setCooldown(remaining)
      if (remaining <= 0) {
        window.clearInterval(timer)
      }
    }, 1000)
  }

  const handleSendCode = async () => {
    setError(null)
    setNotice(null)
    try {
      await sendEmailCode(email)
      startCooldown()
    } catch (e) {
      const message = e instanceof Error ? e.message : ''
      if (message === 'DEV_EMAIL_FALLBACK_CODE_123456') {
        setNotice('开发环境邮件服务未配置，请使用测试验证码 123456 登录。')
        startCooldown()
        return
      }
      setError(message || t('auth.sendFailed'))
    }
  }

  const handleLogin = async (event: React.FormEvent) => {
    event.preventDefault()
    setError(null)
    setNotice(null)
    setSubmitting(true)

    try {
      await loginWithEmailCode(email, code)
      onSuccess()
    } catch (e) {
      setError(e instanceof Error ? e.message : t('auth.loginFailed'))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleLogin} className="space-y-4">
      <div className="space-y-2">
        <label className="text-sm text-[color:var(--cf-muted)]">{t('auth.email')}</label>
        <input
          type="email"
          value={email}
          onChange={event => setEmail(event.target.value)}
          className="h-11 w-full rounded-xl border border-[color:var(--cf-border)] bg-[color:var(--cf-surface)] px-3 text-sm outline-none transition focus:border-primary"
          placeholder={t('auth.emailPlaceholder')}
          required
        />
      </div>

      <div className="space-y-2">
        <label className="text-sm text-[color:var(--cf-muted)]">{t('auth.code')}</label>
        <div className="flex gap-2">
          <input
            type="text"
            value={code}
            onChange={event => setCode(event.target.value.replace(/\D/g, '').slice(0, 6))}
            className="h-11 flex-1 rounded-xl border border-[color:var(--cf-border)] bg-[color:var(--cf-surface)] px-3 text-sm outline-none transition focus:border-primary"
            placeholder={t('auth.codePlaceholder')}
            required
          />
          <button
            type="button"
            disabled={!canSendCode || !email}
            onClick={handleSendCode}
            className="h-11 min-w-[110px] rounded-xl border border-[color:var(--cf-border)] px-3 text-sm font-medium text-[color:var(--cf-text-strong)] disabled:opacity-50"
          >
            {cooldown > 0 ? `${cooldown}s` : t('auth.sendCode')}
          </button>
        </div>
      </div>

      {error && (
        <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-300">
          {error}
        </div>
      )}
      {notice && (
        <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-300">
          {notice}
        </div>
      )}

      <button
        type="submit"
        disabled={submitting || code.length !== 6}
        className="h-11 w-full rounded-xl bg-gradient-to-r from-primary to-secondary text-sm font-semibold text-white disabled:opacity-50"
      >
        {submitting ? t('auth.loggingIn') : t('auth.loginWithEmail')}
      </button>
    </form>
  )
}
