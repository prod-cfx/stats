'use client'

import { X } from 'lucide-react'
import React, { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { getTelegramLoginConfigRequest } from '@/features/auth/api'
import { EmailOtpForm } from '@/features/auth/components/EmailOtpForm'
import { TelegramLoginButtons } from '@/features/auth/components/TelegramLoginButtons'
import { useMobileKeyboardInset } from '@/hooks/useMobileKeyboardInset'

interface AuthSheetProps {
  open: boolean
  lng: 'zh' | 'en'
  redirect?: string
  onOpenChange: (open: boolean) => void
  onSuccess?: (redirect?: string) => void
  fallbackPage?: boolean
}

const FOCUSABLE_SELECTOR = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(',')

type InertElement = HTMLElement & { inert: boolean }

export function AuthSheet({
  open,
  lng,
  redirect,
  onOpenChange,
  onSuccess,
  fallbackPage = false,
}: AuthSheetProps) {
  const { t } = useTranslation()
  const [betaCode, setBetaCode] = useState('')
  const [betaCodeGateEnabled, setBetaCodeGateEnabled] = useState(false)
  const panelRef = useRef<HTMLDivElement | null>(null)
  const overlayRef = useRef<HTMLDivElement | null>(null)
  const closeButtonRef = useRef<HTMLButtonElement | null>(null)
  const previousFocusRef = useRef<HTMLElement | null>(null)
  const mobileKeyboard = useMobileKeyboardInset({ enabled: open && !fallbackPage })

  useEffect(() => {
    if (!open) {
      setBetaCode('')
    }
  }, [open])

  useEffect(() => {
    if (!open) return

    let mounted = true

    async function loadLoginConfig() {
      try {
        const config = await getTelegramLoginConfigRequest()
        if (mounted) setBetaCodeGateEnabled(Boolean(config.betaCodeGateEnabled))
      } catch {
        if (mounted) setBetaCodeGateEnabled(false)
      }
    }

    void loadLoginConfig()

    return () => {
      mounted = false
    }
  }, [open])

  useEffect(() => {
    if (!open || fallbackPage) return

    previousFocusRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null
    const panel = panelRef.current
    const overlay = overlayRef.current
    const inertSiblings: Array<{
      element: HTMLElement
      ariaHidden: string | null
      inert: boolean
    }> = []

    if (overlay?.parentElement) {
      Array.from(overlay.parentElement.children).forEach(child => {
        if (child === overlay || !(child instanceof HTMLElement)) return
        const element = child as InertElement
        inertSiblings.push({
          element,
          ariaHidden: element.getAttribute('aria-hidden'),
          inert: Boolean(element.inert),
        })
        element.setAttribute('aria-hidden', 'true')
        element.inert = true
      })
    }

    closeButtonRef.current?.focus()

    const getFocusableElements = () => {
      if (!panel) return []
      return Array.from(panel.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)).filter(element => {
        return !element.hasAttribute('disabled') && element.tabIndex !== -1
      })
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        onOpenChange(false)
        return
      }

      if (event.key !== 'Tab') return

      const focusableElements = getFocusableElements()
      if (focusableElements.length === 0) {
        event.preventDefault()
        panel?.focus()
        return
      }

      const currentIndex = focusableElements.indexOf(document.activeElement as HTMLElement)
      const nextIndex = event.shiftKey
        ? currentIndex <= 0 ? focusableElements.length - 1 : currentIndex - 1
        : currentIndex === -1 || currentIndex === focusableElements.length - 1 ? 0 : currentIndex + 1

      event.preventDefault()
      focusableElements[nextIndex]?.focus()
    }

    document.addEventListener('keydown', handleKeyDown)

    return () => {
      document.removeEventListener('keydown', handleKeyDown)
      inertSiblings.forEach(({ element, ariaHidden, inert }) => {
        if (ariaHidden === null) {
          element.removeAttribute('aria-hidden')
        } else {
          element.setAttribute('aria-hidden', ariaHidden)
        }
        element.inert = inert
      })
      previousFocusRef.current?.focus()
      previousFocusRef.current = null
    }
  }, [fallbackPage, onOpenChange, open])

  if (!open) return null

  const handleSuccess = () => {
    onSuccess?.(redirect)
  }

  const panel = (
    <div
      ref={panelRef}
      data-testid="auth-sheet-panel"
      role={fallbackPage ? 'region' : 'dialog'}
      aria-modal={fallbackPage ? undefined : true}
      aria-labelledby="auth-sheet-title"
      tabIndex={-1}
      className="cf-mobile-login-sheet relative z-10 w-full max-w-none translate-y-[calc(-1*var(--mobile-keyboard-inset))] space-y-4 rounded-t-[28px] border border-b-0 border-[color:var(--cf-border)] bg-[color:var(--cf-surface)] px-5 pt-5 pb-[calc(env(safe-area-inset-bottom)+1.25rem)] shadow-[0_-18px_48px_rgba(15,23,42,0.14)] transition-transform duration-150 md:max-w-[420px] md:translate-y-0 md:rounded-lg md:border md:px-6 md:py-5 md:shadow-sm"
      onBlur={mobileKeyboard.onBlur}
      onFocus={mobileKeyboard.onFocus}
      style={mobileKeyboard.style}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-1">
          <h2 id="auth-sheet-title" className="!text-base !font-semibold !leading-6 text-[color:var(--cf-text-strong)]">
            {t('nav.login')}
          </h2>
          <p className="!text-sm !font-normal !leading-[22px] text-[color:var(--cf-muted)]">
            {t('auth.loginDesc')}
          </p>
        </div>
        <button
          ref={closeButtonRef}
          type="button"
          data-testid="auth-sheet-close"
          onClick={() => onOpenChange(false)}
          className="-mr-2 inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-[color:var(--cf-text-strong)] transition hover:bg-[color:var(--cf-surface-hover)]"
          aria-label={t('common.close', { defaultValue: 'Close' })}
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      <EmailOtpForm
        betaCode={betaCode}
        betaCodeGateEnabled={betaCodeGateEnabled}
        onBetaCodeChange={setBetaCode}
        onSuccess={handleSuccess}
      />

      <div className="relative py-1 text-center !text-xs !font-normal !leading-5 text-[color:var(--cf-muted)]">
        <span className="px-2">{t('auth.or')}</span>
      </div>

      <TelegramLoginButtons lng={lng} redirect={redirect} betaCode={betaCodeGateEnabled ? betaCode : undefined} />
    </div>
  )

  if (fallbackPage) return panel

  return (
    <div ref={overlayRef} className="fixed inset-0 z-[90] flex items-end justify-center md:items-center">
      <button
        type="button"
        data-testid="auth-sheet-backdrop"
        className="fixed inset-0 bg-slate-950/45 backdrop-blur-[2px]"
        aria-label={t('common.close', { defaultValue: 'Close' })}
        onClick={() => onOpenChange(false)}
      />
      {panel}
    </div>
  )
}
