'use client'

import type { DynamicParamSchema, DynamicParamValues } from './dynamic-params'
import type { LlmClarificationGate, LlmPublicationGate } from '@/lib/api'
import { ArrowUp, Bot, Check, Copy, Play, Settings2, User } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { validateBacktestRange } from './backtest-range'
import { parseDynamicParamInputValue } from './dynamic-params'
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
const BACKTEST_PRICE_SOURCE_OPTIONS = ['open', 'close', 'mid'] as const

interface BacktestSettingField {
  key: string
  labelKey: string
  type: 'number' | 'select' | 'radio'
  helperKey?: string
  placeholderKey?: string
  errorKey?: string
  min?: number
  step?: number
  inputMode?: 'decimal' | 'numeric'
  options?: readonly string[]
}

const BACKTEST_SETTING_FIELDS: BacktestSettingField[] = [
  {
    key: 'backtestInitialCash',
    labelKey: 'aiQuant.backtestInitialCash',
    type: 'number',
    helperKey: 'aiQuant.backtestHelper.positive',
    placeholderKey: 'aiQuant.backtestPlaceholder.initialCash',
    min: 0.01,
    step: 0.01,
    inputMode: 'decimal',
  },
  {
    key: 'backtestLeverage',
    labelKey: 'aiQuant.backtestLeverage',
    type: 'number',
    helperKey: 'aiQuant.backtestHelper.positive',
    placeholderKey: 'aiQuant.backtestPlaceholder.leverage',
    min: 1,
    step: 1,
    inputMode: 'numeric',
  },
  {
    key: 'backtestSlippageBps',
    labelKey: 'aiQuant.backtestSlippageBps',
    type: 'number',
    helperKey: 'aiQuant.backtestHelper.nonNegative',
    placeholderKey: 'aiQuant.backtestPlaceholder.slippageBps',
    min: 0,
    step: 0.01,
    inputMode: 'decimal',
  },
  {
    key: 'backtestFeeBps',
    labelKey: 'aiQuant.backtestFeeBps',
    type: 'number',
    helperKey: 'aiQuant.backtestHelper.nonNegative',
    placeholderKey: 'aiQuant.backtestPlaceholder.feeBps',
    min: 0,
    step: 0.01,
    inputMode: 'decimal',
  },
  {
    key: 'backtestPriceSource',
    labelKey: 'aiQuant.backtestPriceSource',
    type: 'select',
    errorKey: 'aiQuant.backtestError.priceSource',
    options: BACKTEST_PRICE_SOURCE_OPTIONS,
  },
  {
    key: 'backtestAllowPartial',
    labelKey: 'aiQuant.backtestAllowPartialChoice',
    type: 'radio',
    errorKey: 'aiQuant.backtestError.allowPartial',
    options: ['true', 'false'],
  },
]

const BACKTEST_DRAFT_KEYS = [
  'backtestRangePreset',
  'backtestStart',
  'backtestEnd',
  ...BACKTEST_SETTING_FIELDS.map(field => field.key),
] as const

function buildBacktestDraftValues(paramValues: DynamicParamValues): DynamicParamValues {
  return Object.fromEntries(BACKTEST_DRAFT_KEYS.map(key => [key, paramValues[key]]))
}

function hasBacktestDraftChanges(current: DynamicParamValues, draft: DynamicParamValues): boolean {
  return BACKTEST_DRAFT_KEYS.some(key => {
    const currentValue = current[key]
    const draftValue = draft[key]
    return JSON.stringify(currentValue ?? null) !== JSON.stringify(draftValue ?? null)
  })
}

function parseFiniteNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string' && value.trim()) {
    const parsed = Number(value)
    return Number.isFinite(parsed) ? parsed : null
  }
  return null
}

