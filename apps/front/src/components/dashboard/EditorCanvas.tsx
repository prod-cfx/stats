'use client';

import { Plus } from 'lucide-react';
import React, { useState } from 'react';
import { AddWidgetModal } from './AddWidgetModal';

export const EditorCanvas = () => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [activeCellIndex, setActiveCellIndex] = useState<number | null>(null);
  const [widgets, setWidgets] = useState<(string | null)[]>(Array.from({length: 15}).fill(null));

  const handleOpenModal = (index: number) => {
    setActiveCellIndex(index);
    setIsModalOpen(true);
  };

  const handleSelectWidget = (widget: string) => {
    if (activeCellIndex !== null) {
      const newWidgets = [...widgets];
      newWidgets[activeCellIndex] = widget;
      setWidgets(newWidgets);
    }
  };

  return (
    <div className="flex flex-col gap-10">
      {/* Header Section */}
      <div className="space-y-6">
        <input 
          type="text" 
          placeholder="无说明" 
          defaultValue="无说明"
          className="w-full bg-transparent border-none text-white text-h1 font-bold focus:outline-none placeholder:text-[#8b949e]"
        />
        <button type="button" className="flex items-center gap-2 px-4 py-1.5 bg-[#161b22] border border-[#30363d] rounded-md text-[#c9d1d9] text-label hover:border-primary/50 transition-all">
          <Plus className="w-3.5 h-3.5" />
          <span>添加标签</span>
        </button>
      </div>

      {/* Grid Canvas Section */}
      <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4 min-h-[600px]">
        {widgets.map((widget, idx) => (
          <div 
            key={idx} 
            onClick={() => handleOpenModal(idx)}
            className={`aspect-square bg-[#161b22]/50 border-2 rounded-xl flex items-center justify-center group transition-all cursor-pointer overflow-hidden ${
              widget 
                ? 'border-solid border-[#30363d] bg-[#161b22] gradient-border-hover' 
                : 'border-dashed border-[#30363d] hover:border-primary/30 hover:bg-[#161b22]'
            }`}
          >
            {widget ? (
              <div className="w-full h-full flex flex-col items-center justify-center p-4 text-center">
                <span className="text-white font-bold text-body">{widget}</span>
                <span className="text-[#8b949e] text-caption mt-2 font-medium uppercase tracking-wider">组件详情已就绪</span>
              </div>
            ) : (
              <div className="w-8 h-8 rounded-full bg-[#0d1117] flex items-center justify-center text-[#8b949e] group-hover:text-white group-hover:bg-gradient-to-br from-primary to-secondary transition-all shadow-lg group-hover:shadow-primary/20">
                <Plus className="w-5 h-5" />
              </div>
            )}
          </div>
        ))}
      </div>

      <AddWidgetModal 
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSelect={handleSelectWidget}
      />
    </div>
  );
};

