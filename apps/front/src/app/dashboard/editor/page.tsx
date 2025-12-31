'use client';

import { Bookmark, Compass, Layout } from 'lucide-react';
import React, { useState } from 'react';
import { DashboardEditorSidebar } from '@/components/dashboard/DashboardEditorSidebar';
import { EditorCanvas } from '@/components/dashboard/EditorCanvas';
import { Navbar } from '@/components/layout/Navbar';

type TabType = 'explore' | 'my' | 'saved';

export default function DashboardEditorPage() {
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
        <DashboardEditorSidebar />

        {/* Content Area */}
        <div className="flex-1 flex flex-col min-h-0 overflow-y-auto no-scrollbar p-8">
          <div className="max-w-[1440px] mx-auto w-full flex flex-col gap-10">
            <div className="flex items-center gap-2 border-b border-[#30363d]">
              {tabs.map((tab) => {
                const Icon = tab.icon;
                const isActive = activeTab === tab.id;
                return (
                  <button
                    type="button"
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id as TabType)}
                    className={`flex items-center gap-2 px-6 py-4 text-sm font-bold transition-all relative -mb-[1px] ${
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

            {/* Editor Content */}
            <EditorCanvas />
          </div>
        </div>
      </main>
    </div>
  );
}

