'use client'

import type { DynamicParamSchema, DynamicParamValues } from './dynamic-params'
import type { LlmClarificationGate, LlmPublicationGate } from '@/lib/api'
import { ArrowUp, Bot, Check, Copy, Play, Settings2, User } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import {
  buildDynamicParamFields,
  parseDynamicParamInputValue,
  validateDynamicParamValues,
} from './dynamic-params'
import { ClarificationGateCard } from './ClarificationGateCard'
import { PublicationGateCard } from './PublicationGateCard'

export interface QuantMessage {
  id: string
  role: 'assistant' | 'user'
  content: string
}

interface QuantChatPanelProps {
  messages: QuantMessage[]
  paramSchema: DynamicParamSchema | null
  paramValues: DynamicParamValues
  clarificationGate?: LlmClarificationGate | null
  publicationGate?: LlmPublicationGate | null
  compactMode?: boolean // Kept for compatibility but ignored in new design
  onClarificationAnswer?: (itemKey: string, value: string) => void
  onParamChange: (key: string, value: unknown) => void
  onSend: (input: string) => void
  onRunBacktest: () => void
  canRunBacktest?: boolean
}

function getCodeLanguage(className?: string): string {
  if (!className) return 'text'
  const languageMatch = /language-([\w-]+)/.exec(className)
  return languageMatch?.[1]?.toLowerCase() || 'text'
}

function normalizeCodeText(children: unknown): string {
  return String(children ?? '').replace(/\n$/, '')
}

const BACKTEST_RANGE_PRESETS = ['7D', '30D', '90D', '1Y', 'CUSTOM'] as const

function toDateTimeLocalValue(value: unknown): string {
  if (typeof value !== 'string' || !value.trim()) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''

  const pad = (n: number) => String(n).padStart(2, '0')
  const y = date.getFullYear()
  const m = pad(date.getMonth() + 1)
  const d = pad(date.getDate())
  const hh = pad(date.getHours())
  const mm = pad(date.getMinutes())
  return `${y}-${m}-${d}T${hh}:${mm}`
}

function fromDateTimeLocalValue(value: string): string {
  if (!value.trim()) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  return date.toISOString()
}

