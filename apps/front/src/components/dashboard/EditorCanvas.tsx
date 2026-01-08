'use client';

import { Plus, Trash2 } from 'lucide-react';
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useMarketDataCatalog } from '@/lib/market-data/useMarketDataCatalog'
import { useLocalStorageState } from '@/lib/storage/useLocalStorageState'
import { AddWidgetModal } from './AddWidgetModal';

export const EditorCanvas = () => {
  const { t } = useTranslation();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [activeCellIndex, setActiveCellIndex] = useState<number | null>(null);
  const { items: _catalogItems, byId: _byId } = useMarketDataCatalog()
  const { value: widgets, setValue: setWidgets } = useLocalStorageState<(string | null)[]>(
    'dashboard:editor:draft:widgets',
    Array.from({ length: 15 }).fill(null),
  )

  const handleOpenModal = (index: number) => {
    setActiveCellIndex(index);
    setIsModalOpen(true);
  };

  const handleSelectWidget = (widgetId: string) => {
    if (activeCellIndex !== null) {
      const newWidgets = [...widgets];
      newWidgets[activeCellIndex] = widgetId;
      setWidgets(newWidgets);
    }
  };

  const removeWidget = (idx: number) => {
    const newWidgets = [...widgets]
    newWidgets[idx] = null
    setWidgets(newWidgets)
  }

  return (
    <div className="flex flex-col gap-10">
      {/* Header Section */}
      <div className="space-y-6">
        <input 
          type="text" 
          placeholder={t('dashboard.editor.descriptionPlaceholder')}
          defaultValue={t('dashboard.editor.descriptionPlaceholder')}
          className="w-full bg-transparent border-none text-white text-h1 font-bold focus:outline-none placeholder:text-[#8b949e]"
        />
        <button type="button" className="flex items-center gap-2 px-4 py-1.5 bg-[#161b22] border border-[#30363d] rounded-md text-[#c9d1d9] text-label hover:border-primary/50 transition-all">
          <Plus className="w-3.5 h-3.5" />
          <span>{t('dashboard.editor.addTag')}</span>
        </button>
      </div>

      {/* Grid Canvas Section */}
      <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4 min-h-[600px]">
        {widgets.map((widget, idx) => (
          <div 
            key={idx} 
            onClick={() => handleOpenModal(idx)}
            className={`relative aspect-square bg-[#161b22]/50 border-2 rounded-xl flex items-center justify-center group transition-all cursor-pointer overflow-hidden ${
              widget 
                ? 'border-solid border-[#30363d] bg-[#161b22] gradient-border-hover' 
                : 'border-dashed border-[#30363d] hover:border-primary/30 hover:bg-[#161b22]'
            }`}
          >
            {widget ? (
              <div className="w-full h-full flex flex-col items-center justify-center p-4 text-center">
                <span className="text-white font-bold text-body">
                  {byId.get(widget)?.labelKey ? t(byId.get(widget)!.labelKey) : widget}
                </span>
                <span className="text-[#8b949e] text-caption mt-2 font-medium uppercase tracking-wider">{t('dashboard.editor.widgetReady')}</span>
              </div>
            ) : (
              <div className="w-8 h-8 rounded-full bg-[#0d1117] flex items-center justify-center text-[#8b949e] group-hover:text-white group-hover:bg-gradient-to-br from-primary to-secondary transition-all shadow-lg group-hover:shadow-primary/20">
                <Plus className="w-5 h-5" />
              </div>
            )}

            {widget && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation()
                  removeWidget(idx)
                }}
                className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity p-1.5 rounded-lg bg-black/40 hover:bg-red-500/20 text-[#8b949e] hover:text-red-400"
                aria-label={t('dashboard.editor.removeWidget')}
                title={t('dashboard.editor.removeWidget')}
              >
                <Trash2 className="w-4 h-4" />
              </button>
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

