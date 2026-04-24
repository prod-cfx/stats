import { motion } from 'framer-motion'
import type { ReactNode } from 'react'
import { ArrowRight, Bot, Check, LineChart, Play, ShieldCheck, Sparkles, Zap } from 'lucide-react'
import Link from 'next/link'

type FeatureKey = 'conversation' | 'backtest' | 'deploy' | 'plaza'
type AdvantageKey = 'barrier' | 'logic' | 'validation' | 'closedLoop'
type Translate = (key: string, options?: Record<string, unknown>) => string

const workflowKeys = ['chat', 'strategy', 'backtest', 'deploy'] as const
const featureKeys: FeatureKey[] = ['conversation', 'backtest', 'deploy', 'plaza']
const advantageKeys: AdvantageKey[] = ['barrier', 'logic', 'validation', 'closedLoop']
export function AiQuantMarketingHome({ lng, t }: { lng: 'zh' | 'en', t: Translate }) {
  const ctaHref = `/${lng}/ai-quant`

  return (
    <main className="relative overflow-hidden bg-[color:var(--cf-bg)] text-[color:var(--cf-text)]">
      {/* Global Grid Background */}
      <div className="pointer-events-none fixed inset-0 z-0 overflow-hidden">
        <div className="absolute inset-0 bg-[linear-gradient(to_right,var(--cf-border)_1px,transparent_1px),linear-gradient(to_bottom,var(--cf-border)_1px,transparent_1px)] bg-[size:64px_64px] opacity-[0.05]" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(100,108,255,0.05),transparent_70%)]" />
      </div>

      <div className="relative z-10">
        <HeroSection ctaHref={ctaHref} t={t} />
        <WorkflowSection t={t} />
        {featureKeys.map((key, index) => (
          <FeatureSection key={key} featureKey={key} reverse={index % 2 === 1} t={t} />
        ))}
        <AdvantageSection t={t} />
        <section className="px-4 py-20 md:px-8 md:py-28">
          <div className="mx-auto max-w-5xl rounded-[2rem] border border-white/5 bg-[color:var(--cf-surface)]/50 px-6 py-12 text-center shadow-2xl shadow-black/10 backdrop-blur-xl md:px-12 md:py-16">
            <p className="text-xs font-bold tracking-[0.24em] text-primary uppercase">
              {t('aiQuant.homepage.final.eyebrow')}
            </p>
            <h2 className="mx-auto mt-4 max-w-3xl text-4xl leading-tight font-semibold tracking-tighter text-[color:var(--cf-text-strong)] md:text-6xl">
              {t('aiQuant.homepage.final.title')}
            </h2>
            <p className="mx-auto mt-5 max-w-2xl text-base leading-7 text-[color:var(--cf-muted)] md:text-lg">
              {t('aiQuant.homepage.final.description')}
            </p>
            <PrimaryCta href={ctaHref} className="mt-8" label={t('aiQuant.homepage.finalCta')} />
          </div>
        </section>
      </div>
    </main>
  )
}