function validateBacktestSettings(paramValues: DynamicParamValues): {
  fieldErrors: Record<string, string>
  rangeError: string | null
} {
  const fieldErrors: Record<string, string> = {}

  const initialCash = parseFiniteNumber(paramValues.backtestInitialCash)
  if (initialCash === null || initialCash <= 0) {
    fieldErrors.backtestInitialCash = 'aiQuant.messages.positiveNumber'
  }

  const leverage = parseFiniteNumber(paramValues.backtestLeverage)
  if (leverage === null || leverage <= 0) {
    fieldErrors.backtestLeverage = 'aiQuant.messages.positiveNumber'
  }

  const slippageBps = parseFiniteNumber(paramValues.backtestSlippageBps)
  if (slippageBps === null || slippageBps < 0) {
    fieldErrors.backtestSlippageBps = 'aiQuant.messages.nonNegativeNumber'
  }

  const feeBps = parseFiniteNumber(paramValues.backtestFeeBps)
  if (feeBps === null || feeBps < 0) {
    fieldErrors.backtestFeeBps = 'aiQuant.messages.nonNegativeNumber'
  }

  const priceSource =
    typeof paramValues.backtestPriceSource === 'string'
      ? paramValues.backtestPriceSource.trim()
      : ''
  if (
    !BACKTEST_PRICE_SOURCE_OPTIONS.includes(
      priceSource as (typeof BACKTEST_PRICE_SOURCE_OPTIONS)[number],
    )
  ) {
    fieldErrors.backtestPriceSource = 'aiQuant.messages.invalidPriceSource'
  }

  if (typeof paramValues.backtestAllowPartial !== 'boolean') {
    fieldErrors.backtestAllowPartial = 'aiQuant.messages.invalidBoolean'
  }

  const range = {
    preset:
      typeof paramValues.backtestRangePreset === 'string'
        ? paramValues.backtestRangePreset.toUpperCase()
        : '30D',
    startAt: typeof paramValues.backtestStart === 'string' ? paramValues.backtestStart : '',
    endAt: typeof paramValues.backtestEnd === 'string' ? paramValues.backtestEnd : '',
  }

  const rangeValidation = validateBacktestRange(
    (range.preset === 'CUSTOM'
      ? { preset: 'CUSTOM', startAt: range.startAt, endAt: range.endAt }
      : { preset: '30D' }) as Parameters<typeof validateBacktestRange>[0],
  )

  let rangeError: string | null = null
  if (range.preset === 'CUSTOM' && !rangeValidation.ok) {
    if (rangeValidation.reason === 'missing_range') {
      rangeError = 'aiQuant.messages.backtestRangeMissing'
    } else if (rangeValidation.reason === 'start_after_end') {
      rangeError = 'aiQuant.messages.backtestRangeOrderInvalid'
    } else if (rangeValidation.reason === 'range_too_large') {
      rangeError = 'aiQuant.messages.backtestRangeTooLarge'
    }
  }

  return { fieldErrors, rangeError }
}

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
  paramSchema: _paramSchema,
  paramValues,
  clarificationGate: _clarificationGate,
  publicationGate,
  onClarificationAnswer: _onClarificationAnswer,
  onParamChange,
  onSend,
  onRunBacktest,
  canRunBacktest = true,
}: QuantChatPanelProps) {
  const { t } = useTranslation()
  const [input, setInput] = useState('')
  const [showSettings, setShowSettings] = useState(false)
  const [copiedCodeId, setCopiedCodeId] = useState<string | null>(null)
  const [submittedBacktestSettings, setSubmittedBacktestSettings] = useState(false)
  const [touchedBacktestFields, setTouchedBacktestFields] = useState<Record<string, boolean>>({})
  const [backtestDraftValues, setBacktestDraftValues] = useState<DynamicParamValues>(() =>
    buildBacktestDraftValues(paramValues),
  )
  const chatScrollRef = useRef<HTMLDivElement>(null)
  const validation = useMemo(
    () => validateBacktestSettings(backtestDraftValues),
    [backtestDraftValues],
  )
  const backtestRangePreset = useMemo(() => {
    const raw =
      typeof backtestDraftValues.backtestRangePreset === 'string'
        ? backtestDraftValues.backtestRangePreset.toUpperCase()
        : '30D'
    return BACKTEST_RANGE_PRESETS.includes(raw as (typeof BACKTEST_RANGE_PRESETS)[number])
      ? (raw as (typeof BACKTEST_RANGE_PRESETS)[number])
      : '30D'
  }, [backtestDraftValues.backtestRangePreset])
  const hasDraftChanges = useMemo(
    () => hasBacktestDraftChanges(paramValues, backtestDraftValues),
    [backtestDraftValues, paramValues],
  )

  useEffect(() => {
    const el = chatScrollRef.current
    if (!el) return
    el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' })
  }, [messages])

  useEffect(() => {
    setBacktestDraftValues(buildBacktestDraftValues(paramValues))
    setTouchedBacktestFields({})
    setSubmittedBacktestSettings(false)
  }, [paramValues])

  const submit = () => {
    if (!input.trim()) return
    onSend(input)
    setInput('')
  }

  const updateBacktestDraftValue = (key: string, value: unknown) => {
    setBacktestDraftValues(prev => ({ ...prev, [key]: value }))
  }

  const touchBacktestField = (key: string) => {
    setTouchedBacktestFields(prev => (prev[key] ? prev : { ...prev, [key]: true }))
  }

  const handleConfirmBacktestParams = () => {
    if (Object.keys(validation.fieldErrors).length > 0 || validation.rangeError) {
      setSubmittedBacktestSettings(true)
      return
    }
    for (const key of BACKTEST_DRAFT_KEYS) {
      const nextValue = backtestDraftValues[key]
      const currentValue = paramValues[key]
      if (JSON.stringify(nextValue ?? null) !== JSON.stringify(currentValue ?? null)) {
        onParamChange(key, nextValue)
      }
    }
    setSubmittedBacktestSettings(false)
    setTouchedBacktestFields({})
    setShowSettings(false)
  }

  const handleCancelBacktestParams = () => {
    setBacktestDraftValues(buildBacktestDraftValues(paramValues))
    setTouchedBacktestFields({})
    setSubmittedBacktestSettings(false)
    setShowSettings(false)
  }

  const copyCode = async (code: string, codeId: string) => {
    try {
      await navigator.clipboard.writeText(code)
      setCopiedCodeId(codeId)
      window.setTimeout(() => {
        setCopiedCodeId(prev => (prev === codeId ? null : prev))
      }, 1400)
    } catch {
      setCopiedCodeId(null)
    }
  }

  return (
    <section className="flex h-[calc(100dvh-200px)] min-w-0 flex-col overflow-hidden rounded-2xl border border-[color:var(--cf-border)] bg-[color:var(--cf-surface)] shadow-sm md:h-[calc(100vh-200px)] md:min-h-[600px]">
      {/* Header / Toolbar */}
      <div className="flex items-center justify-between border-b border-[color:var(--cf-border)] bg-[color:var(--cf-surface-active)] px-4 py-3">
        <div className="flex items-center gap-2">
          <div className="bg-primary/10 text-primary flex h-8 w-8 items-center justify-center rounded-lg">
            <Bot className="h-5 w-5" />
          </div>
          <h2 className="font-semibold text-[color:var(--cf-text-strong)]">
            {t('aiQuant.chatTitle')}
          </h2>
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
            data-testid="run-backtest"
            onClick={onRunBacktest}
            disabled={!canRunBacktest || hasDraftChanges}
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
          <div className="flex max-h-[calc(100dvh-15rem)] flex-col gap-3 overflow-hidden md:max-h-[65vh]">
            <div className="flex-1 overflow-y-auto pr-1">
              <div className="grid gap-4 md:grid-cols-3">
                <div className="space-y-1 md:col-span-3">
                  <h3 className="text-sm font-semibold text-[color:var(--cf-text-strong)]">
                    {t('aiQuant.backtestSettingsTitle')}
                  </h3>
                  <p className="text-xs text-[color:var(--cf-muted)]">
                    {t('aiQuant.backtestSettingsDescription')}
                  </p>
                </div>
                <div className="space-y-2 md:col-span-3">
                  <span className="text-xs font-medium text-[color:var(--cf-muted)]">
                    {t('aiQuant.backtestRange')}
                  </span>
                  <div className="flex flex-wrap gap-2">
                    {BACKTEST_RANGE_PRESETS.map(preset => {
                      const active = backtestRangePreset === preset
                      const label = preset === 'CUSTOM' ? t('aiQuant.customRange') : preset
                      return (
                        <button
                          key={preset}
                          type="button"
                          onClick={() => updateBacktestDraftValue('backtestRangePreset', preset)}
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
                      <span className="text-xs font-medium text-[color:var(--cf-muted)]">
                        {t('aiQuant.backtestStart')}
                      </span>
                      <input
                        type="datetime-local"
                        className="focus:border-primary h-9 w-full rounded-lg border border-[color:var(--cf-border)] bg-[color:var(--cf-surface)] px-2 text-sm text-[color:var(--cf-text)] outline-none"
                        value={toDateTimeLocalValue(backtestDraftValues.backtestStart)}
                        onChange={event => {
                          updateBacktestDraftValue(
                            'backtestStart',
                            fromDateTimeLocalValue(event.target.value),
                          )
                        }}
                      />
                    </label>
                    <label className="space-y-1.5">
                      <span className="text-xs font-medium text-[color:var(--cf-muted)]">
                        {t('aiQuant.backtestEnd')}
                      </span>
                      <input
                        type="datetime-local"
                        className="focus:border-primary h-9 w-full rounded-lg border border-[color:var(--cf-border)] bg-[color:var(--cf-surface)] px-2 text-sm text-[color:var(--cf-text)] outline-none"
                        value={toDateTimeLocalValue(backtestDraftValues.backtestEnd)}
                        onChange={event => {
                          updateBacktestDraftValue(
                            'backtestEnd',
                            fromDateTimeLocalValue(event.target.value),
                          )
                        }}
                      />
                    </label>
                  </>
                )}

                {BACKTEST_SETTING_FIELDS.map(field => {
                  const value = backtestDraftValues[field.key]
                  const error = validation.fieldErrors[field.key]
                  const showError =
                    Boolean(error) &&
                    (submittedBacktestSettings || touchedBacktestFields[field.key])
                  const helperText = showError
                    ? t(field.errorKey ?? error!)
                    : field.helperKey
                      ? t(field.helperKey)
                      : null
                  const fieldClassName = `h-9 w-full rounded-lg border bg-[color:var(--cf-surface)] px-2 text-sm text-[color:var(--cf-text)] outline-none focus:border-primary ${
                    showError ? 'border-amber-400' : 'border-[color:var(--cf-border)]'
                  }`

                  return (
                    <label key={field.key} className="space-y-1.5">
                      <span className="text-xs font-medium text-[color:var(--cf-muted)]">
                        {t(field.labelKey)}
                        <span className="ml-0.5 text-[color:var(--cf-muted)]">*</span>
                      </span>
                      {field.type === 'select' && field.options ? (
                        <select
                          className={fieldClassName}
                          value={
                            typeof value === 'string' ||
                            typeof value === 'number' ||
                            typeof value === 'boolean'
                              ? String(value)
                              : ''
                          }
                          onChange={event =>
                            updateBacktestDraftValue(field.key, event.target.value)
                          }
                          onBlur={() => touchBacktestField(field.key)}
                        >
                          <option value="" disabled>
                            {t('aiQuant.backtestPlaceholder.priceSource')}
                          </option>
                          {field.options.map(option => (
                            <option key={option} value={option}>
                              {t(`aiQuant.backtestPriceSource.${option}`)}
                            </option>
                          ))}
                        </select>
                      ) : field.type === 'radio' && field.options ? (
                        <div
                          className={`grid grid-cols-2 gap-2 rounded-lg border p-1 ${
                            showError ? 'border-amber-400' : 'border-[color:var(--cf-border)]'
                          }`}
                          onBlur={event => {
                            if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
                              touchBacktestField(field.key)
                            }
                          }}
                        >
                          {field.options.map(option => {
                            const checked = value === (option === 'true')
                            return (
                              <button
                                key={option}
                                type="button"
                                onClick={() => {
                                  updateBacktestDraftValue(field.key, option === 'true')
                                  touchBacktestField(field.key)
                                }}
                                className={`rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                                  checked
                                    ? 'bg-primary text-white'
                                    : 'bg-[color:var(--cf-surface)] text-[color:var(--cf-text)] hover:bg-[color:var(--cf-surface-active)]'
                                }`}
                              >
                                {t(
                                  `aiQuant.backtestAllowPartial.${option === 'true' ? 'enabled' : 'disabled'}`,
                                )}
                              </button>
                            )
                          })}
                        </div>
                      ) : (
                        <input
                          type="number"
                          min={field.min}
                          step={field.step ?? 'any'}
                          inputMode={field.inputMode ?? 'decimal'}
                          placeholder={field.placeholderKey ? t(field.placeholderKey) : undefined}
                          className={fieldClassName}
                          value={
                            typeof value === 'string' || typeof value === 'number'
                              ? String(value)
                              : ''
                          }
                          onChange={event => {
                            updateBacktestDraftValue(
                              field.key,
                              parseDynamicParamInputValue('number', event.target.value),
                            )
                          }}
                          onBlur={() => touchBacktestField(field.key)}
                        />
                      )}
                      {helperText && (
                        <span
                          className={`text-xs ${showError ? 'text-amber-600' : 'text-[color:var(--cf-muted)]'}`}
                        >
                          {helperText}
                        </span>
                      )}
                    </label>
                  )
                })}
                {validation.rangeError && backtestRangePreset === 'CUSTOM' && (
                  <p className="text-sm text-red-500 md:col-span-3">{t(validation.rangeError)}</p>
                )}
                {hasDraftChanges && (
                  <p className="text-sm text-[color:var(--cf-muted)] md:col-span-3">
                    {t('aiQuant.backtestDraftPending')}
                  </p>
                )}
              </div>
            </div>
            <div
              data-testid="backtest-settings-actions"
              className="shrink-0 border-t border-[color:var(--cf-border)] bg-[color:var(--cf-bg)] pt-3"
            >
              <div className="grid grid-cols-2 gap-2 sm:flex sm:items-center sm:justify-end">
                <button
                  type="button"
                  onClick={handleCancelBacktestParams}
                  className="w-full rounded-lg border border-[color:var(--cf-border)] px-3 py-1.5 text-sm font-medium text-[color:var(--cf-text)] transition-colors hover:bg-[color:var(--cf-surface)] sm:w-auto"
                >
                  {t('aiQuant.backtestClosePanel')}
                </button>
                <button
                  type="button"
                  onClick={handleConfirmBacktestParams}
                  disabled={
                    !hasDraftChanges ||
                    Object.keys(validation.fieldErrors).length > 0 ||
                    Boolean(validation.rangeError)
                  }
                  className="bg-primary w-full rounded-lg px-3 py-1.5 text-sm font-medium text-white transition-colors disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
                >
                  {t('aiQuant.backtestConfirmSettings')}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Chat Area */}
      <div
        ref={chatScrollRef}
        className="min-w-0 flex-1 overflow-y-auto bg-[color:var(--cf-bg)] p-4"
      >
        <div className="space-y-6">
          {publicationGate && <PublicationGateCard gate={publicationGate} />}
          {messages.map(message => (
            <div
              key={message.id}
              className={`flex min-w-0 gap-3 ${message.role === 'assistant' ? 'justify-start' : 'justify-end'}`}
            >
              {message.role === 'assistant' && (
                <div className="bg-primary/10 text-primary flex h-8 w-8 shrink-0 items-center justify-center rounded-full">
                  <Bot className="h-5 w-5" />
                </div>
              )}

              <div
                className={`max-w-[85%] min-w-0 rounded-2xl px-4 py-3 text-sm leading-relaxed shadow-sm ${
                  message.role === 'assistant'
                    ? 'rounded-tl-none border border-[color:var(--cf-border)] bg-[color:var(--cf-surface)] text-[color:var(--cf-text)] [&_code]:rounded [&_code]:bg-[color:var(--cf-bg)] [&_code]:px-1.5 [&_code]:py-0.5'
                    : 'bg-primary rounded-tr-none text-white'
                }`}
              >
                {message.role === 'assistant' ? (
                  <div className="[&_a]:text-primary min-w-0 space-y-3 [&_a]:underline [&_blockquote]:border-l-2 [&_blockquote]:border-[color:var(--cf-border)] [&_blockquote]:pl-3 [&_ol]:list-decimal [&_ol]:pl-6 [&_p]:leading-7 [&_table]:w-full [&_table]:border-collapse [&_td]:border [&_td]:border-[color:var(--cf-border)] [&_td]:px-2 [&_td]:py-1 [&_th]:border [&_th]:border-[color:var(--cf-border)] [&_th]:bg-[color:var(--cf-surface-active)] [&_th]:px-2 [&_th]:py-1 [&_ul]:list-disc [&_ul]:pl-6">
                    {(() => {
                      let codeBlockIndex = 0
                      return (
                        <ReactMarkdown
                          remarkPlugins={[remarkGfm]}
                          components={{
                            code({ inline, className, children, node: _node, ...rest }: any) {
                              const rawText = String(children ?? '')
                              const hasLanguageClass =
                                typeof className === 'string' && /language-[\w-]+/.test(className)
                              const hasLineBreak = /\r?\n/.test(rawText)
                              const shouldRenderInline =
                                inline ?? (!hasLanguageClass && !hasLineBreak)

                              if (shouldRenderInline) {
                                return (
                                  <code
                                    className="rounded bg-[color:var(--cf-bg)] px-1.5 py-0.5"
                                    {...rest}
                                  >
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
                                    <span className="font-mono tracking-wide text-[color:var(--cf-muted)] uppercase">
                                      {language}
                                    </span>
                                    <button
                                      type="button"
                                      onClick={() => copyCode(normalizedText, blockId)}
                                      aria-label={
                                        copiedCodeId === blockId
                                          ? t('common.copied', { defaultValue: 'Copied' })
                                          : t('common.copy', { defaultValue: 'Copy' })
                                      }
                                      className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-[color:var(--cf-text)] transition-colors hover:bg-[color:var(--cf-surface)]"
                                    >
                                      {copiedCodeId === blockId ? (
                                        <>
                                          <Check className="h-3.5 w-3.5" />
                                          <span>
                                            {t('common.copied', { defaultValue: 'Copied' })}
                                          </span>
                                        </>
                                      ) : (
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
        <div className="focus-within:border-primary focus-within:ring-primary relative rounded-xl border border-[color:var(--cf-border)] bg-[color:var(--cf-bg)] shadow-sm focus-within:ring-1">
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
            className="bg-primary hover:bg-primary/90 absolute right-2 bottom-2 flex h-8 w-8 items-center justify-center rounded-lg text-white transition-all disabled:cursor-not-allowed disabled:bg-[color:var(--cf-border)] disabled:text-[color:var(--cf-muted)]"
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
