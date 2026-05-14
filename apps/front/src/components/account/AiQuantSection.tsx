'use client'

import { Activity, Plus, ShieldCheck, Sparkles } from 'lucide-react'
import Link from 'next/link'
import { useTranslation } from 'react-i18next'
import { AiQuantStrategyList } from './AiQuantStrategyList'

export function AiQuantSection({ lng }: { lng: 'zh' | 'en' }) {
  const { t } = useTranslation()
  return (
    <section className="cf-ai-quant-section space-y-5">
      <section className="cf-ai-console-card overflow-hidden rounded-lg border border-[color:var(--cf-border)] bg-[color:var(--cf-surface)]">
        <div className="flex flex-col gap-5 p-5 md:flex-row md:items-start md:justify-between">
          <div className="min-w-0 space-y-3">
            <div className="flex items-center gap-2">
              <span className="flex h-9 w-9 items-center justify-center rounded-lg border border-primary/20 bg-primary/10 text-primary">
                <Activity className="h-4 w-4" />
              </span>
              <div>
                <h2 className="text-xl font-semibold text-[color:var(--cf-text-strong)]">
                  {t('aiQuant.consoleTitle', { defaultValue: 'AI 量化控制台' })}
                </h2>
              </div>
            </div>
            <p className="max-w-2xl text-sm leading-6 text-[color:var(--cf-muted)]">
              {t('aiQuant.consoleSubtitle', {
                defaultValue: '管理运行中的自动化策略、交易所连接和执行状态。',
              })}
            </p>
          </div>

          <div data-testid="ai-quant-section-actions" className="flex flex-col gap-3 sm:flex-row">
            <Link
              href={`/${lng}/ai-quant/plaza`}
              className="cf-primary-cta inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-lg px-5 text-sm font-semibold !text-white transition sm:w-auto"
            >
              <Sparkles className="h-4 w-4" />
              {t('aiQuant.plaza')}
            </Link>
            <Link
              href={`/${lng}/ai-quant`}
              className="cf-primary-cta inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-lg px-5 text-sm font-semibold !text-white transition sm:w-auto"
            >
              <Plus className="h-4 w-4" />
              {t('aiQuant.createStrategy')}
            </Link>
          </div>
        </div>

        <div className="cf-ai-console-note border-t border-[color:var(--cf-border)] bg-[color:var(--cf-bg)]/50 px-5 py-3">
          <div className="flex items-start gap-2 text-xs leading-5 text-[color:var(--cf-muted)]">
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
