'use client'

import { Send } from 'lucide-react'
import React, { useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { API_BASE_URL } from '@/lib/api-client'
import { useAuth } from '@/hooks/use-auth'
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
  const [desktopBusy, setDesktopBusy] = useState(false)
  const [statusMessage, setStatusMessage] = useState<string | null>(null)
  const scriptHostRef = useRef<HTMLDivElement>(null)
  const { createTelegramDesktopIntent } = useAuth()

  const callbackUrl = useMemo(() => {
    if (typeof window === 'undefined') return ''
    return `${window.location.origin}/${lng}/auth/telegram/callback?source=web&intent=${intent}`
  }, [intent, lng])

  useEffect(() => {
    setShowDesktopEntry(canShowTelegramDesktopEntry())
    setShowWebAppEntry(isTelegramWebAppEnv())

    fetch(`${API_BASE_URL}/auth/telegram/login-config`)
      .then(res => res.json())
      .then(data => {
        const parsed = (data?.data || data) as TelegramConfigResponse
        const name = parsed.botName?.trim()
        setBotName(name || null)
        if (!name) {
          setStatusMessage(t('auth.configFailed'))
        } else {
          setStatusMessage(null)
        }
      })
      .catch(() => {
        setBotName(null)
        setStatusMessage(t('auth.configFailed'))
      })
  }, [])

  useEffect(() => {
    if (!botName || !callbackUrl || !scriptHostRef.current) return

    scriptHostRef.current.innerHTML = ''
    const script = document.createElement('script')
    script.async = true
    script.src = 'https://telegram.org/js/telegram-widget.js?22'
    script.setAttribute('data-telegram-login', botName)
    script.setAttribute('data-size', 'large')
    script.setAttribute('data-radius', '999')
    script.setAttribute('data-userpic', 'false')
    script.setAttribute('data-request-access', 'write')
    script.setAttribute('data-auth-url', callbackUrl)
    scriptHostRef.current.appendChild(script)
  }, [botName, callbackUrl])

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div
          className={`flex h-11 items-center justify-center rounded-full border border-violet-500/30 px-4 text-sm font-semibold text-[color:var(--cf-text-strong)] dark:text-white ${
            botName ? 'dark:bg-gray-200' : 'bg-transparent'
          }`}
        >
          {botName ? (
            <div ref={scriptHostRef} className="telegram-widget-host [&_iframe]:!h-8 [&_iframe]:!w-full" />
          ) : (
            <span>{t('auth.telegramWeb')}</span>
          )}
        </div>

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
            className="flex h-11 items-center justify-center gap-2 rounded-full border border-violet-500/30 bg-transparent px-4 text-sm font-semibold text-[color:var(--cf-text-strong)] transition hover:bg-violet-500/5 disabled:opacity-50 dark:text-white"
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

      {botName && (
        <p className="text-center text-xs text-[color:var(--cf-muted)]">
          {t('auth.botDomainInvalid')}
        </p>
      )}
    </div>
  )
}
