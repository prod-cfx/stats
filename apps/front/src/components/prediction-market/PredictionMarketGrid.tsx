'use client'

/* eslint-disable perfectionist/sort-imports -- 按语义分组导入，保持与其他组件一致 */

import type { PredictionCardProps, PredictionRulesMeta } from './PredictionCard'
import { Bitcoin, Coins, Globe, Landmark, Rocket, Shield } from 'lucide-react'
import React, { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { LoadingState } from '@/components/ui/loading'
import { Modal } from '@/components/ui/Modal'
import type { PredictionMarketCardResponse } from '@/lib/api'
import { fetchPredictionMarkets } from '@/lib/api'
import { useMockData } from '@/hooks/use-mock-data'
import { formatDateTimeFull, formatNumber } from '@/lib/formatters'
import { PredictionCard } from './PredictionCard'
import { toPolymarketLocale } from './locale'

type PredictionMarketItem = PredictionCardProps & {
  rules?: PredictionRulesMeta
}

const ICONS = [Bitcoin, Rocket, Coins, Shield, Globe, Landmark] as const
const ICON_BG_CLASSES = [
  'bg-orange-500',
  'bg-primary',
  'bg-secondary',
  'bg-indigo-600',
  'bg-slate-600',
  'bg-purple-600',
] as const

function formatProbability(raw?: string | null): string | undefined {
  if (!raw) return undefined
  const num = Number.parseFloat(raw)
  if (Number.isNaN(num)) return raw
  // 缺失数据在后端可能会传空字符串；0 视为真实 0 概率。
  // 但也避免将几乎为 0 的噪声直接显示为 0%。
  if (num > 0 && num < 0.005) return '<1%'
  const pct = num <= 1 ? num * 100 : num
  return `${pct.toFixed(0)}%`
}

function hashCode(str: string): number {
  let hash = 0
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i)
    hash |= 0
  }
  return Math.abs(hash)
}

function nonEmptyString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim().length > 0 ? value : undefined
}

const ISO_DATE_REGEX = /\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z?/g

function formatRuleText(text: string): string {
  return text.replace(ISO_DATE_REGEX, match => formatDateTimeFull(match))
}

function mapToPredictionItem(item: PredictionMarketCardResponse): PredictionMarketItem {
  const seed = [
    nonEmptyString((item as any).id),
    nonEmptyString((item as any).title),
    nonEmptyString((item as any).status),
    nonEmptyString((item as any).probability),
    (item as any).volume24h != null ? String((item as any).volume24h) : undefined,
  ]
    .filter(Boolean)
    .join('|')

  const safeId = nonEmptyString((item as any).id) ?? `pm-${hashCode(seed || 'unknown')}`
  const hash = hashCode(safeId)
  const Icon = ICONS[hash % ICONS.length]
  const iconBgColor = ICON_BG_CLASSES[hash % ICON_BG_CLASSES.length]

  return {
    id: safeId,
    title: item.title,
    icon: <Icon className="h-5 w-5 text-white" />,
    iconBgColor,
    options: item.options?.map(opt => ({
      label: opt.label,
      probability: formatProbability(opt.probability) ?? '-',
    })),
    probability: formatProbability(item.probability),
    status: item.status,
    volume: item.volume24h ? `$${formatNumber(item.volume24h, 0)}` : undefined,
    rules: item.rules
      ? {
          paragraphs: item.rules.paragraphs,
          createdAt: item.rules.createdAt,
        }
      : undefined,
  }
}

