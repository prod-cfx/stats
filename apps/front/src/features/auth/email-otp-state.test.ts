import { describe, expect, it } from '@jest/globals'

import {
  AUTH_CODE_COOLDOWN_SECONDS,
  buildSendCodeNotice,
  formatSendCodeButtonLabel,
  getRemainingCooldownSeconds,
  shouldResetEmailOtpFlow,
} from './email-otp-state'

describe('email otp state helpers', () => {
  it('should format first send button label', () => {
    expect(formatSendCodeButtonLabel({ cooldownRemaining: 0, hasSentCode: false, isSending: false })).toBe('发送验证码')
  })

  it('should format resend countdown label after code has been sent', () => {
    expect(
      formatSendCodeButtonLabel({
        cooldownRemaining: AUTH_CODE_COOLDOWN_SECONDS,
        hasSentCode: true,
        isSending: false,
      }),
    ).toBe(`60s 后重发`)
  })

  it('should describe resend success and invalidate old codes', () => {
    expect(buildSendCodeNotice({ email: 'alpha@example.com', isResend: true })).toBe(
      '新验证码已发送至 al***@example.com，之前的验证码已失效。',
    )
  })

  it('should reset otp flow when email changes', () => {
    expect(shouldResetEmailOtpFlow('alpha@example.com', 'beta@example.com')).toBe(true)
  })

  it('should keep current flow when normalized email stays the same', () => {
    expect(shouldResetEmailOtpFlow('Alpha@example.com ', ' alpha@example.com')).toBe(false)
  })

  it('should clamp cooldown seconds to zero when expired', () => {
    expect(getRemainingCooldownSeconds(Date.now() - 1_000)).toBe(0)
  })
})
