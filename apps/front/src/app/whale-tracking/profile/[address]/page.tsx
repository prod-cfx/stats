'use client';

import React from 'react';
import { useParams } from 'next/navigation';
import Navbar from '@/components/layout/Navbar';
import { ProfileHeader } from '@/components/whale-tracking/profile/ProfileHeader';
import { ProfileSummary } from '@/components/whale-tracking/profile/ProfileSummary';
import { PositionProfile } from '@/components/whale-tracking/profile/PositionProfile';
import { PnLTrendCard } from '@/components/whale-tracking/profile/PnLTrendCard';
import { ProfileDataTabs } from '@/components/whale-tracking/profile/ProfileDataTabs';

export default function WhaleProfilePage() {
  const params = useParams();
  const address = params.address as string;

  return (
    <div className="flex flex-col min-h-screen bg-[#121212] text-white">
      <Navbar />
      
      <main className="flex-1 overflow-y-auto p-8 no-scrollbar">
        <div className="max-w-[1440px] mx-auto w-full space-y-10">
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
      </main>
    </div>
  );
}

