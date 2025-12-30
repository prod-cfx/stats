'use client';

import React, { useState } from 'react';
import { Navbar } from '@/components/layout/Navbar';
import { DashboardSidebar } from '@/components/dashboard/DashboardSidebar';
import { ExploreDashboards } from '@/components/dashboard/ExploreDashboards';
import { Compass, Layout, Bookmark } from 'lucide-react';

type TabType = 'explore' | 'my' | 'saved';

export default function DashboardPage() {
  const [activeTab, setActiveTab] = useState<TabType>('explore');

  const tabs = [
    { id: 'explore', label: 'Explore Dashboards', icon: Compass },
    { id: 'my', label: 'My Dashboards', icon: Layout },
    { id: 'saved', label: 'Saved Dashboards', icon: Bookmark },
  ];

  return (
    <div className="flex flex-col h-screen w-screen bg-[#0d1117] text-white overflow-hidden">
      <Navbar />
      
      <main className="flex-1 flex min-h-0">
        {/* Sidebar */}
        <DashboardSidebar />

        {/* Content Area */}
        <div className="flex-1 flex flex-col min-h-0 overflow-y-auto no-scrollbar p-8">
          <div className="max-w-[1440px] mx-auto w-full flex flex-col gap-10">
            {/* Tabs */}
            <div className="flex items-center gap-2 border-b border-[#30363d]">
              {tabs.map((tab) => {
                const Icon = tab.icon;
                const isActive = activeTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id as TabType)}
                    className={`flex items-center gap-2 px-6 py-4 text-sm font-bold transition-all border-b-2 -mb-[2px] ${
                      isActive 
                        ? 'text-white border-[#3b82f6] bg-[#161b22]' 
                        : 'text-[#8b949e] border-transparent hover:text-white'
                    }`}
                  >
                    <Icon className={`w-4 h-4 ${isActive ? 'text-[#3b82f6]' : 'text-[#8b949e]'}`} />
                    <span>{tab.label}</span>
                  </button>
                );
              })}
            </div>

            {/* Tab Content */}
            {activeTab === 'explore' && <ExploreDashboards />}
            {activeTab === 'my' && (
              <div className="flex flex-col items-center justify-center py-20 text-[#8b949e] gap-4 border-2 border-dashed border-[#30363d] rounded-2xl">
                <Layout className="w-12 h-12" />
                <p className="text-lg font-medium">You don't have any dashboards yet.</p>
                <button className="text-white bg-[#2563eb] px-6 py-2 rounded-lg font-bold hover:bg-blue-700 transition-all">
                  Create Your First Dashboard
                </button>
              </div>
            )}
            {activeTab === 'saved' && (
              <div className="flex flex-col items-center justify-center py-20 text-[#8b949e] gap-4 border-2 border-dashed border-[#30363d] rounded-2xl">
                <Bookmark className="w-12 h-12" />
                <p className="text-lg font-medium">No saved dashboards yet.</p>
                <button className="text-white bg-[#161b22] border border-[#30363d] px-6 py-2 rounded-lg font-bold hover:text-white hover:border-[#3b82f6]/50 transition-all">
                  Explore Trending Dashboards
                </button>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}

