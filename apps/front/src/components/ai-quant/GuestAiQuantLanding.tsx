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
    tags: ['oscillation', 'grid'],
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
    <section className="w-full space-y-8">
      {/* AI Chat Section */}
      <div className="rounded-2xl border border-[color:var(--cf-border)] bg-[color:var(--cf-surface)] p-6 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 text-white shadow-md">
            <Sparkles className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-[color:var(--cf-text-strong)]">{t('aiQuant.guestLanding.title')}</h1>
            <p className="text-sm text-[color:var(--cf-muted)]">
              {t('aiQuant.guestLanding.subtitle')}
            </p>
          </div>
        </div>

        <div className="group mt-6 relative rounded-3xl border border-[color:var(--cf-border)] bg-[color:var(--cf-bg)] p-4 shadow-inner transition-all focus-within:border-primary/50 focus-within:ring-4 focus-within:ring-primary/10 hover:border-primary/30">
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
            className="min-h-[100px] w-full resize-none bg-transparent text-base leading-relaxed text-[color:var(--cf-text)] outline-none placeholder:text-[color:var(--cf-muted)]"
          />
          <div className="mt-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setDraft('3分钟跌1%买入，15分钟涨2%卖出，单笔10%资金')}
                className="rounded-full border border-[color:var(--cf-border)] bg-[color:var(--cf-surface)] px-3 py-1.5 text-xs font-medium text-[color:var(--cf-muted)] transition-colors hover:bg-[color:var(--cf-bg)] hover:text-[color:var(--cf-text)]"
              >
                {t('aiQuant.guestLanding.tryExample')}
              </button>
            </div>
            <button
              type="button"
              onClick={handleSend}
              disabled={!draft.trim()}
              title={t('aiQuant.send')}
              className="flex h-10 w-10 items-center justify-center rounded-full bg-primary text-white shadow-md transition-all hover:bg-primary/90 hover:scale-105 hover:shadow-lg disabled:cursor-not-allowed disabled:bg-[color:var(--cf-border)] disabled:text-[color:var(--cf-muted)] disabled:scale-100 disabled:shadow-none"
              aria-label={t('aiQuant.send')}
            >
              <ArrowUp className="h-5 w-5" />
            </button>
          </div>
        </div>
      </div>

      {/* Strategy Square Section */}
      <section className="space-y-4">
        <div className="flex items-center justify-between px-1">
          <div>
            <h2 className="text-xl font-bold text-[color:var(--cf-text-strong)]">{t('aiQuant.guestLanding.plazaTitle')}</h2>
            <p className="mt-1 text-sm text-[color:var(--cf-muted)]">{t('aiQuant.guestLanding.plazaSubtitle')}</p>
          </div>
          {/* Optional: Add a "View All" link here if needed */}
        </div>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
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
                className="group flex flex-col justify-between rounded-2xl border border-[color:var(--cf-border)] bg-[color:var(--cf-surface)] p-5 transition-all hover:border-primary/30 hover:shadow-lg hover:-translate-y-0.5"
              >
                <div>
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[color:var(--cf-bg)] text-primary group-hover:bg-primary/10 group-hover:text-primary transition-colors">
                        <Icon className="h-5 w-5" />
                      </div>
                      <div>
                        <h3 className="font-bold text-[color:var(--cf-text-strong)]">{t(`aiQuant.strategies.${item.id}.name`, { defaultValue: item.name })}</h3>
                        <div className="mt-1 flex flex-wrap gap-1.5">
                          {display.tags.map(tag => (
                            <span
                              key={tag}
                              className="inline-flex items-center rounded-md bg-[color:var(--cf-bg)] px-1.5 py-0.5 text-[10px] font-medium text-[color:var(--cf-muted)] border border-[color:var(--cf-border)]"
                            >
                              {t(`aiQuant.strategies.${item.id}.tags.${tag}`, { defaultValue: tag })}
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>

                  <p className="mt-4 line-clamp-2 text-sm leading-relaxed text-[color:var(--cf-muted)]">
                    {t(`aiQuant.strategies.${item.id}.desc`, { defaultValue: item.desc })}
                  </p>

                  <div className="mt-4 flex items-center gap-4 rounded-xl bg-[color:var(--cf-bg)] px-3 py-2">
                    <div>
                      <div className="text-xs text-[color:var(--cf-muted)]">{t('aiQuant.guestLanding.backtestReturn')}</div>
                      <div className="font-mono text-sm font-bold text-green-500">{display.returnRate}</div>
                    </div>
                    <div className="h-8 w-px bg-[color:var(--cf-border)]" />
                    <div>
                      <div className="text-xs text-[color:var(--cf-muted)]">{t('aiQuant.guestLanding.winRate')}</div>
                      <div className="font-mono text-sm font-bold text-[color:var(--cf-text)]">{display.winRate}</div>
                    </div>
                  </div>
                </div>

                <div className="mt-5 grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => onRequireLogin({ type: 'run', strategyId: item.id })}
                    className="flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-indigo-500 to-purple-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-all hover:from-indigo-600 hover:to-purple-700 active:scale-95"
                  >
                    <Play className="h-4 w-4 fill-current" />
                    {t('aiQuant.run')}
                  </button>
                  <button
                    type="button"
                    onClick={() => onRequireLogin({ type: 'edit', strategyId: item.id })}
                    className="flex items-center justify-center gap-2 rounded-xl border border-[color:var(--cf-border)] bg-transparent px-4 py-2.5 text-sm font-semibold text-[color:var(--cf-text-strong)] transition-all hover:bg-[color:var(--cf-bg)] hover:border-[color:var(--cf-text-strong)] active:scale-95"
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
