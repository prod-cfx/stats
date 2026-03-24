'use client'

import type { QuantParams } from '@/app/[lng]/ai-quant/AiQuantPageClient'
import type { BacktestRangePreset } from '@/components/ai-quant/backtest-range'
import { resolveBacktestRange } from '@/components/ai-quant/backtest-range'
import DOMPurify from 'dompurify'
import { ArrowUp, Bot, Check, ChevronsUpDown, Play, Search, Settings2, User } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import showdown from 'showdown'
import { useTranslation } from 'react-i18next'

export interface QuantMessage {
  id: string
  role: 'assistant' | 'user'
  content: string
}

interface QuantChatPanelProps {
  messages: QuantMessage[]
  params: QuantParams
  compactMode?: boolean // Kept for compatibility but ignored in new design
  onParamsChange: (next: QuantParams) => void
  onSend: (input: string) => void
  onRunBacktest: () => void
  canRunBacktest?: boolean
}

const SYMBOLS = [
  { value: 'BTCUSDT', label: 'BTC/USDT' },
  { value: 'ETHUSDT', label: 'ETH/USDT' },
  { value: 'SOLUSDT', label: 'SOL/USDT' },
  { value: 'BNBUSDT', label: 'BNB/USDT' },
  { value: 'XRPUSDT', label: 'XRP/USDT' },
  { value: 'ADAUSDT', label: 'ADA/USDT' },
  { value: 'DOGEUSDT', label: 'DOGE/USDT' },
  { value: 'AVAXUSDT', label: 'AVAX/USDT' },
  { value: 'DOTUSDT', label: 'DOT/USDT' },
  { value: 'MATICUSDT', label: 'MATIC/USDT' },
]

const RANGE_PRESETS: Array<{ value: BacktestRangePreset, label: '7D' | '30D' | '90D' | '1Y' | 'CUSTOM' }> = [
  { value: '7D', label: '7D' },
  { value: '30D', label: '30D' },
  { value: '90D', label: '90D' },
  { value: '1Y', label: '1Y' },
  { value: 'CUSTOM', label: 'CUSTOM' },
]

const markdownConverter = new showdown.Converter({
  ghCodeBlocks: true,
  simpleLineBreaks: true,
  strikethrough: true,
  tables: true,
  tasklists: true,
})

