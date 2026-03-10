'use client'

import type { QuantParams } from '@/app/[lng]/ai-quant/AiQuantPageClient'
import { SendHorizontal } from 'lucide-react'
import { useState } from 'react'

export interface QuantMessage {
  id: string
  role: 'assistant' | 'user'
  content: string
}

interface QuantChatPanelProps {
  messages: QuantMessage[]
  params: QuantParams
  compactMode?: boolean
  onParamsChange: (next: QuantParams) => void
  onSend: (input: string) => void
  onRunBacktest: () => void
  canRunBacktest?: boolean
}

export function QuantChatPanel({
  messages,
  params,
  compactMode = false,
  onParamsChange,
  onSend,
  onRunBacktest,
  canRunBacktest = true,
}: QuantChatPanelProps) {
  const [input, setInput] = useState('')

  const submit = () => {
    if (!input.trim()) return
    onSend(input)
    setInput('')
  }

  return (
    <section className="rounded-2xl border border-[color:var(--cf-border)] bg-[color:var(--cf-surface)] p-5">
      <h2 className="text-lg font-semibold text-[color:var(--cf-text-strong)]">策略对话</h2>

      <div
        className={`mt-4 overflow-y-auto rounded-xl border border-[color:var(--cf-border)] bg-[color:var(--cf-bg)] p-3 transition-all duration-300 ${
          compactMode ? 'h-[240px]' : 'h-[520px]'
        }`}
      >
        <div className="space-y-3">
          {messages.map(message => (
            <div key={message.id} className={`flex ${message.role === 'assistant' ? 'justify-start' : 'justify-end'}`}>
              <div className={`max-w-[78%] ${message.role === 'assistant' ? '' : 'text-right'}`}>
                <div className="mb-1 text-xs text-[color:var(--cf-muted)]">
                {message.role === 'assistant' ? 'AI' : '你'}
                </div>
                <div
                  className={`rounded-lg border px-3 py-2 text-sm ${
                    message.role === 'assistant'
                      ? 'border-[color:var(--cf-border)] bg-[color:var(--cf-surface)] text-[color:var(--cf-text)]'
                      : 'border-violet-500/30 bg-violet-500/10 text-[color:var(--cf-text-strong)]'
                  }`}
                >
                  {message.content}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="mt-4 grid gap-3 rounded-xl border border-[color:var(--cf-border)] bg-[color:var(--cf-bg)] p-3 md:grid-cols-3">
        <label className="text-xs text-[color:var(--cf-muted)]">
          交易所
          <select
            className="mt-1 h-9 w-full rounded-lg border border-[color:var(--cf-border)] bg-[color:var(--cf-surface)] px-2 text-sm text-[color:var(--cf-text)]"
            value={params.exchange}
            onChange={event => onParamsChange({ ...params, exchange: event.target.value as 'binance' | 'okx' })}
          >
            <option value="binance">Binance</option>
            <option value="okx">OKX</option>
          </select>
        </label>

        <label className="text-xs text-[color:var(--cf-muted)]">
          交易对
          <input
            className="mt-1 h-9 w-full rounded-lg border border-[color:var(--cf-border)] bg-[color:var(--cf-surface)] px-2 text-sm text-[color:var(--cf-text)]"
            value={params.symbol}
            onChange={event => onParamsChange({ ...params, symbol: event.target.value })}
          />
        </label>

        <label className="text-xs text-[color:var(--cf-muted)]">
          单笔仓位(%)
          <input
            type="number"
            min={1}
            max={100}
            className="mt-1 h-9 w-full rounded-lg border border-[color:var(--cf-border)] bg-[color:var(--cf-surface)] px-2 text-sm text-[color:var(--cf-text)]"
            value={params.positionPct}
            onChange={event => onParamsChange({ ...params, positionPct: Number(event.target.value || 0) })}
          />
        </label>
      </div>

      <div className="mt-4 flex flex-col gap-3 md:flex-row">
        <input
          className="h-10 flex-1 rounded-xl border border-[color:var(--cf-border)] bg-[color:var(--cf-bg)] px-3 text-sm text-[color:var(--cf-text)]"
          placeholder="例如：3分钟跌1%买入，15分钟涨2%卖出，单笔10%资金"
          value={input}
          onChange={event => setInput(event.target.value)}
          onKeyDown={event => {
            if (event.key === 'Enter') submit()
          }}
        />
        <button
          type="button"
          onClick={submit}
          className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-[color:var(--cf-border)] bg-[color:var(--cf-surface)] px-4 text-sm font-semibold text-[color:var(--cf-text-strong)]"
        >
          <SendHorizontal className="h-4 w-4" />
          发送
        </button>
        <button
          type="button"
          onClick={onRunBacktest}
          disabled={!canRunBacktest}
          className="from-primary to-secondary h-10 rounded-xl bg-gradient-to-r px-4 text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-40"
        >
          开始回测
        </button>
      </div>
    </section>
  )
}
