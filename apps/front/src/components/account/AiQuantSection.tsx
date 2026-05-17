'use client'

import { Activity, Plus, ShieldCheck, Sparkles } from 'lucide-react'
import Link from 'next/link'
import { useTranslation } from 'react-i18next'
import { AiQuantStrategyList } from './AiQuantStrategyList'

export function AiQuantSection({ lng }: { lng: 'zh' | 'en' }) {
  const { t } = useTranslation()
  return (
    <section className="cf-ai-quant-section space-y-5">
      <section className="cf-ai-console-card overflow-hidden rounded-2xl border border-[color:var(--cf-border)] bg-[color:var(--cf-surface)]">
        <div className="flex min-h-[72px] flex-col gap-3 px-5 py-4 md:flex-row md:items-center md:justify-between">
          <div className="flex min-w-0 items-start gap-3">
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-primary/20 bg-primary/10 text-primary">
                <Activity className="h-4 w-4" />
            </span>
            <div className="min-w-0">
              <p className="!text-[15px] !font-semibold leading-[22px] text-[color:var(--cf-text-strong)]">
                {t('aiQuant.consoleTitle', { defaultValue: 'AI 量化控制台' })}
              </p>
              <p className="mt-1 max-w-2xl text-sm leading-[22px] text-[color:var(--cf-muted)]">
                {t('aiQuant.consoleSubtitle', {
                  defaultValue: '管理运行中的自动化策略、交易所连接和执行状态。',
                })}
              </p>
            </div>
          </div>

          <div data-testid="ai-quant-section-actions" className="grid grid-cols-2 gap-2 sm:flex sm:flex-row md:shrink-0 md:self-center">
            <Link
              href={`/${lng}/ai-quant/plaza`}
              className="cf-primary-cta inline-flex min-h-10 w-full items-center justify-center gap-1.5 rounded-xl px-3 py-2 text-xs font-semibold leading-5 whitespace-nowrap !text-white transition sm:min-h-9 sm:w-auto sm:rounded-full sm:px-3.5 sm:py-1.5"
            >
              <Sparkles className="h-4 w-4" />
              {t('aiQuant.plaza')}
            </Link>
            <Link
              href={`/${lng}/ai-quant`}
              className="cf-primary-cta inline-flex min-h-10 w-full items-center justify-center gap-1.5 rounded-xl px-3 py-2 text-xs font-semibold leading-5 whitespace-nowrap !text-white transition sm:min-h-9 sm:w-auto sm:rounded-full sm:px-3.5 sm:py-1.5"
            >
              <Plus className="h-4 w-4" />
              {t('aiQuant.createStrategy')}
            </Link>
          </div>
        </div>

        <div className="cf-ai-console-note border-t border-[color:var(--cf-border)] bg-[color:var(--cf-bg)]/50 px-5 py-3">
          <div className="flex items-start gap-2 text-sm leading-[22px] text-[color:var(--cf-muted)]">
            <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" />
            <span>
              {t('aiQuant.consoleApiReady', {
                defaultValue: '交易所 API 已配置后即可部署运行策略。',
              })}
            </span>
          </div>
        </div>
      </section>

      <AiQuantStrategyList lng={lng} />
    </section>
  )
}
