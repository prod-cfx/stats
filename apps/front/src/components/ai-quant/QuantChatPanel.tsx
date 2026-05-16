'use client'

import type { DynamicParamSchema, DynamicParamValues } from './dynamic-params'
import type { LlmClarificationGate, LlmPublicationGate } from '@/lib/api'
import { ArrowDown, ArrowUp, BarChart3, Bot, Check, Copy, KeyRound, Play, Settings2, Sparkles, User } from 'lucide-react'
import Link from 'next/link'
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
  backtestMarketType?: 'spot' | 'perp' | null
  clarificationGate?: LlmClarificationGate | null
  publicationGate?: LlmPublicationGate | null
  compactMode?: boolean // Kept for compatibility but ignored in new design
  onClarificationAnswer?: (itemKey: string, value: string) => void
  onParamChange?: (key: string, value: unknown) => void
  onConfirmBacktestParams: (nextValues: DynamicParamValues) => void
  onSend: (input: string) => void
  onRunBacktest: () => void
  canRunBacktest?: boolean
  locale?: 'zh' | 'en'
  mobileMode?: boolean
  mobileApiConfigHref?: string
  mobilePlazaHref?: string
  mobilePanelTab?: 'logic' | 'backtest'
  onMobilePanelTabChange?: (tab: 'logic' | 'backtest') => void
}

function getCodeLanguage(className?: string): string {
  if (!className) return 'text'
  const languageMatch = /language-([\w-]+)/.exec(className)
  return languageMatch?.[1]?.toLowerCase() || 'text'
}

function normalizeCodeText(children: unknown): string {
  return String(children ?? '').replace(/\n$/, '')
}

const COLLAPSED_CODE_LINE_LIMIT = 12

interface QuantCodeBlockProps {
  blockId: string
  className?: string
  code: string
  copied: boolean
  expanded: boolean
  language: string
  onCopy: () => void
  onToggleExpanded: () => void
  locale?: 'zh' | 'en'
  t: (key: string, options?: { defaultValue?: string }) => string
  rest: Record<string, unknown>
}

