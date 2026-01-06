'use client';

import { Activity, BarChart2, Database, Info, Layers, Map, PieChart, Plus, TrendingUp } from 'lucide-react';
import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Modal } from '@/components/ui/Modal';
import { useMarketDataCatalog } from '@/lib/market-data/useMarketDataCatalog'

interface AddWidgetModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (widgetId: string) => void;
}

const iconMap: Record<string, React.ComponentType<any>> = {
  Map,
  BarChart2,
  Layers,
  Activity,
  Database,
  TrendingUp,
  PieChart,
  Info,
}

export const AddWidgetModal = ({ isOpen, onClose, onSelect }: AddWidgetModalProps) => {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(false);
  const { items: catalogItems } = useMarketDataCatalog()

  const widgetItems = useMemo(() => {
    return catalogItems
      .filter((x) => x.kind === 'dashboardWidget')
      .map((x) => {
        const Icon = (x.ui?.icon && iconMap[x.ui.icon]) ? iconMap[x.ui.icon] : Info
        return {
          id: x.id,
          labelKey: x.labelKey,
          icon: Icon,
          color: x.ui?.color || '#6366f1',
        }
      })
  }, [catalogItems])

  useEffect(() => {
    if (isOpen) {
      setLoading(true);
      // Mock modal content loading: 800-1200ms
      const timer = setTimeout(() => setLoading(false), 1000);
      return () => clearTimeout(timer);
    }
  }, [isOpen]);

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={t('dashboard.editor.addWidgetTitle')}
      width="max-w-2xl"
      loading={loading}
      footer={(
        <div className="text-center text-xs text-[#8b949e]">
          {t('dashboard.editor.addWidgetFooter')}
        </div>
      )}
    >
      <div className="space-y-4">
        <p className="text-[#8b949e] text-[10px] font-bold tracking-[0.2em] uppercase mb-6">
          {t('dashboard.editor.addWidgetHint')}
        </p>
        
        <div className="grid grid-cols-1 gap-3">
          {widgetItems.map((item) => (
            <button
              type="button"
              key={item.id}
              onClick={() => {
                onSelect(item.id);
                onClose();
              }}
              className="flex items-center gap-4 p-4 rounded-xl bg-[#21262d] border border-transparent gradient-border-hover transition-all group text-left animate-in fade-in slide-in-from-bottom-1 duration-300"
            >
              <div 
                className="w-10 h-10 rounded-lg flex items-center justify-center transition-all group-hover:scale-110"
                style={{ backgroundColor: `${item.color}20`, color: item.color }}
              >
                <item.icon className="w-6 h-6" />
              </div>
              <div className="flex-1">
                <span className="text-white font-bold text-lg">{t(item.labelKey)}</span>
              </div>
              <div className="text-[#8b949e] group-hover:text-white transition-colors">
                <Plus className="w-5 h-5" />
              </div>
            </button>
          ))}
        </div>
      </div>
    </Modal>
  );
};
