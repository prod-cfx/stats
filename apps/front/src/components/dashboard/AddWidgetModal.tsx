'use client';

import { Activity, BarChart2, Database, Info, Layers, Map, PieChart, TrendingUp, X } from 'lucide-react';
import React from 'react';
import { PageTitle } from '@/components/ui/Typography';

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

const PlusIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
    <line x1="12" y1="5" x2="12" y2="19"></line>
    <line x1="5" y1="12" x2="19" y2="12"></line>
  </svg>
);

export const AddWidgetModal = ({ isOpen, onClose, onSelect }: AddWidgetModalProps) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={onClose}
      />
      
      {/* Modal Content */}
      <div className="relative w-full max-w-2xl bg-[#161b22] border border-[#30363d] rounded-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-200">
        {/* Header */}
        <div className="p-8 border-b border-[#30363d] flex justify-between items-start">
          <div className="space-y-1">
            <PageTitle>添加一个组件</PageTitle>
            <p className="text-[#8b949e] text-label font-medium tracking-[0.1em] uppercase">
              WHAT KIND OF INTEL DO YOU WANT TO SEE?
            </p>
          </div>
          <button type="button" onClick={onClose} className="absolute top-4 right-4 p-2 text-[#8b949e] hover:text-white transition-colors">
        <X className="w-6 h-6" />
      </button>
        </div>

        {/* List */}
        <div className="max-h-[60vh] overflow-y-auto no-scrollbar p-6">
          <div className="grid grid-cols-1 gap-3">
            {widgetItems.map((item) => (
              <button
                type="button"
                key={item.id}
                onClick={() => {
                  onSelect(item.label);
                  onClose();
                }}
                className="flex items-center gap-4 p-4 rounded-xl bg-[#21262d] border border-transparent gradient-border-hover transition-all group text-left"
              >
                <div 
                  className="w-10 h-10 rounded-lg flex items-center justify-center transition-all group-hover:scale-110"
                  style={{ backgroundColor: `${item.color}20`, color: item.color }}
                >
                  <item.icon className="w-6 h-6" />
                </div>
                <div className="flex-1">
                  <span className="text-white font-semibold text-h3">{item.label}</span>
                </div>
                <div className="text-[#8b949e] group-hover:text-white transition-colors">
                  <PlusIcon />
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Footer info (optional) */}
        <div className="p-4 bg-[#0d1117]/50 border-t border-[#30363d] text-center text-caption text-[#5a5a5a]">
          选择一个组件添加到您的看板中
        </div>
      </div>
    </div>
  );
};


