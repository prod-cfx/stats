'use client'

import { motion, type Transition, useReducedMotion } from 'framer-motion'
import { ArrowRight, BarChart3, LineChart, Play, ShieldCheck, Sparkles, Star, Zap } from 'lucide-react'
import Link from 'next/link'
import { useId } from 'react'
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
              initial={shouldReduceMotion ? false : 'hidden'}
              whileInView={shouldReduceMotion ? undefined : 'visible'}
              animate={shouldReduceMotion ? { opacity: 1, y: 0 } : undefined}
              variants={revealUp}
              viewport={{ once: true, margin: '-80px' }}
              transition={shouldReduceMotion ? undefined : { ...revealTransition, delay: index * 0.06 }}
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
  const shouldReduceMotion = useReducedMotion()
  const sectionClass = featureKey === 'conversation' || featureKey === 'deploy' ? alternateSectionShell : sectionShell

  return (
    <section className={sectionClass}>
      <div className={`mx-auto grid max-w-7xl items-center gap-12 md:grid-cols-2 md:gap-16 ${reverse ? 'md:[&>*:first-child]:order-2' : ''}`}>
        <motion.div
          initial={shouldReduceMotion ? false : 'hidden'}
          whileInView={shouldReduceMotion ? undefined : 'visible'}
          animate={shouldReduceMotion ? { opacity: 1, y: 0 } : undefined}
          variants={revealUp}
          viewport={{ once: true, margin: '-80px' }}
          transition={shouldReduceMotion ? undefined : revealTransition}
        >
          <div className="mb-4 text-[10px] font-bold tracking-[0.3em] text-primary uppercase">
            {t(`aiQuant.homepage.features.${featureKey}.eyebrow`)}
          </div>
          <h2 className="text-2xl leading-tight font-black tracking-tight text-slate-950 dark:text-white md:text-3xl">
            {t(`aiQuant.homepage.features.${featureKey}.title`)}
          </h2>
          <p className={`mt-5 text-base leading-relaxed ${mutedText}`}>
            {t(`aiQuant.homepage.features.${featureKey}.description`)}
          </p>
        </motion.div>

        <motion.div
          initial={shouldReduceMotion ? false : 'hidden'}
          whileInView={shouldReduceMotion ? undefined : 'visible'}
          animate={shouldReduceMotion ? { opacity: 1, y: 0 } : undefined}
          variants={revealUp}
          viewport={{ once: true, margin: '-80px' }}
          transition={shouldReduceMotion ? undefined : { ...revealTransition, delay: 0.08 }}
          className="relative"
        >
          <FeatureVisual featureKey={featureKey} />
        </motion.div>
      </div>
    </section>
  )
}

function FeatureVisual({ featureKey }: { featureKey: FeatureKey }) {
  if (featureKey === 'conversation') return <ConversationStrategyVisual />
  if (featureKey === 'backtest') return <BacktestResultVisual />
  if (featureKey === 'deploy') return <DeployOrbitVisual />
  return <StrategyPlazaVisual />
}

