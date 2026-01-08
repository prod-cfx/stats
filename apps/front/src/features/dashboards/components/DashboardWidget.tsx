import type { WidgetType } from '../widgets/widgets.catalog';
import { AlertCircle } from 'lucide-react'
import React from 'react'
import { useWidgetMockData } from '../mock/useWidgetMockData'
import { WIDGET_CATALOG } from '../widgets/widgets.catalog';
import { WidgetShell } from '../widgets/WidgetShell'

interface DashboardWidgetProps {
  type: WidgetType;
  config?: Record<string, any>;
  isDraggable?: boolean;
  className?: string;
  onRemove?: () => void;
}

export const DashboardWidget: React.FC<DashboardWidgetProps> = ({ 
  type, 
  config = {}, 
  className = '',
  onRemove
}) => {
  // Find widget definition
  const widgetDef = React.useMemo(() => {
    for (const group of WIDGET_CATALOG) {
      const found = group.items.find(i => i.type === type);
      if (found) return found;
    }
    return null;
  }, [type]);

  const { loading, data, error } = useWidgetMockData(type, { ...widgetDef?.defaultConfig, ...config })

  if (!widgetDef) {
    return (
      <div className={`w-full h-full flex items-center justify-center bg-[#161b22] border border-red-500/50 rounded-xl text-red-500 gap-2 ${className}`}>
        <AlertCircle className="w-5 h-5" />
        <span>Unknown Widget: {type}</span>
      </div>
    );
  }

  return (
    <div className={className}>
      <WidgetShell title={widgetDef.title} description={widgetDef.description} onRemove={onRemove}>
        {loading ? (
          <div className="animate-pulse space-y-3">
            <div className="h-4 w-1/3 rounded bg-white/10" />
            <div className="h-3 w-full rounded bg-white/10" />
            <div className="h-24 w-full rounded bg-white/5 border border-white/10" />
          </div>
        ) : error ? (
          <div className="text-sm text-red-400 flex items-center gap-2">
            <AlertCircle className="w-4 h-4" />
            <span>{error}</span>
          </div>
        ) : (
          <div className="h-full flex items-center justify-center">
            {/* Do not render JSON. Keep a neutral placeholder for legacy usage. */}
            <div className="text-white/60 text-sm">
              组件开发中：{widgetDef.title}
              {data ? '' : ''}
            </div>
          </div>
        )}
      </WidgetShell>
    </div>
  );
};


