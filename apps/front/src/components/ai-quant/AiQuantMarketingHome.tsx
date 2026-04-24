'use client'

import type { ReactNode } from 'react'
import { ArrowRight, Bot, Check, LineChart, Play, ShieldCheck, Sparkles, Zap } from 'lucide-react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { useTranslation } from 'react-i18next'

type FeatureKey = 'conversation' | 'backtest' | 'deploy' | 'plaza'
type AdvantageKey = 'barrier' | 'logic' | 'validation' | 'closedLoop'

const workflowKeys = ['chat', 'strategy', 'backtest', 'deploy'] as const
const featureKeys: FeatureKey[] = ['conversation', 'backtest', 'deploy', 'plaza']
const advantageKeys: AdvantageKey[] = ['barrier', 'logic', 'validation', 'closedLoop']

function useCurrentLng() {
  const params = useParams<{ lng?: string }>()
  return params?.lng === 'en' ? 'en' : 'zh'
}

export function AiQuantMarketingHome() {
  const { t } = useTranslation()
  const lng = useCurrentLng()
  const ctaHref = `/${lng}/ai-quant`

  return (
    <main className="overflow-hidden bg-[color:var(--cf-bg)] text-[color:var(--cf-text)]">
      <HeroSection ctaHref={ctaHref} />
      <WorkflowSection />
      {featureKeys.map((key, index) => (
        <FeatureSection key={key} featureKey={key} reverse={index % 2 === 1} />
      ))}
      <AdvantageSection />
      <section className="px-4 py-20 md:px-8 md:py-28">
        <div className="mx-auto max-w-5xl rounded-[2rem] border border-[color:var(--cf-border)] bg-[color:var(--cf-surface)] px-6 py-12 text-center shadow-2xl shadow-black/10 md:px-12 md:py-16">
          <p className="text-xs font-bold tracking-[0.24em] text-primary uppercase">
            {t('aiQuant.homepage.final.eyebrow')}
          </p>
          <h2 className="mx-auto mt-4 max-w-3xl text-4xl leading-tight font-semibold tracking-normal text-[color:var(--cf-text-strong)] md:text-6xl">
            {t('aiQuant.homepage.final.title')}
          </h2>
          <p className="mx-auto mt-5 max-w-2xl text-base leading-7 text-[color:var(--cf-muted)] md:text-lg">
            {t('aiQuant.homepage.final.description')}
          </p>
          <PrimaryCta href={ctaHref} className="mt-8" />
        </div>
      </section>
    </main>
  )
}

function HeroSection({ ctaHref }: { ctaHref: string }) {
  const { t } = useTranslation()

  return (
    <section className="relative border-b border-[color:var(--cf-border)] bg-[color:var(--cf-bg)]">
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute inset-0 bg-[linear-gradient(to_right,var(--cf-border)_1px,transparent_1px),linear-gradient(to_bottom,var(--cf-border)_1px,transparent_1px)] bg-[size:56px_56px] opacity-[0.08]" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_78%_20%,rgba(100,108,255,0.16),transparent_34%),linear-gradient(135deg,rgba(34,197,94,0.08),transparent_42%)]" />
      </div>

      <div className="relative mx-auto grid min-h-[760px] max-w-7xl items-center gap-14 px-4 py-20 md:grid-cols-[0.82fr_1.18fr] md:px-8 md:py-24">
        <div>
          <p className="text-xs font-bold tracking-[0.24em] text-primary uppercase">
            {t('aiQuant.homepage.hero.eyebrow')}
          </p>
          <h1 className="mt-5 max-w-3xl text-5xl leading-[1.04] font-semibold tracking-normal text-[color:var(--cf-text-strong)] md:text-7xl">
            {t('aiQuant.homepage.hero.title')}
          </h1>
          <p className="mt-6 max-w-2xl text-lg leading-8 text-[color:var(--cf-muted)] md:text-xl">
            {t('aiQuant.homepage.hero.description')}
          </p>
          <PrimaryCta href={ctaHref} className="mt-9" />
        </div>

        <div className="relative min-h-[560px]">
          <ProductWorkspaceVisual />
          <LogicFloatCard />
        </div>
      </div>
    </section>
  )
}

function PrimaryCta({ href, className = '' }: { href: string, className?: string }) {
  const { t } = useTranslation()

  return (
    <Link
      href={href}
      className={`inline-flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-primary to-secondary px-6 py-4 text-base font-bold text-white shadow-2xl shadow-primary/25 transition hover:opacity-95 active:scale-[0.99] ${className}`}
    >
      {t('aiQuant.homepage.cta')}
      <ArrowRight className="h-5 w-5" />
    </Link>
  )
}