function HeroSection({ ctaHref, t }: { ctaHref: string, t: Translate }) {

  return (
    <section className="relative">
      <div className="relative mx-auto grid min-h-[840px] max-w-7xl items-center gap-14 px-4 pt-24 pb-20 md:grid-cols-[0.9fr_1.1fr] md:px-8 md:pt-32 md:pb-24">
        <div className="relative z-10">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            <p className="text-xs font-bold tracking-[0.24em] text-primary uppercase">
              {t('aiQuant.homepage.hero.eyebrow')}
            </p>
            <h1 className="mt-5 max-w-3xl bg-gradient-to-b from-[color:var(--cf-text-strong)] to-[color:var(--cf-text-strong)]/60 bg-clip-text text-5xl leading-[1.04] font-semibold tracking-tighter text-transparent md:text-7xl">
              {t('aiQuant.homepage.hero.title')}
            </h1>
            <p className="mt-6 max-w-2xl text-lg leading-8 text-[color:var(--cf-muted)] md:text-xl">
              {t('aiQuant.homepage.hero.description')}
            </p>
            <div className="mt-10 flex flex-wrap gap-4">
              <PrimaryCta href={ctaHref} label={t('aiQuant.homepage.heroCta')} />
              <Link
                href="#workflow"
                className="inline-flex items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-6 py-4 text-base font-bold text-[color:var(--cf-text-strong)] backdrop-blur-sm transition hover:bg-white/10"
              >
                {t('aiQuant.homepage.howItWorks')}
              </Link>
            </div>
          </motion.div>
        </div>

        <div className="relative flex min-h-[600px] items-center justify-center">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(100,108,255,0.15),transparent_60%)]" />
          
          <motion.div
            initial={{ opacity: 0, scale: 0.9, rotateY: -10 }}
            animate={{ opacity: 1, scale: 1, rotateY: 0 }}
            transition={{ duration: 0.8, delay: 0.2 }}
            className="relative z-10 w-full perspective-1000"
          >
            <ProductWorkspaceVisual t={t} />
          </motion.div>

          {/* Floating Cards */}
          <motion.div
            animate={{ y: [0, -15, 0] }}
            transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
            className="absolute -top-10 -right-4 z-20 md:right-0"
          >
            <div className="rounded-2xl border border-white/10 bg-white/5 p-4 shadow-2xl backdrop-blur-xl">
              <div className="flex items-center gap-3">
                <div className="grid h-10 w-10 place-items-center rounded-full bg-emerald-500/20 text-emerald-500">
                  <LineChart className="h-5 w-5" />
                </div>
                <div>
                  <div className="text-[10px] font-medium text-[color:var(--cf-muted)] uppercase tracking-wider">ROI</div>
                  <div className="text-lg font-bold text-emerald-500">+124.8%</div>
                </div>
              </div>
            </div>
          </motion.div>

          <motion.div
            animate={{ y: [0, 15, 0] }}
            transition={{ duration: 5, repeat: Infinity, ease: "easeInOut", delay: 0.5 }}
            className="absolute -bottom-10 -left-4 z-20 md:left-0"
          >
            <div className="rounded-2xl border border-white/10 bg-white/5 p-4 shadow-2xl backdrop-blur-xl">
              <div className="flex items-center gap-3">
                <div className="grid h-10 w-10 place-items-center rounded-full bg-primary/20 text-primary">
                  <ShieldCheck className="h-5 w-5" />
                </div>
                <div>
                  <div className="text-[10px] font-medium text-[color:var(--cf-muted)] uppercase tracking-wider">Risk Control</div>
                  <div className="text-lg font-bold text-primary">Max DD 8.2%</div>
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  )
}

function PrimaryCta({ href, className = '', label }: { href: string, className?: string, label: string }) {

  return (
    <Link
      href={href}
      className={`inline-flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-primary to-secondary px-8 py-4 text-base font-bold text-white shadow-2xl shadow-primary/25 transition hover:scale-105 hover:opacity-95 active:scale-[0.98] ${className}`}
    >
      {label}
      <ArrowRight className="h-5 w-5" />
    </Link>
  )
}

