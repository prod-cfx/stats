'use client'

import type { QuantReturnIntentInput } from './intent-storage'
import { useState } from 'react'
import { STRATEGY_PRESETS } from './strategy-presets'

interface GuestAiQuantLandingProps {
  onRequireLogin: (intent: QuantReturnIntentInput) => void
}

export function GuestAiQuantLanding({ onRequireLogin }: GuestAiQuantLandingProps) {
  const [draft, setDraft] = useState('')

  return (
    <section className="w-full space-y-4">
      <div className="rounded-2xl border border-[color:var(--cf-border)] bg-[color:var(--cf-surface)] p-5">
        <h1 className="text-2xl font-bold text-[color:var(--cf-text-strong)]">AI量化</h1>
        <p className="mt-1 text-sm text-[color:var(--cf-muted)]">
          先浏览精选策略。需要运行、编辑或发起 AI 对话时登录即可自动续操作。
        </p>

        <div className="mt-4 rounded-2xl border border-[color:var(--cf-border)] bg-[color:var(--cf-bg)] px-3 py-2">
          <input
            value={draft}
            onChange={event => setDraft(event.target.value)}
            placeholder="例如：3分钟跌1%买入，15分钟涨2%卖出，单笔10%资金"
            className="h-11 w-full bg-transparent text-sm text-[color:var(--cf-text)] outline-none placeholder:text-[color:var(--cf-muted)]"
          />
          <button
            type="button"
            onClick={() => onRequireLogin({ type: 'chat', draft: draft.trim() || '3分钟跌1%买入，15分钟涨2%卖出，单笔10%资金' })}
            className="mt-2 h-9 rounded-xl border border-[color:var(--cf-border)] px-3 text-sm font-semibold text-[color:var(--cf-text-strong)]"
          >
            发送（需登录）
          </button>
        </div>
      </div>

      <section className="rounded-2xl border border-[color:var(--cf-border)] bg-[color:var(--cf-surface)] p-5">
        <h2 className="text-lg font-semibold text-[color:var(--cf-text-strong)]">精选策略</h2>
        <p className="mt-1 text-sm text-[color:var(--cf-muted)]">先看策略效果，登录后可立即运行或继续编辑。</p>
        <div className="mt-4 grid gap-3 md:grid-cols-3">
          {STRATEGY_PRESETS.map(item => (
            <article key={item.id} className="rounded-xl border border-[color:var(--cf-border)] bg-[color:var(--cf-bg)] p-4">
              <h3 className="text-base font-semibold text-[color:var(--cf-text-strong)]">{item.name}</h3>
              <p className="mt-1 text-sm text-[color:var(--cf-muted)]">{item.desc}</p>
              <div className="mt-4 grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => onRequireLogin({ type: 'run', strategyId: item.id })}
                  className="rounded-lg bg-gradient-to-r from-primary to-secondary px-3 py-1.5 text-sm font-semibold text-white"
                >
                  运行
                </button>
                <button
                  type="button"
                  onClick={() => onRequireLogin({ type: 'edit', strategyId: item.id })}
                  className="rounded-lg border border-[color:var(--cf-border)] px-3 py-1.5 text-sm font-semibold text-[color:var(--cf-text-strong)]"
                >
                  编辑
                </button>
              </div>
            </article>
          ))}
        </div>
      </section>
    </section>
  )
}
