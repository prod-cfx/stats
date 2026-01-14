'use client';

import type {TraderOpenOrdersResponse, TraderPositionsResponse, TraderSnapshotResponse} from '@/lib/api';
 import React, { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Footer } from '@/components/layout/Footer';
import { Navbar } from '@/components/layout/Navbar';
import { EmptyState, LoadingState } from '@/components/ui/loading';
import { PnLTrendCard } from '@/components/whale-tracking/profile/PnLTrendCard';
import { PositionProfile } from '@/components/whale-tracking/profile/PositionProfile';
import { ProfileDataTabs } from '@/components/whale-tracking/profile/ProfileDataTabs';
import { ProfileHeader } from '@/components/whale-tracking/profile/ProfileHeader';
import { ProfileSummary } from '@/components/whale-tracking/profile/ProfileSummary';
import {
  fetchTraderOpenOrders,
  fetchTraderPositions,
  fetchTraderSnapshot
  
  
  
} from '@/lib/api';

export function ProfileClient({ address }: { address: string }) {
  const { t } = useTranslation();
  const isValidAddress = address && address.startsWith('0x');

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [snapshotData, setSnapshotData] = useState<TraderSnapshotResponse | null>(null);
  const [positionsData, setPositionsData] = useState<TraderPositionsResponse | null>(null);
  const [ordersData, setOrdersData] = useState<TraderOpenOrdersResponse | null>(null);

  const loadData = useCallback(async () => {
    if (!isValidAddress) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const [snapshot, positions, orders] = await Promise.all([
        fetchTraderSnapshot(address),
        fetchTraderPositions(address, { type: 'all' }),
        fetchTraderOpenOrders(address),
      ]);

      setSnapshotData(snapshot);
      setPositionsData(positions);
      setOrdersData(orders);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to load data'));
    } finally {
      setLoading(false);
    }
  }, [address, isValidAddress]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  return (
    <div className="flex flex-col min-h-screen bg-[#0d1117] text-white">
      <Navbar />

      <main className="flex-1 overflow-y-auto p-4 md:p-8 no-scrollbar">
        <div className="max-w-[1440px] mx-auto w-full">
          <LoadingState
            isLoading={loading}
            error={error}
            isEmpty={!loading && (!isValidAddress || !snapshotData)}
            onRetry={loadData}
          >
            <div className="space-y-10 animate-in fade-in duration-500">
              {/* Header */}
              <ProfileHeader address={address} />

              {/* Summary Stats */}
              {snapshotData && <ProfileSummary snapshot={snapshotData} />}

              {/* Middle Section: Position Profile + PnL Trend */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                <div className="lg:col-span-4">
                  <PositionProfile />
                </div>
                <div className="lg:col-span-8">
                  <PnLTrendCard />
                </div>
              </div>

              {/* Bottom Section: Tabs and Tables */}
              {positionsData && ordersData && (
                <ProfileDataTabs
                  spotPositions={positionsData.spot}
                  perpPositions={positionsData.perp}
                  openOrders={ordersData.orders}
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
      <Footer />
    </div>
  );
}