function ProductWorkspaceVisual({ t }: { t: Translate }) {

  return (
    <div className="mx-auto w-full max-w-[720px] overflow-hidden rounded-[2.5rem] border border-white/10 bg-[color:var(--cf-surface)]/40 shadow-[0_32px_64px_-16px_rgba(0,0,0,0.5)] backdrop-blur-2xl">
      <div className="flex h-12 items-center justify-between border-b border-white/5 bg-white/5 px-6 text-[10px] font-medium text-[color:var(--cf-muted)] uppercase tracking-widest">
        <div className="flex items-center gap-4">
          <div className="flex gap-1.5">
            <div className="h-2.5 w-2.5 rounded-full bg-red-500/50" />
            <div className="h-2.5 w-2.5 rounded-full bg-amber-500/50" />
            <div className="h-2.5 w-2.5 rounded-full bg-emerald-500/50" />
          </div>
          <span>{t('aiQuant.homepage.visual.workspace')}</span>
        </div>
        <span className="flex items-center gap-2 text-emerald-500">
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75"></span>
            <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500"></span>
          </span>
          {t('aiQuant.homepage.visual.status')}
        </span>
      </div>
      <div className="grid min-h-[480px] grid-cols-[140px_minmax(0,1fr)] md:grid-cols-[160px_minmax(0,1fr)]">
        <aside className="border-r border-white/5 bg-black/20 p-4">
          <div className="grid h-9 place-items-center rounded-xl bg-gradient-to-r from-primary to-secondary text-[10px] font-bold text-white uppercase tracking-wider">
            {t('aiQuant.createChat')}
          </div>
          <div className="mt-6 space-y-2.5">
            {(['btcPullback', 'ethBreakout', 'gridTemplate'] as const).map((item, index) => (
              <div
                key={item}
                className={`rounded-xl border px-3 py-2.5 text-[11px] transition-colors ${
                  index === 0
                    ? 'border-primary/40 bg-primary/10 text-[color:var(--cf-text-strong)]'
                    : 'border-white/5 text-[color:var(--cf-muted)] hover:bg-white/5'
                }`}
              >
                {t(`aiQuant.homepage.visual.sidebar.${item}`)}
              </div>
            ))}
          </div>
        </aside>

        <div className="grid min-w-0 md:grid-cols-[1.1fr_0.9fr]">
          <div className="border-r border-white/5 p-5">
            <ChatBubble icon={<Bot className="h-4 w-4" />} text={t('aiQuant.homepage.visual.assistant')} />
            <ChatBubble user text={t('aiQuant.homepage.visual.userPrompt')} />
            <div className="mt-6 rounded-2xl border border-white/5 bg-black/20 p-4">
              <div className="text-[10px] font-medium text-[color:var(--cf-muted)] uppercase tracking-wider">
                {t('aiQuant.homepage.visual.logicTitle')}
              </div>
              <div className="mt-4 space-y-3 text-[11px] text-[color:var(--cf-text)]">
                <RuleDot color="bg-sky-400" text={t('aiQuant.homepage.visual.rule1')} />
                <RuleDot color="bg-secondary" text={t('aiQuant.homepage.visual.rule2')} />
                <RuleDot color="bg-emerald-400" text={t('aiQuant.homepage.visual.rule3')} />
              </div>
            </div>
            <div className="mt-6 flex h-11 items-center justify-between rounded-2xl border border-white/5 bg-black/20 px-4 text-[11px] text-[color:var(--cf-muted)]">
              <span>{t('aiQuant.homepage.visual.inputPlaceholder')}</span>
              <span className="grid h-7 w-7 place-items-center rounded-full bg-gradient-to-r from-primary to-secondary text-white">
                ↑
              </span>
            </div>
          </div>

          <div className="hidden bg-black/10 p-5 md:block">
            <div className="mb-4 flex items-center justify-between text-[10px] font-medium uppercase tracking-wider">
              <span className="text-[color:var(--cf-muted)]">{t('aiQuant.backtestResult')}</span>
              <span className="text-emerald-500">{t('aiQuant.deploy')}</span>
            </div>
            <MiniEquityChart />
            <div className="mt-6 grid grid-cols-2 gap-2.5">
              <MetricTile label={t('aiQuant.homepage.visual.metrics.return')} value="+18.4%" good />
              <MetricTile label={t('aiQuant.homepage.visual.metrics.maxDrawdown')} value="12.8%" />
              <MetricTile label={t('aiQuant.homepage.visual.metrics.winRate')} value="63%" />
              <MetricTile label={t('aiQuant.homepage.visual.metrics.trades')} value="48" />
            </div>
            <div className="mt-6 grid h-10 place-items-center rounded-xl bg-gradient-to-r from-primary to-secondary text-xs font-bold text-white uppercase tracking-wider">
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

function LogicFloatCard({ t }: { t: Translate }) {

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

function WorkflowSection({ t }: { t: Translate }) {

  return (
    <section id="workflow" className="relative px-4 py-24 md:px-8 md:py-32">
      <div className="mx-auto max-w-7xl">
        <SectionHeading
          eyebrow={t('aiQuant.homepage.workflow.eyebrow')}
          title={t('aiQuant.homepage.workflow.title')}
          centered
        />
        <div className="mt-16 grid gap-6 md:grid-cols-4">
          {workflowKeys.map((key, index) => (
            <motion.div
              key={key}
              whileHover={{ y: -8 }}
              className="group relative rounded-[2rem] border border-white/5 bg-white/5 p-8 shadow-2xl backdrop-blur-sm transition-all hover:bg-white/10"
            >
              <div className="absolute -inset-px rounded-[2rem] bg-gradient-to-b from-primary/20 to-transparent opacity-0 transition-opacity group-hover:opacity-100" />
              <div className="relative z-10">
                <div className="mb-10 flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-lg font-bold text-primary">
                  0{index + 1}
                </div>
                <h3 className="text-2xl font-semibold tracking-tight text-[color:var(--cf-text-strong)]">
                  {t(`aiQuant.homepage.workflow.items.${key}.title`)}
                </h3>
                <p className="mt-4 text-sm leading-7 text-[color:var(--cf-muted)]">
                  {t(`aiQuant.homepage.workflow.items.${key}.desc`)}
                </p>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  )
}

function FeatureSection({
  featureKey,
  reverse = false,
  t,
}: {
  featureKey: FeatureKey
  reverse?: boolean
  t: Translate
}) {

  return (
    <section className="px-4 py-20 md:px-8 md:py-28">
      <div className={`mx-auto grid max-w-7xl items-center gap-16 md:grid-cols-2 ${reverse ? 'md:[&>*:first-child]:order-2' : ''}`}>
        <motion.div
          initial={{ opacity: 0, x: reverse ? 20 : -20 }}
          whileInView={{ opacity: 1, x: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
        >
          <p className="text-xs font-bold tracking-[0.24em] text-primary uppercase">
            {t(`aiQuant.homepage.features.${featureKey}.eyebrow`)}
          </p>
          <h2 className="mt-4 text-4xl leading-tight font-semibold tracking-tighter text-[color:var(--cf-text-strong)] md:text-5xl">
            {t(`aiQuant.homepage.features.${featureKey}.title`)}
          </h2>
          <p className="mt-5 max-w-xl text-base leading-8 text-[color:var(--cf-muted)] md:text-lg">
            {t(`aiQuant.homepage.features.${featureKey}.description`)}
          </p>
        </motion.div>
        <motion.div
          initial={{ opacity: 0, scale: 0.95, rotateX: 5, rotateY: reverse ? -5 : 5 }}
          whileInView={{ opacity: 1, scale: 1, rotateX: 0, rotateY: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.8 }}
          className="perspective-1000"
        >
          <FeatureVisual featureKey={featureKey} t={t} />
        </motion.div>
      </div>
    </section>
  )
}

function FeatureVisual({ featureKey, t }: { featureKey: FeatureKey, t: Translate }) {
  if (featureKey === 'conversation') return <ConversationVisual t={t} />
  if (featureKey === 'backtest') return <BacktestVisual t={t} />
  if (featureKey === 'deploy') return <DeployVisual t={t} />
  return <PlazaVisual t={t} />
}

function ConversationVisual({ t }: { t: Translate }) {

  return (
    <div className="rounded-[2.5rem] border border-white/10 bg-[color:var(--cf-surface)]/40 p-6 shadow-2xl backdrop-blur-xl transition-transform hover:scale-[1.02]">
      <ChatBubble icon={<Sparkles className="h-4 w-4" />} text={t('aiQuant.homepage.visual.assistant')} />
      <ChatBubble user text={t('aiQuant.homepage.visual.userPrompt')} />
      <div className="mt-6 rounded-2xl border border-primary/30 bg-primary/10 p-5">
        <p className="text-[10px] font-bold text-primary uppercase tracking-wider">{t('aiQuant.homepage.visual.parsedStrategy')}</p>
        <div className="mt-4 grid gap-3 text-[11px] text-[color:var(--cf-text)]">
          <RuleDot color="bg-sky-400" text={t('aiQuant.homepage.visual.rule1')} />
          <RuleDot color="bg-secondary" text={t('aiQuant.homepage.visual.rule2')} />
          <RuleDot color="bg-emerald-400" text={t('aiQuant.homepage.visual.rule3')} />
        </div>
      </div>
    </div>
  )
}

function BacktestVisual({ t }: { t: Translate }) {

  return (
    <div className="rounded-[2.5rem] border border-white/10 bg-[color:var(--cf-surface)]/40 p-6 shadow-2xl backdrop-blur-xl transition-transform hover:scale-[1.02]">
      <div className="mb-6 flex items-center justify-between">
        <span className="text-[10px] font-bold text-[color:var(--cf-text-strong)] uppercase tracking-wider">{t('aiQuant.backtestResult')}</span>
        <LineChart className="h-5 w-5 text-primary" />
      </div>
      <MiniEquityChart />
      <div className="mt-6 grid grid-cols-2 gap-3 md:grid-cols-4">
        <MetricTile label={t('aiQuant.homepage.visual.metrics.return')} value="+18.4%" good />
        <MetricTile label={t('aiQuant.homepage.visual.metrics.maxDrawdown')} value="12.8%" />
        <MetricTile label={t('aiQuant.homepage.visual.metrics.winRate')} value="63%" />
        <MetricTile label={t('aiQuant.homepage.visual.metrics.trades')} value="48" />
      </div>
    </div>
  )
}

function DeployVisual({ t }: { t: Translate }) {
  const rows = [
    [t('aiQuant.homepage.visual.deployRows.snapshot'), t('aiQuant.homepage.visual.deployRows.confirmed')],
    [t('aiQuant.homepage.visual.deployRows.backtestGate'), t('aiQuant.homepage.visual.deployRows.passed')],
    [t('aiQuant.homepage.visual.deployRows.exchangeApi'), t('aiQuant.homepage.visual.deployRows.ready')],
  ] as const

  return (
    <div className="rounded-[2.5rem] border border-white/10 bg-[color:var(--cf-surface)]/40 p-6 shadow-2xl backdrop-blur-xl transition-transform hover:scale-[1.02]">
      <div className="space-y-3">
        {rows.map(([label, value]) => (
          <div key={label} className="flex items-center justify-between rounded-2xl border border-white/5 bg-black/20 p-4">
            <span className="text-[11px] text-[color:var(--cf-text)]">{label}</span>
            <span className="inline-flex items-center gap-2 text-[11px] font-bold text-emerald-500">
              <Check className="h-4 w-4" />
              {value}
            </span>
          </div>
        ))}
      </div>
      <div className="mt-6 grid h-12 place-items-center rounded-2xl bg-gradient-to-r from-primary to-secondary text-xs font-bold text-white uppercase tracking-wider">
        {t('aiQuant.homepage.visual.deployAction')}
      </div>
    </div>
  )
}

function PlazaVisual({ t }: { t: Translate }) {
  const cards = [
    [t('aiQuant.homepage.visual.plaza.trend'), '+12.5%', ShieldCheck],
    [t('aiQuant.homepage.visual.plaza.grid'), '95%', Zap],
    [t('aiQuant.homepage.visual.plaza.reversion'), '72%', Play],
    [t('aiQuant.homepage.visual.plaza.breakout'), t('aiQuant.homepage.visual.deployRows.ready'), LineChart],
  ] as const

  return (
    <div className="grid grid-cols-2 gap-4">
      {cards.map(([title, stat, Icon]) => (
        <div key={title} className="rounded-[2rem] border border-white/10 bg-[color:var(--cf-surface)]/40 p-6 shadow-2xl backdrop-blur-xl transition-transform hover:scale-[1.05]">
          <div className="grid h-10 w-10 place-items-center rounded-xl bg-primary/10 text-primary">
            <Icon className="h-5 w-5" />
          </div>
          <h3 className="mt-5 text-lg font-semibold tracking-tight text-[color:var(--cf-text-strong)]">{title}</h3>
          <p className="mt-2 text-[11px] text-[color:var(--cf-muted)]">{t('aiQuant.homepage.visual.plaza.template')}</p>
          <div className="mt-6 text-2xl font-bold text-emerald-500">{stat}</div>
        </div>
      ))}
    </div>
  )
}

function AdvantageSection({ t }: { t: Translate }) {

  return (
    <section className="relative px-4 py-24 md:px-8 md:py-32">
      <div className="relative mx-auto grid max-w-7xl gap-16 md:grid-cols-[0.8fr_1.2fr] md:items-center">
        <SectionHeading
          eyebrow={t('aiQuant.homepage.advantages.eyebrow')}
          title={t('aiQuant.homepage.advantages.title')}
        />
        <div className="grid gap-6 md:grid-cols-2">
          {advantageKeys.map((key, index) => (
            <motion.div
              key={key}
              whileHover={{ y: -8 }}
              className="group relative min-h-[240px] rounded-[2rem] border border-white/5 bg-white/5 p-8 shadow-2xl backdrop-blur-sm transition-all hover:bg-white/10"
            >
              <div className="absolute -inset-px rounded-[2rem] bg-gradient-to-b from-emerald-500/20 to-transparent opacity-0 transition-opacity group-hover:opacity-100" />
              <div className="relative z-10">
                <div className="mb-10 flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-500/10 text-lg font-bold text-emerald-500">
                  0{index + 1}
                </div>
                <h3 className="text-2xl font-semibold tracking-tight text-[color:var(--cf-text-strong)]">
                  {t(`aiQuant.homepage.advantages.items.${key}.title`)}
                </h3>
                <p className="mt-4 text-sm leading-7 text-[color:var(--cf-muted)]">
                  {t(`aiQuant.homepage.advantages.items.${key}.desc`)}
                </p>
              </div>
            </motion.div>
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
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.5 }}
      >
        <p className="text-xs font-bold tracking-[0.24em] text-primary uppercase">{eyebrow}</p>
        <h2 className="mt-4 text-4xl leading-tight font-semibold tracking-tighter text-[color:var(--cf-text-strong)] md:text-6xl">
          {title}
        </h2>
      </motion.div>
    </div>
  )
}
