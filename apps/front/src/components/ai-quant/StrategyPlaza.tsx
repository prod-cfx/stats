'use client'

import type { StrategyPlazaTemplate } from '@/lib/api'
import { Activity, Edit3, Loader2, Play } from 'lucide-react'
import { useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

const TRANSLATED_TEMPLATE_TAG_KEYS: Partial<Record<string, readonly string[]>> = {
  'ma-cross': ['trend', 'ma', 'okxDemo'],
  'bollinger-reversion': ['meanReversion', 'bollinger', 'okxDemo'],
  'grid-range': ['range', 'buyLowSellHigh', 'okxDemo'],
  'rsi-reversal': ['rsi', 'reversal', 'okxDemo'],
  'breakout-follow': ['breakout', 'trend', 'okxDemo'],
  'macd-cross': ['macd', 'momentum', 'okxDemo'],
}

const CATEGORY_LABELS = [
  '全部',
  '趋势',
  '突破',
  '反转',
  '网格',
  'DCA',
  '盘口',
  '衍生品事件',
  '风控稳健',
] as const
const SORT_OPTIONS = [
  { key: 'hot', label: '热门' },
  { key: 'return', label: '收益' },
  { key: 'sharpe', label: 'Sharpe' },
  { key: 'drawdown', label: '低回撤' },
  { key: 'new', label: '最新' },
] as const
const PAGE_SIZE = 9
const RUN_BUTTON_GRADIENT_CLASS = 'bg-gradient-to-r from-violet-600 to-fuchsia-600'
const RUN_BUTTON_GRADIENT_STYLE = 'linear-gradient(90deg, #7C3AED 0%, #C026D3 100%)'
const PAGER_ACTIVE_GRADIENT_CLASS = 'bg-gradient-to-r from-[#7C3AED] to-[#B414F4]'
const PAGER_ACTIVE_GRADIENT_STYLE = 'linear-gradient(90deg, #7C3AED 0%, #B414F4 100%)'

const TEMPLATE_CATEGORY: Partial<Record<string, (typeof CATEGORY_LABELS)[number]>> = {
  'ma-cross': '趋势',
  'breakout-follow': '突破',
  'bollinger-reversion': '反转',
  'rsi-reversal': '反转',
  'grid-range': '网格',
  'macd-cross': '趋势',
}

const CATEGORY_TONE: Record<string, string> = {
  趋势: '#0EA5E9',
  突破: '#16A36B',
  反转: '#D98008',
  网格: '#7C3AED',
  DCA: '#7C3AED',
  盘口: '#EF4444',
  衍生品事件: '#0EA5E9',
  风控稳健: '#16A36B',
}

interface StrategyPlazaProps {
  templates: StrategyPlazaTemplate[]
  loading: boolean
  error?: string | null
  actionError?: string | null
  pendingTemplateId?: string | null
  pendingAction?: 'run' | 'edit' | null
  onRunStrategy: (templateId: string) => void
  onEditStrategy: (templateId: string) => void
}

interface StrategyCardModel {
  template: StrategyPlazaTemplate
  name: string
  description: string
  tags: string[]
  category: string
  symbolLabel: string
  pairLabel: string
  marketLabel: string
  positionLabel: string
  leverageLabel: string
  periodLabel: string
  returnPct: number | null
  winRatePct: number | null
  maxDrawdownPct: number | null
  sharpe: number
  users: number
  author: string
  authorTone: string
  tone: string
  status: 'hot' | 'new' | 'official' | 'pro' | null
  seed: number[]
  order: number
}

type TFunction = ReturnType<typeof useTranslation>['t']
type SortKey = (typeof SORT_OPTIONS)[number]['key']

function getMarketTypeLabel(marketType: StrategyPlazaTemplate['marketType'], t: TFunction): string {
  const fallback = marketType === 'spot' ? '现货' : marketType === 'perp' ? '永续' : marketType
  return t(`aiQuant.strategyPlazaCard.marketType.${marketType}`, { defaultValue: fallback })
}

function getLeverageLabel(leverage: number | null, t: TFunction): string {
  return leverage
    ? `${leverage}x`
    : t('aiQuant.strategyPlazaCard.noLeverage', { defaultValue: '无杠杆' })
}

function formatPositionPct(value: number): string {
  const percent = Math.abs(value) <= 1 ? value * 100 : value
  return `${Number(percent.toFixed(2)).toString()}%`
}

function formatMetricPct(value: number | null, options: { sign?: boolean } = {}): string {
  if (value == null) return '--'
  const formatted = `${Number(value.toFixed(2)).toString()}%`
  return options.sign && value > 0 ? `+${formatted}` : formatted
}

function stableHash(input: string): number {
  let hash = 0
  for (let i = 0; i < input.length; i += 1) hash = (hash * 31 + input.charCodeAt(i)) >>> 0
  return hash
}

function buildSeed(template: StrategyPlazaTemplate, returnPct: number | null): number[] {
  let hash = stableHash(template.id)
  const rnd = () => {
    hash = (hash * 1103515245 + 12345) >>> 0
    return (hash >>> 16) / 65535
  }
  const targetReturn = (returnPct ?? 8) / 100
  const volatility = Math.max(0.6, Math.min(4.5, Math.abs(returnPct ?? 8) * 0.1 + 0.8))
  const result: number[] = []
  let price = 100
  for (let i = 0; i < 28; i += 1) {
    const target = 100 * (1 + targetReturn * (i / 27))
    price += (target - price) * 0.45 + (rnd() - 0.5) * volatility
    result.push(price)
  }
  return result
}

function inferCategory(template: StrategyPlazaTemplate, tags: string[]): string {
  const mappedCategory = TEMPLATE_CATEGORY[template.id]
  if (mappedCategory) return mappedCategory
  const source =
    `${template.id} ${template.name} ${template.description} ${tags.join(' ')}`.toLowerCase()
  if (source.includes('grid') || source.includes('网格') || source.includes('range')) return '网格'
  if (source.includes('breakout') || source.includes('突破')) return '突破'
  if (
    source.includes('reversion') ||
    source.includes('reversal') ||
    source.includes('rsi') ||
    source.includes('反转')
  )
    return '反转'
  if (source.includes('dca') || source.includes('定投')) return 'DCA'
  if (source.includes('funding') || source.includes('套利') || source.includes('衍生'))
    return '衍生品事件'
  if (
    source.includes('risk') ||
    source.includes('hedge') ||
    source.includes('稳健') ||
    source.includes('对冲')
  )
    return '风控稳健'
  if (source.includes('orderbook') || source.includes('盘口') || source.includes('hft'))
    return '盘口'
  return '趋势'
}

function resolveTemplateDisplay(template: StrategyPlazaTemplate, t: TFunction) {
  const name = t(`aiQuant.strategies.${template.id}.name`, { defaultValue: template.name })
  const description = t(`aiQuant.strategies.${template.id}.desc`, {
    defaultValue: template.description,
  })
  const translatedTagKeys = TRANSLATED_TEMPLATE_TAG_KEYS[template.id]
  const tags = translatedTagKeys
    ? translatedTagKeys.map(tag =>
        t(`aiQuant.strategies.${template.id}.tags.${tag}`, { defaultValue: tag }),
      )
    : template.tags
  return { name, description, tags }
}

function templateTone(template: StrategyPlazaTemplate): string {
  const symbol = template.symbol.toUpperCase()
  if (symbol.includes('BTC')) return '#F7931A'
  if (symbol.includes('ETH')) return '#627EEA'
  if (symbol.includes('SOL')) return '#9945FF'
  if (symbol.includes('BNB')) return '#F0B90B'
  return '#7C3AED'
}

function toCardModel(
  template: StrategyPlazaTemplate,
  index: number,
  t: TFunction,
): StrategyCardModel {
  const display = resolveTemplateDisplay(template, t)
  const category = inferCategory(template, display.tags)
  const returnPct = template.displayMetrics.returnPct
  const winRatePct = template.displayMetrics.winRatePct
  const maxDrawdownPct = template.displayMetrics.maxDrawdownPct
  const order = template.displayOrder ?? index + 1
  const status: StrategyCardModel['status'] =
    template.status === 'live' ? 'official' : order <= 2 ? 'hot' : order <= 4 ? 'new' : null
  const author =
    status === 'official'
      ? 'Quantify 官方'
      : t('aiQuant.strategyPlazaCard.okxDemo', { defaultValue: 'OKX 模拟盘' })
  const marketTypeLabel = t(`aiQuant.strategyPlazaCard.marketType.${template.marketType}`, {
    defaultValue: getMarketTypeLabel(template.marketType, t),
  })

  return {
    template,
    name: display.name,
    description: display.description,
    tags: display.tags,
    category,
    symbolLabel: (template.symbol.split('-')[0] ?? 'Q').slice(0, 4) || 'Q',
    pairLabel: template.symbol,
    marketLabel: marketTypeLabel,
    positionLabel: formatPositionPct(template.positionPct),
    leverageLabel: getLeverageLabel(template.leverage, t),
    periodLabel: template.timeframe,
    returnPct,
    winRatePct,
    maxDrawdownPct,
    sharpe: Number(
      (1.05 + (winRatePct ?? 54) / 100 + Math.max(0, (returnPct ?? 8) / 50)).toFixed(2),
    ),
    users: 240 + (stableHash(template.id) % 8400),
    author,
    authorTone: status === 'official' ? '#7C3AED' : '#0EA5E9',
    tone: templateTone(template),
    status,
    seed: buildSeed(template, returnPct),
    order,
  }
}

function fmtUsers(value: number): string {
  return value >= 1000 ? `${(value / 1000).toFixed(1)}k` : `${value}`
}

function Sparkline({ data, index, accent }: { data: number[]; index: string; accent?: string }) {
  const width = 120
  const height = 40
  const min = Math.min(...data)
  const max = Math.max(...data)
  const span = max - min || 1
  const points = data
    .map((value, i) => {
      const x = (i / (data.length - 1)) * width
      const y = height - 3 - ((value - min) / span) * (height - 6)
      return `${x.toFixed(1)},${y.toFixed(1)}`
    })
    .join(' ')
  const up = data[data.length - 1] >= data[0]
  const color = accent || (up ? '#16A36B' : '#DC4646')
  const gradientId = `strategy-plaza-spark-${index}`

  return (
    <svg
      aria-hidden="true"
      className="block h-10 w-[116px] overflow-visible"
      preserveAspectRatio="none"
      viewBox={`0 0 ${width} ${height}`}
    >
      <defs>
        <linearGradient id={gradientId} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.26" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <polygon fill={`url(#${gradientId})`} points={`0,${height} ${points} ${width},${height}`} />
      <polyline
        fill="none"
        points={points}
        stroke={color}
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.7"
      />
    </svg>
  )
}

function StatusBadge({
  status,
  className = '',
}: {
  status: StrategyCardModel['status']
  className?: string
}) {
  if (!status) return null
  const config = {
    hot: { label: '热门', className: 'bg-red-500/10 text-red-500' },
    new: { label: 'NEW', className: 'bg-emerald-500/10 text-emerald-600' },
    official: { label: '官方', className: 'bg-violet-500/10 text-violet-600' },
    pro: { label: 'PRO', className: 'bg-gradient-to-r from-amber-500 to-red-500 text-white' },
  }[status]
  return (
    <span
      data-testid="strategy-plaza-status-badge"
      className={`scard-badge rounded-[5px] px-1.5 py-0.5 text-[10px] font-bold tracking-[0.3px] ${config.className} ${className}`}
    >
      {config.label}
    </span>
  )
}

function StarIcon({ filled }: { filled: boolean }) {
  return (
    <svg
      aria-hidden="true"
      className="h-[18px] w-[18px]"
      fill={filled ? 'currentColor' : 'none'}
      viewBox="0 0 24 24"
    >
      <path
        d="M12 3l2.9 6 6.6.9-4.8 4.6 1.2 6.6L12 18.1 5.9 21l1.2-6.6L2.4 9.9 9 9z"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.8"
      />
    </svg>
  )
}

function StrategyActionButtons({
  item,
  hasPendingAction,
  isRunning,
  isEditing,
  variant = 'card',
  onRunStrategy,
  onEditStrategy,
  t,
}: {
  item: StrategyCardModel
  hasPendingAction: boolean
  isRunning: boolean
  isEditing: boolean
  variant?: 'rail' | 'card'
  onRunStrategy: (templateId: string) => void
  onEditStrategy: (templateId: string) => void
  t: TFunction
}) {
  const hostClassName =
    variant === 'rail' ? 'mt-3 flex w-full gap-2' : 'flex shrink-0 items-center gap-2'

  return (
    <div data-testid="strategy-plaza-actions" className={hostClassName}>
      <button
        type="button"
        data-testid="strategy-plaza-run-button"
        disabled={hasPendingAction}
        aria-busy={isRunning}
        onClick={event => {
          event.stopPropagation()
          onRunStrategy(item.template.id)
        }}
        className={`scard-btn inline-flex h-9 flex-1 items-center justify-center gap-1.5 rounded-[9px] border-0 ${RUN_BUTTON_GRADIENT_CLASS} px-3 text-xs leading-5 font-semibold whitespace-nowrap text-white shadow-sm transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-60`}
        style={{ backgroundImage: RUN_BUTTON_GRADIENT_STYLE }}
      >
        <Play className="h-3.5 w-3.5 fill-current" />
        {isRunning
          ? t('aiQuant.strategyPlazaCard.running', { defaultValue: '运行中' })
          : t('aiQuant.run')}
      </button>
      <button
        type="button"
        disabled={hasPendingAction}
        aria-busy={isEditing}
        onClick={event => {
          event.stopPropagation()
          onEditStrategy(item.template.id)
        }}
        className="scard-btn inline-flex h-9 flex-1 items-center justify-center gap-1.5 rounded-[9px] border border-[color:var(--cf-border)] bg-[color:var(--cf-surface)] px-3 text-xs leading-5 font-semibold whitespace-nowrap text-[color:var(--cf-text-strong)] transition hover:bg-[color:var(--cf-surface-hover)] disabled:cursor-wait disabled:opacity-70"
      >
        {isEditing ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
        ) : (
          <Edit3 className="h-3.5 w-3.5" />
        )}
        {isEditing
          ? t('aiQuant.strategyPlazaCard.processing', { defaultValue: '处理中' })
          : t('aiQuant.edit')}
      </button>
    </div>
  )
}