function ConversationStrategyVisual() {
  const { t } = useTranslation()
  const shouldReduceMotion = useReducedMotion()
  const rules = [
    { id: 'buy', label: 'BUY', text: t('aiQuant.homepage.visual.rule1'), icon: LineChart, tone: 'text-sky-500 dark:text-sky-300' },
    { id: 'sell', label: 'SELL', text: t('aiQuant.homepage.visual.rule3'), icon: Play, tone: 'text-rose-500 dark:text-rose-300' },
    { id: 'capital', label: '10%', text: t('aiQuant.homepage.visual.rule2'), icon: ShieldCheck, tone: 'text-emerald-500 dark:text-emerald-300' },
  ]

  return (
    <div className="mx-auto w-full max-w-[560px] overflow-hidden rounded-[1.75rem]">
      <div className={`rounded-[1.75rem] p-4 sm:p-5 ${panelClass}`}>
        <div className="rounded-[1.35rem] border border-slate-200/75 bg-slate-50/80 p-4 dark:border-white/[0.07] dark:bg-white/[0.035]">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-primary/25 bg-primary/10 text-primary shadow-[0_12px_30px_rgba(100,108,255,0.16)]">
              <Sparkles className="h-5 w-5" />
            </div>
            <div className="rounded-2xl border border-slate-200/85 bg-white px-4 py-3 text-sm leading-relaxed text-slate-700 shadow-sm dark:border-white/[0.07] dark:bg-white/[0.06] dark:text-white/[0.78]">
              {t('aiQuant.homepage.visual.assistant')}
            </div>
          </div>
          <div className="mt-4 flex justify-end">
            <div className="max-w-[82%] rounded-2xl border border-primary/25 bg-primary/10 px-4 py-3 text-sm leading-relaxed font-semibold text-primary shadow-[0_14px_34px_rgba(100,108,255,0.12)] dark:bg-primary/[0.16]">
              {t('aiQuant.homepage.visual.userPrompt')}
            </div>
          </div>
        </div>

        <div className="mt-4 rounded-[1.35rem] border border-slate-200/80 bg-white/[0.88] p-4 shadow-[0_18px_44px_rgba(15,23,42,0.06)] dark:border-white/[0.07] dark:bg-[#0b1119]/[0.84]">
          <div className="flex items-center justify-between gap-3">
            <div className="text-[11px] font-black tracking-[0.2em] text-slate-500 uppercase dark:text-white/48">
              {t('aiQuant.homepage.visual.parsedStrategy')}
            </div>
            <div className="flex items-center gap-2 rounded-full border border-emerald-400/25 bg-emerald-400/10 px-2.5 py-1 text-[10px] font-bold text-emerald-500 dark:text-emerald-300">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 shadow-[0_0_10px_rgba(52,211,153,0.9)]" />
              Processing
            </div>
          </div>
          <div className="mt-4 space-y-2.5">
            {rules.map((rule, index) => (
              <motion.div
                key={rule.id}
                initial={shouldReduceMotion ? false : { opacity: 0, y: 12 }}
                whileInView={shouldReduceMotion ? undefined : { opacity: 1, y: 0 }}
                viewport={{ once: true, margin: '-60px' }}
                transition={shouldReduceMotion ? undefined : { duration: 0.45, ease: 'easeOut', delay: index * 0.08 }}
                className="flex items-center gap-3 rounded-2xl border border-slate-200/75 bg-slate-50/80 px-3.5 py-3 dark:border-white/[0.06] dark:bg-white/[0.035]"
              >
                <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white shadow-sm dark:bg-white/[0.06] ${rule.tone}`}>
                  <rule.icon className="h-4 w-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className={`text-[11px] font-black tracking-[0.18em] ${rule.tone}`}>
                    {rule.label}
                  </div>
                  <div className="mt-0.5 truncate text-sm font-semibold text-slate-700 dark:text-white/[0.78]">
                    {rule.text}
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

function BacktestResultVisual() {
  const { t } = useTranslation()
  const shouldReduceMotion = useReducedMotion()
  const equityCurveId = useId()
  const bars = [
    { label: 'W1', height: 34, positive: true },
    { label: 'W2', height: 46, positive: true },
    { label: 'W3', height: 28, positive: false },
    { label: 'W4', height: 58, positive: true },
    { label: 'W5', height: 66, positive: true },
    { label: 'W6', height: 38, positive: false },
    { label: 'W7', height: 72, positive: true },
    { label: 'D1', height: 52, positive: true },
    { label: 'D2', height: 81, positive: true },
    { label: 'D3', height: 44, positive: false },
    { label: 'D4', height: 76, positive: true },
    { label: 'D5', height: 88, positive: true },
    { label: 'D6', height: 62, positive: true },
    { label: 'D7', height: 94, positive: true },
  ]

  return (
    <div className={`mx-auto w-full max-w-[560px] overflow-hidden rounded-[1.75rem] p-5 sm:p-6 ${panelClass}`}>
      <div className="mb-5 flex items-center justify-between">
        <div className="text-xs font-black tracking-[0.22em] text-slate-500 uppercase dark:text-white/[0.48]">
          {t('aiQuant.backtestResult')}
        </div>
        <div className="flex h-10 w-10 items-center justify-center rounded-2xl border border-primary/20 bg-primary/10 text-primary">
          <BarChart3 className="h-5 w-5" />
        </div>
      </div>

      <div className="relative h-56 overflow-hidden rounded-[1.35rem] border border-slate-200/80 bg-slate-50/90 p-4 pb-3 dark:border-white/[0.06] dark:bg-black/[0.24]">
        <div className="absolute inset-0 bg-[linear-gradient(to_right,rgba(15,23,42,0.045)_1px,transparent_1px),linear-gradient(to_bottom,rgba(15,23,42,0.05)_1px,transparent_1px)] bg-[size:34px_34px] dark:bg-[linear-gradient(to_right,rgba(255,255,255,0.035)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.032)_1px,transparent_1px)]" />
        <div className="relative z-10 flex h-full flex-col">
          <div className="relative min-h-0 flex-1">
            <div className="absolute inset-x-0 top-1/2 h-px bg-slate-300/60 dark:bg-white/[0.08]" />
            <div className="flex h-full items-end gap-1.5 px-1 pt-5 sm:gap-2">
              {bars.map((bar, index) => (
                <motion.div
                  key={bar.label}
                  initial={shouldReduceMotion ? false : { height: 0 }}
                  whileInView={shouldReduceMotion ? undefined : { height: `${bar.height}%` }}
                  animate={shouldReduceMotion ? { height: `${bar.height}%` } : undefined}
                  viewport={{ once: true, margin: '-60px' }}
                  transition={shouldReduceMotion ? undefined : { duration: 0.5, ease: 'easeOut', delay: index * 0.025 }}
                  className={`min-h-3 flex-1 rounded-t-[5px] border-t ${
                    bar.positive
                      ? 'border-emerald-300/70 bg-gradient-to-t from-emerald-400/24 to-emerald-400/72 shadow-[0_0_18px_rgba(16,185,129,0.12)] dark:from-emerald-400/18 dark:to-emerald-300/62'
                      : 'border-rose-300/55 bg-gradient-to-t from-rose-400/16 to-rose-400/42 dark:from-rose-400/12 dark:to-rose-300/34'
                  }`}
                />
              ))}
            </div>
            <svg className="pointer-events-none absolute inset-x-1 top-4 z-20 h-[72%] w-[calc(100%-0.5rem)] overflow-visible" viewBox="0 0 420 128" fill="none" aria-hidden="true">
              <motion.path
                d="M4 98 C24 88 42 90 64 74 C89 55 112 78 132 58 C154 36 178 58 198 42 C224 20 246 52 268 34 C292 15 314 31 334 21 C360 9 383 19 416 7"
                initial={shouldReduceMotion ? false : { pathLength: 0, opacity: 0 }}
                whileInView={shouldReduceMotion ? undefined : { pathLength: 1, opacity: 1 }}
                animate={shouldReduceMotion ? { pathLength: 1, opacity: 1 } : undefined}
                viewport={{ once: true, margin: '-60px' }}
                transition={shouldReduceMotion ? undefined : { duration: 1.2, ease: 'easeInOut', delay: 0.16 }}
                stroke={`url(#${equityCurveId})`}
                strokeWidth="4"
                strokeLinecap="round"
              />
              <defs>
                <linearGradient id={equityCurveId} x1="4" y1="98" x2="416" y2="7" gradientUnits="userSpaceOnUse">
                  <stop stopColor="#2563eb" />
                  <stop offset="0.5" stopColor="#38bdf8" />
                  <stop offset="1" stopColor="#646cff" />
                </linearGradient>
              </defs>
            </svg>
          </div>
          <div className="mt-2 grid grid-cols-[repeat(14,minmax(0,1fr))] gap-1 border-t border-slate-200/70 pt-2 dark:border-white/[0.07]">
            {bars.map((bar, index) => (
              <span key={bar.label} className="text-center text-[9px] font-bold text-slate-400 dark:text-white/[0.32]">
                <span className="hidden sm:inline">{bar.label}</span>
                <span className="sm:hidden">{index % 2 === 0 ? bar.label : ''}</span>
              </span>
            ))}
          </div>
        </div>
      </div>

      <div className="mt-5 grid grid-cols-2 gap-3">
        <MetricCard label={t('aiQuant.homepage.visual.metrics.return')} value="+18.4%" positive />
        <MetricCard label={t('aiQuant.homepage.visual.metrics.winRate')} value="63%" />
      </div>
    </div>
  )
}

function MetricCard({ label, value, positive = false }: { label: string, value: string, positive?: boolean }) {
  return (
    <div className="rounded-2xl border border-slate-200/80 bg-white/[0.78] p-4 shadow-sm dark:border-white/[0.06] dark:bg-white/[0.035]">
      <div className={`mb-1 text-[10px] font-black tracking-[0.18em] uppercase ${mutedText}`}>
        {label}
      </div>
      <div className={`text-2xl font-black ${positive ? 'text-emerald-500 dark:text-emerald-300' : 'text-slate-950 dark:text-white'}`}>
        {value}
      </div>
    </div>
  )
}

function DeployOrbitVisual() {
  const { t } = useTranslation()
  const shouldReduceMotion = useReducedMotion()
  const rings = [
    { id: 'outer', className: 'inset-6 border-primary/[0.12] dark:border-primary/[0.18]', duration: 18 },
    { id: 'middle', className: 'inset-16 border-sky-400/18 dark:border-sky-300/16', duration: 14 },
    { id: 'inner', className: 'inset-[6.5rem] border-emerald-400/24 dark:border-emerald-300/18', duration: 10 },
  ]

  return (
    <div className={`mx-auto aspect-square min-h-[320px] w-full max-w-[520px] overflow-hidden rounded-[1.75rem] ${panelClass}`}>
      <div className="relative h-full min-h-[320px] overflow-hidden rounded-[1.75rem] bg-[radial-gradient(circle_at_50%_50%,rgba(100,108,255,0.16),transparent_32%),linear-gradient(135deg,rgba(248,250,252,0.9),rgba(255,255,255,0.58))] dark:bg-[radial-gradient(circle_at_50%_50%,rgba(100,108,255,0.24),transparent_34%),linear-gradient(135deg,rgba(16,21,29,0.92),rgba(2,3,5,0.9))]">
        <div className="absolute inset-0 bg-[linear-gradient(to_right,rgba(15,23,42,0.04)_1px,transparent_1px),linear-gradient(to_bottom,rgba(15,23,42,0.035)_1px,transparent_1px)] bg-[size:44px_44px] dark:bg-[linear-gradient(to_right,rgba(255,255,255,0.026)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.026)_1px,transparent_1px)]" />
        {rings.map((ring, index) => (
          <motion.div
            key={ring.id}
            aria-hidden="true"
            animate={shouldReduceMotion ? undefined : { rotate: index % 2 === 0 ? 360 : -360, scale: [1, 1.035, 1] }}
            transition={shouldReduceMotion ? undefined : { duration: ring.duration, repeat: Infinity, ease: 'linear' }}
            className={`absolute rounded-full border border-dashed ${ring.className}`}
          />
        ))}
        <motion.div
          aria-hidden="true"
          animate={shouldReduceMotion ? undefined : { opacity: [0.35, 0.72, 0.35], scale: [0.92, 1.08, 0.92] }}
          transition={shouldReduceMotion ? undefined : { duration: 3.8, repeat: Infinity, ease: 'easeInOut' }}
          className="absolute inset-1/2 h-44 w-44 -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary/20 blur-3xl"
        />
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="relative flex h-36 w-36 flex-col items-center justify-center rounded-[2rem] border border-white/55 bg-white/[0.86] text-center shadow-[0_28px_80px_rgba(100,108,255,0.24)] backdrop-blur-xl dark:border-white/[0.1] dark:bg-[#121926]/[0.88]">
            <div className="absolute inset-3 rounded-[1.4rem] border border-primary/[0.16]" />
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-primary to-secondary text-white shadow-[0_0_28px_rgba(100,108,255,0.42)]">
              <Zap className="h-6 w-6" />
            </div>
            <div className="mt-4 px-4 text-xs font-black tracking-[0.2em] text-slate-900 uppercase dark:text-white">
              {t('aiQuant.homepage.visual.deployAction')}
            </div>
          </div>
        </div>
        <div className="absolute top-[18%] left-[18%] h-3 w-3 rounded-full bg-sky-400 shadow-[0_0_22px_rgba(56,189,248,0.75)]" />
        <div className="absolute right-[20%] bottom-[21%] h-3 w-3 rounded-full bg-emerald-400 shadow-[0_0_22px_rgba(52,211,153,0.75)]" />
        <div className="absolute top-[24%] right-[22%] h-2.5 w-2.5 rounded-full bg-primary shadow-[0_0_20px_rgba(100,108,255,0.75)]" />
      </div>
    </div>
  )
}

function StrategyPlazaVisual() {
  const { t } = useTranslation()
  const shouldReduceMotion = useReducedMotion()
  const floatingCards = [
    { id: 'grid', title: t('aiQuant.homepage.visual.plaza.grid'), stat: '95%', icon: Zap, className: 'top-[10%] left-[5%] rotate-[-7deg]', delay: 0 },
    { id: 'reversion', title: t('aiQuant.homepage.visual.plaza.reversion'), stat: '72%', icon: ShieldCheck, className: 'right-[6%] top-[18%] rotate-[7deg]', delay: 0.4 },
    { id: 'breakout', title: t('aiQuant.homepage.visual.plaza.breakout'), stat: 'Ready', icon: LineChart, className: 'bottom-[9%] left-[10%] rotate-[5deg]', delay: 0.8 },
  ]

  return (
    <div className={`relative mx-auto aspect-[1.22] w-full max-w-[560px] overflow-hidden rounded-[1.75rem] ${panelClass}`}>
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_35%,rgba(100,108,255,0.14),transparent_36%),linear-gradient(135deg,rgba(248,250,252,0.92),rgba(255,255,255,0.6))] dark:bg-[radial-gradient(circle_at_50%_35%,rgba(100,108,255,0.2),transparent_38%),linear-gradient(135deg,rgba(16,21,29,0.92),rgba(2,3,5,0.94))]" />
      <div className="absolute inset-0 bg-[linear-gradient(to_right,rgba(15,23,42,0.04)_1px,transparent_1px),linear-gradient(to_bottom,rgba(15,23,42,0.035)_1px,transparent_1px)] bg-[size:40px_40px] dark:bg-[linear-gradient(to_right,rgba(255,255,255,0.026)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.026)_1px,transparent_1px)]" />

      {floatingCards.map(card => (
        <motion.div
          key={card.id}
          animate={shouldReduceMotion ? undefined : { y: [0, -10, 0] }}
          transition={shouldReduceMotion ? undefined : { duration: 4.8, repeat: Infinity, ease: 'easeInOut', delay: card.delay }}
          className={`absolute w-[42%] rounded-2xl border border-slate-200/80 bg-white/[0.78] p-4 shadow-[0_18px_48px_rgba(15,23,42,0.1)] backdrop-blur-xl dark:border-white/[0.07] dark:bg-white/[0.055] ${card.className}`}
        >
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <card.icon className="h-4 w-4" />
            </div>
            <div className="min-w-0">
              <div className="truncate text-sm font-black text-slate-900 dark:text-white">{card.title}</div>
              <div className="mt-0.5 text-xs font-bold text-emerald-500 dark:text-emerald-300">{card.stat}</div>
            </div>
          </div>
        </motion.div>
      ))}

      <div className="absolute inset-0 flex items-center justify-center p-6">
        <div className="relative w-[58%] min-w-[230px] rounded-[1.5rem] border border-primary/25 bg-white/[0.92] p-5 shadow-[0_30px_90px_rgba(100,108,255,0.24)] backdrop-blur-2xl dark:border-primary/25 dark:bg-[#101722]/[0.92]">
          <div className="mb-5 flex items-start justify-between gap-3">
            <div>
              <div className="text-[11px] font-black tracking-[0.18em] text-primary uppercase">
                {t('aiQuant.homepage.visual.plaza.template')}
              </div>
              <div className="mt-2 text-lg font-black text-slate-950 dark:text-white">
                {t('aiQuant.homepage.visual.plaza.trend')}
              </div>
            </div>
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-amber-400/14 text-amber-500 dark:text-amber-300">
              <Star className="h-5 w-5 fill-current" />
            </div>
          </div>
          <div className="flex items-end justify-between gap-4">
            <div className="text-3xl font-black text-emerald-500 dark:text-emerald-300">+12.5%</div>
            <div className="flex h-14 flex-1 items-end gap-1.5">
              {[38, 58, 46, 76, 62, 88].map(height => (
                <div
                  key={height}
                  className="flex-1 rounded-t bg-gradient-to-t from-primary/30 to-primary/75"
                  style={{ height: `${height}%` }}
                />
              ))}
            </div>
          </div>
        </div>
      </div>
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
              initial={shouldReduceMotion ? false : 'hidden'}
              whileInView={shouldReduceMotion ? undefined : 'visible'}
              animate={shouldReduceMotion ? { opacity: 1, y: 0 } : undefined}
              variants={revealUp}
              viewport={{ once: true, margin: '-80px' }}
              transition={shouldReduceMotion ? undefined : { ...revealTransition, delay: index * 0.06 }}
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
