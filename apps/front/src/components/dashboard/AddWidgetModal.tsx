'use client';

import { Activity, BarChart2, Database, Layers, Map, PieChart, Plus, TrendingUp } from 'lucide-react';
import React, { useEffect, useState } from 'react';
import { Modal } from '@/components/ui/Modal';

interface AddWidgetModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (widget: string) => void;
}

const widgetItems = [
  { id: 'liquidation-map', label: '清算地图', icon: Map, color: '#3b82f6' },
  { id: 'ls-ratio', label: '各交易所多空比', icon: BarChart2, color: '#10b981' },
  { id: 'agg-orderbook', label: '聚合挂单', icon: Layers, color: '#f59e0b' },
  { id: 'agg-oi', label: '聚合持仓量', icon: Activity, color: '#8b5cf6' },
  { id: 'agg-volume', label: '聚合成交量', icon: Database, color: '#ec4899' },
  { id: 'liquidation-data', label: '爆仓数据', icon: TrendingUp, color: '#ef4444' },
  { id: 'public-companies', label: '币股', icon: PieChart, color: '#06b6d4' },
  { id: 'prediction-market', label: '预测市场', icon: Info, color: '#6366f1' },
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
      title="添加一个组件"
      width="max-w-2xl"
      loading={loading}
      footer={(
        <div className="text-center text-xs text-[#8b949e]">
          选择一个组件添加到您的看板中 · 更多功能开发中
        </div>
      )}
    >
      <div className="space-y-4">
        <p className="text-[#8b949e] text-[10px] font-bold tracking-[0.2em] uppercase mb-6">
          WHAT KIND OF INTEL DO YOU WANT TO SEE?
        </p>
        
        <div className="grid grid-cols-1 gap-3">
          {widgetItems.map((item) => (
            <button
              type="button"
              key={item.id}
              onClick={() => {
                onSelect(item.label);
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
                <span className="text-white font-bold text-lg">{item.label}</span>
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
