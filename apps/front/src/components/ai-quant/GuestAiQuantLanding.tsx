'use client'

import type {ElementType} from 'react';
import type { QuantReturnIntentInput } from './intent-storage'
import { Activity, ArrowUp, BarChart3, Edit3, Play, Shield, Sparkles, TrendingUp, Zap } from 'lucide-react'
import { useState  } from 'react'
import { useTranslation } from 'react-i18next'
import { STRATEGY_PRESETS } from './strategy-presets'

interface GuestAiQuantLandingProps {
  onRequireLogin: (intent: QuantReturnIntentInput) => void
}

// Mock data for display purposes to make the "Strategy Square" look professional
const PRESET_DISPLAY_DATA: Record<string, {
  tags: string[]
  returnRate: string
  winRate: string
  risk: 'Low' | 'Medium' | 'High'
  icon: ElementType
}> = {
  'momentum-steady': {
    tags: ['trend', 'steady'],
    returnRate: '+12.5%',
    winRate: '68%',
    risk: 'Low',
    icon: Shield,
  },
  'momentum-aggressive': {
    tags: ['hft', 'aggressive'],
    returnRate: '+45.2%',
    winRate: '42%',
    risk: 'High',
    icon: Zap,
  },
  'grid-range': {
    tags: ['range', 'buyLowSellHigh'],
    returnRate: '+8.3%',
    winRate: '95%',
    risk: 'Low',
    icon: Activity,
  },
  'bollinger-reversion': {
    tags: ['meanReversion', 'bollinger'],
    returnRate: '+15.7%',
    winRate: '72%',
    risk: 'Medium',
    icon: TrendingUp,
  },
  'breakout-short': {
    tags: ['breakout', 'shortTerm'],
    returnRate: '+22.1%',
    winRate: '55%',
    risk: 'Medium',
    icon: BarChart3,
  },
  'dip-buy-mid': {
    tags: ['dipBuy', 'swing'],
    returnRate: '+18.4%',
    winRate: '63%',
    risk: 'Medium',
    icon: TrendingUp,
  },
}

