'use client'

import type {UnitSize} from '../widgets/unitSizePresets';
import type { WidgetCatalogItem } from '../widgets/widgets.catalog'
import { ChevronLeft } from 'lucide-react'
import React, { useMemo, useState } from 'react'
import { UNIT_SIZE_PRESETS  } from '../widgets/unitSizePresets'
import { WidgetRenderer } from '../widgets/WidgetRenderer'

interface WidgetConfiguratorProps {
  item: WidgetCatalogItem
  onBack: () => void
  onSave: (config: Record<string, any>, layout: { w: number; h: number }) => void
}

export function WidgetConfigurator({ item, onBack, onSave }: WidgetConfiguratorProps) {
  const [config, setConfig] = useState<Record<string, any>>(item.defaultConfig)
  const [selectedSize, setSelectedSize] = useState<UnitSize>('M')

  const layout = useMemo(() => UNIT_SIZE_PRESETS[selectedSize], [selectedSize])

  // Generate config fields based on widget type
  const configFields = useMemo(() => {
    const fields: Array<{
      key: string
      label: string
      type: 'select' | 'text' | 'number'
      options?: Array<{ value: string; label: string }>
    }> = []

    // Common fields
    if (item.type.includes('kline')) {
      fields.push(
        { key: 'symbol', label: '交易对', type: 'select', options: [
          { value: 'BTCUSDT', label: 'BTC/USDT' },
          { value: 'ETHUSDT', label: 'ETH/USDT' },
          { value: 'SOLUSDT', label: 'SOL/USDT' },
        ]},
        { key: 'interval', label: '时间周期', type: 'select', options: [
          { value: '1m', label: '1分钟' },
          { value: '5m', label: '5分钟' },
          { value: '15m', label: '15分钟' },
          { value: '1h', label: '1小时' },
          { value: '4h', label: '4小时' },
          { value: '1d', label: '1天' },
        ]},
        { key: 'venue', label: '交易所', type: 'select', options: [
          { value: 'OKX', label: 'OKX' },
          { value: 'Binance', label: 'Binance' },
          { value: 'Bybit', label: 'Bybit' },
        ]},
      )
    }

    if (item.type.includes('long_short')) {
      fields.push(
        { key: 'symbol', label: '币种', type: 'select', options: [
          { value: 'BTC', label: 'Bitcoin (BTC)' },
          { value: 'ETH', label: 'Ethereum (ETH)' },
          { value: 'SOL', label: 'Solana (SOL)' },
        ]},
        { key: 'window', label: '时间窗口', type: 'select', options: [
          { value: '1h', label: '1小时' },
          { value: '4h', label: '4小时' },
          { value: '24h', label: '24小时' },
        ]},
      )
    }

    if (item.type.includes('orderbook_agg') || item.type.includes('open_interest') || item.type.includes('volume_agg')) {
      fields.push(
        { key: 'symbol', label: '币种', type: 'select', options: [
          { value: 'BTC', label: 'BTC' },
          { value: 'ETH', label: 'ETH' },
          { value: 'SOL', label: 'SOL' },
        ]},
      )
    }

    if (item.type.includes('liquidation.map')) {
      fields.push(
        { key: 'symbol', label: '币种', type: 'select', options: [
          { value: 'BTC', label: 'BTC' },
          { value: 'ETH', label: 'ETH' },
          { value: 'SOL', label: 'SOL' },
        ]},
        { key: 'range', label: '时间范围', type: 'select', options: [
          { value: '1D', label: '1天' },
          { value: '7D', label: '7天' },
          { value: '30D', label: '30天' },
        ]},
        { key: 'scope', label: '交易所范围', type: 'select', options: [
          { value: 'ALL', label: '全部' },
          { value: 'CEX', label: 'CEX' },
          { value: 'DEX', label: 'DEX' },
        ]},
      )
    }

    if (item.type.includes('prediction')) {
      fields.push(
        { key: 'category', label: '分类', type: 'select', options: [
          { value: 'BTC', label: 'Bitcoin' },
          { value: 'ETH', label: 'Ethereum' },
          { value: 'Politics', label: 'Politics' },
          { value: 'Sports', label: 'Sports' },
        ]},
        { key: 'sort', label: '排序', type: 'select', options: [
          { value: 'hot', label: '热门' },
          { value: 'volume', label: '成交量' },
          { value: 'new', label: '最新' },
        ]},
      )
    }

    if (item.type.includes('crypto_stocks')) {
      fields.push(
        { key: 'watchlist', label: '关注列表', type: 'select', options: [
          { value: 'ALL', label: '全部' },
          { value: 'BTC', label: 'BTC持有者' },
          { value: 'ETH', label: 'ETH持有者' },
        ]},
        { key: 'sort', label: '排序', type: 'select', options: [
          { value: 'marketCap', label: '市值' },
          { value: 'holdings', label: '持仓量' },
        ]},
      )
    }

    return fields
  }, [item.type])

  const handleConfigChange = (key: string, value: any) => {
    setConfig((prev) => ({ ...prev, [key]: value }))
  }

  return (
    <div className="flex h-full min-h-[70vh] max-h-[80vh]">
      {/* Left: Configuration */}
      <div className="w-1/3 border-r border-[#30363d] p-6 overflow-y-auto">
        <button
          type="button"
          onClick={onBack}
          className="flex items-center gap-2 text-[#8b949e] hover:text-white mb-6 transition-colors"
        >
          <ChevronLeft className="w-4 h-4" />
          <span className="text-sm">返回</span>
        </button>

        <h3 className="text-white font-bold text-lg mb-1">{item.title}</h3>
        <p className="text-[#8b949e] text-xs mb-6">{item.description}</p>

        <div className="space-y-4">
          {configFields.map((field) => (
            <div key={field.key}>
              <label className="block text-[#8b949e] text-xs font-medium mb-2 uppercase tracking-wide">
                {field.label}
              </label>
              {field.type === 'select' && field.options ? (
                <select
                  value={config[field.key] || ''}
                  onChange={(e) => handleConfigChange(field.key, e.target.value)}
                  className="w-full bg-[#0d1117] border border-[#30363d] rounded-lg px-3 py-2 text-white text-sm focus:border-primary focus:outline-none"
                >
                  {field.options.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              ) : (
                <input
                  type={field.type === 'number' ? 'number' : 'text'}
                  value={config[field.key] || ''}
                  onChange={(e) => handleConfigChange(field.key, e.target.value)}
                  className="w-full bg-[#0d1117] border border-[#30363d] rounded-lg px-3 py-2 text-white text-sm focus:border-primary focus:outline-none"
                />
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Right: Size & Preview */}
      <div className="flex-1 flex flex-col">
        {/* Size Selection */}
        <div className="border-b border-[#30363d] p-6">
          <label className="block text-[#8b949e] text-xs font-medium mb-3 uppercase tracking-wide">
            组件大小 (UNIT SIZE)
          </label>
          <div className="flex gap-2">
            {(Object.keys(UNIT_SIZE_PRESETS) as UnitSize[]).map((size) => (
              <button
                type="button"
                key={size}
                onClick={() => setSelectedSize(size)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  selectedSize === size
                    ? 'bg-primary text-white'
                    : 'bg-[#21262d] text-[#8b949e] hover:bg-[#30363d]'
                }`}
              >
                {UNIT_SIZE_PRESETS[size].label}
              </button>
            ))}
          </div>
          <div className="mt-2 text-xs text-[#8b949e]">
            网格尺寸: {layout.w} × {layout.h}
          </div>
        </div>

        {/* Preview */}
        <div className="flex-1 p-6 overflow-auto">
          <div className="mb-3">
            <div className="text-[#8b949e] text-xs font-medium uppercase tracking-wide mb-2">
              组件预览 (UNIT PREVIEW)
            </div>
          </div>
          <div
            className="bg-[#0d1117] border border-[#30363d] rounded-xl overflow-hidden relative"
            style={{
              height: '360px', // Strict fixed height as requested
              width: '100%',
            }}
          >
            <div className="absolute inset-0 overflow-hidden">
              <WidgetRenderer
                widget={{
                  id: 'preview',
                  type: item.type,
                  config,
                }}
              />
            </div>
          </div>
        </div>

        {/* Save Button */}
        <div className="border-t border-[#30363d] p-6">
          <button
            type="button"
            onClick={() => onSave(config, layout)}
            className="w-full bg-primary hover:bg-primary/90 text-white font-medium py-3 rounded-lg transition-colors"
          >
            保存并添加到看板
          </button>
        </div>
      </div>
    </div>
  )
}
