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
  betaCode: string
  betaCodeGateEnabled: boolean
  onBetaCodeChange: (betaCode: string) => void
  onSuccess: () => void
}

const EMAIL_OTP_ERROR_KEYS: Record<string, string> = {
  AUTH_VERIFICATION_CODE_INVALID: 'auth.emailOtpErrors.invalidCode',
  AUTH_VERIFICATION_CODE_EXPIRED: 'auth.emailOtpErrors.expiredCode',
  BAD_REQUEST: 'auth.emailOtpErrors.validationFailed',
  BETA_CODE_INVALID: 'auth.emailOtpErrors.betaCodeInvalid',
  BETA_CODE_EXHAUSTED: 'auth.emailOtpErrors.betaCodeUnavailable',
  BETA_CODE_DISABLED: 'auth.emailOtpErrors.betaCodeUnavailable',
  EMAIL_SEND_FAILED: 'auth.emailOtpErrors.emailSendFailed',
  INVALID_EMAIL: 'auth.emailOtpErrors.invalidEmail',
  TOO_MANY_REQUESTS: 'auth.emailOtpErrors.tooManyRequests',
  HTTP_429: 'auth.emailOtpErrors.tooManyRequests',
  VALIDATION_ERROR: 'auth.emailOtpErrors.validationFailed',
}

function isEmailOtpAddressValid(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
}

function getErrorCode(error: unknown): string | undefined {
  if (!error || typeof error !== 'object') {
    return undefined
  }

  const code = (error as { code?: unknown }).code
  if (typeof code === 'string' && code.trim()) {
    return code.trim()
  }

  const message = error instanceof Error ? error.message : ''
  if (/^(?:[A-Z][A-Z0-9_]*|HTTP_\d{3})$/.test(message)) {
    return message
  }

  return undefined
}

function getEmailOtpErrorMessage(
  error: unknown,
  betaCode: string,
  t: (key: string) => string,
  fallbackKey: string,
): string {
  const code = getErrorCode(error)
  if (code === 'BETA_CODE_REQUIRED' || (!betaCode.trim() && code === 'HTTP_400')) {
    return t('auth.betaCodeRequired')
  }
  const translationKey = code ? EMAIL_OTP_ERROR_KEYS[code] : undefined
  return translationKey ? t(translationKey) : t(fallbackKey)
}

export function EmailOtpForm({ betaCode, betaCodeGateEnabled, onBetaCodeChange, onSuccess }: EmailOtpFormProps) {
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
  const emailValid = useMemo(() => isEmailOtpAddressValid(normalizedEmail), [normalizedEmail])
  const canSendCode = useMemo(() => cooldown <= 0 && !sendingCode && emailValid, [cooldown, emailValid, sendingCode])

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
    if (!emailValid) {
      setError(t('auth.emailOtpErrors.invalidEmail'))
      return
    }
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
      setError(getEmailOtpErrorMessage(e, betaCode, t, 'auth.sendFailed'))
    } finally {
      setSendingCode(false)
    }
  }

  const handleLogin = async (event: React.FormEvent) => {
    event.preventDefault()
    setError(null)
    setNotice(null)

    if (!emailValid) {
      setError(t('auth.emailOtpErrors.invalidEmail'))
      return
    }

    if (!hasSentCode || lastSentEmail !== normalizedEmail) {
      setError(t('auth.emailOtpErrors.codeRequired'))
      return
    }

    if (code.length !== 6) {
      setError(t('auth.emailOtpErrors.codeInvalid'))
      return
    }

    if (betaCodeGateEnabled && !betaCode.trim()) {
      setError(t('auth.betaCodeRequired'))
      return
    }

    setVerifying(true)

    try {
      await loginWithEmailCode(normalizedEmail, code, betaCodeGateEnabled ? betaCode : undefined)
      onSuccess()
    } catch (e) {
      setError(getEmailOtpErrorMessage(e, betaCode, t, 'auth.loginFailed'))
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
        <label className="!text-sm !font-semibold !leading-[22px] text-[color:var(--cf-muted)]">{t('auth.email')}</label>
        <input
          type="email"
          value={email}
          onChange={event => handleEmailChange(event.target.value)}
          className="h-10 w-full rounded-full border border-[color:var(--cf-border)] bg-[color:var(--cf-surface)] px-3.5 !text-base !font-normal !leading-[22px] outline-none transition focus:border-primary md:!text-sm"
          placeholder={t('auth.emailPlaceholder')}
          required
        />
      </div>

      <div className="space-y-2">
        <label className="!text-sm !font-semibold !leading-[22px] text-[color:var(--cf-muted)]">{t('auth.code')}</label>
        <div className="flex gap-2">
          <input
            type="text"
            value={code}
            onChange={event => setCode(event.target.value.replace(/\D/g, '').slice(0, 6))}
            className="h-10 min-w-0 flex-1 rounded-full border border-[color:var(--cf-border)] bg-[color:var(--cf-surface)] px-3.5 !text-base !font-normal !leading-[22px] outline-none transition focus:border-primary md:!text-sm"
            placeholder={t('auth.codePlaceholder')}
            required
          />
          <button
            type="button"
            disabled={!canSendCode}
            onClick={handleSendCode}
            className="h-10 min-w-[112px] rounded-full border border-[color:var(--cf-border)] px-3 !text-xs !font-semibold !leading-5 text-[color:var(--cf-text-strong)] transition-colors hover:bg-[color:var(--cf-surface-hover)] disabled:opacity-50"
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
          <p className="!text-xs !font-normal !leading-5 text-[color:var(--cf-muted)]">
            {t('auth.latestCodeHint')}
          </p>
        )}
      </div>

      {betaCodeGateEnabled && (
        <div className="space-y-2">
          <label htmlFor="beta-code-input" className="!text-sm !font-semibold !leading-[22px] text-[color:var(--cf-muted)]">{t('auth.betaCode')}</label>
          <input
            id="beta-code-input"
            type="text"
            value={betaCode}
            onChange={event => onBetaCodeChange(event.target.value)}
            className="h-10 w-full rounded-full border border-[color:var(--cf-border)] bg-[color:var(--cf-surface)] px-3.5 !text-base !font-normal !leading-[22px] outline-none transition focus:border-primary md:!text-sm"
            placeholder={t('auth.betaCodePlaceholder')}
          />
          <p className="!text-xs !font-normal !leading-5 text-[color:var(--cf-muted)]">
            {t('auth.betaCodeHint')}
          </p>
        </div>
      )}

      {error && (
        <div className="rounded-2xl border border-red-500/30 bg-red-500/10 px-3 py-2 !text-sm !font-normal !leading-[22px] text-red-300">
          {error}
        </div>
      )}
      {notice && (
        <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 px-3 py-2 !text-sm !font-normal !leading-[22px] text-amber-300">
          {notice}
        </div>
      )}

      <button
        type="submit"
        disabled={verifying || code.length !== 6}
        className="h-10 w-full rounded-full bg-gradient-to-r from-primary to-secondary !text-xs !font-semibold !leading-5 text-white transition-opacity disabled:opacity-50"
      >
        {verifying ? t('auth.loggingIn') : t('auth.loginWithEmail')}
      </button>
    </form>
  )
}