export function GuestAiQuantLanding({ onRequireLogin }: GuestAiQuantLandingProps) {
  const { t } = useTranslation()
  const [draft, setDraft] = useState('')

  const handleSend = () => {
    onRequireLogin({
      type: 'chat',
      draft: draft.trim() || '3分钟跌1%买入，15分钟涨2%卖出，单笔10%资金',
    })
  }

  return (
    <section className="w-full space-y-5">
      {/* AI Chat Section */}
      <div className="rounded-2xl border border-[color:var(--cf-border)] bg-[color:var(--cf-surface)] px-5 py-4 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 text-white shadow-sm">
            <Sparkles className="h-4 w-4" />
          </div>
          <div className="min-w-0">
            <h1 className="!text-base !font-semibold !leading-6 text-[color:var(--cf-text-strong)]">{t('aiQuant.guestLanding.title')}</h1>
            <p className="!text-sm !font-normal !leading-[22px] text-[color:var(--cf-muted)]">
              {t('aiQuant.guestLanding.subtitle')}
            </p>
          </div>
        </div>

        <div className="group relative mt-4 rounded-2xl border border-[color:var(--cf-border)] bg-[color:var(--cf-bg)] px-4 py-3 shadow-inner transition-colors focus-within:border-primary/50 focus-within:ring-1 focus-within:ring-primary/20 hover:border-primary/30">
          <textarea
            value={draft}
            onChange={event => setDraft(event.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                if (draft.trim()) {
                  handleSend()
                }
              }
            }}
            placeholder={t('aiQuant.inputPlaceholder')}
            className="min-h-[88px] w-full resize-none bg-transparent !text-sm !font-normal !leading-[22px] text-[color:var(--cf-text)] outline-none placeholder:text-[color:var(--cf-muted)]"
          />
          <div className="mt-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setDraft('3分钟跌1%买入，15分钟涨2%卖出，单笔10%资金')}
                className="rounded-full border border-[color:var(--cf-border)] bg-[color:var(--cf-surface)] px-3 py-1.5 !text-xs !font-semibold !leading-5 text-[color:var(--cf-muted)] transition-colors hover:bg-[color:var(--cf-bg)] hover:text-[color:var(--cf-text)]"
              >
                {t('aiQuant.guestLanding.tryExample')}
              </button>
            </div>
            <button
              type="button"
              onClick={handleSend}
              disabled={!draft.trim()}
              title={t('aiQuant.send')}
              className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-white shadow-sm transition-colors hover:bg-primary/90 disabled:cursor-not-allowed disabled:bg-[color:var(--cf-border)] disabled:text-[color:var(--cf-muted)] disabled:shadow-none"
              aria-label={t('aiQuant.send')}
            >
              <ArrowUp className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Strategy Square Section */}
      <section className="space-y-3">
        <div className="flex items-center justify-between px-1">
          <div>
            <h2 className="!text-[15px] !font-semibold !leading-[22px] text-[color:var(--cf-text-strong)]">{t('aiQuant.guestLanding.plazaTitle')}</h2>
            <p className="mt-1 !text-sm !font-normal !leading-[22px] text-[color:var(--cf-muted)]">{t('aiQuant.guestLanding.plazaSubtitle')}</p>
          </div>
          {/* Optional: Add a "View All" link here if needed */}
        </div>

        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
          {STRATEGY_PRESETS.map(item => {
            const display = PRESET_DISPLAY_DATA[item.id] || {
              tags: ['通用'],
              returnRate: '--',
              winRate: '--',
              risk: 'Medium',
              icon: Activity,
            }
            const Icon = display.icon

            return (
              <article
                key={item.id}
                className="group flex flex-col justify-between rounded-2xl border border-[color:var(--cf-border)] bg-[color:var(--cf-surface)] px-5 py-4 transition-colors hover:border-primary/30 hover:bg-[color:var(--cf-surface-hover)]"
              >
                <div>
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[color:var(--cf-bg)] text-primary transition-colors group-hover:bg-primary/10 group-hover:text-primary">
                        <Icon className="h-4 w-4" />
                      </div>
                      <div className="min-w-0">
                        <h3 className="truncate !text-sm !font-semibold !leading-[22px] text-[color:var(--cf-text-strong)]">{t(`aiQuant.strategies.${item.id}.name`, { defaultValue: item.name })}</h3>
                        <div className="mt-1 flex flex-wrap gap-1.5">
                          {display.tags.map(tag => (
                            <span
                              key={tag}
                              className="inline-flex items-center rounded-full border border-[color:var(--cf-border)] bg-[color:var(--cf-bg)] px-2 py-0.5 !text-[10px] !font-semibold !leading-4 text-[color:var(--cf-muted)]"
                            >
                              {t(`aiQuant.strategies.${item.id}.tags.${tag}`, { defaultValue: tag })}
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>

                  <p className="mt-3 line-clamp-2 !text-sm !font-normal !leading-[22px] text-[color:var(--cf-muted)]">
                    {t(`aiQuant.strategies.${item.id}.desc`, { defaultValue: item.desc })}
                  </p>

                  <div className="mt-3 flex items-center gap-4 rounded-2xl bg-[color:var(--cf-bg)] px-3 py-2">
                    <div>
                      <div className="!text-xs !font-normal !leading-5 text-[color:var(--cf-muted)]">{t('aiQuant.guestLanding.backtestReturn')}</div>
                      <div className="font-mono !text-sm !font-semibold !leading-[22px] text-green-500">{display.returnRate}</div>
                    </div>
                    <div className="h-8 w-px bg-[color:var(--cf-border)]" />
                    <div>
                      <div className="!text-xs !font-normal !leading-5 text-[color:var(--cf-muted)]">{t('aiQuant.guestLanding.winRate')}</div>
                      <div className="font-mono !text-sm !font-semibold !leading-[22px] text-[color:var(--cf-text)]">{display.winRate}</div>
                    </div>
                  </div>
                </div>

                <div className="mt-4 grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => onRequireLogin({ type: 'run', strategyId: item.id })}
                    className="flex items-center justify-center gap-1.5 rounded-full bg-gradient-to-r from-indigo-500 to-purple-600 px-3.5 py-1.5 !text-xs !font-semibold !leading-5 text-white shadow-sm transition-colors hover:from-indigo-600 hover:to-purple-700"
                  >
                    <Play className="h-4 w-4 fill-current" />
                    {t('aiQuant.run')}
                  </button>
                  <button
                    type="button"
                    onClick={() => onRequireLogin({ type: 'edit', strategyId: item.id })}
                    className="flex items-center justify-center gap-1.5 rounded-full border border-[color:var(--cf-border)] bg-transparent px-3.5 py-1.5 !text-xs !font-semibold !leading-5 text-[color:var(--cf-text-strong)] transition-colors hover:border-[color:var(--cf-text-strong)] hover:bg-[color:var(--cf-bg)]"
                  >
                    <Edit3 className="h-4 w-4" />
                    {t('aiQuant.edit')}
                  </button>
                </div>
              </article>
            )
          })}
        </div>
      </section>
    </section>
  )
}
