'use client'

import type { UnitSize } from '../widgets/unitSizePresets'
import type { WidgetCatalogItem } from '../widgets/widgets.catalog'
import { ChevronLeft } from 'lucide-react'
import React, { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  CRYPTO_STOCKS_UNIT_SIZE_PRESETS,
  KLINE_UNIT_SIZE_PRESETS,
  LIQUIDATION_FEED_UNIT_SIZE_PRESETS,
  LIQUIDATION_MAP_UNIT_SIZE_PRESETS,
  LONG_SHORT_UNIT_SIZE_PRESETS,
  OPEN_INTEREST_UNIT_SIZE_PRESETS,
  ORDERBOOK_UNIT_SIZE_PRESETS,
  PREDICTION_UNIT_SIZE_PRESETS,
  UNIT_SIZE_PRESETS,
  VOLUME_UNIT_SIZE_PRESETS,
} from '../widgets/unitSizePresets'
import { WidgetRenderer } from '../widgets/WidgetRenderer'

interface WidgetConfiguratorProps {
  item: WidgetCatalogItem
  onBack: () => void
  onSave: (config: Record<string, any>, layout: { w: number; h: number }) => void
}

export function WidgetConfigurator({ item, onBack, onSave }: WidgetConfiguratorProps) {
  const { t } = useTranslation()
  const [config, setConfig] = useState<Record<string, any>>(item.defaultConfig)
  const [selectedSize, setSelectedSize] = useState<UnitSize>('M')

  const sizePresets = useMemo(() => {
    // K 线有独立的尺寸策略：S 更矮(h=3)且更宽，M/L/XL 在此基础上递增
    if (item.type === 'market.kline') return KLINE_UNIT_SIZE_PRESETS
    // 预测市场只保留 S/M 尺寸
    if (item.type === 'market.prediction') return PREDICTION_UNIT_SIZE_PRESETS as any
    // 币股固定高度 h=3，只变宽
    if (item.type === 'market.crypto_stocks') return CRYPTO_STOCKS_UNIT_SIZE_PRESETS
    // 聚合多空比只保留 S/M 尺寸
    if (item.type === 'derivatives.long_short_ratio') return LONG_SHORT_UNIT_SIZE_PRESETS as any
    // 聚合挂单 S 宽度同 K 线，高度 h=3
    if (item.type === 'derivatives.orderbook_agg') return ORDERBOOK_UNIT_SIZE_PRESETS as any
    // 聚合持仓量只保留 S/M 尺寸
    if (item.type === 'derivatives.open_interest_agg') return OPEN_INTEREST_UNIT_SIZE_PRESETS as any
    // 清算地图只保留 S/M 尺寸
    if (item.type === 'liquidation.map') return LIQUIDATION_MAP_UNIT_SIZE_PRESETS as any
    // 聚合成交量只保留 S/M 尺寸
    if (item.type === 'derivatives.volume_agg') return VOLUME_UNIT_SIZE_PRESETS as any
    // 聚合爆仓只保留 S 尺寸
    if (item.type === 'liquidation.feed') return LIQUIDATION_FEED_UNIT_SIZE_PRESETS as any
    return UNIT_SIZE_PRESETS
  }, [item.type])

  const layout = useMemo(() => {
    // If selectedSize is not in presets (e.g. was 'M' but now only 'S' available),
    // fallback to the first available size
    const preset = sizePresets[selectedSize] || Object.values(sizePresets)[0]
    return preset
  }, [selectedSize, sizePresets])

  // Effect to sync selectedSize state if it becomes invalid
  React.useEffect(() => {
    if (!sizePresets[selectedSize]) {
      const firstAvailable = Object.keys(sizePresets)[0] as UnitSize
      if (firstAvailable) {
        // eslint-disable-next-line react-hooks-extra/no-direct-set-state-in-use-effect -- normalize invalid size
        setSelectedSize(firstAvailable)
      }
    }
  }, [sizePresets, selectedSize])

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
        // 只保留一个：筛选交易对（其他配置保持默认值，不在左侧展示）
        {
          key: 'symbol',
          label: t('widget.config.selectSymbol'),
          type: 'select',
          options: [
            { value: 'BTCUSDT', label: 'BTC/USDT' },
            { value: 'ETHUSDT', label: 'ETH/USDT' },
            { value: 'SOLUSDT', label: 'SOL/USDT' },
          ],
        },
      )
    }

    if (item.type.includes('long_short')) {
      fields.push(
        {
          key: 'symbol',
          label: t('widget.config.symbol'),
          type: 'select',
          options: [
            { value: 'BTC', label: 'Bitcoin (BTC)' },
            { value: 'ETH', label: 'Ethereum (ETH)' },
            { value: 'SOL', label: 'Solana (SOL)' },
          ],
        },
        {
          key: 'window',
          label: t('widget.config.timeWindow'),
          type: 'select',
          options: [
            { value: '1h', label: t('chart.timeframes.1h') },
            { value: '4h', label: t('chart.timeframes.4h') },
            { value: '24h', label: t('longShort.timeRanges.24h') },
          ],
        },
      )
    }

    if (
      item.type.includes('orderbook_agg') ||
      item.type.includes('open_interest') ||
      item.type.includes('volume_agg')
    ) {
      // User requested to remove left-side configuration fields for orderbook
    }

    if (item.type.includes('liquidation.map')) {
      fields.push(
        {
          key: 'symbol',
          label: t('widget.config.symbol'),
          type: 'select',
          options: [
            { value: 'BTC', label: 'BTC' },
            { value: 'ETH', label: 'ETH' },
            { value: 'SOL', label: 'SOL' },
          ],
        },
        {
          key: 'range',
          label: t('widget.config.timeRange'),
          type: 'select',
          options: [
            { value: '1D', label: t('chart.timeframes.1d') },
            { value: '7D', label: t('liquidationMap.range.7d') },
            { value: '30D', label: t('liquidationMap.range.30d') },
          ],
        },
        {
          key: 'scope',
          label: t('widget.config.exchangeScope'),
          type: 'select',
          options: [
            { value: 'ALL', label: t('liquidationMap.exchangeType.all') },
            { value: 'CEX', label: t('liquidationMap.exchangeType.cex') },
            { value: 'DEX', label: t('liquidationMap.exchangeType.dex') },
          ],
        },
      )
    }

    if (item.type.includes('prediction')) {
      // User requested to remove left-side configuration fields for prediction market
    }

    if (item.type.includes('crypto_stocks')) {
      // User requested to remove left-side configuration fields for crypto stocks
    }

    return fields
  }, [item.type, t])

  const handleConfigChange = (key: string, value: any) => {
    setConfig(prev => ({ ...prev, [key]: value }))
  }

  return (
    <div className="flex h-full max-h-[80vh] min-h-[70vh]">
      {/* Left: Configuration */}
      <div className="w-1/3 overflow-y-auto border-r border-[color:var(--cf-border)] p-6">
        <button
          type="button"
          onClick={onBack}
          className="mb-6 flex items-center gap-2 text-[color:var(--cf-muted)] transition-colors hover:text-[color:var(--cf-text-strong)]"
        >
          <ChevronLeft className="h-4 w-4" />
          <span className="text-sm">{t('widget.config.back')}</span>
        </button>

        <h3 className="mb-1 text-lg font-bold text-[color:var(--cf-text-strong)]">
          {t(item.title)}
        </h3>
        <p className="mb-6 text-xs text-[color:var(--cf-muted)]">{t(item.description)}</p>

        <div className="space-y-4">
          {configFields.map(field => (
            <div key={field.key}>
              <label className="mb-2 block text-xs font-medium tracking-wide text-[color:var(--cf-muted)] uppercase">
                {field.label}
              </label>
              {field.type === 'select' && field.options ? (
                <select
                  value={config[field.key] || ''}
                  onChange={e => handleConfigChange(field.key, e.target.value)}
                  className="focus:border-primary w-full rounded-lg border border-[color:var(--cf-border)] bg-[color:var(--cf-bg)] px-3 py-2 text-sm text-[color:var(--cf-text-strong)] focus:outline-none"
                >
                  {field.options.map(opt => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              ) : (
                <input
                  type={field.type === 'number' ? 'number' : 'text'}
                  value={config[field.key] || ''}
                  onChange={e => handleConfigChange(field.key, e.target.value)}
                  className="focus:border-primary w-full rounded-lg border border-[color:var(--cf-border)] bg-[color:var(--cf-bg)] px-3 py-2 text-sm text-[color:var(--cf-text-strong)] focus:outline-none"
                />
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Right: Size & Preview */}
      <div className="flex flex-1 flex-col">
        {/* Size Selection */}
        <div className="border-b border-[color:var(--cf-border)] p-6">
          <label className="mb-3 block text-xs font-medium tracking-wide text-[color:var(--cf-muted)] uppercase">
            {t('widget.config.size')}
          </label>
          <div className="flex gap-2">
            {(Object.keys(sizePresets) as UnitSize[]).map(size => (
              <button
                type="button"
                key={size}
                onClick={() => setSelectedSize(size)}
                className={`rounded-lg px-4 py-2 text-sm font-medium transition-all ${
                  selectedSize === size
                    ? 'from-primary to-secondary shadow-primary/20 bg-gradient-to-r text-white shadow-lg'
                    : 'bg-[color:var(--cf-surface)] text-[color:var(--cf-muted)] hover:bg-[color:var(--cf-surface-hover)]'
                }`}
              >
                {sizePresets[size].label}
              </button>
            ))}
          </div>
          <div className="mt-2 text-xs text-[color:var(--cf-muted)]">
            {t('widget.config.gridSize')}: {layout.w} × {layout.h}
          </div>
        </div>

        {/* Preview */}
        <div className="flex-1 overflow-auto p-6">
          <div className="mb-3">
            <div className="mb-2 text-xs font-medium tracking-wide text-[color:var(--cf-muted)] uppercase">
              {t('widget.config.preview')}
            </div>
          </div>
          <div
            className="relative overflow-hidden rounded-xl border border-[color:var(--cf-border)] bg-[color:var(--cf-bg)]"
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
        <div className="border-t border-[color:var(--cf-border)] p-6">
          <button
            type="button"
            onClick={() => onSave({ ...config, size: selectedSize }, layout)}
            className="from-primary to-secondary shadow-primary/20 w-full rounded-lg bg-gradient-to-r py-3 font-medium text-white shadow-lg transition-all hover:opacity-90 active:scale-95"
          >
            {t('widget.config.saveAndAdd')}
          </button>
        </div>
      </div>
    </div>
  )
}
