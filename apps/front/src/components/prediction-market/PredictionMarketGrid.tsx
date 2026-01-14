'use client';

/* eslint-disable perfectionist/sort-imports -- 按语义分组导入，保持与其他组件一致 */

import type { PredictionCardProps, PredictionRulesMeta } from './PredictionCard';
import { Bitcoin, Coins, Globe, Landmark, Rocket, Shield } from 'lucide-react';
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { LoadingState } from '@/components/ui/loading';
import { Modal } from '@/components/ui/Modal';
import type { PredictionMarketCardResponse } from '@/lib/api';
import { fetchPredictionMarkets } from '@/lib/api';
import { useMockData } from '@/hooks/use-mock-data';
import { formatDateTimeFull, formatNumber } from '@/lib/formatters';
import { PredictionCard } from './PredictionCard';

type PredictionMarketItem = PredictionCardProps & {
  rules?: PredictionRulesMeta;
};

const ICONS = [Bitcoin, Rocket, Coins, Shield, Globe, Landmark] as const;
const ICON_BG_CLASSES = [
  'bg-orange-500',
  'bg-primary',
  'bg-secondary',
  'bg-indigo-600',
  'bg-slate-600',
  'bg-purple-600',
] as const;

function formatProbability(raw?: string | null): string | undefined {
  if (!raw) return undefined;
  const num = Number.parseFloat(raw);
  if (Number.isNaN(num)) return raw;
  const pct = num <= 1 ? num * 100 : num;
  return `${pct.toFixed(0)}%`;
}

function hashCode(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash) + str.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

const ISO_DATE_REGEX = /\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z?/g;

function formatRuleText(text: string): string {
  return text.replace(ISO_DATE_REGEX, match => formatDateTimeFull(match));
}

function mapToPredictionItem(item: PredictionMarketCardResponse): PredictionMarketItem {
  const hash = hashCode(item.id);
  const Icon = ICONS[hash % ICONS.length];
  const iconBgColor = ICON_BG_CLASSES[hash % ICON_BG_CLASSES.length];

  return {
    id: item.id,
    title: item.title,
    icon: <Icon className="w-5 h-5 text-white" />,
    iconBgColor,
    options: item.options?.map(opt => ({
      label: opt.label,
      probability: formatProbability(opt.probability) ?? '',
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
  };
}

export const PredictionMarketGrid = () => {
  const { t } = useTranslation();
  const [selectedPrediction, setSelectedPrediction] = useState<PredictionMarketItem | null>(null);
  const [modalLoading, setModalLoading] = useState(false);

  const { data: predictions, loading, error, reload } = useMockData(
    async () => {
      const result = await fetchPredictionMarkets({ onlyActive: true, limit: 48 });
      return result.map(item => mapToPredictionItem(item));
    },
    [],
    {
      delay: 0,
      ignoreQueryOverrides: true,
    },
  );

  const handleCardClick = (p: PredictionMarketItem) => {
    setModalLoading(true);
    setSelectedPrediction(p);
    // Modal internal loading: 800-1200ms
    setTimeout(() => setModalLoading(false), 1000);
  };

  return (
    <div className="space-y-4 md:space-y-8">
      <div className="relative min-h-[400px]">
        <LoadingState isLoading={loading} error={error} onRetry={reload}>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 pb-12 animate-in fade-in duration-500">
            {predictions?.map(prediction => (
              <div key={prediction.id} onClick={() => handleCardClick(prediction)} className="cursor-pointer">
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
          <div className="flex gap-4 items-start pb-4 border-b border-[#30363d]">
            <div className={`w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 ${selectedPrediction?.iconBgColor || 'bg-[#374151]'}`}>
              {selectedPrediction?.icon}
            </div>
            <div>
              <h3 className="text-xl font-bold text-white leading-tight">{selectedPrediction?.title}</h3>
              <div className="flex gap-3 mt-2">
                <span className="text-xs text-[#8b949e]">{t('predictionMarket.modal.volume')}: {selectedPrediction?.volume ?? '-'}</span>
                <span className="text-xs text-[#f87171] font-bold">
                  ● {t(`predictionMarket.status.${(selectedPrediction?.status || 'LIVE').toLowerCase()}`, { defaultValue: selectedPrediction?.status || 'LIVE' })}
                </span>
              </div>
            </div>
          </div>

          {/* Outcomes (read-only) */}
          {(selectedPrediction?.options?.length || selectedPrediction?.probability) && (
            <div className="space-y-3">
              <p className="text-sm font-bold text-[#8b949e] uppercase tracking-wider">{t('predictionMarket.modal.outcomes')}</p>
              {selectedPrediction?.options?.length ? (
                <div className="space-y-3">
                  {selectedPrediction.options.map((opt, idx) => (
                    <div
                      key={`${opt.label}-${idx}`}
                      className="w-full flex justify-between items-center p-4 bg-[#0d1117] border border-[#30363d] rounded-xl"
                    >
                      <span className="text-white font-bold">{opt.label}</span>
                      <span className="text-primary font-bold">{opt.probability}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="py-8 text-center bg-[#0d1117] rounded-xl border border-[#30363d]">
                  <p className="text-3xl font-bold text-white mb-1">{selectedPrediction?.probability}</p>
                  <p className="text-[#8b949e] text-xs uppercase tracking-widest">{t('predictionMarket.modal.probability')}</p>
                </div>
              )}
            </div>
          )}

          {/* Rules */}
          <div className="space-y-4 pt-2">
            <h4 className="text-lg font-bold text-white">{t('predictionMarket.modal.rules')}</h4>
            <div className="text-sm leading-relaxed text-[#e6edf3] px-1">
              {(selectedPrediction?.rules?.paragraphs || []).map((p, idx) => (
                <React.Fragment key={idx}>
                  <p>{formatRuleText(p)}</p>
                  {idx !== (selectedPrediction?.rules?.paragraphs?.length ?? 0) - 1 && <div className="h-5" />}
                </React.Fragment>
              ))}
            </div>

            {selectedPrediction?.rules?.createdAt && (
              <div className="pt-6 border-t border-[#30363d] text-xs text-[#8b949e]">
                <span className="font-bold">
                  {t('predictionMarket.modal.createdAt', { date: formatDateTimeFull(selectedPrediction.rules.createdAt) })}
                </span>
              </div>
            )}
          </div>
        </div>
      </Modal>
    </div>
  );
};

