'use client';

import type { WidgetCatalogGroup, WidgetCatalogItem } from '@/features/dashboards/widgets/widgets-catalog';
import { Database, TrendingUp, Zap } from 'lucide-react';
import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Modal } from '@/components/ui/Modal';
import { WidgetConfigurator } from '@/features/dashboards/components/WidgetConfigurator';
import { WidgetGroupPreview } from '@/features/dashboards/components/WidgetGroupPreview';
import { addWidgetToDashboard } from '@/features/dashboards/store/dashboard-actions';
import { WIDGET_CATALOG } from '@/features/dashboards/widgets/widgets-catalog';

interface AddWidgetModalProps {
  isOpen: boolean;
  onClose: () => void;
  dashboardId: string;
}

type Step = 'groups' | 'preview' | 'configure'

interface WidgetModalState {
  loading: boolean
  step: Step
  selectedGroup: WidgetCatalogGroup | null
  selectedItem: WidgetCatalogItem | null
}

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
  const [modalState, setModalState] = useState<WidgetModalState>({
    loading: isOpen,
    step: 'groups',
    selectedGroup: null,
    selectedItem: null,
  })
  const lastOpenStateRef = useRef(isOpen)

  useLayoutEffect(() => {
    if (lastOpenStateRef.current === isOpen) return
    lastOpenStateRef.current = isOpen

    if (isOpen) {
      setModalState({
        loading: true,
        step: 'groups',
        selectedGroup: null,
        selectedItem: null,
      })
    }
  }, [isOpen])

  const { loading, step, selectedGroup, selectedItem } = modalState

  useEffect(() => {
    if (isOpen) {
      const timer = setTimeout(() => {
        setModalState(prev => ({ ...prev, loading: false }))
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [isOpen]);

  const handleSelectGroup = (group: WidgetCatalogGroup) => {
    setModalState(prev => ({ ...prev, selectedGroup: group, step: 'preview' }))
  }

  const handleSelectWidget = (item: WidgetCatalogItem) => {
    setModalState(prev => ({ ...prev, selectedItem: item, step: 'configure' }))
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
      setModalState(prev => ({ ...prev, step: 'groups', selectedGroup: null }))
    } else if (step === 'configure') {
      setModalState(prev => ({ ...prev, step: 'preview', selectedItem: null }))
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
            ? t(selectedGroup?.title || '')
            : t(selectedItem?.title || '')
      }
      width="max-w-5xl"
      loading={loading}
      footer={null}
    >
      <div className="max-h-[calc(100dvh-8rem)] min-w-0 overflow-y-auto overscroll-contain md:max-h-[80vh]">
        {step === 'groups' && (
          <div className="min-w-0 space-y-5 p-1 md:space-y-6 md:p-2">
            <p className="text-[color:var(--cf-muted)] text-xs font-medium tracking-wide">
              {t('dashboard.editor.addWidgetHint')}
            </p>
            
            <div className="grid min-w-0 grid-cols-1 gap-3 md:grid-cols-3 md:gap-4">
              {WIDGET_CATALOG.map((group) => {
                const Icon = GROUP_ICONS[group.id] || Database
                const color = GROUP_COLORS[group.id]
                
                return (
                  <button
                    type="button"
                    key={group.id}
                    onClick={() => handleSelectGroup(group)}
                    className="group min-w-0 rounded-xl border border-[color:var(--cf-border)] bg-[color:var(--cf-surface)] p-4 text-left transition-all hover:border-primary/50 hover:bg-[color:var(--cf-surface-hover)] md:p-6"
                  >
                    <div 
                      className="size-12 rounded-xl flex items-center justify-center mb-4 transition-transform group-hover:scale-110"
                      style={{ backgroundColor: `${color}15`, color }}
                    >
                      <Icon className="size-6" />
                    </div>
                    
                    <h3 className="mb-2 break-words text-base font-bold text-[color:var(--cf-text-strong)] transition-colors group-hover:text-primary md:text-lg">
                      {t(group.title)}
                    </h3>
                    
                    <p className="text-[color:var(--cf-muted)] text-xs mb-3 line-clamp-2">
                      {t(group.subtitle)}
                    </p>
                    
                    <div className="flex min-w-0 items-center justify-between gap-3">
                      <span className="text-[color:var(--cf-muted)] text-xs">
                        {t('dashboard.editor.componentsCount', { count: group.items.length })}
                      </span>
                      <span className="text-primary text-xs opacity-100 transition-opacity md:opacity-0 md:group-hover:opacity-100">
                        {t('dashboard.editor.actions.view')} →
                      </span>
                    </div>
                  </button>
                )
              })}
            </div>
          </div>
        )}

        {step === 'preview' && selectedGroup && (
          <div className="min-w-0 p-1 md:p-2">
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