export function StrategyPlaza({
  templates,
  loading,
  error,
  actionError,
  pendingTemplateId,
  pendingAction,
  onRunStrategy,
  onEditStrategy,
}: StrategyPlazaProps) {
  const { t } = useTranslation()
  const hasPendingAction = Boolean(pendingTemplateId && pendingAction)
  const railRef = useRef<HTMLDivElement>(null)
  const [category, setCategory] = useState<(typeof CATEGORY_LABELS)[number]>('全部')
  const [sort, setSort] = useState<SortKey>('hot')
  const [query, setQuery] = useState('')
  const [favoriteOnly, setFavoriteOnly] = useState(false)
  const [favorites, setFavorites] = useState<Record<string, boolean>>({})
  const [page, setPage] = useState(1)

  const cards = useMemo(
    () => templates.map((template, index) => toCardModel(template, index, t)),
    [templates, t],
  )
  const hotCards = useMemo(
    () =>
      cards
        .slice()
        .sort((a, b) => b.users - a.users)
        .slice(0, Math.min(6, cards.length)),
    [cards],
  )
  const filteredCards = useMemo(() => {
    const search = query.trim().toLowerCase()
    const list = cards
      .filter(item =>
        favoriteOnly
          ? favorites[item.template.id]
          : category === '全部' || item.category === category,
      )
      .filter(
        item =>
          !search ||
          `${item.name} ${item.description} ${item.category} ${item.tags.join(' ')} ${item.pairLabel} ${item.author}`
            .toLowerCase()
            .includes(search),
      )

    return list.slice().sort((a, b) => {
      if (sort === 'return') return (b.returnPct ?? -Infinity) - (a.returnPct ?? -Infinity)
      if (sort === 'sharpe') return b.sharpe - a.sharpe
      if (sort === 'drawdown')
        return Math.abs(a.maxDrawdownPct ?? Infinity) - Math.abs(b.maxDrawdownPct ?? Infinity)
      if (sort === 'new') return a.order - b.order
      return b.users - a.users
    })
  }, [cards, category, favoriteOnly, favorites, query, sort])

  const totalPages = Math.max(1, Math.ceil(filteredCards.length / PAGE_SIZE))
  const currentPage = Math.min(page, totalPages)
  const pageCards = filteredCards.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE)
  const favoriteCount = cards.filter(item => favorites[item.template.id]).length

  const resetPage = () => setPage(1)

  if (loading) {
    return (
      <section className="space-y-4">
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {[0, 1, 2].map(item => (
            <article
              key={item}
              className="rounded-[18px] border border-[color:var(--cf-border)] bg-[color:var(--cf-surface)] px-5 py-4"
            >
              <div className="h-10 w-10 animate-pulse rounded-xl bg-[color:var(--cf-bg)]" />
              <div className="mt-4 h-4 w-2/3 animate-pulse rounded bg-[color:var(--cf-bg)]" />
              <div className="mt-3 h-16 w-full animate-pulse rounded-xl bg-[color:var(--cf-bg)]" />
              <div className="mt-4 grid grid-cols-4 gap-2">
                {[0, 1, 2, 3].map(stat => (
                  <div key={stat} className="h-8 animate-pulse rounded bg-[color:var(--cf-bg)]" />
                ))}
              </div>
            </article>
          ))}
        </div>
      </section>
    )
  }

  if (error) {
    return (
      <section className="space-y-4">
        <div className="rounded-2xl border border-red-500/20 bg-red-500/10 px-5 py-4 text-sm leading-[22px] text-red-500">
          {error}
        </div>
      </section>
    )
  }

  if (templates.length === 0) {
    return (
      <section className="space-y-4">
        <div className="rounded-2xl border border-[color:var(--cf-border)] bg-[color:var(--cf-surface)] px-5 py-8 text-center text-sm leading-[22px] text-[color:var(--cf-muted)]">
          {t('aiQuant.strategyPlazaCard.empty')}
        </div>
      </section>
    )
  }

  return (
    <section className="space-y-6">
      {actionError && (
        <div className="rounded-2xl border border-red-500/20 bg-red-500/10 px-5 py-4 text-sm leading-[22px] text-red-500">
          {actionError}
        </div>
      )}

      <div className="splaza-rail-wrap">
        <div className="splaza-rail-head mb-3 flex items-center gap-3">
          <h2 className="m-0 flex items-center gap-2 !text-[17px] !leading-6 !font-bold text-[color:var(--cf-text-strong)]">
            <Activity className="h-[18px] w-[18px] text-amber-500" />
            热门策略
          </h2>
          <div className="ml-auto hidden gap-2 sm:flex">
            <button
              aria-label="上一组"
              className="flex h-[34px] w-[34px] items-center justify-center rounded-full border border-[color:var(--cf-border)] text-[color:var(--cf-muted)] hover:text-[color:var(--cf-text-strong)]"
              type="button"
              onClick={() => railRef.current?.scrollBy?.({ left: -340, behavior: 'smooth' })}
            >
              ‹
            </button>
            <button
              aria-label="下一组"
              className="flex h-[34px] w-[34px] items-center justify-center rounded-full border border-[color:var(--cf-border)] text-[color:var(--cf-muted)] hover:text-[color:var(--cf-text-strong)]"
              type="button"
              onClick={() => railRef.current?.scrollBy?.({ left: 340, behavior: 'smooth' })}
            >
              ›
            </button>
          </div>
        </div>
        <div
          ref={railRef}
          data-testid="strategy-plaza-hot-rail"
          className="splaza-rail flex snap-x gap-3 overflow-x-auto pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        >
          {hotCards.map((item, index) => {
            const isRunning = pendingTemplateId === item.template.id && pendingAction === 'run'
            const isEditing = pendingTemplateId === item.template.id && pendingAction === 'edit'
            const up = item.seed[item.seed.length - 1] >= item.seed[0]
            return (
              <article
                key={item.template.id}
                className="srail-card relative isolate flex w-[312px] shrink-0 snap-start flex-col overflow-hidden rounded-[18px] border border-[color:var(--cf-border)] bg-[color:var(--cf-surface)] px-[18px] py-4 text-[color:var(--cf-text-strong)] shadow-sm transition hover:border-[color:var(--cf-text-strong)]/20 hover:shadow-lg"
              >
                <div className="mesh pointer-events-none absolute inset-0 bg-[linear-gradient(color-mix(in_srgb,var(--cf-border)_55%,transparent)_1px,transparent_1px),linear-gradient(90deg,color-mix(in_srgb,var(--cf-border)_55%,transparent)_1px,transparent_1px)] [mask-image:linear-gradient(120deg,#000_0%,transparent_70%)] bg-[length:22px_22px] opacity-40" />
                <StatusBadge className="absolute top-3 right-3 z-[3]" status={item.status} />
                <div className="relative z-[2]">
                  <div className="mt-1 flex items-center gap-2.5">
                    <span
                      className="flex h-[38px] w-[38px] shrink-0 items-center justify-center rounded-[11px] text-sm font-bold shadow-md"
                      style={{ background: item.tone }}
                    >
                      {item.symbolLabel}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-[14.5px] leading-5 font-bold tracking-[-0.2px]">
                        {item.name}
                      </div>
                      <div className="mt-0.5 flex items-center gap-1 text-[11px] text-[color:var(--cf-muted)]">
                        {item.author}
                      </div>
                    </div>
                  </div>
                  <div className="mt-4 flex items-end gap-2.5">
                    <div
                      className={`shrink-0 font-mono text-2xl leading-none font-extrabold ${up ? 'text-[#7EFFB0]' : 'text-[#FF9DA3]'}`}
                    >
                      {formatMetricPct(item.returnPct, { sign: true })}
                      <small className="ml-1 text-[11px] font-medium text-[color:var(--cf-muted)]">
                        收益
                      </small>
                    </div>
                    <div className="min-w-0 flex-1">
                      <Sparkline accent="#A78BFA" data={item.seed} index={`rail-${index}`} />
                    </div>
                  </div>
                  <div className="mt-3 flex gap-5 border-t border-[color:var(--cf-border)] pt-3">
                    <div>
                      <div className="text-[9px] tracking-[0.4px] text-[color:var(--cf-muted)] uppercase">
                        Sharpe
                      </div>
                      <div className="mt-0.5 font-mono text-[13px] font-bold">
                        {item.sharpe.toFixed(2)}
                      </div>
                    </div>
                    <div>
                      <div className="text-[9px] tracking-[0.4px] text-[color:var(--cf-muted)] uppercase">
                        回撤
                      </div>
                      <div className="mt-0.5 font-mono text-[13px] font-bold">
                        {formatMetricPct(item.maxDrawdownPct)}
                      </div>
                    </div>
                    <div>
                      <div className="text-[9px] tracking-[0.4px] text-[color:var(--cf-muted)] uppercase">
                        胜率
                      </div>
                      <div className="mt-0.5 font-mono text-[13px] font-bold">
                        {formatMetricPct(item.winRatePct)}
                      </div>
                    </div>
                  </div>
                  <StrategyActionButtons
                    hasPendingAction={hasPendingAction}
                    isEditing={isEditing}
                    isRunning={isRunning}
                    item={item}
                    onEditStrategy={onEditStrategy}
                    onRunStrategy={onRunStrategy}
                    t={t}
                    variant="rail"
                  />
                </div>
              </article>
            )
          })}
        </div>
      </div>

      <div data-testid="strategy-plaza-toolbar" className="splaza-toolbar space-y-3">
        <div className="splaza-row cats flex flex-col gap-3 lg:flex-row lg:items-center">
          <div className="splaza-chips flex min-w-0 flex-1 flex-wrap gap-2">
            <button
              type="button"
              className={`splaza-chip fav inline-flex h-[34px] items-center gap-1.5 rounded-full border px-4 text-[13px] font-medium ${favoriteOnly ? 'border-amber-500/30 bg-amber-500/10 text-amber-600' : 'border-[color:var(--cf-border)] bg-[color:var(--cf-surface)] text-[color:var(--cf-muted)]'}`}
              onClick={() => {
                setFavoriteOnly(value => !value)
                resetPage()
              }}
            >
              <StarIcon filled={favoriteOnly} />
              收藏{favoriteCount ? ` ${favoriteCount}` : ''}
            </button>
            {CATEGORY_LABELS.map(label => {
              const active = !favoriteOnly && category === label
              return (
                <button
                  key={label}
                  type="button"
                  className={`splaza-chip inline-flex h-[34px] items-center rounded-full border px-4 text-[13px] font-medium ${active ? 'border-[color:var(--cf-text-strong)] bg-[color:var(--cf-text-strong)] text-[color:var(--cf-bg)]' : 'border-[color:var(--cf-border)] bg-[color:var(--cf-surface)] text-[color:var(--cf-muted)] hover:text-[color:var(--cf-text-strong)]'}`}
                  onClick={() => {
                    setFavoriteOnly(false)
                    setCategory(label)
                    resetPage()
                  }}
                >
                  {label}
                </button>
              )
            })}
          </div>
          <label className="splaza-search flex h-[38px] w-full shrink-0 items-center gap-2 rounded-full border border-[color:var(--cf-border)] bg-[color:var(--cf-surface)] px-3.5 text-[color:var(--cf-muted)] focus-within:border-violet-500 focus-within:ring-2 focus-within:ring-violet-500/15 lg:w-[232px]">
            <span className="text-[13px]">⌕</span>
            <input
              data-testid="strategy-plaza-search"
              aria-label="搜索策略 · 币对 · 作者"
              placeholder="搜索策略 · 币对 · 作者"
              value={query}
              onInput={event => {
                setQuery(event.currentTarget.value)
                resetPage()
              }}
              className="min-w-0 flex-1 border-0 bg-transparent text-[13px] text-[color:var(--cf-text)] outline-none"
            />
          </label>
        </div>
        <div className="splaza-row sortrow flex items-center gap-3 border-t border-[color:var(--cf-border)] pt-3">
          <span className="sr-label shrink-0 text-[13px] text-[color:var(--cf-muted)]">排序</span>
          <div className="splaza-sort flex rounded-[10px] border border-[color:var(--cf-border)] bg-[color:var(--cf-bg)] p-[3px]">
            {SORT_OPTIONS.map(option => (
              <button
                key={option.key}
                type="button"
                className={`h-[30px] rounded-[7px] px-3 text-[12.5px] font-medium ${sort === option.key ? 'bg-[color:var(--cf-surface)] text-violet-600 shadow-sm' : 'text-[color:var(--cf-muted)] hover:text-[color:var(--cf-text-strong)]'}`}
                onClick={() => {
                  setSort(option.key)
                  resetPage()
                }}
              >
                {option.label}
              </button>
            ))}
          </div>
          <div className="flex-1" />
          <span className="splaza-total shrink-0 font-mono text-[13px] text-[color:var(--cf-muted)]">
            共 {filteredCards.length} 个
          </span>
        </div>
      </div>

      <div
        data-testid="strategy-plaza-grid"
        className="market-grid grid gap-[18px] md:grid-cols-2 xl:grid-cols-3"
      >
        {pageCards.length === 0 ? (
          <div className="splaza-empty col-span-full py-16 text-center text-[color:var(--cf-muted)]">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-amber-500/10 text-amber-600">
              <StarIcon filled={false} />
            </div>
            <div className="mb-1.5 text-base font-semibold text-[color:var(--cf-text-strong)]">
              {favoriteOnly ? '还没有收藏的策略' : '没有符合条件的策略'}
            </div>
            <div className="mx-auto max-w-[280px] text-[13px] leading-6">
              {favoriteOnly
                ? '点击策略卡右上角的 ☆ 星标，把感兴趣的策略收藏到这里。'
                : '试试切换其他分类或清空搜索关键词。'}
            </div>
          </div>
        ) : (
          pageCards.map((item, index) => {
            const isRunning = pendingTemplateId === item.template.id && pendingAction === 'run'
            const isEditing = pendingTemplateId === item.template.id && pendingAction === 'edit'
            const starred = Boolean(favorites[item.template.id])
            const tagTone = CATEGORY_TONE[item.category] || '#64748B'
            return (
              <article
                key={item.template.id}
                data-testid="strategy-plaza-card"
                className="scard group flex min-w-0 cursor-pointer flex-col rounded-[18px] border border-[color:var(--cf-border)] bg-[color:var(--cf-surface)] px-[18px] py-4 transition hover:-translate-y-0.5 hover:border-[color:var(--cf-text-strong)]/20 hover:shadow-lg"
              >
                <div className="scard-head mb-3.5 flex items-start gap-3">
                  <span
                    className="scard-av flex h-11 w-11 shrink-0 items-center justify-center rounded-[13px] text-[15px] font-bold text-white"
                    style={{ background: item.tone }}
                  >
                    {item.symbolLabel}
                  </span>
                  <div className="scard-titles min-w-0 flex-1">
                    <div className="scard-name-row mb-1 flex items-center gap-2">
                      <span className="scard-name truncate text-[15px] font-semibold text-[color:var(--cf-text-strong)]">
                        {item.name}
                      </span>
                      <StatusBadge status={item.status} />
                    </div>
                    <div
                      data-testid="strategy-plaza-meta-row"
                      className="scard-meta-row grid min-w-0 gap-1 sm:flex sm:items-center sm:gap-2"
                    >
                      <span
                        className="scard-tag w-fit shrink-0 rounded-md px-2 py-0.5 text-[11px] font-semibold"
                        style={{ backgroundColor: `${tagTone}1f`, color: tagTone }}
                      >
                        {item.category}
                      </span>
                      <span className="scard-pair truncate font-mono text-[11.5px] text-[color:var(--cf-muted)]">
                        {item.pairLabel}
                      </span>
                      <span className="scard-period shrink-0 text-[11.5px] text-[color:var(--cf-muted)]">
                        · {item.marketLabel}
                      </span>
                      <span className="scard-period shrink-0 text-[11.5px] text-[color:var(--cf-muted)]">
                        · {item.positionLabel} / {item.leverageLabel}
                      </span>
                    </div>
                  </div>
                  <button
                    type="button"
                    className={`scard-star flex h-[30px] w-[30px] shrink-0 items-center justify-center rounded-[9px] ${starred ? 'text-amber-600' : 'text-[color:var(--cf-muted)] hover:bg-[color:var(--cf-bg)]'}`}
                    title={starred ? '取消收藏' : '收藏'}
                    onClick={event => {
                      event.stopPropagation()
                      setFavorites(value => ({
                        ...value,
                        [item.template.id]: !value[item.template.id],
                      }))
                    }}
                  >
                    <StarIcon filled={starred} />
                  </button>
                </div>

                <p className="mb-2 line-clamp-2 text-sm leading-[22px] text-[color:var(--cf-muted)]">
                  {item.description}
                </p>
                <div className="mb-3 flex flex-wrap gap-1.5">
                  {item.tags.map(tag => (
                    <span
                      key={tag}
                      className="inline-flex items-center rounded-full border border-[color:var(--cf-border)] bg-[color:var(--cf-bg)] px-2 py-0.5 text-xs leading-4 font-medium text-[color:var(--cf-muted)]"
                    >
                      {tag}
                    </span>
                  ))}
                </div>

                <div className="scard-perf mb-3 flex items-center gap-3 rounded-[11px] bg-[color:var(--cf-bg)] px-3 py-2.5">
                  <div className="min-w-0 flex-1">
                    <div className="perf-l text-[10px] tracking-[0.4px] text-[color:var(--cf-muted)] uppercase">
                      近 {item.periodLabel}
                    </div>
                    <div
                      className={`perf-v mt-0.5 flex items-baseline gap-1.5 font-mono text-[22px] font-bold ${item.returnPct == null || item.returnPct >= 0 ? 'text-emerald-600' : 'text-red-500'}`}
                    >
                      {formatMetricPct(item.returnPct, { sign: true })}
                      <small className="text-[11px] font-medium text-[color:var(--cf-muted)]">
                        收益
                      </small>
                    </div>
                  </div>
                  <Sparkline data={item.seed} index={`card-${index}`} />
                </div>

                <div className="scard-stats mb-3.5 grid grid-cols-4 gap-1.5">
                  <div className="s text-center">
                    <div className="l text-[9.5px] tracking-[0.3px] text-[color:var(--cf-muted)] uppercase">
                      Sharpe
                    </div>
                    <div className="v mt-1 font-mono text-[13px] font-bold text-[color:var(--cf-text-strong)]">
                      {item.sharpe.toFixed(2)}
                    </div>
                  </div>
                  <div className="s text-center">
                    <div className="l text-[9.5px] tracking-[0.3px] text-[color:var(--cf-muted)] uppercase">
                      回撤
                    </div>
                    <div className="v dn mt-1 font-mono text-[13px] font-bold text-red-500">
                      {formatMetricPct(item.maxDrawdownPct)}
                    </div>
                  </div>
                  <div className="s text-center">
                    <div className="l text-[9.5px] tracking-[0.3px] text-[color:var(--cf-muted)] uppercase">
                      胜率
                    </div>
                    <div className="v mt-1 font-mono text-[13px] font-bold text-[color:var(--cf-text-strong)]">
                      {formatMetricPct(item.winRatePct)}
                    </div>
                  </div>
                  <div className="s text-center">
                    <div className="l text-[9.5px] tracking-[0.3px] text-[color:var(--cf-muted)] uppercase">
                      跟单
                    </div>
                    <div className="v mt-1 font-mono text-[13px] font-bold text-[color:var(--cf-text-strong)]">
                      {fmtUsers(item.users)}
                    </div>
                  </div>
                </div>

                <div
                  data-testid="strategy-plaza-card-footer"
                  className="scard-foot mt-auto flex items-center gap-3 border-t border-[color:var(--cf-border)] pt-3"
                >
                  <div className="scard-author flex min-w-0 flex-1 items-center gap-1.5">
                    <span
                      className="a-av flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-bold text-white"
                      style={{ background: item.authorTone }}
                    >
                      {item.author.slice(0, 1)}
                    </span>
                    <span className="a-name truncate text-[11.5px] text-[color:var(--cf-muted)]">
                      {item.author}
                    </span>
                  </div>
                  <StrategyActionButtons
                    hasPendingAction={hasPendingAction}
                    isEditing={isEditing}
                    isRunning={isRunning}
                    item={item}
                    onEditStrategy={onEditStrategy}
                    onRunStrategy={onRunStrategy}
                    t={t}
                  />
                </div>
              </article>
            )
          })
        )}
      </div>

      {totalPages > 1 && (
        <div
          data-testid="strategy-plaza-pager"
          className="splaza-pager mt-7 flex items-center justify-center gap-1.5"
        >
          <button
            disabled={currentPage === 1}
            type="button"
            onClick={() => setPage(value => Math.max(1, value - 1))}
          >
            ‹
          </button>
          {Array.from({ length: totalPages }, (_, index) => index + 1).map(item => (
            <button
              key={item}
              data-testid={item === currentPage ? 'strategy-plaza-page-button-active' : undefined}
              className={
                item === currentPage ? `is-on ${PAGER_ACTIVE_GRADIENT_CLASS} text-white` : ''
              }
              style={
                item === currentPage ? { backgroundImage: PAGER_ACTIVE_GRADIENT_STYLE } : undefined
              }
              type="button"
              onClick={() => setPage(item)}
            >
              {item}
            </button>
          ))}
          <button
            disabled={currentPage === totalPages}
            type="button"
            onClick={() => setPage(value => Math.min(totalPages, value + 1))}
          >
            ›
          </button>
        </div>
      )}
    </section>
  )
}
