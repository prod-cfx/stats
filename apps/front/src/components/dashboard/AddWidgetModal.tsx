'use client';

import { Activity, BarChart2, Database, Layers, Map, PieChart, Plus, TrendingUp } from 'lucide-react';
import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Modal } from '@/components/ui/Modal';

interface AddWidgetModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (widgetId: string) => void;
}

const widgetItems = [
  { id: 'liquidation-map', labelKey: 'dashboard.widgets.liquidationMap', icon: Map, color: '#3b82f6' },
  { id: 'ls-ratio', labelKey: 'dashboard.widgets.lsRatio', icon: BarChart2, color: '#10b981' },
  { id: 'agg-orderbook', labelKey: 'dashboard.widgets.aggOrderbook', icon: Layers, color: '#f59e0b' },
  { id: 'agg-oi', labelKey: 'dashboard.widgets.aggOI', icon: Activity, color: '#8b5cf6' },
  { id: 'agg-volume', labelKey: 'dashboard.widgets.aggVolume', icon: Database, color: '#ec4899' },
  { id: 'liquidation-data', labelKey: 'dashboard.widgets.liquidationData', icon: TrendingUp, color: '#ef4444' },
  { id: 'public-companies', labelKey: 'dashboard.widgets.publicCompanies', icon: PieChart, color: '#06b6d4' },
  { id: 'prediction-market', labelKey: 'dashboard.widgets.predictionMarket', icon: Info, color: '#6366f1' },
];

function Info(props: any) {
  return (
    <svg
      {...props}
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="12" cy="12" r="10" />
      <path d="M12 16v-4" />
      <path d="M12 8h.01" />
    </svg>
  );
}

export const AddWidgetModal = ({ isOpen, onClose, onSelect }: AddWidgetModalProps) => {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(false);

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
