'use client';

import React from 'react';
import { useTranslation } from 'react-i18next';
import { Navbar } from '@/components/layout/Navbar';
import { Footer } from '@/components/layout/Footer';
import { EmptyState, LoadingState } from '@/components/ui/loading';
import { PnLTrendCard } from '@/components/whale-tracking/profile/PnLTrendCard';
import { PositionProfile } from '@/components/whale-tracking/profile/PositionProfile';
import { ProfileDataTabs } from '@/components/whale-tracking/profile/ProfileDataTabs';
import { ProfileHeader } from '@/components/whale-tracking/profile/ProfileHeader';
import { ProfileSummary } from '@/components/whale-tracking/profile/ProfileSummary';
import { useMockData } from '@/hooks/use-mock-data';

export function ProfileClient({ address }: { address: string }) {
  const { t } = useTranslation();
  // Check if address is valid or present
  const isValidAddress = address && address.startsWith('0x');

  // Use mock data to simulate loading of the entire profile
  const { data, loading, error, reload } = useMockData(
    async () => {
      if (!isValidAddress) return null;
      // Simulate fetching profile data
      return { address };
    },
    [address]
  );

  return (
    <div className="flex flex-col min-h-screen bg-[#0d1117] text-white">
      <Navbar />
      
      <main className="flex-1 overflow-y-auto p-4 md:p-8 no-scrollbar">
        <div className="max-w-[1440px] mx-auto w-full">
          <LoadingState 
            isLoading={loading} 
            error={error} 
            isEmpty={!loading && (!isValidAddress || !data)}
            onRetry={reload}
          >
            <div className="space-y-10 animate-in fade-in duration-500">
              {/* Header */}
              <ProfileHeader address={address} />

              {/* Summary Stats */}
              <ProfileSummary />

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
              <ProfileDataTabs />
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