function ProductWorkspaceVisual() {
  const { t } = useTranslation()

  return (
    <div className="absolute inset-x-0 top-4 mx-auto w-full max-w-[720px] overflow-hidden rounded-[2rem] border border-[color:var(--cf-border)] bg-[color:var(--cf-surface)] shadow-2xl shadow-black/25 md:right-0 md:left-auto">
      <div className="flex h-14 items-center justify-between border-b border-[color:var(--cf-border)] bg-[color:var(--cf-surface-2)] px-5 text-xs text-[color:var(--cf-muted)]">
        <span>{t('aiQuant.homepage.visual.workspace')}</span>
        <span className="font-bold text-emerald-500">{t('aiQuant.homepage.visual.status')}</span>
      </div>
      <div className="grid min-h-[450px] grid-cols-[150px_minmax(0,1fr)] md:grid-cols-[178px_minmax(0,1fr)]">
        <aside className="border-r border-[color:var(--cf-border)] bg-[color:var(--cf-bg)] p-4">
          <div className="grid h-10 place-items-center rounded-xl bg-gradient-to-r from-primary to-secondary text-xs font-bold text-white">
            {t('aiQuant.createChat')}
          </div>
          <div className="mt-4 space-y-2">
            {(['btcPullback', 'ethBreakout', 'gridTemplate'] as const).map((item, index) => (
              <div
                key={item}
                className={`rounded-xl border px-3 py-3 text-xs ${
                  index === 0
                    ? 'border-primary/40 bg-primary/10 text-[color:var(--cf-text-strong)]'
                    : 'border-[color:var(--cf-border)] text-[color:var(--cf-muted)]'
                }`}
              >
                {t(`aiQuant.homepage.visual.sidebar.${item}`)}
              </div>
            ))}
          </div>
        </aside>

        <div className="grid min-w-0 md:grid-cols-[1.08fr_0.92fr]">
          <div className="border-r border-[color:var(--cf-border)] p-4">
            <ChatBubble icon={<Bot className="h-4 w-4" />} text={t('aiQuant.homepage.visual.assistant')} />
            <ChatBubble user text={t('aiQuant.homepage.visual.userPrompt')} />
            <div className="mt-4 rounded-2xl border border-[color:var(--cf-border)] bg-[color:var(--cf-bg)] p-4">
              <div className="text-xs text-[color:var(--cf-muted)]">
                {t('aiQuant.homepage.visual.logicTitle')}
              </div>
              <div className="mt-3 space-y-2 text-xs text-[color:var(--cf-text)]">
                <RuleDot color="bg-sky-400" text={t('aiQuant.homepage.visual.rule1')} />
                <RuleDot color="bg-secondary" text={t('aiQuant.homepage.visual.rule2')} />
                <RuleDot color="bg-emerald-400" text={t('aiQuant.homepage.visual.rule3')} />
              </div>
            </div>
            <div className="mt-4 flex h-12 items-center justify-between rounded-2xl border border-[color:var(--cf-border)] bg-[color:var(--cf-bg)] px-4 text-xs text-[color:var(--cf-muted)]">
              <span>{t('aiQuant.homepage.visual.inputPlaceholder')}</span>
              <span className="grid h-8 w-8 place-items-center rounded-full bg-gradient-to-r from-primary to-secondary text-white">
                ↑
              </span>
            </div>
          </div>

          <div className="hidden bg-[color:var(--cf-bg)] p-4 md:block">
            <div className="mb-3 flex items-center justify-between text-xs">
              <span className="text-[color:var(--cf-muted)]">{t('aiQuant.backtestResult')}</span>
              <span className="font-bold text-emerald-500">{t('aiQuant.deploy')}</span>
            </div>
            <MiniEquityChart />
            <div className="mt-4 grid grid-cols-2 gap-2">
              <MetricTile label={t('aiQuant.homepage.visual.metrics.return')} value="+18.4%" good />
              <MetricTile label={t('aiQuant.homepage.visual.metrics.maxDrawdown')} value="12.8%" />
              <MetricTile label={t('aiQuant.homepage.visual.metrics.winRate')} value="63%" />
              <MetricTile label={t('aiQuant.homepage.visual.metrics.trades')} value="48" />
            </div>
            <div className="mt-4 grid h-10 place-items-center rounded-xl bg-gradient-to-r from-primary to-secondary text-sm font-bold text-white">
              {t('aiQuant.deploy')}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function ChatBubble({
  text,
  user = false,
  icon,
}: {
  text: string
  user?: boolean
  icon?: ReactNode
}) {
  return (
    <div className="mb-3 flex gap-3">
      <div className={`grid h-8 w-8 shrink-0 place-items-center rounded-full ${user ? 'bg-[color:var(--cf-surface-2)]' : 'bg-primary/15 text-primary'}`}>
        {icon ?? <span className="text-xs font-bold">U</span>}
      </div>
      <div className={`flex-1 rounded-2xl border px-4 py-3 text-sm leading-6 ${
        user
          ? 'border-primary/35 bg-primary/10 text-[color:var(--cf-text-strong)]'
          : 'border-[color:var(--cf-border)] bg-[color:var(--cf-surface-2)] text-[color:var(--cf-text)]'
      }`}
      >
        {text}
      </div>
    </div>
  )
}

function RuleDot({ color, text }: { color: string, text: string }) {
  return (
    <div className="flex items-center gap-2">
      <span className={`h-2 w-2 rounded-full ${color}`} />
      <span>{text}</span>
    </div>
  )
}

function LogicFloatCard() {
  const { t } = useTranslation()

  return (
    <div className="absolute bottom-2 left-0 hidden w-[360px] -rotate-2 rounded-[1.6rem] border border-[color:var(--cf-border)] bg-[color:var(--cf-surface)] p-5 shadow-2xl shadow-black/25 backdrop-blur md:block">
      <div className="mb-3 flex items-center justify-between">
        <span className="text-xs text-[color:var(--cf-muted)]">{t('aiQuant.messages.graphTitle')}</span>
        <span className="text-xs font-bold text-primary">{t('aiQuant.homepage.visual.aiGenerated')}</span>
      </div>
      <div className="space-y-2 text-xs">
        <LogicLine tag="IF" color="text-amber-400" text={t('aiQuant.homepage.visual.rule1')} />
        <LogicLine tag="THEN" color="text-sky-400" text={t('aiQuant.homepage.visual.rule2')} />
        <LogicLine tag="EXECUTE" color="text-emerald-400" text={t('aiQuant.homepage.visual.rule3')} />
      </div>
    </div>
  )
}

function LogicLine({ tag, color, text }: { tag: string, color: string, text: string }) {
  return (
    <div className="rounded-xl border border-[color:var(--cf-border)] bg-[color:var(--cf-bg)] px-3 py-2 text-[color:var(--cf-text)]">
      <b className={color}>{tag}</b> {text}
    </div>
  )
}

function MiniEquityChart() {
  return (
    <div className="h-36 overflow-hidden rounded-2xl border border-[color:var(--cf-border)] bg-[color:var(--cf-surface)]">
      <svg viewBox="0 0 310 150" className="h-full w-full">
        <path d="M0 112 H310 M0 76 H310 M0 40 H310" stroke="currentColor" className="text-[color:var(--cf-border)]" strokeWidth="1" />
        <path d="M18 118 C52 100,74 124,108 82 S168 64,206 56 S256 36,292 22" fill="none" stroke="#22c55e" strokeWidth="4" strokeLinecap="round" />
        <path d="M18 118 C52 100,74 124,108 82 S168 64,206 56 S256 36,292 22 L292 150 L18 150 Z" fill="rgba(34,197,94,.14)" />
      </svg>
    </div>
  )
}

function MetricTile({ label, value, good = false }: { label: string, value: string, good?: boolean }) {
  return (
    <div className="rounded-xl border border-[color:var(--cf-border)] bg-[color:var(--cf-surface)] p-3">
      <div className="text-[10px] text-[color:var(--cf-muted)]">{label}</div>
      <div className={`mt-1 text-lg font-semibold ${good ? 'text-emerald-500' : 'text-[color:var(--cf-text-strong)]'}`}>
        {value}
      </div>
    </div>
  )
}

function WorkflowSection() {
  const { t } = useTranslation()

  return (
    <section className="px-4 py-20 md:px-8 md:py-28">
      <div className="mx-auto max-w-7xl">
        <SectionHeading
          eyebrow={t('aiQuant.homepage.workflow.eyebrow')}
          title={t('aiQuant.homepage.workflow.title')}
          centered
        />
        <div className="relative mt-12 rounded-[2rem] border border-[color:var(--cf-border)] bg-[color:var(--cf-surface)] p-5 md:p-8">
          <div className="grid gap-4 md:grid-cols-4">
            {workflowKeys.map((key, index) => (
              <div key={key} className="relative rounded-3xl border border-[color:var(--cf-border)] bg-[color:var(--cf-bg)] p-6">
                <div className="mb-8 text-xs font-bold text-primary">0{index + 1}</div>
                <h3 className="text-2xl font-semibold text-[color:var(--cf-text-strong)]">
                  {t(`aiQuant.homepage.workflow.items.${key}.title`)}
                </h3>
                <p className="mt-3 text-sm leading-6 text-[color:var(--cf-muted)]">
                  {t(`aiQuant.homepage.workflow.items.${key}.desc`)}
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}

function FeatureSection({
  featureKey,
  reverse = false,
}: {
  featureKey: FeatureKey
  reverse?: boolean
}) {
  const { t } = useTranslation()

  return (
    <section className="px-4 py-16 md:px-8 md:py-24">
      <div className={`mx-auto grid max-w-7xl items-center gap-12 md:grid-cols-2 ${reverse ? 'md:[&>*:first-child]:order-2' : ''}`}>
        <div>
          <p className="text-xs font-bold tracking-[0.2em] text-primary uppercase">
            {t(`aiQuant.homepage.features.${featureKey}.eyebrow`)}
          </p>
          <h2 className="mt-4 text-4xl leading-tight font-semibold tracking-normal text-[color:var(--cf-text-strong)] md:text-5xl">
            {t(`aiQuant.homepage.features.${featureKey}.title`)}
          </h2>
          <p className="mt-5 max-w-xl text-base leading-7 text-[color:var(--cf-muted)] md:text-lg">
            {t(`aiQuant.homepage.features.${featureKey}.description`)}
          </p>
        </div>
        <FeatureVisual featureKey={featureKey} />
      </div>
    </section>
  )
}

function FeatureVisual({ featureKey }: { featureKey: FeatureKey }) {
  if (featureKey === 'conversation') return <ConversationVisual />
  if (featureKey === 'backtest') return <BacktestVisual />
  if (featureKey === 'deploy') return <DeployVisual />
  return <PlazaVisual />
}

function ConversationVisual() {
  const { t } = useTranslation()

  return (
    <div className="rounded-[2rem] border border-[color:var(--cf-border)] bg-[color:var(--cf-surface)] p-5 shadow-2xl shadow-black/10">
      <ChatBubble icon={<Sparkles className="h-4 w-4" />} text={t('aiQuant.homepage.visual.assistant')} />
      <ChatBubble user text={t('aiQuant.homepage.visual.userPrompt')} />
      <div className="rounded-2xl border border-primary/30 bg-primary/10 p-4">
        <p className="text-xs font-bold text-primary">{t('aiQuant.homepage.visual.parsedStrategy')}</p>
        <div className="mt-3 grid gap-2 text-sm text-[color:var(--cf-text)]">
          <RuleDot color="bg-sky-400" text={t('aiQuant.homepage.visual.rule1')} />
          <RuleDot color="bg-secondary" text={t('aiQuant.homepage.visual.rule2')} />
          <RuleDot color="bg-emerald-400" text={t('aiQuant.homepage.visual.rule3')} />
        </div>
      </div>
    </div>
  )
}

function BacktestVisual() {
  const { t } = useTranslation()

  return (
    <div className="rounded-[2rem] border border-[color:var(--cf-border)] bg-[color:var(--cf-surface)] p-5 shadow-2xl shadow-black/10">
      <div className="mb-4 flex items-center justify-between">
        <span className="text-sm font-semibold text-[color:var(--cf-text-strong)]">{t('aiQuant.backtestResult')}</span>
        <LineChart className="h-5 w-5 text-primary" />
      </div>
      <MiniEquityChart />
      <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-4">
        <MetricTile label={t('aiQuant.homepage.visual.metrics.return')} value="+18.4%" good />
        <MetricTile label={t('aiQuant.homepage.visual.metrics.maxDrawdown')} value="12.8%" />
        <MetricTile label={t('aiQuant.homepage.visual.metrics.winRate')} value="63%" />
        <MetricTile label={t('aiQuant.homepage.visual.metrics.trades')} value="48" />
      </div>
    </div>
  )
}

function DeployVisual() {
  const { t } = useTranslation()
  const rows = [
    [t('aiQuant.homepage.visual.deployRows.snapshot'), t('aiQuant.homepage.visual.deployRows.confirmed')],
    [t('aiQuant.homepage.visual.deployRows.backtestGate'), t('aiQuant.homepage.visual.deployRows.passed')],
    [t('aiQuant.homepage.visual.deployRows.exchangeApi'), t('aiQuant.homepage.visual.deployRows.ready')],
  ] as const

  return (
    <div className="rounded-[2rem] border border-[color:var(--cf-border)] bg-[color:var(--cf-surface)] p-5 shadow-2xl shadow-black/10">
      <div className="space-y-3">
        {rows.map(([label, value]) => (
          <div key={label} className="flex items-center justify-between rounded-2xl border border-[color:var(--cf-border)] bg-[color:var(--cf-bg)] p-4">
            <span className="text-sm text-[color:var(--cf-text)]">{label}</span>
            <span className="inline-flex items-center gap-2 text-sm font-bold text-emerald-500">
              <Check className="h-4 w-4" />
              {value}
            </span>
          </div>
        ))}
      </div>
      <div className="mt-4 grid h-12 place-items-center rounded-2xl bg-gradient-to-r from-primary to-secondary font-bold text-white">
        {t('aiQuant.homepage.visual.deployAction')}
      </div>
    </div>
  )
}

function PlazaVisual() {
  const { t } = useTranslation()
  const cards = [
    [t('aiQuant.homepage.visual.plaza.trend'), '+12.5%', ShieldCheck],
    [t('aiQuant.homepage.visual.plaza.grid'), '95%', Zap],
    [t('aiQuant.homepage.visual.plaza.reversion'), '72%', Play],
    [t('aiQuant.homepage.visual.plaza.breakout'), t('aiQuant.homepage.visual.deployRows.ready'), LineChart],
  ] as const

  return (
    <div className="grid grid-cols-2 gap-4">
      {cards.map(([title, stat, Icon]) => (
        <div key={title} className="rounded-[1.5rem] border border-[color:var(--cf-border)] bg-[color:var(--cf-surface)] p-5 shadow-xl shadow-black/5">
          <div className="grid h-10 w-10 place-items-center rounded-xl bg-primary/10 text-primary">
            <Icon className="h-5 w-5" />
          </div>
          <h3 className="mt-5 text-lg font-semibold text-[color:var(--cf-text-strong)]">{title}</h3>
          <p className="mt-2 text-sm text-[color:var(--cf-muted)]">{t('aiQuant.homepage.visual.plaza.template')}</p>
          <div className="mt-6 text-2xl font-semibold text-emerald-500">{stat}</div>
        </div>
      ))}
    </div>
  )
}

function AdvantageSection() {
  const { t } = useTranslation()

  return (
    <section className="relative px-4 py-20 md:px-8 md:py-28">
      <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-emerald-500/5" />
      <div className="relative mx-auto grid max-w-7xl gap-12 md:grid-cols-[0.82fr_1.18fr] md:items-center">
        <SectionHeading
          eyebrow={t('aiQuant.homepage.advantages.eyebrow')}
          title={t('aiQuant.homepage.advantages.title')}
        />
        <div className="grid gap-4 md:grid-cols-2">
          {advantageKeys.map((key, index) => (
            <div key={key} className="min-h-[220px] rounded-[1.75rem] border border-[color:var(--cf-border)] bg-[color:var(--cf-surface)] p-6 shadow-xl shadow-black/5">
              <div className="mb-8 text-xs font-bold text-primary">0{index + 1}</div>
              <h3 className="text-2xl font-semibold text-[color:var(--cf-text-strong)]">
                {t(`aiQuant.homepage.advantages.items.${key}.title`)}
              </h3>
              <p className="mt-3 text-sm leading-6 text-[color:var(--cf-muted)]">
                {t(`aiQuant.homepage.advantages.items.${key}.desc`)}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

function SectionHeading({
  eyebrow,
  title,
  centered = false,
}: {
  eyebrow: string
  title: string
  centered?: boolean
}) {
  return (
    <div className={centered ? 'text-center' : ''}>
      <p className="text-xs font-bold tracking-[0.2em] text-primary uppercase">{eyebrow}</p>
      <h2 className="mt-4 text-4xl leading-tight font-semibold tracking-normal text-[color:var(--cf-text-strong)] md:text-5xl">
        {title}
      </h2>
    </div>
  )
}
