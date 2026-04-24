'use client'

import { motion, type Transition, useReducedMotion } from 'framer-motion'
import { ArrowRight, BarChart3, LineChart, Play, ShieldCheck, Sparkles, Zap } from 'lucide-react'
import Link from 'next/link'
import { useTranslation } from 'react-i18next'

type FeatureKey = 'conversation' | 'backtest' | 'deploy' | 'plaza'
type AdvantageKey = 'barrier' | 'logic' | 'validation' | 'closedLoop'

const sectionShell = 'relative border-t border-slate-200/70 bg-white/45 px-6 py-20 dark:border-white/[0.06] dark:bg-[#080c12]/80 md:px-8 md:py-24'
const alternateSectionShell = 'relative border-t border-slate-200/70 bg-[#f8fafc] px-6 py-20 dark:border-white/[0.06] dark:bg-[#020305] md:px-8 md:py-24'
const panelClass = 'border border-slate-200/80 bg-white/75 shadow-[0_24px_80px_rgba(15,23,42,0.08)] backdrop-blur-xl dark:border-white/[0.08] dark:bg-[#10151d]/72 dark:shadow-[0_28px_100px_rgba(0,0,0,0.35)]'
const mutedText = 'text-slate-600 dark:text-[#8f98aa]'

const revealUp = {
  hidden: { opacity: 0, y: 24 },
  visible: { opacity: 1, y: 0 },
}

const revealTransition: Transition = {
  duration: 0.65,
  ease: [0.22, 1, 0.36, 1],
}

const workflowKeys = ['chat', 'strategy', 'backtest', 'deploy'] as const
const featureKeys: FeatureKey[] = ['conversation', 'backtest', 'deploy', 'plaza']
const advantageKeys: AdvantageKey[] = ['barrier', 'logic', 'validation', 'closedLoop']

export function AiQuantMarketingHome({ lng }: { lng: 'zh' | 'en' }) {
  const ctaHref = `/${lng}/ai-quant`

  return (
    <main className="relative min-h-screen overflow-hidden bg-[#f6f8fc] text-slate-950 selection:bg-primary/20 dark:bg-[#020305] dark:text-white">
      <ThemeAmbientBackground />
      <div className="relative z-10">
        <HeroSection ctaHref={ctaHref} lng={lng} />
        <WorkflowSection />
        {featureKeys.map((key, index) => (
          <FeatureSection key={key} featureKey={key} reverse={index % 2 === 1} />
        ))}
        <AdvantageSection />
        <FinalCtaSection ctaHref={ctaHref} />
      </div>
    </main>
  )
}

function ThemeAmbientBackground() {
  const shouldReduceMotion = useReducedMotion()

  return (
    <div className="pointer-events-none fixed inset-0 z-0 overflow-hidden">
      <div className="absolute inset-0 bg-[linear-gradient(to_right,rgba(15,23,42,0.035)_1px,transparent_1px),linear-gradient(to_bottom,rgba(15,23,42,0.03)_1px,transparent_1px)] bg-[size:48px_48px] dark:bg-[linear-gradient(to_right,rgba(255,255,255,0.018)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.018)_1px,transparent_1px)]" />
      <motion.div
        aria-hidden="true"
        animate={shouldReduceMotion ? { opacity: 0.66, scale: 1 } : { opacity: [0.5, 0.82, 0.5], scale: [0.96, 1.06, 0.96] }}
        transition={shouldReduceMotion ? undefined : { duration: 10, repeat: Infinity, ease: 'easeInOut' }}
        className="absolute -top-48 left-1/2 h-[38rem] w-[38rem] -translate-x-1/2 rounded-full bg-blue-300/24 blur-[140px] dark:bg-blue-500/14"
      />
      <motion.div
        aria-hidden="true"
        animate={shouldReduceMotion ? { opacity: 0.48, scale: 1 } : { opacity: [0.34, 0.62, 0.34], scale: [1, 1.12, 1] }}
        transition={shouldReduceMotion ? undefined : { duration: 13, repeat: Infinity, ease: 'easeInOut', delay: 1.2 }}
        className="absolute top-1/4 -left-52 h-[34rem] w-[34rem] rounded-full bg-violet-300/22 blur-[130px] dark:bg-violet-500/12"
      />
      <motion.div
        aria-hidden="true"
        animate={shouldReduceMotion ? { opacity: 0.38, scale: 1 } : { opacity: [0.28, 0.5, 0.28], scale: [1.04, 0.95, 1.04] }}
        transition={shouldReduceMotion ? undefined : { duration: 12, repeat: Infinity, ease: 'easeInOut', delay: 0.6 }}
        className="absolute -right-48 bottom-0 h-[32rem] w-[32rem] rounded-full bg-cyan-300/18 blur-[130px] dark:bg-cyan-500/10"
      />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,rgba(255,255,255,0.78),transparent_46%)] dark:bg-[radial-gradient(circle_at_50%_0%,rgba(255,255,255,0.055),transparent_50%)]" />
    </div>
  )
}

