'use client';

import React from 'react';
import { Layout, Bookmark, Plus, ChevronRight, Trash2, Send } from 'lucide-react';
import Link from 'next/link';

export const DashboardEditorSidebar = () => {
  return (
    <aside className="w-64 flex-none border-r border-[#30363d] p-6 flex flex-col gap-10">
      <div className="flex flex-col gap-8 h-full">
        {/* Navigation Section */}
        <div className="space-y-8">
          {/* My Dashboards Section */}
          <div className="space-y-4">
            <button className="w-full flex items-center justify-between group">
              <div className="flex items-center gap-3">
                <Layout className="w-4 h-4 text-[#cccccc]" />
                <span className="text-[#cccccc] text-base font-semibold">我的看板</span>
              </div>
              <ChevronRight className="w-3 h-3 text-[#5a5a5a] group-hover:text-white transition-colors" />
            </button>
            <div className="pl-7 space-y-4">
              <div className="text-[#999999] text-sm hover:text-white cursor-pointer transition-colors uppercase tracking-wider">UNTITLED</div>
              <div className="text-[#999999] text-sm hover:text-white cursor-pointer transition-colors uppercase tracking-wider">UNTITLED</div>
              <div className="text-[#999999] text-sm hover:text-white cursor-pointer transition-colors uppercase tracking-wider">UNTITLED</div>
            </div>
          </div>

          {/* Tracked Entities */}
          <div className="text-[#5a5a5a] text-[10px] font-bold uppercase tracking-[0.1em]">
            TRACKED ENTITIES
          </div>

          {/* Saved Dashboards Section */}
          <button className="w-full flex items-center justify-between group">
            <div className="flex items-center gap-3">
              <Bookmark className="w-4 h-4 text-[#cccccc]" />
              <span className="text-[#cccccc] text-base font-semibold">已保存的看板</span>
            </div>
            <ChevronRight className="w-3 h-3 text-[#5a5a5a] group-hover:text-white transition-colors" />
          </button>
        </div>

        {/* Action Buttons Section */}
        <div className="mt-auto space-y-4">
          <button className="w-full bg-[#2563eb] hover:bg-blue-700 text-white font-bold py-3 rounded-lg flex items-center justify-center gap-2 transition-all active:scale-[0.98]">
            <Plus className="w-4 h-4" />
            <span className="text-sm">CREATE DASHBOARD</span>
          </button>
          
          <button className="w-full bg-[#161b22] hover:bg-[#30363d] text-white font-bold py-3 rounded-lg flex items-center justify-center gap-2 transition-all active:scale-[0.98] border border-[#30363d]">
            <Send className="w-4 h-4" />
            <span className="text-sm uppercase tracking-wider">发布</span>
          </button>

          <button className="w-full bg-transparent hover:bg-red-500/10 text-[#999999] hover:text-red-500 font-bold py-3 rounded-lg flex items-center justify-center gap-2 transition-all active:scale-[0.98]">
            <Trash2 className="w-4 h-4" />
            <span className="text-sm uppercase tracking-wider">DELETE</span>
          </button>
        </div>
      </div>
    </aside>
  );
};