export function QuantChatPanel({
  messages,
  params,
  onParamsChange,
  onSend,
  onRunBacktest,
  canRunBacktest = true,
}: QuantChatPanelProps) {
  const { t } = useTranslation()
  const [input, setInput] = useState('')
  const [showSettings, setShowSettings] = useState(false)
  
  // Custom Combobox State
  const [openCombobox, setOpenCombobox] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const comboboxRef = useRef<HTMLDivElement>(null)
  const chatScrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const el = chatScrollRef.current
    if (!el) return
    el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' })
  }, [messages])

  // Click outside handler for combobox
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (comboboxRef.current && !comboboxRef.current.contains(event.target as Node)) {
        setOpenCombobox(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const submit = () => {
    if (!input.trim()) return
    onSend(input)
    setInput('')
  }

  const filteredSymbols = SYMBOLS.filter(symbol => 
    symbol.label.toLowerCase().includes(searchQuery.toLowerCase()) ||
    symbol.value.toLowerCase().includes(searchQuery.toLowerCase())
  )

  const formatDateTimeLocal = (value: string): string => {
    if (!value) return ''
    const parsed = new Date(value)
    if (Number.isNaN(parsed.getTime())) return ''
    const year = parsed.getFullYear()
    const month = String(parsed.getMonth() + 1).padStart(2, '0')
    const day = String(parsed.getDate()).padStart(2, '0')
    const hour = String(parsed.getHours()).padStart(2, '0')
    const minute = String(parsed.getMinutes()).padStart(2, '0')
    return `${year}-${month}-${day}T${hour}:${minute}`
  }

  const onPresetChange = (preset: BacktestRangePreset) => {
    if (preset === 'CUSTOM') {
      onParamsChange({ ...params, backtestRangePreset: 'CUSTOM' })
      return
    }
    const range = resolveBacktestRange({ preset })
    onParamsChange({
      ...params,
      backtestRangePreset: preset,
      backtestStart: range.startAt,
      backtestEnd: range.endAt,
    })
  }

  return (
    <section className="flex h-[calc(100vh-200px)] min-h-[600px] flex-col overflow-hidden rounded-2xl border border-[color:var(--cf-border)] bg-[color:var(--cf-surface)] shadow-sm">
      {/* Header / Toolbar */}
      <div className="flex items-center justify-between border-b border-[color:var(--cf-border)] bg-[color:var(--cf-surface-active)] px-4 py-3">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <Bot className="h-5 w-5" />
          </div>
          <h2 className="font-semibold text-[color:var(--cf-text-strong)]">{t('aiQuant.chatTitle')}</h2>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowSettings(!showSettings)}
            className={`flex items-center gap-2 rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors ${
              showSettings
                ? 'border-primary bg-primary/5 text-primary'
                : 'border-[color:var(--cf-border)] text-[color:var(--cf-text)] hover:bg-[color:var(--cf-bg)]'
            }`}
          >
            <Settings2 className="h-4 w-4" />
            <span>{t('aiQuant.paramsConfig')}</span>
          </button>
          <button
            onClick={onRunBacktest}
            disabled={!canRunBacktest}
            className="flex items-center gap-2 rounded-lg bg-gradient-to-r from-violet-500 to-purple-600 px-3 py-1.5 text-sm font-medium text-white shadow-sm transition-all hover:from-violet-600 hover:to-purple-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Play className="h-4 w-4 fill-current" />
            <span>{t('aiQuant.startBacktest')}</span>
          </button>
        </div>
      </div>

      {/* Settings Panel (Collapsible) */}
      {showSettings && (
        <div className="border-b border-[color:var(--cf-border)] bg-[color:var(--cf-bg)] px-4 py-3 transition-all">
          <div className="grid gap-4 md:grid-cols-3">
            <label className="space-y-1.5">
              <span className="text-xs font-medium text-[color:var(--cf-muted)]">{t('aiQuant.exchange')}</span>
              <select
                className="h-9 w-full rounded-lg border border-[color:var(--cf-border)] bg-[color:var(--cf-surface)] px-2 text-sm text-[color:var(--cf-text)] outline-none focus:border-primary"
                value={params.exchange}
                onChange={event => onParamsChange({ ...params, exchange: event.target.value as 'binance' | 'okx' })}
              >
                <option value="binance">Binance</option>
                <option value="okx">OKX</option>
              </select>
            </label>

            <div className="space-y-1.5 relative" ref={comboboxRef}>
              <span className="text-xs font-medium text-[color:var(--cf-muted)]">{t('aiQuant.symbol')}</span>
              <button
                type="button"
                onClick={() => setOpenCombobox(!openCombobox)}
                className="flex h-9 w-full items-center justify-between rounded-lg border border-[color:var(--cf-border)] bg-[color:var(--cf-surface)] px-3 text-sm text-[color:var(--cf-text)] outline-none hover:bg-[color:var(--cf-bg)] focus:border-primary"
              >
                {params.symbol
                  ? SYMBOLS.find((symbol) => symbol.value === params.symbol)?.label || params.symbol
                  : `${t('aiQuant.symbol')}...`}
                <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
              </button>
              
              {openCombobox && (
                <div className="absolute top-full left-0 z-50 mt-1 w-full rounded-lg border border-[color:var(--cf-border)] bg-[color:var(--cf-surface)] p-1 shadow-md">
                  <div className="flex items-center border-b border-[color:var(--cf-border)] px-2 pb-1">
                    <Search className="mr-2 h-4 w-4 opacity-50" />
                    <input
                      className="flex h-8 w-full rounded-md bg-transparent text-sm outline-none placeholder:text-[color:var(--cf-muted)]"
                      placeholder={`${t('nav.search')}...`}
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      autoFocus
                    />
                  </div>
                  <div className="max-h-[200px] overflow-y-auto py-1">
                    {filteredSymbols.length === 0 ? (
                      <div className="px-2 py-2 text-sm text-[color:var(--cf-muted)] text-center">
                        {t('common.emptyTitle')}
                      </div>
                    ) : (
                      filteredSymbols.map((symbol) => (
                        <div
                          key={symbol.value}
                          onClick={() => {
                            onParamsChange({ ...params, symbol: symbol.value })
                            setOpenCombobox(false)
                            setSearchQuery('')
                          }}
                          className={`flex cursor-pointer items-center rounded-md px-2 py-1.5 text-sm hover:bg-[color:var(--cf-bg)] ${
                            params.symbol === symbol.value ? 'bg-[color:var(--cf-bg)] font-medium' : ''
                          }`}
                        >
                          <Check
                            className={`mr-2 h-4 w-4 ${
                              params.symbol === symbol.value ? 'opacity-100' : 'opacity-0'
                            }`}
                          />
                          {symbol.label}
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>

            <label className="space-y-1.5">
              <span className="text-xs font-medium text-[color:var(--cf-muted)]">{t('aiQuant.positionPct')}</span>
              <input
                type="number"
                min={1}
                max={100}
                className="h-9 w-full rounded-lg border border-[color:var(--cf-border)] bg-[color:var(--cf-surface)] px-2 text-sm text-[color:var(--cf-text)] outline-none focus:border-primary"
                value={params.positionPct}
                onChange={event => onParamsChange({ ...params, positionPct: Number(event.target.value || 0) })}
              />
            </label>
          </div>

          <div className="mt-4 space-y-2">
            <p className="text-xs font-medium text-[color:var(--cf-muted)]">{t('aiQuant.backtestRange')}</p>
            <div className="flex flex-wrap gap-2">
              {RANGE_PRESETS.map((preset) => (
                <button
                  key={preset.value}
                  type="button"
                  onClick={() => onPresetChange(preset.value)}
                  className={`rounded-lg border px-2.5 py-1 text-xs font-semibold ${
                    params.backtestRangePreset === preset.value
                      ? 'border-primary bg-primary/10 text-primary'
                      : 'border-[color:var(--cf-border)] text-[color:var(--cf-text)] hover:bg-[color:var(--cf-surface)]'
                  }`}
                >
                  {preset.value === 'CUSTOM' ? t('aiQuant.customRange') : preset.label}
                </button>
              ))}
            </div>

            {params.backtestRangePreset === 'CUSTOM' && (
              <div className="grid gap-3 pt-1 md:grid-cols-2">
                <label className="space-y-1.5">
                  <span className="text-xs font-medium text-[color:var(--cf-muted)]">{t('aiQuant.backtestStart')}</span>
                  <input
                    type="datetime-local"
                    className="h-9 w-full rounded-lg border border-[color:var(--cf-border)] bg-[color:var(--cf-surface)] px-2 text-sm text-[color:var(--cf-text)] outline-none focus:border-primary"
                    value={formatDateTimeLocal(params.backtestStart)}
                    onChange={event => onParamsChange({
                      ...params,
                      backtestRangePreset: 'CUSTOM',
                      backtestStart: event.target.value,
                    })}
                  />
                </label>
                <label className="space-y-1.5">
                  <span className="text-xs font-medium text-[color:var(--cf-muted)]">{t('aiQuant.backtestEnd')}</span>
                  <input
                    type="datetime-local"
                    className="h-9 w-full rounded-lg border border-[color:var(--cf-border)] bg-[color:var(--cf-surface)] px-2 text-sm text-[color:var(--cf-text)] outline-none focus:border-primary"
                    value={formatDateTimeLocal(params.backtestEnd)}
                    onChange={event => onParamsChange({
                      ...params,
                      backtestRangePreset: 'CUSTOM',
                      backtestEnd: event.target.value,
                    })}
                  />
                </label>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Chat Area */}
      <div ref={chatScrollRef} className="flex-1 overflow-y-auto bg-[color:var(--cf-bg)] p-4">
        <div className="space-y-6">
          {messages.map(message => (
            <div
              key={message.id}
              className={`flex gap-3 ${message.role === 'assistant' ? 'justify-start' : 'justify-end'}`}
            >
              {message.role === 'assistant' && (
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                  <Bot className="h-5 w-5" />
                </div>
              )}
              
              <div
                className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-relaxed shadow-sm ${
                  message.role === 'assistant'
                    ? 'rounded-tl-none border border-[color:var(--cf-border)] bg-[color:var(--cf-surface)] text-[color:var(--cf-text)] [&_code]:rounded [&_code]:bg-[color:var(--cf-bg)] [&_code]:px-1.5 [&_code]:py-0.5 [&_pre]:overflow-x-auto [&_pre]:rounded-lg [&_pre]:border [&_pre]:border-[color:var(--cf-border)] [&_pre]:bg-[color:var(--cf-bg)] [&_pre]:p-3 [&_pre_code]:bg-transparent [&_pre_code]:p-0'
                    : 'rounded-tr-none bg-primary text-white'
                }`}
              >
                {message.role === 'assistant' ? (
                  <div
                    dangerouslySetInnerHTML={{
                      __html: DOMPurify.sanitize(markdownConverter.makeHtml(message.content)),
                    }}
                  />
                ) : (
                  message.content
                )}
              </div>

              {message.role === 'user' && (
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[color:var(--cf-surface-active)] text-[color:var(--cf-text-strong)]">
                  <User className="h-5 w-5" />
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Input Area */}
      <div className="border-t border-[color:var(--cf-border)] bg-[color:var(--cf-surface)] p-4">
        <div className="relative rounded-xl border border-[color:var(--cf-border)] bg-[color:var(--cf-bg)] shadow-sm focus-within:border-primary focus-within:ring-1 focus-within:ring-primary">
          <textarea
            className="max-h-[120px] min-h-[50px] w-full resize-none bg-transparent px-4 py-3 pr-12 text-sm text-[color:var(--cf-text)] outline-none placeholder:text-[color:var(--cf-muted)]"
            placeholder={t('aiQuant.inputPlaceholder')}
            value={input}
            onChange={event => setInput(event.target.value)}
            onKeyDown={event => {
              if (event.key === 'Enter' && event.shiftKey) {
                event.preventDefault()
                submit()
              }
            }}
          />
          <button
            type="button"
            onClick={submit}
            disabled={!input.trim()}
            className="absolute bottom-2 right-2 flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-white transition-all hover:bg-primary/90 disabled:cursor-not-allowed disabled:bg-[color:var(--cf-border)] disabled:text-[color:var(--cf-muted)]"
          >
            <ArrowUp className="h-5 w-5" />
          </button>
        </div>
        <p className="mt-2 text-center text-xs text-[color:var(--cf-muted)]">
          {t('aiQuant.messages.aiDisclaimer')}
        </p>
      </div>
    </section>
  )
}
