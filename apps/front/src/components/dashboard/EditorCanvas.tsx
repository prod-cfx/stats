'use client';

import React from 'react';
import { Plus } from 'lucide-react';

export const EditorCanvas = () => {
  return (
    <div className="flex flex-col gap-10">
      {/* Header Section */}
      <div className="space-y-6">
        <input 
          type="text" 
          placeholder="无说明" 
          defaultValue="无说明"
          className="w-full bg-transparent border-none text-white text-3xl font-bold focus:outline-none placeholder:text-[#adaebc]"
        />
        <button className="flex items-center gap-2 px-4 py-1.5 bg-[#1e1e1e] border border-[#3a3a3a] rounded-md text-[#cccccc] text-sm hover:border-[#3b82f6]/50 transition-all">
          <Plus className="w-3.5 h-3.5" />
          <span>添加标签</span>
        </button>
      </div>

      {/* Grid Canvas Section */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 min-h-[600px]">
        {[...Array(12)].map((_, idx) => (
          <div 
            key={idx} 
            className="aspect-square bg-[#1e1e1e]/50 border-2 border-dashed border-[#2c2c2c] rounded-xl flex items-center justify-center group hover:border-[#3b82f6]/30 hover:bg-[#1e1e1e] transition-all cursor-pointer"
          >
            <div className="w-10 h-10 rounded-full bg-[#2c2c2c] flex items-center justify-center text-[#5a5a5a] group-hover:text-[#3b82f6] group-hover:bg-[#3b82f6]/10 transition-all">
              <Plus className="w-6 h-6" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