function HeroSection({ ctaHref, lng }: { ctaHref: string, lng: 'zh' | 'en' }) {
  const { t } = useTranslation()
  const title = t('aiQuant.homepage.hero.title')

  return (
    <section className="relative overflow-hidden bg-[#f6f8fc]/80 px-6 pt-20 pb-24 dark:bg-[#020305]/90 md:px-8 md:pt-28 md:pb-32">
      <HeroLines />
      <HeroParticles />
      <motion.div
        initial="hidden"
        animate="visible"
        variants={revealUp}
        transition={revealTransition}
        className="relative z-10 mx-auto flex max-w-4xl flex-col items-center text-center"
      >
        <div className="inline-flex items-center gap-2 rounded-full border border-primary/25 bg-white/65 px-4 py-1.5 text-[11px] font-bold tracking-[0.22em] text-primary uppercase shadow-[0_10px_30px_rgba(100,108,255,0.12)] backdrop-blur-xl dark:border-white/10 dark:bg-white/[0.04]">
          <Sparkles className="h-3 w-3" />
          {t('aiQuant.homepage.hero.eyebrow')}
        </div>
        <h1 className="mt-8 text-5xl leading-[1.08] font-extrabold tracking-tight text-slate-950 antialiased dark:text-white sm:text-6xl md:text-7xl lg:text-[5.8rem] lg:leading-[1.04]">
          <GradientTitle title={title} lng={lng} />
        </h1>
        <p className={`mx-auto mt-8 max-w-2xl text-[15px] leading-[1.75] md:text-base md:leading-relaxed ${mutedText}`}>
          {t('aiQuant.homepage.hero.description')}
        </p>
        <div className="mt-10">
          <PrimaryCta href={ctaHref} label={t('aiQuant.homepage.heroCta')} />
        </div>
      </motion.div>
    </section>
  )
}

function GradientTitle({ title, lng }: { title: string, lng: 'zh' | 'en' }) {
  const target = lng === 'zh' ? 'AI 量化' : 'AI quant'

  if (!title.includes(target)) {
    return <>{title}</>
  }

  const parts = title.split(target)

  return (
    <>
      {parts.map((part, index) => (
        <span key={`${part}-${index}`}>
          {part}
          {index < parts.length - 1 && (
            <span className="bg-gradient-to-r from-[#3e69ff] via-[#6d57ff] to-[#8a5bff] bg-clip-text text-transparent dark:from-[#60a5fa] dark:via-primary dark:to-[#c084fc]">
              {target}
            </span>
          )}
        </span>
      ))}
    </>
  )
}

function HeroLines() {
  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-0">
      <div className="absolute top-16 left-[8%] h-px w-[28rem] -rotate-12 bg-gradient-to-r from-transparent via-blue-400/28 to-transparent dark:via-blue-300/16" />
      <div className="absolute right-[4%] bottom-20 h-px w-[34rem] -rotate-12 bg-gradient-to-r from-transparent via-violet-400/24 to-transparent dark:via-violet-300/14" />
    </div>
  )
}

