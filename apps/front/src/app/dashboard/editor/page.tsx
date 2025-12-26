'use client';

import React, { useState } from 'react';
import { Navbar } from '@/components/layout/Navbar';
import { DashboardEditorSidebar } from '@/components/dashboard/DashboardEditorSidebar';
import { EditorCanvas } from '@/components/dashboard/EditorCanvas';
import { Compass, Layout, Bookmark } from 'lucide-react';

type TabType = 'explore' | 'my' | 'saved';

export default function DashboardEditorPage() {
  const [activeTab, setActiveTab] = useState<TabType>('explore');

  const tabs = [
    { id: 'explore', label: 'Explore Dashboards', icon: Compass },
    { id: 'my', label: 'My Dashboards', icon: Layout },
    { id: 'saved', label: 'Saved Dashboards', icon: Bookmark },
  ];

  return (
    <div className="flex flex-col h-screen w-screen bg-[#121212] text-white overflow-hidden">
      <Navbar />
      
      <main className="flex-1 flex min-h-0">
        {/* Sidebar */}
        <DashboardEditorSidebar />

        {/* Content Area */}
        <div className="flex-1 flex flex-col min-h-0 overflow-y-auto no-scrollbar p-8">
          <div className="max-w-[1440px] mx-auto w-full flex flex-col gap-10">
            {/* Tabs (Reuse similar to DashboardPage) */}
            <div className="flex items-center gap-2 border-b border-[#2c2c2c]">
              {tabs.map((tab) => {
                const Icon = tab.icon;
                const isActive = activeTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id as TabType)}
                    className={`flex items-center gap-2 px-6 py-4 text-sm font-bold transition-all border-b-2 -mb-[2px] ${
                      isActive 
                        ? 'text-white border-[#3b82f6] bg-[#1e1e1e]' 
                        : 'text-[#888888] border-transparent hover:text-white'
                    }`}
                  >
                    <Icon className={`w-4 h-4 ${isActive ? 'text-[#3b82f6]' : 'text-[#5a5a5a]'}`} />
                    <span>{tab.label}</span>
                  </button>
                );
              })}
            </div>

            {/* Editor Content */}
            <EditorCanvas />
          </div>
        </div>
      </main>
    </div>
  );
}

