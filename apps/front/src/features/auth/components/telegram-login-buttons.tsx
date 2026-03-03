'use client'

import { Send } from 'lucide-react'
import React, { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { API_BASE_URL } from '@/lib/api-client'
import { useAuth } from '@/hooks/use-auth'
import { getTelegramWebAuthorizeUrlRequest } from '../api'
import { canShowTelegramDesktopEntry, isTelegramWebAppEnv } from '../telegram-env'

interface TelegramLoginButtonsProps {
  lng: 'zh' | 'en'
  intent?: 'login' | 'bind'
}

interface TelegramConfigResponse {
  botName?: string | null
}

export function TelegramLoginButtons({ lng, intent = 'login' }: TelegramLoginButtonsProps) {
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
        const res = await fetch(`${API_BASE_URL}/auth/telegram/login-config`)
        const data = await res.json()
        const parsed = (data?.data || data) as TelegramConfigResponse
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

  const buttonClassName = 'flex h-11 items-center justify-center gap-2 rounded-full border border-violet-500/30 bg-transparent px-4 text-sm font-semibold text-[color:var(--cf-text-strong)] transition hover:bg-violet-500/5 disabled:opacity-50 dark:text-white'
  const showBotDomainHint = Boolean(statusMessage && /bot domain invalid/i.test(statusMessage))

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
              const result = await getTelegramWebAuthorizeUrlRequest({ intent, lng })
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
                const result = await createTelegramDesktopIntent({
                  intent,
                  lng,
                })
                window.location.href = result.deepLink
                window.setTimeout(() => {
                  window.location.href = result.callbackUrl
                }, 350)
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