function QuantCodeBlock({
  blockId,
  className,
  code,
  copied,
  expanded,
  language,
  onCopy,
  onToggleExpanded,
  locale,
  t,
  rest,
}: QuantCodeBlockProps) {
  const lineCount = code.split(/\r?\n/).length
  const canCollapse = lineCount > COLLAPSED_CODE_LINE_LIMIT
  const collapsed = canCollapse && !expanded

  return (
    <div className="overflow-hidden rounded-xl border border-[color:var(--cf-border)] bg-[color:var(--cf-bg)]">
      <div className="flex items-center justify-between border-b border-[color:var(--cf-border)] bg-[color:var(--cf-surface-active)] px-3 py-2 text-xs">
        <span className="font-mono tracking-wide text-[color:var(--cf-muted)] uppercase">
          {language}
        </span>
        <button
          type="button"
          onClick={onCopy}
          aria-label={
            copied
              ? t('common.copied', { defaultValue: 'Copied' })
              : t('common.copy', { defaultValue: 'Copy' })
          }
          className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-[color:var(--cf-text)] transition-colors hover:bg-[color:var(--cf-surface)]"
        >
          {copied ? (
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
      <div className="relative">
        <pre className={`overflow-x-auto p-3 text-xs leading-6 ${collapsed ? 'max-h-48 overflow-y-hidden' : ''}`}>
          <code className={className} {...rest}>
            {code}
          </code>
        </pre>
        {collapsed && (
          <div className="pointer-events-none absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-[color:var(--cf-bg)] to-transparent" />
        )}
      </div>
      {canCollapse && (
        <button
          type="button"
          onClick={onToggleExpanded}
          className="w-full border-t border-[color:var(--cf-border)] bg-[color:var(--cf-surface-active)] px-3 py-2 text-sm font-semibold text-[color:var(--cf-text-strong)] transition-colors hover:bg-[color:var(--cf-surface-hover)]"
          aria-controls={blockId}
          aria-expanded={expanded}
        >
          {expanded
            ? locale === 'en' ? 'Collapse' : '收起'
            : locale === 'en' ? 'View all' : '查看全部'}
        </button>
      )}
    </div>
  )
}

const BACKTEST_RANGE_PRESETS = ['7D', '30D', '90D', '1Y', 'CUSTOM'] as const
const BACKTEST_PRICE_SOURCE_OPTIONS = ['open', 'close', 'mid'] as const

interface BacktestSettingField {
  key: string
  labelKey: string
  type: 'number' | 'select'
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
    placeholderKey: 'aiQuant.backtestPlaceholder.initialCash',
    errorKey: 'aiQuant.backtestError.positive',
    min: 0.01,
    step: 0.01,
    inputMode: 'decimal',
  },
  {
    key: 'backtestLeverage',
    labelKey: 'aiQuant.backtestLeverage',
    type: 'number',
    placeholderKey: 'aiQuant.backtestPlaceholder.leverage',
    errorKey: 'aiQuant.backtestError.positiveInteger',
    min: 1,
    step: 1,
    inputMode: 'numeric',
  },
  {
    key: 'backtestSlippageBps',
    labelKey: 'aiQuant.backtestSlippageBps',
    type: 'number',
    placeholderKey: 'aiQuant.backtestPlaceholder.slippageBps',
    errorKey: 'aiQuant.backtestError.nonNegative',
    min: 0,
    step: 0.01,
    inputMode: 'decimal',
  },
  {
    key: 'backtestFeeBps',
    labelKey: 'aiQuant.backtestFeeBps',
    type: 'number',
    placeholderKey: 'aiQuant.backtestPlaceholder.feeBps',
    errorKey: 'aiQuant.backtestError.nonNegative',
    min: 0,
    step: 0.01,
    inputMode: 'decimal',
  },
  {
    key: 'backtestPriceSource',
    labelKey: 'aiQuant.backtestPriceSource',
    type: 'select',
    placeholderKey: 'aiQuant.backtestPlaceholder.priceSource',
    errorKey: 'aiQuant.backtestError.priceSource',
    options: BACKTEST_PRICE_SOURCE_OPTIONS,
  },
  {
    key: 'backtestAllowPartial',
    labelKey: 'aiQuant.backtestAllowPartial',
    type: 'select',
    placeholderKey: 'aiQuant.backtestPlaceholder.allowPartial',
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

function parsePositiveIntegerDraftValue(rawValue: string): number | undefined | null {
  if (rawValue.trim() === '') return undefined
  if (!/^\d+$/.test(rawValue)) return null
  const parsed = Number(rawValue)
  return Number.isFinite(parsed) ? parsed : null
}

function validateBacktestSettings(paramValues: DynamicParamValues, backtestMarketType: 'spot' | 'perp' | null): {
  fieldErrors: Record<string, string>
  rangeError: string | null
} {
  const fieldErrors: Record<string, string> = {}

  const initialCash = parseFiniteNumber(paramValues.backtestInitialCash)
  if (initialCash === null || initialCash <= 0) {
    fieldErrors.backtestInitialCash = 'aiQuant.messages.positiveNumber'
  }

  const leverage = parseFiniteNumber(paramValues.backtestLeverage)
  if (backtestMarketType === 'perp' && (leverage === null || leverage <= 0 || !Number.isInteger(leverage))) {
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
  backtestMarketType = 'perp',
  clarificationGate: _clarificationGate,
  publicationGate,
  onClarificationAnswer: _onClarificationAnswer,
  onConfirmBacktestParams,
  onSend,
  onRunBacktest,
  canRunBacktest = true,
  locale,
  mobileMode = false,
  mobileApiConfigHref,
  mobilePlazaHref,
  mobilePanelTab = 'logic',
  onMobilePanelTabChange,
}: QuantChatPanelProps) {
  const { t, i18n } = useTranslation()
  const resolvedLocale = locale ?? ((i18n?.resolvedLanguage ?? i18n?.language ?? 'zh').startsWith('en') ? 'en' : 'zh')
  const isZh = resolvedLocale === 'zh'
  const [input, setInput] = useState('')
  const [showSettings, setShowSettings] = useState(false)
  const [copiedCodeId, setCopiedCodeId] = useState<string | null>(null)
  const [expandedCodeBlocks, setExpandedCodeBlocks] = useState<Record<string, boolean>>({})
  const [submittedBacktestSettings, setSubmittedBacktestSettings] = useState(false)
  const [touchedBacktestFields, setTouchedBacktestFields] = useState<Record<string, boolean>>({})
  const [showScrollToLatest, setShowScrollToLatest] = useState(false)
  const [backtestDraftValues, setBacktestDraftValues] = useState<DynamicParamValues>(() =>
    buildBacktestDraftValues(paramValues),
  )
  const chatScrollRef = useRef<HTMLDivElement>(null)
  const visibleBacktestSettingFields = useMemo(
    () => BACKTEST_SETTING_FIELDS.filter(field => field.key !== 'backtestLeverage' || backtestMarketType === 'perp'),
    [backtestMarketType],
  )
  const validation = useMemo(
    () => validateBacktestSettings(backtestDraftValues, backtestMarketType),
    [backtestDraftValues, backtestMarketType],
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
  const showRangeError =
    Boolean(validation.rangeError) &&
    backtestRangePreset === 'CUSTOM' &&
    (submittedBacktestSettings ||
      touchedBacktestFields.backtestStart ||
      touchedBacktestFields.backtestEnd)

  useEffect(() => {
    const el = chatScrollRef.current
    if (!el) return
    el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' })
  }, [messages])

  const updateScrollToLatestVisibility = () => {
    const el = chatScrollRef.current
    if (!el) return
    setShowScrollToLatest(el.scrollHeight - el.scrollTop - el.clientHeight > 140)
  }

  const scrollToLatest = () => {
    const el = chatScrollRef.current
    if (!el) return
    el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' })
    setShowScrollToLatest(false)
  }

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
    onConfirmBacktestParams(backtestDraftValues)
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

  const toggleCodeBlockExpanded = (blockId: string) => {
    setExpandedCodeBlocks(prev => ({
      ...prev,
      [blockId]: !prev[blockId],
    }))
  }

  return (
    <section
      className={
        mobileMode
          ? 'relative flex h-[calc(100dvh-64px)] min-h-0 min-w-0 flex-col overflow-hidden bg-[#f5f8fb] md:h-[calc(100vh-200px)] md:min-h-[600px] md:rounded-2xl md:border md:border-[color:var(--cf-border)] md:bg-[color:var(--cf-surface)] md:shadow-sm'
          : 'relative flex min-h-[520px] max-h-[calc(100dvh-7rem)] min-w-0 flex-col overflow-hidden rounded-2xl border border-[color:var(--cf-border)] bg-[color:var(--cf-surface)] shadow-sm md:h-[calc(100vh-200px)] md:max-h-none md:min-h-[600px]'
      }
      data-mobile-mode={mobileMode ? 'true' : undefined}
    >
      {/* Header / Toolbar */}
      <div className={`${mobileMode ? 'hidden md:flex' : 'flex'} items-center gap-3 border-b border-[color:var(--cf-border)] bg-[color:var(--cf-surface-active)] px-4 py-3`}>
        <div className="flex min-w-0 flex-1 items-center gap-2">
          <div className="bg-primary/10 text-primary flex h-8 w-8 items-center justify-center rounded-lg">
            <Bot className="h-5 w-5" />
          </div>
          <h2 className="min-w-0 truncate font-semibold text-[color:var(--cf-text-strong)]">
            {t('aiQuant.chatTitle')}
          </h2>
        </div>
        <div className="ml-auto flex shrink-0 items-center gap-2">
          <button
            type="button"
            onClick={() => setShowSettings(!showSettings)}
            className={`flex min-h-10 items-center justify-center gap-2 rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors ${
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
            className="cf-primary-cta flex min-h-10 items-center justify-center gap-2 rounded-lg px-3 text-sm font-medium transition-all"
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
                        onBlur={() => touchBacktestField('backtestStart')}
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
                        onBlur={() => touchBacktestField('backtestEnd')}
                      />
                    </label>
                  </>
                )}

                {visibleBacktestSettingFields.map(field => {
                  const value = backtestDraftValues[field.key]
                  const error = validation.fieldErrors[field.key]
                  const showError =
                    Boolean(error) &&
                    (submittedBacktestSettings || touchedBacktestFields[field.key])
                  const fieldClassName = `h-9 w-full rounded-lg border bg-[color:var(--cf-surface)] px-2 text-sm text-[color:var(--cf-text)] outline-none focus:border-primary ${
                    showError ? 'border-red-500' : 'border-[color:var(--cf-border)]'
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
                            updateBacktestDraftValue(
                              field.key,
                              field.key === 'backtestAllowPartial'
                                ? event.target.value === 'true'
                                : event.target.value,
                            )
                          }
                          onBlur={() => touchBacktestField(field.key)}
                        >
                          <option value="" disabled>
                            {field.placeholderKey ? t(field.placeholderKey) : ''}
                          </option>
                          {field.options.map(option => (
                            <option key={option} value={option}>
                              {field.key === 'backtestAllowPartial'
                                ? t(
                                    `aiQuant.backtestAllowPartial.${option === 'true' ? 'enabled' : 'disabled'}`,
                                  )
                                : t(`aiQuant.backtestPriceSource.${option}`)}
                            </option>
                          ))}
                        </select>
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
                            if (field.key === 'backtestLeverage') {
                              const nextValue = parsePositiveIntegerDraftValue(event.target.value)
                              if (nextValue === null) return
                              updateBacktestDraftValue(field.key, nextValue)
                              return
                            }
                            updateBacktestDraftValue(
                              field.key,
                              parseDynamicParamInputValue('number', event.target.value),
                            )
                          }}
                          onBlur={() => touchBacktestField(field.key)}
                        />
                      )}
                      {showError && (
                        <span className="text-xs text-red-500">{t(field.errorKey ?? error!)}</span>
                      )}
                    </label>
                  )
                })}
                {showRangeError && validation.rangeError && (
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
                  disabled={!hasDraftChanges}
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
        className={mobileMode ? 'min-w-0 flex-1 overflow-y-auto bg-[#f5f8fb] px-4 py-3' : 'min-w-0 flex-1 overflow-y-auto bg-[color:var(--cf-bg)] p-4'}
        onScroll={updateScrollToLatestVisibility}
      >
        <div className={mobileMode ? 'space-y-5 pb-2' : 'space-y-6'}>
          {publicationGate && <PublicationGateCard gate={publicationGate} />}
          {messages.map(message => (
            <div
              key={message.id}
              className={`flex min-w-0 gap-3 ${message.role === 'assistant' ? 'justify-start' : 'justify-end'}`}
            >
              {message.role === 'assistant' && (
                <div className={`${mobileMode ? 'bg-[#eef2ff] text-primary' : 'bg-primary/10 text-primary'} flex h-8 w-8 shrink-0 items-center justify-center rounded-full`}>
                  <Bot className="h-5 w-5" />
                </div>
              )}

              <div
                data-testid={`quant-message-bubble-${message.role}`}
                className={`max-w-[min(100%,42rem)] min-w-0 break-words rounded-2xl px-4 py-3 text-sm leading-relaxed shadow-sm ${
                  message.role === 'assistant'
                    ? `${mobileMode ? 'border-[#d9e2ea] bg-white text-[#374151]' : 'border-[color:var(--cf-border)] bg-[color:var(--cf-surface)] text-[color:var(--cf-text)]'} rounded-tl-none border [&_code]:rounded [&_code]:bg-[color:var(--cf-bg)] [&_code]:px-1.5 [&_code]:py-0.5`
                    : 'bg-primary rounded-tr-none text-white'
                }`}
              >
                {message.role === 'assistant' ? (
                  <div className="[&_a]:text-primary min-w-0 space-y-3 overflow-x-auto [&_a]:underline [&_blockquote]:border-l-2 [&_blockquote]:border-[color:var(--cf-border)] [&_blockquote]:pl-3 [&_ol]:list-decimal [&_ol]:pl-6 [&_p]:leading-7 [&_table]:min-w-[32rem] [&_table]:border-collapse [&_td]:border [&_td]:border-[color:var(--cf-border)] [&_td]:px-2 [&_td]:py-1 [&_th]:border [&_th]:border-[color:var(--cf-border)] [&_th]:bg-[color:var(--cf-surface-active)] [&_th]:px-2 [&_th]:py-1 [&_ul]:list-disc [&_ul]:pl-6">
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
                                <QuantCodeBlock
                                  blockId={blockId}
                                  className={className}
                                  code={normalizedText}
                                  copied={copiedCodeId === blockId}
                                  expanded={Boolean(expandedCodeBlocks[blockId])}
                                  language={language}
                                  locale={resolvedLocale}
                                  onCopy={() => copyCode(normalizedText, blockId)}
                                  onToggleExpanded={() => toggleCodeBlockExpanded(blockId)}
                                  t={t}
                                  rest={rest}
                                />
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
                <div className={`${mobileMode ? 'bg-white text-[#111827]' : 'bg-[color:var(--cf-surface-active)] text-[color:var(--cf-text-strong)]'} flex h-8 w-8 shrink-0 items-center justify-center rounded-full`}>
                  <User className="h-5 w-5" />
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {mobileMode && showScrollToLatest && (
        <button
          type="button"
          onClick={scrollToLatest}
          aria-label={t('aiQuant.scrollToLatest', { defaultValue: '回到最新对话' })}
          className="absolute left-1/2 bottom-[148px] z-20 inline-flex h-10 w-10 -translate-x-1/2 items-center justify-center rounded-full border border-[#d8dee8] bg-white/95 text-[#111827] shadow-[0_8px_22px_rgba(15,23,42,0.18)] backdrop-blur"
        >
          <ArrowDown className="h-5 w-5" />
        </button>
      )}

      {/* Input Area */}
      <div className={mobileMode ? 'border-t border-[#d7dee7] bg-white px-3 pt-2 pb-[calc(env(safe-area-inset-bottom)+0.75rem)]' : 'border-t border-[color:var(--cf-border)] bg-[color:var(--cf-surface)] p-4'}>
        {mobileMode && (
          <div
            data-testid="quant-mobile-skill-toolbar"
            className="mb-2 flex items-center gap-2 overflow-x-auto rounded-2xl bg-white px-1 py-1 md:hidden"
          >
            <button
              type="button"
              onClick={() => setShowSettings(!showSettings)}
              className={`inline-flex min-h-8 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-lg border px-2.5 text-[11px] font-semibold shadow-sm ${
                showSettings
                  ? 'border-[#3f6fff] bg-[#eef4ff] text-[#1f4fff]'
                  : 'border-[#d8dee8] bg-white text-[#1f2937]'
              }`}
            >
              <Settings2 className="h-3.5 w-3.5" />
              {isZh ? '参数配置' : 'Parameters'}
            </button>
            <button
              type="button"
              data-testid="run-backtest-mobile"
              onClick={onRunBacktest}
              disabled={!canRunBacktest || hasDraftChanges}
              className="inline-flex min-h-8 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-lg border border-[#3f6fff] bg-[#3f6fff] px-2.5 text-[11px] font-semibold text-white shadow-sm disabled:cursor-not-allowed disabled:border-[#d7dee7] disabled:bg-[#d7dee7] disabled:text-[#6b7280]"
            >
              <Play className="h-3.5 w-3.5 fill-current" />
              {isZh ? '开始回测' : 'Start Backtest'}
            </button>
            <button
              type="button"
              onClick={() => onMobilePanelTabChange?.('logic')}
              className={`inline-flex min-h-8 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-lg border px-3 text-[12px] font-semibold shadow-sm ${
                mobilePanelTab === 'logic'
                  ? 'border-[#b8c4d6] bg-[#f8fbff] text-[#111827]'
                  : 'border-[#d8dee8] bg-white text-[#374151]'
              }`}
            >
              <Check className="h-3.5 w-3.5" />
              {isZh ? '策略确认' : 'Strategy'}
            </button>
            <button
              type="button"
              onClick={() => onMobilePanelTabChange?.('backtest')}
              className={`inline-flex min-h-8 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-lg border px-3 text-[12px] font-semibold shadow-sm ${
                mobilePanelTab === 'backtest'
                  ? 'border-[#b8c4d6] bg-[#f8fbff] text-[#111827]'
                  : 'border-[#d8dee8] bg-white text-[#374151]'
              }`}
            >
              <BarChart3 className="h-3.5 w-3.5" />
              {isZh ? '回测结果' : 'Backtest Result'}
            </button>
            {mobilePlazaHref && (
              <Link
                href={mobilePlazaHref}
                data-testid="quant-mobile-plaza-link"
                className="inline-flex min-h-8 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-lg border border-[#d8dee8] bg-white px-2.5 text-[11px] font-semibold text-[#1f2937] shadow-sm"
              >
                <Sparkles className="h-3.5 w-3.5" />
                {isZh ? '策略广场' : 'Strategy Plaza'}
              </Link>
            )}
            {mobileApiConfigHref && (
              <Link
                href={mobileApiConfigHref}
                data-testid="quant-mobile-api-link"
                className="inline-flex min-h-8 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-lg border border-[#d8dee8] bg-white px-2.5 text-[11px] font-semibold text-[#1f2937] shadow-sm"
              >
                <KeyRound className="h-3.5 w-3.5" />
                {isZh ? '交易API' : 'Trading API'}
              </Link>
            )}
          </div>
        )}
        <div className={`focus-within:border-primary focus-within:ring-primary relative border shadow-sm focus-within:ring-1 ${mobileMode ? 'rounded-xl border-[#d9e2ea] bg-white' : 'rounded-xl border-[color:var(--cf-border)] bg-[color:var(--cf-bg)]'}`}>
          <textarea
            className={`max-h-[120px] min-h-[50px] w-full resize-none bg-transparent px-4 py-3 pr-12 text-sm outline-none ${mobileMode ? 'text-[#374151] placeholder:text-[#7b8794]' : 'text-[color:var(--cf-text)] placeholder:text-[color:var(--cf-muted)]'}`}
            placeholder={isZh
              ? '描述你的交易策略，例如：3分钟跌1%买入，15分钟涨2%卖出...'
              : t('aiQuant.inputPlaceholder')}
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
        <p className={`mt-2 text-center text-xs ${mobileMode ? 'text-[#6b7280]' : 'text-[color:var(--cf-muted)]'}`}>
          {isZh
            ? 'AI 内容仅供参考，请务必在实盘前进行充分回测。'
            : t('aiQuant.messages.aiDisclaimer')}
        </p>
      </div>
    </section>
  )
}
