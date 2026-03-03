'use client'

import { Send } from 'lucide-react'
import React, { useEffect, useMemo, useRef, useState } from 'react'
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
          setStatusMessage('未配置 Telegram 登录机器人（请检查 TELEGRAM_BOT_TOKEN）')
        } else {
          setStatusMessage(null)
        }
      })
      .catch(() => {
        setBotName(null)
        setStatusMessage('获取 Telegram 配置失败，请稍后重试')
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
        <div className="flex h-11 items-center justify-center rounded-full border border-cyan-400 bg-cyan-500/5 px-4 text-sm font-semibold text-cyan-200">
          {botName ? (
            <div ref={scriptHostRef} className="telegram-widget-host [&_iframe]:!h-8 [&_iframe]:!w-full" />
          ) : (
            <span>Telegram 网页版（未配置）</span>
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
                setStatusMessage(error instanceof Error ? error.message : '无法拉起 Telegram 桌面应用')
              } finally {
                setDesktopBusy(false)
              }
            }}
            className="flex h-11 items-center justify-center gap-2 rounded-full border border-cyan-400 px-4 text-sm font-semibold text-cyan-300 transition hover:bg-cyan-500/10 disabled:opacity-50"
          >
            <Send className="h-4 w-4" />
            Telegram 桌面应用
          </button>
        )}
      </div>

      {showWebAppEntry && (
        <div className="rounded-xl border border-[color:var(--cf-border)] bg-[color:var(--cf-surface)] px-4 py-3 text-center text-sm font-semibold text-[color:var(--cf-text-strong)]">
          请在 Telegram 内使用机器人完成授权后返回
        </div>
      )}

      {statusMessage && (
        <div className="rounded-xl border border-[color:var(--cf-border)] bg-[color:var(--cf-surface)] px-4 py-3 text-center text-sm text-[color:var(--cf-text)]">
          {statusMessage}
        </div>
      )}

      {botName && (
        <p className="text-center text-xs text-[color:var(--cf-muted)]">
          若网页版出现 Bot domain invalid，请在 BotFather 使用 /setdomain 配置当前站点域名
        </p>
      )}
    </div>
  )
}