export function QuantChatPanel({
  messages,
  paramSchema,
  paramValues,
  clarificationGate,
  publicationGate,
  onClarificationAnswer,
  onParamChange,
  onSend,
  onRunBacktest,
  canRunBacktest = true,
}: QuantChatPanelProps) {
  const { t } = useTranslation()
  const [input, setInput] = useState('')
  const [showSettings, setShowSettings] = useState(false)
  const [copiedCodeId, setCopiedCodeId] = useState<string | null>(null)
  const chatScrollRef = useRef<HTMLDivElement>(null)
  const fields = useMemo(() => buildDynamicParamFields(paramSchema), [paramSchema])
  const validation = useMemo(
    () => validateDynamicParamValues(paramSchema, paramValues),
    [paramSchema, paramValues],
  )
  const backtestRangePreset = useMemo(() => {
    const raw = typeof paramValues.backtestRangePreset === 'string'
      ? paramValues.backtestRangePreset.toUpperCase()
      : '30D'
    return BACKTEST_RANGE_PRESETS.includes(raw as typeof BACKTEST_RANGE_PRESETS[number])
      ? raw as typeof BACKTEST_RANGE_PRESETS[number]
      : '30D'
  }, [paramValues.backtestRangePreset])

  useEffect(() => {
    const el = chatScrollRef.current
    if (!el) return
    el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' })
  }, [messages])

  const submit = () => {
    if (!input.trim()) return
    onSend(input)
    setInput('')
  }

  const copyCode = async (code: string, codeId: string) => {
    try {
      await navigator.clipboard.writeText(code)
      setCopiedCodeId(codeId)
      window.setTimeout(() => {
        setCopiedCodeId(prev => (prev === codeId ? null : prev))
      }, 1400)
    }
    catch {
      setCopiedCodeId(null)
    }
  }

  return (
    <section className="flex h-[calc(100vh-200px)] min-h-[600px] min-w-0 flex-col overflow-hidden rounded-2xl border border-[color:var(--cf-border)] bg-[color:var(--cf-surface)] shadow-sm">
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
            type="button"
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
            type="button"
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
            <div className="space-y-2 md:col-span-3">
              <span className="text-xs font-medium text-[color:var(--cf-muted)]">{t('aiQuant.backtestRange')}</span>
              <div className="flex flex-wrap gap-2">
                {BACKTEST_RANGE_PRESETS.map((preset) => {
                  const active = backtestRangePreset === preset
                  const label = preset === 'CUSTOM' ? t('aiQuant.customRange') : preset
                  return (
                    <button
                      key={preset}
                      type="button"
                      onClick={() => onParamChange('backtestRangePreset', preset)}
                      className={`rounded-md border px-2.5 py-1 text-xs font-medium transition-colors ${
                        active
                          ? 'border-primary bg-primary/10 text-primary'
                          : 'border-[color:var(--cf-border)] text-[color:var(--cf-text)] hover:bg-[color:var(--cf-surface)]'
                      }`}
                    >
                      {label}
                    </button>
                  )
                })}
              </div>
            </div>

            {backtestRangePreset === 'CUSTOM' && (
              <>
                <label className="space-y-1.5">
                  <span className="text-xs font-medium text-[color:var(--cf-muted)]">{t('aiQuant.backtestStart')}</span>
                  <input
                    type="datetime-local"
                    className="h-9 w-full rounded-lg border border-[color:var(--cf-border)] bg-[color:var(--cf-surface)] px-2 text-sm text-[color:var(--cf-text)] outline-none focus:border-primary"
                    value={toDateTimeLocalValue(paramValues.backtestStart)}
                    onChange={(event) => {
                      onParamChange('backtestStart', fromDateTimeLocalValue(event.target.value))
                    }}
                  />
                </label>
                <label className="space-y-1.5">
                  <span className="text-xs font-medium text-[color:var(--cf-muted)]">{t('aiQuant.backtestEnd')}</span>
                  <input
                    type="datetime-local"
                    className="h-9 w-full rounded-lg border border-[color:var(--cf-border)] bg-[color:var(--cf-surface)] px-2 text-sm text-[color:var(--cf-text)] outline-none focus:border-primary"
                    value={toDateTimeLocalValue(paramValues.backtestEnd)}
                    onChange={(event) => {
                      onParamChange('backtestEnd', fromDateTimeLocalValue(event.target.value))
                    }}
                  />
                </label>
              </>
            )}

            {fields.map(field => {
              const value = paramValues[field.key]
              const error = validation.fieldErrors[field.key]
              const fieldClassName = `h-9 w-full rounded-lg border bg-[color:var(--cf-surface)] px-2 text-sm text-[color:var(--cf-text)] outline-none focus:border-primary ${
                error ? 'border-red-500' : 'border-[color:var(--cf-border)]'
              }`

              return (
                <label key={field.key} className="space-y-1.5">
                  <span className="text-xs font-medium text-[color:var(--cf-muted)]">
                    {field.label}
                    {field.required ? ' *' : ''}
                  </span>
                  {field.control === 'select' && field.enumOptions
                    ? (
                        <select
                          className={fieldClassName}
                          value={typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean' ? String(value) : ''}
                          onChange={event => onParamChange(field.key, event.target.value)}
                        >
                          <option value="">-</option>
                          {field.enumOptions.map(option => (
                            <option key={option.value} value={option.value}>
                              {option.label}
                            </option>
                          ))}
                        </select>
                      )
                    : field.control === 'checkbox'
                      ? (
                          <input
                            type="checkbox"
                            className="h-4 w-4 rounded border border-[color:var(--cf-border)]"
                            checked={Boolean(value)}
                            onChange={event => onParamChange(field.key, event.target.checked)}
                          />
                        )
                      : field.control === 'textarea'
                        ? (
                            <textarea
                              className={`min-h-[72px] w-full rounded-lg border bg-[color:var(--cf-surface)] px-2 py-1.5 text-sm text-[color:var(--cf-text)] outline-none focus:border-primary ${
                                error ? 'border-red-500' : 'border-[color:var(--cf-border)]'
                              }`}
                              value={typeof value === 'string' ? value : JSON.stringify(value ?? '', null, 2)}
                              onChange={(event) => {
                                const raw = event.target.value
                                try {
                                  onParamChange(field.key, JSON.parse(raw))
                                } catch {
                                  onParamChange(field.key, raw)
                                }
                              }}
                            />
                          )
                        : (
                            <input
                              type={field.type === 'number' || field.type === 'integer' ? 'number' : 'text'}
                              min={field.minimum}
                              max={field.maximum}
                              className={fieldClassName}
                              value={typeof value === 'string' || typeof value === 'number' ? String(value) : ''}
                              onChange={(event) => {
                                if (field.type === 'number' || field.type === 'integer') {
                                  onParamChange(field.key, parseDynamicParamInputValue(field.type, event.target.value))
                                  return
                                }
                                onParamChange(field.key, event.target.value)
                              }}
                            />
                          )}
                  {error && (
                    <span className="text-xs text-red-500">{error}</span>
                  )}
                </label>
              )
            })}
            {fields.length === 0 && (
              <p className="text-sm text-[color:var(--cf-muted)]">{t('common.emptyTitle')}</p>
            )}
          </div>
        </div>
      )}

      {/* Chat Area */}
      <div ref={chatScrollRef} className="min-w-0 flex-1 overflow-y-auto bg-[color:var(--cf-bg)] p-4">
        <div className="space-y-6">
          {clarificationGate?.blocked && onClarificationAnswer && (
            <ClarificationGateCard gate={clarificationGate} onAnswer={onClarificationAnswer} />
          )}
          {publicationGate && <PublicationGateCard gate={publicationGate} />}
          {messages.map(message => (
            <div
              key={message.id}
              className={`flex min-w-0 gap-3 ${message.role === 'assistant' ? 'justify-start' : 'justify-end'}`}
            >
              {message.role === 'assistant' && (
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                  <Bot className="h-5 w-5" />
                </div>
              )}
              
              <div
                className={`min-w-0 max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-relaxed shadow-sm ${
                  message.role === 'assistant'
                    ? 'rounded-tl-none border border-[color:var(--cf-border)] bg-[color:var(--cf-surface)] text-[color:var(--cf-text)] [&_code]:rounded [&_code]:bg-[color:var(--cf-bg)] [&_code]:px-1.5 [&_code]:py-0.5'
                    : 'rounded-tr-none bg-primary text-white'
                }`}
              >
                {message.role === 'assistant' ? (
                  <div className="min-w-0 space-y-3 [&_a]:text-primary [&_a]:underline [&_blockquote]:border-l-2 [&_blockquote]:border-[color:var(--cf-border)] [&_blockquote]:pl-3 [&_ol]:list-decimal [&_ol]:pl-6 [&_p]:leading-7 [&_table]:w-full [&_table]:border-collapse [&_td]:border [&_td]:border-[color:var(--cf-border)] [&_td]:px-2 [&_td]:py-1 [&_th]:border [&_th]:border-[color:var(--cf-border)] [&_th]:bg-[color:var(--cf-surface-active)] [&_th]:px-2 [&_th]:py-1 [&_ul]:list-disc [&_ul]:pl-6">
                    {(() => {
                      let codeBlockIndex = 0
                      return (
                        <ReactMarkdown
                          remarkPlugins={[remarkGfm]}
                          components={{
                            code({ inline, className, children, node: _node, ...rest }: any) {
                              const rawText = String(children ?? '')
                              const hasLanguageClass = typeof className === 'string' && /language-[\w-]+/.test(className)
                              const hasLineBreak = /\r?\n/.test(rawText)
                              const shouldRenderInline = inline ?? (!hasLanguageClass && !hasLineBreak)

                              if (shouldRenderInline) {
                                return (
                                  <code className="rounded bg-[color:var(--cf-bg)] px-1.5 py-0.5" {...rest}>
                                    {children}
                                  </code>
                                )
                              }

                              const normalizedText = normalizeCodeText(children)
                              const language = getCodeLanguage(className)
                              const blockId = `${message.id}-code-${codeBlockIndex}`
                              codeBlockIndex += 1

                              return (
                                <div className="overflow-hidden rounded-xl border border-[color:var(--cf-border)] bg-[color:var(--cf-bg)]">
                                  <div className="flex items-center justify-between border-b border-[color:var(--cf-border)] bg-[color:var(--cf-surface-active)] px-3 py-2 text-xs">
                                    <span className="font-mono uppercase tracking-wide text-[color:var(--cf-muted)]">
                                      {language}
                                    </span>
                                    <button
                                      type="button"
                                      onClick={() => copyCode(normalizedText, blockId)}
                                      aria-label={copiedCodeId === blockId ? t('common.copied', { defaultValue: 'Copied' }) : t('common.copy', { defaultValue: 'Copy' })}
                                      className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-[color:var(--cf-text)] transition-colors hover:bg-[color:var(--cf-surface)]"
                                    >
                                      {copiedCodeId === blockId
                                        ? (
                                            <>
                                              <Check className="h-3.5 w-3.5" />
                                              <span>{t('common.copied', { defaultValue: 'Copied' })}</span>
                                            </>
                                          )
                                        : (
                                            <>
                                              <Copy className="h-3.5 w-3.5" />
                                              <span>{t('common.copy', { defaultValue: 'Copy' })}</span>
                                            </>
                                          )}
                                    </button>
                                  </div>
                                  <pre className="overflow-x-auto p-3 text-xs leading-6">
                                    <code className={className} {...rest}>
                                      {normalizedText}
                                    </code>
                                  </pre>
                                </div>
                              )
                            },
                          }}
                        >
                          {message.content}
                        </ReactMarkdown>
                      )
                    })()}
                  </div>
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
              if (event.key !== 'Enter' || event.shiftKey) return
              if (event.nativeEvent.isComposing || event.nativeEvent.keyCode === 229) return
              event.preventDefault()
              submit()
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
