'use client';

import { Bookmark, Compass, Layout } from 'lucide-react';
import React, { useState } from 'react';
import { DashboardSidebar } from '@/components/dashboard/DashboardSidebar';
import { ExploreDashboards } from '@/components/dashboard/ExploreDashboards';
import { Navbar } from '@/components/layout/Navbar';

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
      
      <main className="flex-1 overflow-y-auto no-scrollbar p-8">
        <div className="max-w-[1440px] mx-auto w-full flex min-h-0 gap-8">
          {/* Sidebar */}
          <div className="flex-none">
            <DashboardSidebar />
          </div>

          {/* Content Area */}
          <div className="flex-1 flex flex-col min-h-0">
            <div className="flex flex-col gap-10">
            <div className="flex items-center gap-2 border-b border-[#30363d]">
              {tabs.map((tab) => {
                const Icon = tab.icon;
                const isActive = activeTab === tab.id;
                return (
                  <button
                    type="button"
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id as TabType)}
                    className={`flex items-center gap-2 px-6 py-4 text-sm font-bold transition-all relative -mb-[px] ${
                      isActive 
                        ? 'text-white bg-white/5' 
                        : 'text-[#8b949e] border-transparent hover:text-white'
                    }`}
                  >
                    <Icon className={`w-4 h-4 ${isActive ? 'text-primary' : 'text-[#8b949e]'}`} />
                    <span>{tab.label}</span>
                    {isActive && (
                      <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-gradient-to-r from-primary to-secondary" />
                    )}
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
                <button 
                  type="button"
                  className="text-white bg-gradient-to-r from-primary to-secondary px-6 py-2 rounded-lg font-bold hover:opacity-90 transition-all shadow-lg shadow-primary/20"
                >
                  Create Your First Dashboard
                </button>
              </div>
            )}
            {activeTab === 'saved' && (
              <div className="flex flex-col items-center justify-center py-20 text-[#8b949e] gap-4 border-2 border-dashed border-[#30363d] rounded-2xl">
                <Bookmark className="w-12 h-12" />
                <p className="text-lg font-medium">No saved dashboards yet.</p>
                <button 
                  type="button"
                  className="text-white bg-[#161b22] border border-[#30363d] px-6 py-2 rounded-lg font-bold hover:text-white hover:border-primary/50 transition-all"
                >
                  Explore Trending Dashboards
                </button>
              </div>
            )}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

