'use client';

import type { WidgetCatalogGroup, WidgetCatalogItem } from '@/features/dashboards/widgets/widgets.catalog';
import { Database, TrendingUp, Zap } from 'lucide-react';
import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Modal } from '@/components/ui/Modal';
import { WidgetConfigurator } from '@/features/dashboards/components/WidgetConfigurator';
import { WidgetGroupPreview } from '@/features/dashboards/components/WidgetGroupPreview';
import { addWidgetToDashboard } from '@/features/dashboards/store/dashboardActions';
import { WIDGET_CATALOG } from '@/features/dashboards/widgets/widgets.catalog';

interface AddWidgetModalProps {
  isOpen: boolean;
  onClose: () => void;
  dashboardId: string;
}

type Step = 'groups' | 'preview' | 'configure'

const GROUP_ICONS: Record<string, React.ComponentType<any>> = {
  market: TrendingUp,
  derivatives: Database,
  liquidation: Zap,
}

const GROUP_COLORS: Record<string, string> = {
  market: '#F7931A',
  derivatives: '#3b82f6',
  liquidation: '#ef4444',
}

export const AddWidgetModal = ({ isOpen, onClose, dashboardId }: AddWidgetModalProps) => {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState<Step>('groups')
  const [selectedGroup, setSelectedGroup] = useState<WidgetCatalogGroup | null>(null)
  const [selectedItem, setSelectedItem] = useState<WidgetCatalogItem | null>(null)

  useEffect(() => {
    if (isOpen) {
      setLoading(true);
      setStep('groups')
      setSelectedGroup(null)
      setSelectedItem(null)
      const timer = setTimeout(() => setLoading(false), 300);
      return () => clearTimeout(timer);
    }
  }, [isOpen]);

  const handleSelectGroup = (group: WidgetCatalogGroup) => {
    setSelectedGroup(group)
    setStep('preview')
  }

  const handleSelectWidget = (item: WidgetCatalogItem) => {
    setSelectedItem(item)
    setStep('configure')
  }

  const handleSaveWidget = (config: Record<string, any>, layout: { w: number; h: number }) => {
    if (!selectedItem) return
    
    // Add widget with custom config and layout
    const customItem = {
      ...selectedItem,
      defaultConfig: config,
      defaultLayout: { ...selectedItem.defaultLayout, w: layout.w, h: layout.h },
    }
    
    addWidgetToDashboard(dashboardId, customItem)
    onClose()
  }

  const handleBack = () => {
    if (step === 'preview') {
      setStep('groups')
      setSelectedGroup(null)
    } else if (step === 'configure') {
      setStep('preview')
      setSelectedItem(null)
    }
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={
        step === 'groups' 
          ? t('dashboard.editor.addWidgetTitle') 
          : step === 'preview' 
            ? selectedGroup?.title || ''
            : selectedItem?.title || ''
      }
      width="max-w-5xl"
      loading={loading}
      footer={null}
    >
      <div className="max-h-[80vh] overflow-y-auto">
        {step === 'groups' && (
          <div className="space-y-6 p-2">
            <p className="text-[#8b949e] text-xs font-medium tracking-wide">
              {t('dashboard.editor.addWidgetHint')}
            </p>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {WIDGET_CATALOG.map((group) => {
                const Icon = GROUP_ICONS[group.id] || Database
                const color = GROUP_COLORS[group.id]
                
                return (
                  <button
                    key={group.id}
                    onClick={() => handleSelectGroup(group)}
                    className="bg-[#161b22] border border-[#30363d] rounded-xl p-6 hover:bg-[#21262d] hover:border-primary/50 transition-all group text-left"
                  >
                    <div 
                      className="w-12 h-12 rounded-xl flex items-center justify-center mb-4 transition-transform group-hover:scale-110"
                      style={{ backgroundColor: `${color}15`, color }}
                    >
                      <Icon className="w-6 h-6" />
                    </div>
                    
                    <h3 className="text-white font-bold text-lg mb-2 group-hover:text-primary transition-colors">
                      {group.title}
                    </h3>
                    
                    <p className="text-[#8b949e] text-xs mb-3 line-clamp-2">
                      {group.subtitle}
                    </p>
                    
                    <div className="flex items-center justify-between">
                      <span className="text-[#8b949e] text-xs">
                        {group.items.length} 个组件
                      </span>
                      <span className="text-primary text-xs opacity-0 group-hover:opacity-100 transition-opacity">
                        查看 →
                      </span>
                    </div>
                  </button>
                )
              })}
            </div>
          </div>
        )}

        {step === 'preview' && selectedGroup && (
          <div className="p-2">
            <WidgetGroupPreview
              group={selectedGroup}
              onBack={handleBack}
              onSelectWidget={handleSelectWidget}
            />
          </div>
        )}

        {step === 'configure' && selectedItem && (
          <WidgetConfigurator
            item={selectedItem}
            onBack={handleBack}
            onSave={handleSaveWidget}
          />
        )}
      </div>
    </Modal>
  );
};
