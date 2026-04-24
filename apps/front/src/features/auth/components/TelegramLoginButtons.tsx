'use client'

import { Send } from 'lucide-react'
import React, { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useAuth } from '@/hooks/use-auth'
import { getTelegramLoginConfigRequest, getTelegramWebAuthorizeUrlRequest } from '../api'
import { canShowTelegramDesktopEntry, isTelegramWebAppEnv } from '../telegram-env'

interface TelegramLoginButtonsProps {
  lng: 'zh' | 'en'
  intent?: 'login' | 'bind'
  redirect?: string
  betaCode?: string
}

interface TelegramConfigResponse {
  botName?: string | null
}

const TELEGRAM_WEB_BETA_CODE_KEY = 'auth:telegram:betaCode'

function getTelegramDesktopBetaCodeKey(intentId: string) {
  return `auth:telegram:desktop:${intentId}:betaCode`
}

export function TelegramLoginButtons({ lng, intent = 'login', redirect, betaCode }: TelegramLoginButtonsProps) {
  const { t } = useTranslation()
  const [showDesktopEntry, setShowDesktopEntry] = useState(false)
  const [showWebAppEntry, setShowWebAppEntry] = useState(false)
  const [botName, setBotName] = useState<string | null>(null)
  const [webBusy, setWebBusy] = useState(false)
  const [desktopBusy, setDesktopBusy] = useState(false)
  const [statusMessage, setStatusMessage] = useState<string | null>(null)
  const { createTelegramDesktopIntent } = useAuth()

  useEffect(() => {
    let isMounted = true

    setShowDesktopEntry(canShowTelegramDesktopEntry())
    setShowWebAppEntry(isTelegramWebAppEnv())

    const loadTelegramConfig = async () => {
      try {
        const parsed = await getTelegramLoginConfigRequest() as TelegramConfigResponse
        const name = parsed.botName?.trim()
        if (!isMounted) {
          return
        }
        // login-config 仅用于 Desktop 按钮可见性，Web 登录以点击时 authorize-url 结果为准。
        setBotName(name || null)
      } catch {
        if (!isMounted) {
          return
        }
        setBotName(null)
      }
    }

    void loadTelegramConfig()

    return () => {
      isMounted = false
    }
  }, [])

  const buttonClassName = 'flex h-11 items-center justify-center gap-2 rounded-full border border-violet-500/30 bg-transparent px-4 text-sm font-semibold text-black transition hover:bg-violet-500/5 disabled:opacity-50 dark:text-white'
  const showBotDomainHint = Boolean(statusMessage && /bot domain invalid/i.test(statusMessage))
  const requireBetaCode = () => {
    if (intent !== 'login' || betaCode?.trim()) {
      return false
    }
    setStatusMessage(t('auth.betaCodeRequired'))
    return true
  }

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <button
          type="button"
          disabled={webBusy}
          onClick={async () => {
            try {
              setWebBusy(true)
              setStatusMessage(null)
              if (requireBetaCode()) {
                return
              }
              const result = await getTelegramWebAuthorizeUrlRequest({ intent, lng, redirect })
              if (intent === 'login' && typeof window !== 'undefined' && betaCode) {
                window.sessionStorage.setItem(TELEGRAM_WEB_BETA_CODE_KEY, betaCode)
              }
              window.location.href = result.authorizeUrl
            } catch (error) {
              setStatusMessage(error instanceof Error ? error.message : t('auth.launchFailed'))
            } finally {
              setWebBusy(false)
            }
          }}
          className={buttonClassName}
        >
          {t('auth.telegramWeb')}
        </button>

        {showDesktopEntry && botName && (
          <button
            type="button"
            disabled={desktopBusy}
            onClick={async () => {
              try {
                setDesktopBusy(true)
                setStatusMessage(null)
                if (requireBetaCode()) {
                  return
                }
                const result = await createTelegramDesktopIntent({
                  intent,
                  lng,
                  redirect,
                })
                if (intent === 'login' && typeof window !== 'undefined' && betaCode) {
                  window.sessionStorage.setItem(getTelegramDesktopBetaCodeKey(result.intentId), betaCode)
                }
                const launchLink = result.deepLink?.trim() || result.webLink?.trim()
                if (!launchLink) {
                  throw new Error('Telegram launch link is missing. Please try again.')
                }
                // Only launch Telegram app here. The actual login callback should be opened
                // from Telegram bot message after user confirmation.
                window.location.assign(launchLink)
              } catch (error) {
                setStatusMessage(error instanceof Error ? error.message : t('auth.launchFailed'))
              } finally {
                setDesktopBusy(false)
              }
            }}
            className={buttonClassName}
          >
            <Send className="h-4 w-4 text-violet-500 dark:text-violet-400" />
            {t('auth.telegramDesktop')}
          </button>
        )}
      </div>

      {showWebAppEntry && (
        <div className="rounded-xl border border-[color:var(--cf-border)] bg-[color:var(--cf-surface)] px-4 py-3 text-center text-sm font-semibold text-[color:var(--cf-text-strong)]">
          {t('auth.telegramWebAppDesc')}
        </div>
      )}

      {statusMessage && (
        <div className="rounded-xl border border-[color:var(--cf-border)] bg-[color:var(--cf-surface)] px-4 py-3 text-center text-sm text-[color:var(--cf-text)]">
          {statusMessage}
        </div>
      )}

      {showBotDomainHint && (
        <p className="text-center text-xs text-[color:var(--cf-muted)]">
          {t('auth.botDomainInvalid')}
        </p>
      )}
    </div>
  )
}
