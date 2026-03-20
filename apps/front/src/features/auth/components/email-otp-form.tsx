'use client'

import React, { useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  AUTH_CODE_COOLDOWN_SECONDS,
  getEmailOtpCooldownStorageKey,
  getRemainingCooldownSeconds,
  maskEmail,
  normalizeEmailForOtp,
  shouldResetEmailOtpFlow,
} from '@/features/auth/email-otp-state'
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
  const [sendingCode, setSendingCode] = useState(false)
  const [verifying, setVerifying] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [hasSentCode, setHasSentCode] = useState(false)
  const [lastSentEmail, setLastSentEmail] = useState('')
  const timerRef = useRef<number | null>(null)

  const normalizedEmail = useMemo(() => normalizeEmailForOtp(email), [email])
  const canSendCode = useMemo(() => cooldown <= 0 && !sendingCode && Boolean(normalizedEmail), [cooldown, normalizedEmail, sendingCode])

  const clearCooldownTimer = () => {
    if (timerRef.current !== null) {
      window.clearInterval(timerRef.current)
      timerRef.current = null
    }
  }

  const startCooldown = (targetEmail: string, durationSeconds = AUTH_CODE_COOLDOWN_SECONDS) => {
    clearCooldownTimer()
    setCooldown(durationSeconds)

    if (typeof window !== 'undefined') {
      const expiresAt = Date.now() + durationSeconds * 1000
      window.sessionStorage.setItem(getEmailOtpCooldownStorageKey(targetEmail), String(expiresAt))
    }

    timerRef.current = window.setInterval(() => {
      setCooldown(previous => {
        if (previous <= 1) {
          clearCooldownTimer()
          if (typeof window !== 'undefined') {
            window.sessionStorage.removeItem(getEmailOtpCooldownStorageKey(targetEmail))
          }
          return 0
        }
        return previous - 1
      })
    }, 1000)
  }

  useEffect(() => {
    if (typeof window === 'undefined' || !normalizedEmail) {
      return
    }

    const storageKey = getEmailOtpCooldownStorageKey(normalizedEmail)
    const rawExpiresAt = window.sessionStorage.getItem(storageKey)
    if (!rawExpiresAt) {
      return
    }

    const expiresAt = Number(rawExpiresAt)
    const remaining = getRemainingCooldownSeconds(expiresAt)
    if (remaining <= 0) {
      window.sessionStorage.removeItem(storageKey)
      return
    }

    setHasSentCode(true)
    setLastSentEmail(normalizedEmail)
    startCooldown(normalizedEmail, remaining)

    return clearCooldownTimer
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [normalizedEmail])

  useEffect(() => {
    return clearCooldownTimer
  }, [])

  const handleSendCode = async () => {
    setError(null)
    setSendingCode(true)
    try {
      const isResend = hasSentCode && lastSentEmail === normalizedEmail
      await sendEmailCode(normalizedEmail)
      setHasSentCode(true)
      setLastSentEmail(normalizedEmail)
      setCode('')
      setNotice(
        isResend
          ? t('auth.codeResentTo', { email: maskEmail(normalizedEmail) })
          : t('auth.codeSentTo', { email: maskEmail(normalizedEmail) }),
      )
      startCooldown(normalizedEmail)
    } catch (e) {
      const message = e instanceof Error ? e.message : ''
      if (message === 'DEV_EMAIL_FALLBACK_CODE_123456') {
        setNotice('开发环境邮件服务未配置，请使用测试验证码 123456 登录。')
        setHasSentCode(true)
        setLastSentEmail(normalizedEmail)
        setCode('')
        startCooldown(normalizedEmail)
        return
      }
      setError(message || t('auth.sendFailed'))
    } finally {
      setSendingCode(false)
    }
  }

  const handleLogin = async (event: React.FormEvent) => {
    event.preventDefault()
    setError(null)
    setNotice(null)
    setVerifying(true)

    try {
      await loginWithEmailCode(email, code)
      onSuccess()
    } catch (e) {
      setError(e instanceof Error ? e.message : t('auth.loginFailed'))
    } finally {
      setVerifying(false)
    }
  }

  const handleEmailChange = (nextEmail: string) => {
    if (shouldResetEmailOtpFlow(email, nextEmail)) {
      clearCooldownTimer()
      setCooldown(0)
      setCode('')
      setError(null)
      setNotice(null)
      setHasSentCode(false)
      setLastSentEmail('')
    }
    setEmail(nextEmail)
  }

  return (
    <form onSubmit={handleLogin} className="space-y-4">
      <div className="space-y-2">
        <label className="text-sm text-[color:var(--cf-muted)]">{t('auth.email')}</label>
        <input
          type="email"
          value={email}
          onChange={event => handleEmailChange(event.target.value)}
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
            disabled={!canSendCode}
            onClick={handleSendCode}
            className="h-11 min-w-[110px] rounded-xl border border-[color:var(--cf-border)] px-3 text-sm font-medium text-[color:var(--cf-text-strong)] disabled:opacity-50"
          >
            {sendingCode
              ? t('auth.sendingCode')
              : cooldown > 0
                ? t('auth.resendIn', { seconds: cooldown })
                : hasSentCode
                  ? t('auth.resendCode')
                  : t('auth.sendCode')}
          </button>
        </div>
        {hasSentCode && (
          <p className="text-xs text-[color:var(--cf-muted)]">
            {t('auth.latestCodeHint')}
          </p>
        )}
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
        disabled={verifying || code.length !== 6}
        className="h-11 w-full rounded-xl bg-gradient-to-r from-primary to-secondary text-sm font-semibold text-white disabled:opacity-50"
      >
        {verifying ? t('auth.loggingIn') : t('auth.loginWithEmail')}
      </button>
    </form>
  )
}
