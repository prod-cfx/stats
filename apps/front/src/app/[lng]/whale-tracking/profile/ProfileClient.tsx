'use client'

import type {
  TraderDiscoverTagsResponse,
  TraderOpenOrdersResponse,
  TraderPositionsResponse,
  TraderSnapshotResponse,
  UserFillsResponse,
  UserPortfolioResponse,
} from '@/lib/api'
import React, { useCallback, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Footer } from '@/components/layout/Footer'
import { Navbar } from '@/components/layout/Navbar'
import { EmptyState, LoadingState } from '@/components/ui/loading'
import { PnLTrendCard } from '@/components/whale-tracking/profile/PnLTrendCard'
import { PositionProfile } from '@/components/whale-tracking/profile/PositionProfile'
import { ProfileDataTabs } from '@/components/whale-tracking/profile/ProfileDataTabs'
import { ProfileHeader } from '@/components/whale-tracking/profile/ProfileHeader'
import { ProfileSummary } from '@/components/whale-tracking/profile/ProfileSummary'
import { createWhaleNotificationRule } from '@/features/whale-notification/api/whale-notification-api'
import { CreateMonitorModal } from '@/features/whale-notification/components/CreateMonitorModal'
import { fetchTraderDiscoverTags, fetchTraderFullData } from '@/lib/api'
import { toast } from '@/lib/toast'

export function ProfileClient({ address }: { address: string }) {
  const { t } = useTranslation()
  // 完整的以太坊地址校验：0x 前缀 + 40 位十六进制
  const isValidAddress = address && /^0x[a-fA-F0-9]{40}$/.test(address)

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)
  const [snapshotData, setSnapshotData] = useState<TraderSnapshotResponse | null>(null)
  const [positionsData, setPositionsData] = useState<TraderPositionsResponse | null>(null)
  const [ordersData, setOrdersData] = useState<TraderOpenOrdersResponse | null>(null)
  const [portfolioData, setPortfolioData] = useState<UserPortfolioResponse | null>(null)
  const [fillsData, setFillsData] = useState<UserFillsResponse | null>(null)
  const [discoverTags, setDiscoverTags] = useState<TraderDiscoverTagsResponse | null>(null)
  const [isCreateAddressRuleOpen, setIsCreateAddressRuleOpen] = useState(false)

  const loadData = useCallback(
    async (options: { skipCache?: boolean } = {}) => {
      if (!isValidAddress) {
        setLoading(false)
        return
      }

      setLoading(true)
      setError(null)

      try {
        const [fullData, discoverResp] = await Promise.all([
          fetchTraderFullData(address),
          fetchTraderDiscoverTags(address, { skipCache: options.skipCache }),
        ])

        setSnapshotData(fullData.snapshot)
        setPositionsData(fullData.positions)
        setOrdersData(fullData.orders)
        setPortfolioData(fullData.portfolio)
        setFillsData(fullData.fills)
        setDiscoverTags(discoverResp)
      } catch (err) {
        setError(err instanceof Error ? err : new Error('Failed to load data'))
      } finally {
        setLoading(false)
      }
    },
    [address, isValidAddress],
  )

  useEffect(() => {
    loadData()
  }, [loadData])

  return (
    <div className="flex min-h-screen flex-col bg-[color:var(--cf-bg)] text-[color:var(--cf-text)]">
      <Navbar />

      <main className="no-scrollbar flex-1 overflow-y-auto p-4 md:p-8">
        <div className="mx-auto w-full max-w-[1440px]">
          <LoadingState
            isLoading={loading}
            error={!!error}
            isEmpty={!loading && (!isValidAddress || !snapshotData)}
            onRetry={loadData}
          >
            <div className="animate-in fade-in space-y-10 duration-500">
              {/* Header */}
              <ProfileHeader
                address={address}
                discoverTag={discoverTags?.tag ?? undefined}
                aiTags={discoverTags?.aiTags}
                onRefresh={() => loadData({ skipCache: true })}
                onFollow={() => setIsCreateAddressRuleOpen(true)}
              />

              {/* Summary Stats */}
              {snapshotData && fillsData && portfolioData && (
                <ProfileSummary
                  snapshot={snapshotData}
                  fills={fillsData}
                  portfolio={portfolioData}
                />
              )}

              {/* Middle Section: Position Profile + PnL Trend */}
              <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
                <div className="lg:col-span-4">
                  <PositionProfile />
                </div>
                <div className="lg:col-span-8">
                  {portfolioData && <PnLTrendCard portfolio={portfolioData} />}
                </div>
              </div>

              {/* Bottom Section: Tabs and Tables */}
              {positionsData && ordersData && (
                <ProfileDataTabs
                  address={address}
                  spotPositions={positionsData.spot}
                  perpPositions={positionsData.perp}
                  openOrders={ordersData.orders}
                  traderAddress={address}
                />
              )}
            </div>
          </LoadingState>

          {!loading && !isValidAddress && (
            <EmptyState
              title={t('whaleTracking.profile.invalidAddressTitle')}
              description={t('whaleTracking.profile.invalidAddressDescription')}
            />
          )}
        </div>
      </main>

      <CreateMonitorModal
        isOpen={isCreateAddressRuleOpen}
        mode="ADDRESS"
        presetAddress={address}
        onClose={() => setIsCreateAddressRuleOpen(false)}
        onCreate={async (payload) => {
          await createWhaleNotificationRule(payload)
          toast.success({ title: t('whaleTracking.notifications.toast.ruleCreated') })
        }}
      />
      <Footer />
    </div>
  )
}
