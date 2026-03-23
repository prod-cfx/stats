export const AUTH_CODE_COOLDOWN_SECONDS = 60

export function normalizeEmailForOtp(email: string): string {
  return email.trim().toLowerCase()
}

export function shouldResetEmailOtpFlow(previousEmail: string, nextEmail: string): boolean {
  const previous = normalizeEmailForOtp(previousEmail)
  const next = normalizeEmailForOtp(nextEmail)

  if (!previous || !next) {
    return previous !== next
  }

  return previous !== next
}

export function maskEmail(email: string): string {
  const normalized = normalizeEmailForOtp(email)
  const [localPart, domain] = normalized.split('@')
  if (!localPart || !domain) {
    return normalized
  }

  return `${localPart.slice(0, 2)}***@${domain}`
}

export function buildSendCodeNotice(options: { email: string; isResend: boolean }): string {
  const maskedEmail = maskEmail(options.email)
  if (options.isResend) {
    return `新验证码已发送至 ${maskedEmail}，之前的验证码已失效。`
  }

  return `验证码已发送至 ${maskedEmail}，请使用最新验证码完成登录。`
}

export function formatSendCodeButtonLabel(options: {
  cooldownRemaining: number
  hasSentCode: boolean
  isSending: boolean
}): string {
  if (options.isSending) {
    return '发送中...'
  }

  if (options.cooldownRemaining > 0) {
    return `${options.cooldownRemaining}s 后重发`
  }

  return options.hasSentCode ? '重新发送' : '发送验证码'
}

export function getRemainingCooldownSeconds(expiresAt: number, now = Date.now()): number {
  const remainingMs = expiresAt - now
  if (remainingMs <= 0) {
    return 0
  }

  return Math.ceil(remainingMs / 1000)
}

export function getEmailOtpCooldownStorageKey(email: string): string {
  return `auth.emailOtp.cooldown.${normalizeEmailForOtp(email)}`
}