function HeroParticles() {
  const shouldReduceMotion = useReducedMotion()

  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-0">
      <motion.div
        animate={shouldReduceMotion ? { opacity: 0.5, y: 0 } : { opacity: [0.2, 0.75, 0.2], y: [0, -10, 0] }}
        transition={shouldReduceMotion ? undefined : { duration: 5.5, repeat: Infinity, ease: 'easeInOut' }}
        className="absolute top-[26%] left-[18%] h-1.5 w-1.5 rounded-full bg-blue-400 shadow-[0_0_18px_rgba(96,165,250,0.75)]"
      />
      <motion.div
        animate={shouldReduceMotion ? { opacity: 0.44, y: 0 } : { opacity: [0.15, 0.65, 0.15], y: [0, 12, 0] }}
        transition={shouldReduceMotion ? undefined : { duration: 6.5, repeat: Infinity, ease: 'easeInOut', delay: 0.5 }}
        className="absolute top-[34%] right-[20%] h-2 w-2 rounded-full bg-violet-400 shadow-[0_0_20px_rgba(167,139,250,0.7)]"
      />
      <motion.div
        animate={shouldReduceMotion ? { opacity: 0.38, y: 0 } : { opacity: [0.18, 0.58, 0.18], y: [0, -8, 0] }}
        transition={shouldReduceMotion ? undefined : { duration: 6, repeat: Infinity, ease: 'easeInOut', delay: 1.1 }}
        className="absolute bottom-[25%] left-[25%] h-1 w-1 rounded-full bg-cyan-300 shadow-[0_0_16px_rgba(103,232,249,0.7)]"
      />
      <motion.div
        animate={shouldReduceMotion ? { opacity: 0.32, y: 0 } : { opacity: [0.12, 0.5, 0.12], y: [0, 9, 0] }}
        transition={shouldReduceMotion ? undefined : { duration: 7, repeat: Infinity, ease: 'easeInOut', delay: 1.6 }}
        className="absolute right-[28%] bottom-[19%] h-1.5 w-1.5 rounded-full bg-primary shadow-[0_0_18px_rgba(100,108,255,0.72)]"
      />
    </div>
  )
}

function PrimaryCta({ href, className = '', label }: { href: string, className?: string, label: string }) {
  return (
    <Link
      href={href}
      className={`group relative inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-primary to-secondary px-8 py-4 text-base font-bold text-white shadow-[0_0_30px_-5px_rgba(100,108,255,0.4)] transition-all hover:shadow-[0_0_40px_-5px_rgba(100,108,255,0.6)] hover:-translate-y-0.5 active:translate-y-0 ${className}`}
    >
      {label}
      <ArrowRight className="h-5 w-5 transition-transform group-hover:translate-x-1" />
    </Link>
  )
}

