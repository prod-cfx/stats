'use client'

import { Check, Copy, RefreshCw } from 'lucide-react'
import React, { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { PageTitle } from '@/components/ui/Typography'

interface ProfileHeaderProps {
  address: string
  discoverTag?: string
  aiTags?: {
    key: 'bullWarGod' | 'swingKing' | 'smartTrader' | 'treasuryKeeper' | 'twitterKol'
    color: string
    bgColor: string
    descriptionKey?: 'bullWarGod' | 'swingKing' | 'smartTrader' | 'treasuryKeeper' | 'twitterKol'
  }[]
  onRefresh?: () => void
}

export const ProfileHeader = ({ address, discoverTag, aiTags, onRefresh }: ProfileHeaderProps) => {
  const { t } = useTranslation()
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [isCopied, setIsCopied] = useState(false)
  const refreshTimer = useRef<NodeJS.Timeout | null>(null)
  const copyTimer = useRef<NodeJS.Timeout | null>(null)

  // Cleanup timers on unmount
  useEffect(() => {
    return () => {
      if (refreshTimer.current) clearTimeout(refreshTimer.current)
      if (copyTimer.current) clearTimeout(copyTimer.current)
    }
  }, [])

  const formatAddress = (addr: string) =>
    `${addr.substring(0, 6)}...${addr.substring(addr.length - 4)}`

  const handleRefresh = () => {
    if (refreshTimer.current) clearTimeout(refreshTimer.current)
    setIsRefreshing(true)
    refreshTimer.current = setTimeout(() => setIsRefreshing(false), 1500)
    onRefresh?.()
  }

  const handleCopyAddress = async () => {
    try {
      if (copyTimer.current) clearTimeout(copyTimer.current)
      await navigator.clipboard.writeText(address)
      setIsCopied(true)
      copyTimer.current = setTimeout(() => setIsCopied(false), 2000)
    } catch (err) {
      console.error('Failed to copy address:', err)
    }
  }

  return (
    <div className="flex flex-col justify-between gap-6 md:flex-row md:items-center">
      <div className="flex flex-col gap-3">
        <div className="flex items-center gap-4">
          <div className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-full border border-[color:var(--cf-border)] bg-[color:var(--cf-surface-2)]">
            <img
              src={`https://api.dicebear.com/7.x/identicon/svg?seed=${address}`}
              alt="avatar"
              className="h-full w-full"
            />
          </div>
          <div className="flex items-center gap-3">
            <div className="group/address relative">
              <PageTitle className="cursor-default text-xl md:text-2xl">
                {formatAddress(address)}
              </PageTitle>
              {/* Hover-to-reveal full address tooltip */}
              <div className="pointer-events-none invisible absolute top-0 left-0 z-30 -translate-y-[120%] rounded-lg border border-black/10 bg-black/90 px-3 py-2 font-mono text-xs whitespace-nowrap text-white opacity-0 shadow-2xl transition-all duration-200 group-hover/address:visible group-hover/address:opacity-100 dark:border-white/10 dark:bg-white/90 dark:text-black">
                {address}
                <div className="absolute top-full left-8 -translate-x-1/2 border-8 border-transparent border-t-black/90 dark:border-t-white/90" />
              </div>
            </div>
            <button
              type="button"
              onClick={handleCopyAddress}
              className={`transition-colors ${isCopied ? 'text-green-400' : 'text-[color:var(--cf-muted)] hover:text-[color:var(--cf-text-strong)]'}`}
              title={t('whaleTracking.profile.header.copyAddress')}
            >
              {isCopied ? (
                <Check className="h-4 w-4 md:h-4.5 md:w-4.5" />
              ) : (
                <Copy className="h-4 w-4 md:h-4.5 md:w-4.5" />
              )}
            </button>
          </div>
        </div>

        <div className="flex flex-col gap-2">
          {(discoverTag || (aiTags && aiTags.length > 0)) && (
            <div className="flex flex-wrap items-center gap-2">
              {discoverTag && (
                <span className="md:text-caption rounded border border-[color:var(--cf-border)] bg-[color:var(--cf-surface-2)] px-2 py-0.5 text-[10px] font-bold tracking-tight text-[color:var(--cf-text-strong)]">
                  {discoverTag}
                </span>
              )}
              {aiTags?.map(tag => (
                <span
                  key={tag.key}
                  className="md:text-caption rounded px-2 py-0.5 text-[10px] font-bold tracking-tight"
                  style={{ color: tag.color, backgroundColor: tag.bgColor }}
                >
                  {t(`whaleTracking.discover.aiTags.${tag.key}`)}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={handleRefresh}
          disabled={isRefreshing}
          className={`md:text-label hover:from-primary hover:to-secondary group flex w-full items-center justify-center gap-2 rounded-xl border border-[color:var(--cf-border)] bg-[color:var(--cf-surface)] px-4 py-2 text-xs font-medium text-[color:var(--cf-text)] transition-all hover:border-transparent hover:bg-gradient-to-r active:scale-95 disabled:opacity-50 disabled:active:scale-100 md:w-auto ${isRefreshing ? 'from-primary to-secondary border-transparent bg-gradient-to-r' : ''}`}
        >
          <RefreshCw
            className={`h-4 w-4 text-[color:var(--cf-muted)] transition-all group-hover:text-white md:h-4.5 md:w-4.5 ${isRefreshing ? 'animate-spin text-white' : ''}`}
          />
          <span
            className={`md:text-body text-sm font-bold text-[color:var(--cf-text-strong)] transition-colors`}
          >
            {isRefreshing
              ? t('whaleTracking.profile.header.refreshing')
              : t('whaleTracking.profile.header.realtimeData')}
          </span>
        </button>
      </div>
    </div>
  )
}