export const PredictionMarketGrid = () => {
  const { t, i18n } = useTranslation()
  const [selectedPrediction, setSelectedPrediction] = useState<PredictionMarketItem | null>(null)
  const [modalLoading, setModalLoading] = useState(false)
  const locale = toPolymarketLocale(i18n.language)

  const {
    data: predictions,
    loading,
    error,
    reload,
  } = useMockData(
    async () => {
      const result = await fetchPredictionMarkets({ onlyActive: true, limit: 48, locale })
      return result.map(item => mapToPredictionItem(item))
    },
    [locale],
    {
      delay: 0,
      ignoreQueryOverrides: true,
    },
  )

  const handleCardClick = (p: PredictionMarketItem) => {
    setModalLoading(true)
    setSelectedPrediction(p)
    // Modal internal loading: 800-1200ms
    setTimeout(() => setModalLoading(false), 1000)
  }

  return (
    <div className="space-y-4 md:space-y-8">
      <div className="relative min-h-[400px]">
        <LoadingState isLoading={loading} error={error} onRetry={reload}>
          <div className="animate-in fade-in grid grid-cols-1 gap-4 pb-12 duration-500 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {predictions?.map(prediction => (
              <div
                key={prediction.id}
                onClick={() => handleCardClick(prediction)}
                className="cursor-pointer"
              >
                <PredictionCard {...prediction} />
              </div>
            ))}
          </div>
        </LoadingState>
      </div>

      {/* Detail Modal */}
      <Modal
        isOpen={!!selectedPrediction}
        onClose={() => setSelectedPrediction(null)}
        title={t('predictionMarket.modal.title')}
        width="max-w-xl"
        loading={modalLoading}
      >
        <div className="space-y-6">
          <div className="flex items-start gap-4 border-b border-[color:var(--cf-border)] pb-4">
            <div
              className={`flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-xl ${selectedPrediction?.iconBgColor || 'bg-[#374151]'}`}
            >
              {selectedPrediction?.icon}
            </div>
            <div>
              <h3 className="text-xl leading-tight font-bold text-[color:var(--cf-text-strong)]">
                {selectedPrediction?.title}
              </h3>
              <div className="mt-2 flex gap-3">
                <span className="text-xs text-[color:var(--cf-muted)]">
                  {t('predictionMarket.modal.volume')}: {selectedPrediction?.volume ?? '-'}
                </span>
                <span className="text-xs font-bold text-[#f87171]">
                  ●{' '}
                  {t(
                    `predictionMarket.status.${(selectedPrediction?.status || 'LIVE').toLowerCase()}`,
                    { defaultValue: selectedPrediction?.status || 'LIVE' },
                  )}
                </span>
              </div>
            </div>
          </div>

          {/* Outcomes (read-only) */}
          {(selectedPrediction?.options?.length || selectedPrediction?.probability) && (
            <div className="space-y-3">
              <p className="text-sm font-bold tracking-wider text-[color:var(--cf-muted)] uppercase">
                {t('predictionMarket.modal.outcomes')}
              </p>
              {selectedPrediction?.options?.length ? (
                <div className="space-y-3">
                  {selectedPrediction.options.map((opt, idx) => (
                    <div
                      key={`${opt.label}-${idx}`}
                      className="flex w-full items-center justify-between rounded-xl border border-[color:var(--cf-border)] bg-[color:var(--cf-bg)] p-4"
                    >
                      <span className="font-bold text-[color:var(--cf-text-strong)]">
                        {opt.label}
                      </span>
                      <span className="text-primary font-bold">{opt.probability}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="rounded-xl border border-[color:var(--cf-border)] bg-[color:var(--cf-bg)] py-8 text-center">
                  <p className="mb-1 text-3xl font-bold text-[color:var(--cf-text-strong)]">
                    {selectedPrediction?.probability}
                  </p>
                  <p className="text-xs tracking-widest text-[color:var(--cf-muted)] uppercase">
                    {t('predictionMarket.modal.probability')}
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Rules */}
          <div className="space-y-4 pt-2">
            <h4 className="text-lg font-bold text-[color:var(--cf-text-strong)]">
              {t('predictionMarket.modal.rules')}
            </h4>
            <div className="px-1 text-sm leading-relaxed text-[color:var(--cf-text)]">
              {(selectedPrediction?.rules?.paragraphs || []).map((p, idx) => (
                <React.Fragment key={idx}>
                  <p>{formatRuleText(p)}</p>
                  {idx !== (selectedPrediction?.rules?.paragraphs?.length ?? 0) - 1 && (
                    <div className="h-5" />
                  )}
                </React.Fragment>
              ))}
            </div>

            {selectedPrediction?.rules?.createdAt && (
              <div className="border-t border-[color:var(--cf-border)] pt-6 text-xs text-[color:var(--cf-muted)]">
                <span className="font-bold">
                  {t('predictionMarket.modal.createdAt', {
                    date: formatDateTimeFull(selectedPrediction.rules.createdAt),
                  })}
                </span>
              </div>
            )}
          </div>
        </div>
      </Modal>
    </div>
  )
}
