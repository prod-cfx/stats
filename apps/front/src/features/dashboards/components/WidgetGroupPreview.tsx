'use client'

import type { WidgetCatalogGroup, WidgetCatalogItem } from '../widgets/widgets.catalog'
import { ChevronLeft } from 'lucide-react'
import React from 'react'

interface WidgetGroupPreviewProps {
  group: WidgetCatalogGroup
  onBack: () => void
  onSelectWidget: (item: WidgetCatalogItem) => void
}

export function WidgetGroupPreview({ group, onBack, onSelectWidget }: WidgetGroupPreviewProps) {
  return (
    <div className="space-y-6">
      <button
        type="button"
        onClick={onBack}
        className="flex items-center gap-2 text-[#8b949e] hover:text-white transition-colors"
      >
        <ChevronLeft className="w-4 h-4" />
        <span className="text-sm">返回</span>
      </button>

      <div>
        <h2 className="text-white font-bold text-2xl mb-2">{group.title}</h2>
        <p className="text-[#8b949e] text-sm mb-1">{group.subtitle}</p>
        <p className="text-[#8b949e] text-xs">
          查看有关{group.title.toLowerCase()}的信息
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {group.items.map((item) => (
          <button
            type="button"
            key={item.type}
            onClick={() => onSelectWidget(item)}
            className="bg-[#161b22] border border-[#30363d] rounded-xl p-4 hover:bg-[#21262d] hover:border-primary/50 transition-all group text-left overflow-hidden"
          >
            <div className="flex items-start justify-between mb-3">
              <h3 className="text-white font-bold text-base group-hover:text-primary transition-colors">
                {item.title}
              </h3>
              <span className="text-[#8b949e] text-xs bg-[#21262d] px-2 py-1 rounded">
                {item.defaultLayout.w}×{item.defaultLayout.h}
              </span>
            </div>
            
            <p className="text-[#8b949e] text-xs mb-4 line-clamp-2">
              {item.description}
            </p>

            {/* Mock Preview Thumbnail */}
            <div className="bg-[#0d1117] border border-[#30363d]/50 rounded-lg h-32 flex items-center justify-center relative overflow-hidden">
              {/* Simplified visual preview based on type */}
              {item.type.includes('kline') && (
                <div className="w-full h-full flex items-end justify-around px-4 pb-4">
                  {[40, 60, 45, 70, 55, 80, 65, 50].map((h, i) => (
                    <div
                      key={i}
                      className="w-1.5 bg-gradient-to-t from-primary/60 to-primary/20 rounded-t"
                      style={{ height: `${h}%` }}
                    />
                  ))}
                </div>
              )}
              {item.type.includes('prediction') && (
                <div className="w-full p-4 space-y-2">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full bg-primary/60" />
                      <div className="flex-1 h-2 bg-[#30363d] rounded" />
                      <div className="w-8 h-2 bg-[#30363d] rounded" />
                    </div>
                  ))}
                </div>
              )}
              {item.type.includes('stocks') && (
                <div className="w-full p-4 space-y-1.5">
                  {[1, 2, 3, 4].map((i) => (
                    <div key={i} className="flex items-center gap-2">
                      <div className="w-4 h-4 rounded bg-primary/20" />
                      <div className="flex-1 h-2 bg-[#30363d] rounded" />
                      <div className="w-10 h-2 bg-primary/40 rounded" />
                    </div>
                  ))}
                </div>
              )}
              {item.type.includes('long_short') && (
                <div className="w-full p-4">
                  <div className="flex gap-1 mb-2">
                    <div className="flex-1 h-1.5 bg-green-500/40 rounded" />
                    <div className="flex-1 h-1.5 bg-red-500/40 rounded" />
                  </div>
                  <div className="space-y-1.5">
                    {[1, 2, 3].map((i) => (
                      <div key={i} className="flex gap-2">
                        <div className="w-12 h-2 bg-[#30363d] rounded" />
                        <div className="flex-1 h-2 bg-green-500/20 rounded" />
                        <div className="flex-1 h-2 bg-red-500/20 rounded" />
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {item.type.includes('orderbook') && (
                <div className="w-full p-4 flex gap-2">
                  <div className="flex-1 space-y-1">
                    {[1, 2, 3, 4].map((i) => (
                      <div key={i} className="h-2 bg-green-500/30 rounded" style={{ width: `${100 - i * 15}%` }} />
                    ))}
                  </div>
                  <div className="flex-1 space-y-1">
                    {[1, 2, 3, 4].map((i) => (
                      <div key={i} className="h-2 bg-red-500/30 rounded ml-auto" style={{ width: `${100 - i * 15}%` }} />
                    ))}
                  </div>
                </div>
              )}
              {item.type.includes('liquidation.map') && (
                <div className="w-full h-full p-4">
                  <div className="h-full flex items-end justify-around">
                    {[30, 50, 70, 90, 60, 40, 55, 75, 45].map((h, i) => (
                      <div
                        key={i}
                        className={`w-1 rounded-t ${i < 4 ? 'bg-red-500/40' : 'bg-green-500/40'}`}
                        style={{ height: `${h}%` }}
                      />
                    ))}
                  </div>
                </div>
              )}
              {(item.type.includes('open_interest') || item.type.includes('volume')) && (
                <div className="w-full h-full p-4 flex items-end justify-around">
                  {[40, 55, 48, 62, 70, 58, 75, 65].map((h, i) => (
                    <div
                      key={i}
                      className="w-2 bg-primary/40 rounded-t"
                      style={{ height: `${h}%` }}
                    />
                  ))}
                </div>
              )}
              {item.type.includes('liquidation.feed') && (
                <div className="w-full p-4 space-y-1.5">
                  {[1, 2, 3, 4].map((i) => (
                    <div key={i} className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full bg-red-500/40" />
                      <div className="flex-1 h-2 bg-[#30363d] rounded" />
                      <div className="w-12 h-2 bg-red-500/30 rounded" />
                    </div>
                  ))}
                </div>
              )}
              
              {/* Fallback */}
              {!item.type.includes('kline') && 
               !item.type.includes('prediction') &&
               !item.type.includes('stocks') &&
               !item.type.includes('long_short') &&
               !item.type.includes('orderbook') &&
               !item.type.includes('liquidation') &&
               !item.type.includes('open_interest') &&
               !item.type.includes('volume') && (
                <div className="text-[#8b949e] text-xs">
                  {item.title}
                </div>
              )}
            </div>
          </button>
        ))}
      </div>
    </div>
  )
}
