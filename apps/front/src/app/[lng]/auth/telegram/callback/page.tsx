'use client'

import { useParams, useRouter, useSearchParams } from 'next/navigation'
import React, { useEffect, useState } from 'react'
import { Footer } from '@/components/layout/Footer'
import { Navbar } from '@/components/layout/Navbar'
import { resolveTelegramCallbackPayload } from '@/features/auth/telegram-callback-params'
import { useAuth } from '@/hooks/use-auth'

export default function TelegramCallbackPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const params = useParams<{ lng: string }>()
  const lng = params?.lng === 'en' ? 'en' : 'zh'
  const {
    loginWithTelegramCallback,
    bindTelegram,
    getTelegramDesktopIntentStatus,
    loginWithTelegramDesktopIntent,
    bindTelegramByDesktopIntent,
    isAuthenticated,
    isLoading,
  } = useAuth()
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const query = typeof window === 'undefined'
      ? (searchParams ?? new URLSearchParams())
      : new URLSearchParams(window.location.search)
    const { source, intent, desktopIntentId, redirect, payload } = resolveTelegramCallbackPayload({
      query,
      hash: typeof window === 'undefined' ? '' : window.location.hash,
      lng,
    })

    if (source === 'desktop' && desktopIntentId) {
      let stopped = false
      let attempts = 0
      const maxAttempts = 60

      const finishDesktopFlow = async () => {
        if (intent === 'bind') {
          if (isLoading) return 'waiting'
          if (!isAuthenticated) {
            setError('当前未登录 Coinflux，无法绑定 Telegram')
            return 'failed'
          }
          await bindTelegramByDesktopIntent(desktopIntentId)
          router.replace(redirect)
          return 'done'
        }

        await loginWithTelegramDesktopIntent(desktopIntentId)
        router.replace(redirect)
        return 'done'
      }

      const tick = async () => {
        if (stopped) return
        attempts += 1

        try {
          const status = await getTelegramDesktopIntentStatus(desktopIntentId)
          if (status.status === 'confirmed') {
            const result = await finishDesktopFlow()
            if (result === 'waiting') {
              window.setTimeout(tick, 800)
            }
            return
          }
          if (status.status === 'expired') {
            setError('Telegram 授权已过期，请返回登录页重新发起')
            return
          }
          if (status.status !== 'pending') {
            setError('Telegram 授权状态异常，请返回登录页重试')
            return
          }

          if (attempts >= maxAttempts) {
            setError('等待 Telegram 授权超时，请返回登录页重试')
            return
          }
          window.setTimeout(tick, 2000)
        } catch (err) {
          setError(err instanceof Error ? err.message : 'Telegram 桌面登录失败')
        }
      }

      tick()
      return () => {
        stopped = true
      }
    }

    if (!payload.telegramId || !payload.authDate || !payload.hash) {
      setError('缺少 Telegram 授权参数，请先在 Telegram 中完成登录授权')
      return
    }

    if (intent === 'bind') {
      if (isLoading) return
      if (!isAuthenticated) {
        setError('当前未登录 Coinflux，无法绑定 Telegram')
        return
      }

      bindTelegram(payload)
        .then(() => {
          router.replace(redirect)
        })
        .catch(err => {
          setError(err instanceof Error ? err.message : 'Telegram 绑定失败')
        })
      return
    }

    loginWithTelegramCallback(payload)
      .then(() => {
        router.replace(redirect)
      })
      .catch(err => {
        setError(err instanceof Error ? err.message : 'Telegram 登录失败')
      })
  }, [
    bindTelegram,
    bindTelegramByDesktopIntent,
    getTelegramDesktopIntentStatus,
    isAuthenticated,
    isLoading,
    lng,
    loginWithTelegramCallback,
    loginWithTelegramDesktopIntent,
    router,
    searchParams,
  ])

  return (
    <div className="flex min-h-screen flex-col bg-[color:var(--cf-bg)] text-[color:var(--cf-text)]">
      <Navbar />
      <main className="flex flex-1 items-center justify-center px-4">
        <div className="w-full max-w-md rounded-2xl border border-[color:var(--cf-border)] bg-[color:var(--cf-surface)] p-6 text-center">
          {!error ? (
            <>
              <p className="text-lg font-semibold text-[color:var(--cf-text-strong)]">
                正在验证 Telegram 登录签名...
              </p>
              <p className="mt-2 text-sm text-[color:var(--cf-muted)]">请稍候，页面会自动跳转</p>
            </>
          ) : (
            <>
              <p className="text-lg font-semibold text-red-300">登录失败</p>
              <p className="mt-2 text-sm text-[color:var(--cf-muted)]">{error}</p>
              <button
                type="button"
                onClick={() => router.replace(`/${lng}/auth/login`)}
                className="mt-4 rounded-xl border border-[color:var(--cf-border)] px-4 py-2 text-sm"
              >
                返回登录页
              </button>
            </>
          )}
        </div>
      </main>
      <Footer />
    </div>
  )
}