function WorkflowSection() {
  const { t } = useTranslation()
  const shouldReduceMotion = useReducedMotion()

  return (
    <section id="workflow" className={sectionShell}>
      <div className="mx-auto max-w-7xl">
        <div className="text-center">
          <h2 className="text-2xl font-black tracking-tight text-slate-950 dark:text-white md:text-3xl">
            {t('aiQuant.homepage.workflow.title')}
          </h2>
        </div>
        <div className="mt-14 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {workflowKeys.map((key, index) => (
            <motion.div
              key={key}
              initial="hidden"
              whileInView="visible"
              variants={revealUp}
              viewport={{ once: true, margin: '-80px' }}
              transition={{ ...revealTransition, delay: index * 0.1 }}
              whileHover={shouldReduceMotion ? undefined : { y: -4 }}
              className={`rounded-xl p-7 ${panelClass}`}
            >
              <div className="text-xs font-black text-primary">0{index + 1}</div>
              <h3 className="mt-7 text-lg font-bold text-slate-950 dark:text-white">
                {t(`aiQuant.homepage.workflow.items.${key}.title`)}
              </h3>
              <p className={`mt-4 text-sm leading-relaxed ${mutedText}`}>
                {t(`aiQuant.homepage.workflow.items.${key}.desc`)}
              </p>
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
}: {
  featureKey: FeatureKey
  reverse?: boolean
}) {
  const { t } = useTranslation()

  return (
    <section className={alternateSectionShell}>
      <div className={`mx-auto grid max-w-7xl items-center gap-16 md:grid-cols-2 ${reverse ? 'md:[&>*:first-child]:order-2' : ''}`}>
        <motion.div
          initial={{ opacity: 0, x: reverse ? 30 : -30 }}
          whileInView={{ opacity: 1, x: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
        >
          <div className="text-[10px] font-bold text-primary uppercase tracking-[0.3em] mb-4">
            {t(`aiQuant.homepage.features.${featureKey}.eyebrow`)}
          </div>
          <h2 className="text-3xl font-bold tracking-tight text-slate-950 dark:text-white md:text-5xl">
            {t(`aiQuant.homepage.features.${featureKey}.title`)}
          </h2>
          <p className={`mt-6 text-base leading-relaxed md:text-lg ${mutedText}`}>
            {t(`aiQuant.homepage.features.${featureKey}.description`)}
          </p>
        </motion.div>
        
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.8 }}
          className="relative"
        >
          <div className="absolute inset-0 bg-primary/5 blur-[80px] -z-10" />
          <FeatureVisual featureKey={featureKey} />
        </motion.div>
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
    <div className={`rounded-[2rem] bg-gradient-to-br from-white/[0.05] to-transparent p-8 ${panelClass}`}>
      <div className="space-y-6">
        <div className="flex gap-4">
          <div className="h-10 w-10 shrink-0 rounded-2xl bg-primary/20 flex items-center justify-center text-primary border border-primary/30">
            <Sparkles className="h-5 w-5" />
          </div>
          <div className="rounded-2xl border border-slate-200/80 bg-white/75 px-5 py-3 text-sm text-slate-700 dark:border-white/5 dark:bg-white/5 dark:text-white/80">
            {t('aiQuant.homepage.visual.assistant')}
          </div>
        </div>
        <div className="flex justify-end">
          <div className="rounded-2xl bg-primary/20 px-5 py-3 text-sm text-primary font-medium border border-primary/30">
            {t('aiQuant.homepage.visual.userPrompt')}
          </div>
        </div>
        <div className="rounded-2xl border border-primary/20 bg-primary/5 p-6 mt-6">
          <div className="text-[10px] font-bold text-primary uppercase tracking-widest mb-4">{t('aiQuant.homepage.visual.parsedStrategy')}</div>
          <div className="space-y-3">
            <div className="flex items-center gap-3 text-sm text-slate-700 dark:text-white/70">
              <div className="h-2 w-2 rounded-full bg-sky-400 shadow-[0_0_8px_#38bdf8]" />
              {t('aiQuant.homepage.visual.rule1')}
            </div>
            <div className="flex items-center gap-3 text-sm text-slate-700 dark:text-white/70">
              <div className="h-2 w-2 rounded-full bg-secondary shadow-[0_0_8px_var(--tw-colors-secondary)]" />
              {t('aiQuant.homepage.visual.rule2')}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function BacktestVisual() {
  const { t } = useTranslation()
  return (
    <div className={`rounded-[2rem] bg-gradient-to-br from-white/[0.45] to-transparent p-8 ${panelClass}`}>
      <div className="flex items-center justify-between mb-8">
        <div className={`text-xs font-medium uppercase tracking-widest ${mutedText}`}>{t('aiQuant.backtestResult')}</div>
        <div className="h-10 w-10 rounded-2xl bg-primary/10 flex items-center justify-center text-primary border border-primary/20">
          <BarChart3 className="h-5 w-5" />
        </div>
      </div>
      <div className="h-48 w-full bg-slate-950/[0.04] rounded-2xl flex items-end p-4 gap-2 border border-slate-200/80 dark:border-white/5 dark:bg-black/20">
        {[30, 50, 40, 80, 60, 75, 45, 90, 100].map((h, i) => (
          <motion.div 
            key={i}
            initial={{ height: 0 }}
            whileInView={{ height: `${h}%` }}
            className="flex-1 bg-gradient-to-t from-primary/20 to-primary/60 rounded-t-md border-t border-primary/50"
          />
        ))}
      </div>
      <div className="grid grid-cols-2 gap-4 mt-8">
        <div className="p-4 rounded-2xl bg-white/75 border border-slate-200/80 dark:border-white/5 dark:bg-white/[0.02]">
          <div className={`mb-1 text-[10px] font-medium uppercase ${mutedText}`}>Return</div>
          <div className="text-xl font-bold text-emerald-400">+18.4%</div>
        </div>
        <div className="p-4 rounded-2xl bg-white/75 border border-slate-200/80 dark:border-white/5 dark:bg-white/[0.02]">
          <div className={`mb-1 text-[10px] font-medium uppercase ${mutedText}`}>Win Rate</div>
          <div className="text-xl font-bold text-slate-950 dark:text-white">63%</div>
        </div>
      </div>
    </div>
  )
}

function DeployVisual() {
  const { t } = useTranslation()
  return (
    <div className={`rounded-[2rem] bg-gradient-to-br from-white/[0.45] to-transparent p-8 ${panelClass}`}>
      <div className="space-y-4">
        {[
          { label: t('aiQuant.homepage.visual.deployRows.snapshot'), status: 'ACTIVE' },
          { label: t('aiQuant.homepage.visual.deployRows.backtestGate'), status: 'PASSED' },
          { label: t('aiQuant.homepage.visual.deployRows.exchangeApi'), status: 'SECURE' }
        ].map((item, i) => (
          <div key={i} className="flex items-center justify-between p-5 rounded-2xl bg-white/75 border border-slate-200/80 dark:border-white/5 dark:bg-white/[0.02]">
            <span className="text-sm font-medium text-slate-700 dark:text-white/70">{item.label}</span>
            <span className="text-[10px] font-bold text-emerald-400 tracking-widest px-2 py-1 rounded bg-emerald-500/10 border border-emerald-500/20">{item.status}</span>
          </div>
        ))}
      </div>
      <div className="mt-10 h-14 rounded-2xl bg-gradient-to-r from-primary to-secondary flex items-center justify-center text-sm font-bold text-white uppercase tracking-widest shadow-[0_0_20px_rgba(100,108,255,0.3)]">
        {t('aiQuant.homepage.visual.deployAction')}
      </div>
    </div>
  )
}

function PlazaVisual() {
  const { t } = useTranslation()
  const cards = [
    { title: t('aiQuant.homepage.visual.plaza.trend'), stat: '+12.5%', icon: ShieldCheck },
    { title: t('aiQuant.homepage.visual.plaza.grid'), stat: '95%', icon: Zap },
    { title: t('aiQuant.homepage.visual.plaza.reversion'), stat: '72%', icon: Play },
    { title: t('aiQuant.homepage.visual.plaza.breakout'), stat: 'Ready', icon: LineChart },
  ]
  return (
    <div className="grid grid-cols-2 gap-5">
      {cards.map((card, i) => (
        <div key={i} className={`rounded-[2rem] bg-gradient-to-br from-white/[0.45] to-transparent p-6 transition-all hover:bg-white ${panelClass} dark:hover:bg-white/[0.08]`}>
          <div className="h-12 w-12 rounded-2xl bg-primary/10 flex items-center justify-center text-primary mb-6 border border-primary/20">
            <card.icon className="h-6 w-6" />
          </div>
          <h3 className="text-base font-bold text-slate-950 mb-1 dark:text-white">{card.title}</h3>
          <div className="text-2xl font-bold text-emerald-400">{card.stat}</div>
        </div>
      ))}
    </div>
  )
}

function AdvantageSection() {
  const { t } = useTranslation()
  const shouldReduceMotion = useReducedMotion()

  return (
    <section className={alternateSectionShell}>
      <div className="mx-auto max-w-5xl">
        <div className="text-center">
          <h2 className="text-2xl font-black tracking-tight text-slate-950 dark:text-white md:text-3xl">
            {t('aiQuant.homepage.advantages.title')}
          </h2>
        </div>
        <div className="mt-14 grid gap-5 md:grid-cols-2">
          {advantageKeys.map((key, index) => (
            <motion.div
              key={key}
              initial="hidden"
              whileInView="visible"
              variants={revealUp}
              viewport={{ once: true, margin: '-80px' }}
              transition={{ ...revealTransition, delay: index * 0.1 }}
              whileHover={shouldReduceMotion ? undefined : { y: -4 }}
              className={`relative overflow-hidden rounded-xl p-8 ${panelClass}`}
            >
              <div className="pointer-events-none absolute top-4 right-6 text-7xl font-black leading-none text-slate-950/[0.045] dark:text-white/[0.035]">0{index + 1}</div>
              <h3 className="relative text-xl font-bold text-slate-950 dark:text-white">
                {t(`aiQuant.homepage.advantages.items.${key}.title`)}
              </h3>
              <p className={`relative mt-4 text-base leading-relaxed ${mutedText}`}>
                {t(`aiQuant.homepage.advantages.items.${key}.desc`)}
              </p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  )
}

function FinalCtaSection({ ctaHref }: { ctaHref: string }) {
  const { t } = useTranslation()
  return (
    <section className={alternateSectionShell}>
      <motion.div 
        initial="hidden"
        whileInView="visible"
        variants={revealUp}
        viewport={{ once: true }}
        transition={revealTransition}
        className={`mx-auto max-w-4xl rounded-3xl bg-gradient-to-b from-white/[0.72] to-transparent p-12 text-center backdrop-blur-3xl md:p-20 ${panelClass}`}
      >
        <h2 className="text-3xl font-bold tracking-tight text-slate-950 dark:text-white md:text-6xl">
          {t('aiQuant.homepage.final.title')}
        </h2>
        <p className={`mx-auto mt-6 max-w-xl text-base md:text-lg ${mutedText}`}>
          {t('aiQuant.homepage.final.description')}
        </p>
        <div className="mt-10">
          <PrimaryCta href={ctaHref} label={t('aiQuant.homepage.finalCta')} className="scale-110" />
        </div>
      </motion.div>
    </section>
  )
}
