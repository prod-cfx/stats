'use client'

import { motion, type Transition, useReducedMotion } from 'framer-motion'
import { ArrowRight, CircleDot, LineChart, RefreshCw, Sparkles, Star, TrendingUp, UserRound, WalletCards } from 'lucide-react'
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
  return (
    <div className="pointer-events-none fixed inset-0 z-0 overflow-hidden">
      <div className="absolute inset-0 bg-[linear-gradient(to_right,rgba(15,23,42,0.035)_1px,transparent_1px),linear-gradient(to_bottom,rgba(15,23,42,0.03)_1px,transparent_1px)] bg-[size:48px_48px] dark:bg-[linear-gradient(to_right,rgba(255,255,255,0.018)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.018)_1px,transparent_1px)]" />
      <div aria-hidden="true" className="absolute -top-48 left-1/2 h-[38rem] w-[38rem] -translate-x-1/2 rounded-full bg-blue-300/24 blur-[140px] dark:bg-blue-500/14" />
      <div aria-hidden="true" className="absolute top-1/4 -left-52 h-[34rem] w-[34rem] rounded-full bg-violet-300/22 blur-[130px] dark:bg-violet-500/12" />
      <div aria-hidden="true" className="absolute -right-48 bottom-0 h-[32rem] w-[32rem] rounded-full bg-cyan-300/18 blur-[130px] dark:bg-cyan-500/10" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,rgba(255,255,255,0.78),transparent_46%)] dark:bg-[radial-gradient(circle_at_50%_0%,rgba(255,255,255,0.055),transparent_50%)]" />
    </div>
  )
}

function HeroSection({ ctaHref, lng }: { ctaHref: string, lng: 'zh' | 'en' }) {
  const { t } = useTranslation()
  const title = t('aiQuant.homepage.hero.title')

  return (
    <section className="relative flex min-h-[calc(100svh-64px)] items-center overflow-hidden bg-[#f6f8fc]/80 px-6 py-24 dark:bg-[#020305]/90 md:min-h-[calc(100vh-72px)] md:px-8 md:py-28">
      <HeroGradientWash />
      <HeroLines />
      <HeroParticles />
      <motion.div
        initial="hidden"
        animate="visible"
        variants={revealUp}
        transition={revealTransition}
        className="relative z-10 mx-auto flex max-w-5xl flex-col items-center text-center"
      >
        <div className="inline-flex items-center gap-2 rounded-full border border-primary/25 bg-white/65 px-4 py-1.5 text-[11px] font-bold tracking-[0.22em] text-primary uppercase shadow-[0_10px_30px_rgba(100,108,255,0.12)] backdrop-blur-xl dark:border-white/10 dark:bg-white/[0.04]">
          <Sparkles className="h-3 w-3" />
          {t('aiQuant.homepage.hero.eyebrow')}
        </div>
        <div aria-hidden="true" className="h-10 shrink-0 md:h-11" />
        <h1 className="!m-0 !text-[2.2rem] !leading-[1.08] !font-black !tracking-normal text-balance text-slate-950 antialiased dark:text-white sm:!text-[3.45rem] md:!text-[3.75rem] lg:!text-[3.95rem] lg:!leading-[1.05] xl:!text-[4.2rem]">
          <GradientTitle title={title} lng={lng} />
        </h1>
        <div aria-hidden="true" className="h-9 shrink-0 md:h-10" />
        <p className={`!m-0 mx-auto max-w-3xl !text-[15px] !leading-[1.8] md:!text-[17px] md:!leading-[1.7] ${mutedText}`}>
          {t('aiQuant.homepage.hero.description')}
        </p>
        <div aria-hidden="true" className="h-[52px] shrink-0 md:h-14" />
        <div>
          <PrimaryCta href={ctaHref} label={t('aiQuant.homepage.heroCta')} />
        </div>
      </motion.div>
    </section>
  )
}

function HeroGradientWash() {
  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden">
      <div className="absolute inset-[-12%] bg-[radial-gradient(circle_at_27%_38%,rgba(37,99,235,0.42),transparent_30%),radial-gradient(circle_at_52%_44%,rgba(79,70,229,0.30),transparent_29%),radial-gradient(circle_at_73%_58%,rgba(168,85,247,0.30),transparent_30%),radial-gradient(circle_at_82%_66%,rgba(217,70,239,0.22),transparent_26%)] blur-[70px] dark:bg-[radial-gradient(circle_at_27%_38%,rgba(29,78,216,0.40),transparent_31%),radial-gradient(circle_at_52%_44%,rgba(79,70,229,0.30),transparent_30%),radial-gradient(circle_at_73%_58%,rgba(124,58,237,0.28),transparent_30%),radial-gradient(circle_at_82%_66%,rgba(192,38,211,0.24),transparent_27%)]" />
      <div className="absolute top-[54%] left-[30%] h-28 w-[58rem] -rotate-6 bg-[linear-gradient(90deg,transparent_0%,rgba(59,130,246,0.18)_42%,rgba(217,70,239,0.20)_68%,transparent_100%)] blur-[30px] dark:bg-[linear-gradient(90deg,transparent_0%,rgba(59,130,246,0.2)_42%,rgba(217,70,239,0.22)_68%,transparent_100%)]" />
      <div className="absolute top-[-12%] left-[18%] h-[34rem] w-[34rem] rounded-full bg-blue-300/26 blur-[130px] dark:bg-[#1d58ff]/24" />
      <div className="absolute top-[12%] right-[14%] h-[34rem] w-[34rem] rounded-full bg-violet-300/26 blur-[142px] dark:bg-[#7b2dff]/26" />
      <div className="absolute top-[34%] left-1/2 h-[25rem] w-[25rem] -translate-x-1/2 rounded-full bg-primary/20 blur-[115px] dark:bg-primary/18" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_0%,rgba(248,250,252,0.12)_38%,rgba(246,248,252,0.74)_100%)] dark:bg-[radial-gradient(ellipse_at_center,rgba(2,3,5,0.02)_0%,rgba(2,3,5,0.1)_45%,rgba(2,3,5,0.72)_100%)]" />
    </div>
  )
}

function GradientTitle({ title, lng }: { title: string, lng: 'zh' | 'en' }) {
  const target = lng === 'zh' ? 'AI 量化' : 'AI quant'

  if (!title.includes(target)) {
    return <>{title}</>
  }

  const parts = title.split(target)

  if (lng === 'zh') {
    return (
      <>
        <span className="block">{parts[0].trim()}</span>
        <span className="block text-[0.86em] sm:text-[1em]">
          <span className="bg-gradient-to-r from-[#3e69ff] via-[#6d57ff] to-[#8a5bff] bg-clip-text text-transparent dark:from-[#60a5fa] dark:via-primary dark:to-[#c084fc]">
            {target}
          </span>
          {' '}
          {parts[1].trim()}
        </span>
      </>
    )
  }

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
  const shouldReduceMotion = useReducedMotion()

  return (
    <Link
      href={href}
      className={`group inline-flex min-h-[52px] items-center justify-center gap-2 rounded-lg bg-gradient-to-r from-[#3474ff] to-[#8a55ff] px-8 py-3 text-[15px] font-bold !text-white shadow-[0_14px_40px_rgba(79,70,229,0.35)] transition duration-200 hover:shadow-[0_18px_54px_rgba(79,70,229,0.48)] active:translate-y-0 ${shouldReduceMotion ? '' : 'hover:-translate-y-0.5'} ${className}`}
    >
      {label}
      <ArrowRight className={`h-4 w-4 transition-transform ${shouldReduceMotion ? '' : 'group-hover:translate-x-1'}`} />
    </Link>
  )
}

function WorkflowSection() {
  const { t } = useTranslation()
  const shouldReduceMotion = useReducedMotion()

  return (
    <section id="workflow" className="relative border-t border-slate-200/70 bg-white/45 px-6 py-24 dark:border-white/[0.06] dark:bg-[#080d14]/92 md:px-8 md:py-28 lg:py-30">
      <div className="mx-auto max-w-[76rem]">
        <div className="text-center">
          <h2 className="!m-0 !text-[1.75rem] !leading-[1.22] font-black tracking-normal text-slate-950 dark:text-white md:!text-[2rem]">
            {t('aiQuant.homepage.workflow.title')}
          </h2>
        </div>
        <div className="mt-16 grid gap-6 sm:grid-cols-2 md:mt-18 lg:grid-cols-4 lg:gap-7">
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
              className={`min-h-[190px] rounded-xl p-8 md:min-h-[196px] md:p-9 ${panelClass}`}
            >
              <div className="text-[13px] leading-none font-black text-primary">0{index + 1}</div>
              <div aria-hidden="true" className="h-4 shrink-0 md:h-5" />
              <h3 className="!m-0 !text-[17px] !leading-snug font-bold text-slate-950 dark:text-white md:!text-[19px]">
                {t(`aiQuant.homepage.workflow.items.${key}.title`)}
              </h3>
              <div aria-hidden="true" className="h-3 shrink-0 md:h-[14px]" />
              <p className={`!m-0 !text-[14.5px] !leading-[1.78] md:!text-[15px] ${mutedText}`}>
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
  const usesFeatureCopyScale = featureKey === 'conversation' || featureKey === 'backtest' || featureKey === 'deploy' || featureKey === 'plaza'

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
          <div className={`${usesFeatureCopyScale ? '!text-[12px] !leading-none tracking-[0.18em]' : 'mb-4 text-[10px] tracking-[0.3em]'} font-bold text-primary uppercase`}>
            {t(`aiQuant.homepage.features.${featureKey}.eyebrow`)}
          </div>
          {usesFeatureCopyScale && <div aria-hidden="true" className="h-5 shrink-0 md:h-6" />}
          <h2 className={`${usesFeatureCopyScale ? '!m-0 !text-[1.65rem] !leading-[1.2] md:!text-[1.9rem]' : 'text-2xl leading-tight md:text-3xl'} font-black tracking-normal text-slate-950 dark:text-white`}>
            {t(`aiQuant.homepage.features.${featureKey}.title`)}
          </h2>
          {usesFeatureCopyScale && <div aria-hidden="true" className="h-5 shrink-0 md:h-6" />}
          <p className={`${usesFeatureCopyScale ? '!m-0 !text-[15px] !leading-[1.75] md:!text-[16px]' : 'mt-5 text-base leading-relaxed'} ${mutedText}`}>
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
          className="relative min-w-0"
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
    {
      id: 'buy',
      action: 'BUY',
      meta: t('aiQuant.homepage.visual.ruleMeta.trigger'),
      text: t('aiQuant.homepage.visual.rule1'),
      icon: LineChart,
      iconClass: 'bg-[#08264a] text-[#4da3ff]',
      actionClass: 'border-[#1f4d88] bg-[#0c2447] text-[#62aaff]',
    },
    {
      id: 'sell',
      action: 'SELL',
      meta: t('aiQuant.homepage.visual.ruleMeta.takeProfit'),
      text: t('aiQuant.homepage.visual.rule3'),
      icon: TrendingUp,
      iconClass: 'bg-[#2c2108] text-[#f6c744]',
      actionClass: 'border-[#6b4d0f] bg-[#2b210b] text-[#f6c744]',
    },
    {
      id: 'capital',
      action: '10%',
      meta: t('aiQuant.homepage.visual.ruleMeta.position'),
      text: t('aiQuant.homepage.visual.rule2'),
      icon: WalletCards,
      iconClass: 'bg-[#28114a] text-[#c084fc]',
      actionClass: 'border-[#5b2a86] bg-[#2c1650] text-[#c084fc]',
    },
  ]

  return (
    <div className="mx-auto w-full max-w-[592px]">
      <div className="rounded-xl border border-slate-200/80 bg-white/82 p-5 shadow-[0_22px_70px_rgba(15,23,42,0.08)] dark:border-white/[0.08] dark:bg-[#050607]/92 dark:shadow-[0_30px_90px_rgba(0,0,0,0.45)] md:p-7">
        <div className="flex items-start gap-4">
          <div className="mt-2 flex h-4 w-4 shrink-0 items-center justify-center text-slate-500 dark:text-white/70">
            <CircleDot className="h-3.5 w-3.5" />
          </div>
          <div className="rounded-xl border border-slate-200/75 bg-slate-100 px-5 py-4 text-[14px] leading-relaxed text-slate-700 shadow-sm dark:border-[#1b2940] dark:bg-[#101827] dark:text-[#b9c3d4]">
            {t('aiQuant.homepage.visual.assistant')}
          </div>
        </div>
        <div className="mt-4 flex items-center justify-end gap-3">
          <div className="max-w-[82%] rounded-xl border border-slate-400/80 bg-transparent px-5 py-3 text-[14px] leading-relaxed text-slate-900 dark:border-white/80 dark:text-white">
            {t('aiQuant.homepage.visual.userPrompt')}
          </div>
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-300 text-slate-600 dark:bg-[#344154] dark:text-white">
            <UserRound className="h-4 w-4" />
          </div>
        </div>
      </div>

      <div className="mt-4 rounded-xl border border-slate-200/80 bg-white/82 p-5 shadow-[0_22px_70px_rgba(15,23,42,0.08)] dark:border-white/[0.08] dark:bg-[#060708]/94 dark:shadow-[0_30px_90px_rgba(0,0,0,0.45)] md:p-6">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 text-[12px] font-bold tracking-[0.12em] text-primary">
            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-primary/10">
              <Sparkles className="h-3.5 w-3.5 fill-current" />
            </span>
            {t('aiQuant.homepage.visual.parsedStrategy')}
          </div>
          <div className="flex items-center gap-1.5 text-[12px] font-bold text-emerald-400">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 shadow-[0_0_10px_rgba(52,211,153,0.9)]" />
            Processing
          </div>
        </div>
        <div className="mt-5 space-y-3">
          {rules.map((rule, index) => (
            <motion.div
              key={rule.id}
              initial={shouldReduceMotion ? false : { opacity: 0, y: 12 }}
              whileInView={shouldReduceMotion ? undefined : { opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-60px' }}
              transition={shouldReduceMotion ? undefined : { duration: 0.45, ease: 'easeOut', delay: index * 0.08 }}
              className="flex items-center gap-3 rounded-xl border border-slate-200/75 bg-slate-50/90 px-3.5 py-3 dark:border-white/[0.07] dark:bg-[#0c1119]"
            >
              <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${rule.iconClass}`}>
                <rule.icon className="h-[18px] w-[18px]" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-[11px] leading-none text-slate-500 dark:text-[#6f7a8c]">
                  {rule.meta}
                </div>
                <div className="mt-1.5 text-[14px] leading-snug font-bold text-slate-900 dark:text-white">
                  {rule.text}
                </div>
              </div>
              <div className={`rounded-md border px-3 py-2 text-[12px] leading-none font-bold ${rule.actionClass}`}>
                {rule.action}
              </div>
            </motion.div>
          ))}
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
    { label: 'W1', height: 67, positive: true },
    { label: 'W2', height: 71, positive: true },
    { label: 'W3', height: 70, positive: false },
    { label: 'W4', height: 73, positive: true },
    { label: 'W5', height: 78, positive: true },
    { label: 'W6', height: 80, positive: true },
    { label: 'W7', height: 83, positive: false },
    { label: 'D1', height: 81, positive: true },
    { label: 'D2', height: 84, positive: false },
    { label: 'D3', height: 85, positive: true },
    { label: 'D4', height: 87, positive: false },
    { label: 'D5', height: 86, positive: true },
    { label: 'D6', height: 90, positive: false },
    { label: 'D7', height: 95, positive: true },
  ]

  return (
    <div className={`mx-auto w-full max-w-[568px] overflow-hidden rounded-[1.35rem] p-6 sm:p-7 dark:!border-[#1d2937]/75 dark:!bg-[#10151b]/72 ${panelClass}`}>
      <div className="flex items-center justify-between">
        <div className="!text-[15px] !leading-none font-black tracking-normal text-slate-900 dark:text-white/90">
          {t('aiQuant.backtestResult')}
        </div>
        <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-primary/25 bg-primary/12 text-primary shadow-[0_0_18px_rgba(59,130,246,0.12)]">
          <LineChart className="h-4 w-4" />
        </div>
      </div>

      <div className="relative mt-10 h-[178px] pl-10 pr-2 pb-7 sm:mt-11 sm:h-[190px] sm:pl-12">
        <span className="absolute left-0 top-[18%] text-[11px] font-semibold text-slate-400/78 dark:text-white/[0.32]">100</span>
        <span className="absolute left-1 top-[53%] text-[11px] font-semibold text-slate-400/78 dark:text-white/[0.32]">50</span>
        <span className="absolute bottom-6 left-2 text-[11px] font-semibold text-slate-400/78 dark:text-white/[0.32]">0</span>

        <div className="absolute top-0 right-2 bottom-7 left-10 sm:left-12">
          <div className="absolute inset-0 flex justify-between">
            {bars.map(bar => (
              <span key={`grid-${bar.label}`} className="h-full w-px bg-slate-200/65 dark:bg-white/[0.035]" />
            ))}
          </div>
          <div className="absolute inset-x-0 top-[22%] h-px bg-slate-200/80 dark:bg-white/[0.065]" />
          <div className="absolute inset-x-0 top-[56%] h-px bg-slate-200/80 dark:bg-white/[0.065]" />
          <div className="absolute inset-x-0 bottom-0 h-px bg-slate-400/70 dark:bg-white/[0.18]" />

          <div className="relative z-10 flex h-full items-end justify-between px-1">
            {bars.map((bar, index) => (
              <motion.div
                key={bar.label}
                initial={shouldReduceMotion ? false : { height: 0 }}
                whileInView={shouldReduceMotion ? undefined : { height: `${bar.height}%` }}
                animate={shouldReduceMotion ? { height: `${bar.height}%` } : undefined}
                viewport={{ once: true, margin: '-60px' }}
                transition={shouldReduceMotion ? undefined : { duration: 0.5, ease: 'easeOut', delay: index * 0.025 }}
                className={`min-h-3 w-[11px] rounded-t-[2px] border-x border-t sm:w-[13px] ${
                  bar.positive
                    ? 'border-emerald-300/36 bg-emerald-400/24 dark:border-emerald-300/18 dark:bg-emerald-400/16'
                    : 'border-rose-300/30 bg-rose-400/18 dark:border-rose-300/16 dark:bg-rose-400/12'
                }`}
              />
            ))}
          </div>
          <svg className="pointer-events-none absolute inset-x-0 top-6 z-20 h-[64%] w-full overflow-visible" viewBox="0 0 420 128" fill="none" aria-hidden="true">
            <motion.path
              d="M-14 94 C22 91 50 89 80 85 C112 81 126 86 148 80 C174 72 196 80 218 75 C244 69 264 76 286 70 C312 63 332 69 354 64 C386 57 410 62 434 55"
              initial={shouldReduceMotion ? false : { pathLength: 0, opacity: 0 }}
              whileInView={shouldReduceMotion ? undefined : { pathLength: 1, opacity: 1 }}
              animate={shouldReduceMotion ? { pathLength: 1, opacity: 1 } : undefined}
              viewport={{ once: true, margin: '-60px' }}
              transition={shouldReduceMotion ? undefined : { duration: 1.2, ease: 'easeInOut', delay: 0.16 }}
              stroke={`url(#${equityCurveId})`}
              strokeWidth="3"
              strokeLinecap="round"
            />
            <defs>
              <linearGradient id={equityCurveId} x1="-14" y1="94" x2="434" y2="55" gradientUnits="userSpaceOnUse">
                <stop stopColor="#2563eb" />
                <stop offset="0.5" stopColor="#38bdf8" />
                <stop offset="1" stopColor="#646cff" />
              </linearGradient>
            </defs>
          </svg>
        </div>

        <div className="absolute right-2 bottom-0 left-10 grid grid-cols-[repeat(14,minmax(0,1fr))] gap-2 sm:left-12 sm:gap-3">
          {bars.map((bar, index) => (
            <span key={bar.label} className="text-center text-[11px] font-bold text-slate-400 dark:text-white/[0.32]">
              <span className="hidden sm:inline">{bar.label}</span>
              <span className="sm:hidden">{index % 2 === 0 ? bar.label : ''}</span>
            </span>
          ))}
        </div>
      </div>

      <div className="mt-8 grid grid-cols-2 gap-4">
        <MetricCard label={t('aiQuant.homepage.visual.metrics.return')} value="+18.4%" positive />
        <MetricCard label={t('aiQuant.homepage.visual.metrics.winRate')} value="63%" />
      </div>
    </div>
  )
}

function MetricCard({ label, value, positive = false }: { label: string, value: string, positive?: boolean }) {
  return (
    <div className="rounded-xl border border-slate-200/80 bg-white/[0.78] p-4 shadow-sm dark:border-[#1d2937] dark:bg-[#0d131e]">
      <div className={`!text-[12px] !leading-none font-semibold ${mutedText}`}>
        {label}
      </div>
      <div className={`mt-3 !text-[17px] !leading-tight font-black ${positive ? 'text-emerald-500/82 dark:text-emerald-400/78' : 'text-slate-950/82 dark:text-white/78'}`}>
        {value}
      </div>
    </div>
  )
}

function DeployOrbitVisual() {
  const shouldReduceMotion = useReducedMotion()

  return (
    <div className="relative mx-auto aspect-[1.22] w-full max-w-[570px] overflow-hidden rounded-[1.65rem] border border-slate-200/75 bg-white/88 shadow-[0_24px_80px_rgba(15,23,42,0.09)] dark:border-white/[0.045] dark:bg-[#080713]">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(99,102,241,0.18),transparent_34%),radial-gradient(circle_at_50%_62%,rgba(168,85,247,0.10),transparent_36%),linear-gradient(135deg,rgba(255,255,255,0.98),rgba(238,244,255,0.92))] dark:bg-[radial-gradient(circle_at_50%_50%,rgba(99,102,241,0.20),transparent_34%),radial-gradient(circle_at_50%_62%,rgba(168,85,247,0.12),transparent_34%),linear-gradient(135deg,rgba(18,23,36,0.92),rgba(5,5,12,0.96))]" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(37,99,235,0.055),transparent_48%)] dark:bg-[radial-gradient(circle_at_50%_50%,rgba(255,255,255,0.035),transparent_52%)]" />
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="absolute aspect-square w-[54%] rounded-full border-[5px] border-slate-400/20 dark:border-white/[0.13]" />
        <div className="absolute aspect-square w-[34%] rounded-full border border-slate-500/34 dark:border-white/70" />
        <motion.div
          aria-hidden="true"
          animate={shouldReduceMotion ? { opacity: 0.54, scale: 1 } : { opacity: [0, 0.58, 0.22, 0], scale: [0.64, 0.72, 1.08, 1.58] }}
          transition={shouldReduceMotion ? undefined : { duration: 3.2, repeat: Infinity, ease: 'easeOut', times: [0, 0.08, 0.66, 1] }}
          className="absolute aspect-square w-[34%] rounded-full border border-slate-500/40 dark:border-white/78"
        />
        <motion.div
          aria-hidden="true"
          animate={shouldReduceMotion ? { opacity: 0.28, scale: 1 } : { opacity: [0, 0.36, 0.14, 0], scale: [0.72, 0.8, 1.2, 1.68] }}
          transition={shouldReduceMotion ? undefined : { duration: 3.2, repeat: Infinity, ease: 'easeOut', delay: 1.45, times: [0, 0.08, 0.66, 1] }}
          className="absolute aspect-square w-[34%] rounded-full border border-slate-500/28 dark:border-white/50"
        />
        <motion.div
          aria-hidden="true"
          animate={shouldReduceMotion ? { opacity: 0.34, scale: 1 } : { opacity: [0.28, 0.52, 0.28], scale: [0.92, 1.08, 0.92] }}
          transition={shouldReduceMotion ? undefined : { duration: 3.4, repeat: Infinity, ease: 'easeInOut' }}
          className="absolute aspect-square w-[25%] rounded-full bg-primary/16 blur-3xl dark:bg-primary/22"
        />

        <div className="relative h-[128px] w-[150px]">
          <motion.div
            aria-hidden="true"
            animate={shouldReduceMotion ? undefined : { x: [0, -2, 0], y: [0, 2, 0] }}
            transition={shouldReduceMotion ? undefined : { duration: 4.2, repeat: Infinity, ease: 'easeInOut' }}
            className="absolute left-3 top-8 h-[70px] w-[76px] rounded-xl border border-amber-300/42 bg-gradient-to-br from-amber-200/58 via-orange-100/42 to-white/20 shadow-[0_18px_50px_rgba(245,158,11,0.12)] dark:border-amber-300/34 dark:from-amber-500/30 dark:via-orange-500/12 dark:to-transparent dark:shadow-[0_18px_50px_rgba(245,158,11,0.18)]"
          />
          <motion.div
            aria-hidden="true"
            animate={shouldReduceMotion ? undefined : { x: [0, 2, 0], y: [0, -2, 0] }}
            transition={shouldReduceMotion ? undefined : { duration: 4.6, repeat: Infinity, ease: 'easeInOut', delay: 0.2 }}
            className="absolute right-4 top-9 h-[74px] w-[76px] rounded-xl border border-emerald-300/42 bg-gradient-to-br from-emerald-100/58 via-cyan-100/42 to-white/20 shadow-[0_18px_48px_rgba(20,184,166,0.10)] dark:border-emerald-300/34 dark:from-emerald-400/18 dark:via-cyan-400/12 dark:to-transparent dark:shadow-[0_18px_48px_rgba(20,184,166,0.14)]"
          />
          <div className="absolute left-1/2 top-[42px] z-10 flex h-[78px] w-[84px] -translate-x-1/2 items-center justify-center rounded-2xl border border-slate-300/70 bg-gradient-to-br from-white/92 via-violet-50/92 to-slate-100/90 shadow-[0_24px_70px_rgba(100,108,255,0.20)] backdrop-blur-xl dark:border-white/46 dark:from-purple-400/34 dark:via-[#342344]/86 dark:to-[#111525]/88 dark:shadow-[0_24px_70px_rgba(100,108,255,0.28)]">
            <div className="absolute left-4 top-4 h-2.5 w-2.5 rounded-full bg-slate-400/40 dark:bg-white/26" />
            <div className="space-y-2">
              <div className="h-2.5 w-10 rounded-full bg-violet-500/58 shadow-[0_0_18px_rgba(139,92,246,0.28)] dark:bg-violet-300/80 dark:shadow-[0_0_18px_rgba(196,181,253,0.45)]" />
              <div className="h-2.5 w-10 rounded-full bg-violet-500/54 shadow-[0_0_18px_rgba(139,92,246,0.22)] dark:bg-violet-300/78 dark:shadow-[0_0_18px_rgba(196,181,253,0.38)]" />
            </div>
          </div>
          <motion.div
            animate={shouldReduceMotion ? undefined : { rotate: 360 }}
            transition={shouldReduceMotion ? undefined : { duration: 5.2, repeat: Infinity, ease: 'linear' }}
            className="absolute right-0 top-[36px] z-20 flex h-[58px] w-[58px] items-center justify-center rounded-xl border border-cyan-400/30 bg-cyan-50/92 text-cyan-600 shadow-[0_14px_46px_rgba(34,211,238,0.16)] dark:border-cyan-300/22 dark:bg-[#08283a]/88 dark:text-cyan-300 dark:shadow-[0_14px_46px_rgba(34,211,238,0.22)]"
          >
            <RefreshCw className="h-6 w-6" />
          </motion.div>
          <div className="absolute -bottom-4 left-1/2 z-30 -translate-x-1/2 text-[15px] font-black tracking-normal text-slate-950 drop-shadow-[0_4px_14px_rgba(255,255,255,0.72)] dark:text-white dark:drop-shadow-[0_4px_14px_rgba(0,0,0,0.72)]">
            DEPLOY
          </div>
        </div>
      </div>
      <div className="absolute inset-0 rounded-[1.65rem] ring-1 ring-inset ring-slate-900/[0.04] dark:ring-white/[0.03]" />
    </div>
  )
}

function StrategyPlazaVisual() {
  const { t } = useTranslation()
  const shouldReduceMotion = useReducedMotion()
  const bars = [
    { height: 42, className: 'bg-emerald-400/70' },
    { height: 58, className: 'bg-emerald-400/78' },
    { height: 50, className: 'bg-emerald-400/66' },
    { height: 34, className: 'bg-rose-400/72' },
    { height: 72, className: 'bg-emerald-400/82' },
    { height: 84, className: 'bg-emerald-400/80' },
    { height: 63, className: 'bg-emerald-400/72' },
  ]
  const backgroundCards = [
    {
      id: 'reversion',
      title: t('aiQuant.homepage.visual.plaza.reversion'),
      stat: '+8.3%',
      icon: RefreshCw,
      className: 'left-[14%] top-[19%] w-[34%] rotate-[-7deg]',
      delay: 0,
    },
    {
      id: 'grid',
      title: t('aiQuant.homepage.visual.plaza.grid'),
      stat: '',
      icon: WalletCards,
      className: 'right-[10%] top-[20%] w-[37%] rotate-[7deg]',
      delay: 0.28,
    },
    {
      id: 'breakout',
      title: t('aiQuant.homepage.visual.plaza.breakout'),
      stat: 'Ready',
      icon: LineChart,
      className: 'bottom-[12%] left-[12%] w-[31%] rotate-[-3deg]',
      delay: 0.56,
    },
    {
      id: 'ghost',
      title: '',
      stat: '',
      icon: Sparkles,
      className: 'bottom-[15%] right-[8%] w-[32%] rotate-[9deg]',
      delay: 0.84,
    },
  ]

  return (
    <div className="relative mx-auto aspect-[1.22] w-full max-w-[560px] overflow-hidden rounded-[1.65rem] border border-slate-200/65 bg-white/88 shadow-[0_24px_80px_rgba(15,23,42,0.09)] dark:border-white/[0.035] dark:bg-[#05050b]">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_48%,rgba(99,102,241,0.16),transparent_36%),radial-gradient(circle_at_50%_56%,rgba(124,58,237,0.08),transparent_42%),linear-gradient(145deg,rgba(255,255,255,0.98),rgba(239,245,255,0.92))] dark:bg-[radial-gradient(circle_at_50%_48%,rgba(72,72,180,0.24),transparent_36%),radial-gradient(circle_at_50%_56%,rgba(124,58,237,0.16),transparent_42%),linear-gradient(145deg,rgba(11,11,22,0.98),rgba(2,2,6,0.98))]" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_48%,rgba(255,255,255,0.36),transparent_28%)] dark:bg-[radial-gradient(circle_at_50%_48%,rgba(255,255,255,0.045),transparent_28%)]" />
      <div className="absolute inset-0 bg-[linear-gradient(to_right,rgba(15,23,42,0.045)_1px,transparent_1px),linear-gradient(to_bottom,rgba(15,23,42,0.035)_1px,transparent_1px)] bg-[size:44px_44px] opacity-30 dark:bg-[linear-gradient(to_right,rgba(255,255,255,0.018)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.014)_1px,transparent_1px)] dark:opacity-20" />
      <motion.div
        aria-hidden="true"
        animate={shouldReduceMotion ? undefined : { opacity: [0.18, 0.34, 0.18], scale: [0.96, 1.04, 0.96] }}
        transition={shouldReduceMotion ? undefined : { duration: 5.8, repeat: Infinity, ease: 'easeInOut' }}
        className="absolute left-[31%] top-[28%] h-[42%] w-[44%] rounded-full bg-primary/16 blur-3xl dark:bg-primary/22"
      />

      {backgroundCards.map(card => (
        <motion.div
          key={card.id}
          animate={shouldReduceMotion ? undefined : { y: [0, -7, 0] }}
          transition={shouldReduceMotion ? undefined : { duration: 5.2, repeat: Infinity, ease: 'easeInOut', delay: card.delay }}
          className={`absolute rounded-xl border border-slate-200/80 bg-white/64 p-4 opacity-[0.70] shadow-[0_22px_70px_rgba(15,23,42,0.10)] backdrop-blur-sm dark:border-white/[0.06] dark:bg-[#151a26]/42 dark:opacity-[0.58] dark:shadow-[0_22px_70px_rgba(0,0,0,0.22)] ${card.className}`}
        >
          <div className="flex min-h-[84px] items-start gap-3">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/16 text-primary">
              <card.icon className="h-4 w-4" />
            </div>
            <div className="min-w-0">
              {card.title && <div className="truncate text-[12px] font-black text-slate-700/48 dark:text-white/38">{card.title}</div>}
              {card.stat && <div className="mt-3 text-[18px] font-black text-emerald-500/52 dark:text-emerald-400/48">{card.stat}</div>}
              {card.id === 'reversion' && (
                <div className="mt-5 flex h-9 items-end gap-1">
                  {[36, 52, 64, 28, 74].map((height, index) => (
                    <span key={height} className={`w-1.5 rounded-t ${index === 3 ? 'bg-rose-400/42 dark:bg-rose-400/36' : 'bg-emerald-500/48 dark:bg-emerald-400/45'}`} style={{ height: `${height}%` }} />
                  ))}
                </div>
              )}
            </div>
          </div>
        </motion.div>
      ))}

      <div className="absolute inset-0 flex items-center justify-center p-6">
        <div className="relative w-[44%] min-w-[238px] rounded-[1.35rem] border-2 border-slate-300/90 bg-white/82 p-5 shadow-[0_28px_90px_rgba(80,86,255,0.16)] backdrop-blur-xl dark:border-white/74 dark:bg-[#131c2b]/94 dark:shadow-[0_28px_90px_rgba(80,86,255,0.24)]">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-start gap-4">
              <div className="mt-2 text-primary">
                <TrendingUp className="h-5 w-5" />
              </div>
              <div>
                <div className="text-[16px] font-black leading-none text-slate-950/78 dark:text-white/82">
                  {t('aiQuant.homepage.visual.plaza.trend')}
                </div>
                <div className="mt-3 text-[11px] leading-none text-slate-500/56 dark:text-white/26">
                  {t('aiQuant.homepage.visual.plaza.template')}
                </div>
              </div>
            </div>
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-slate-300/80 bg-white/74 text-primary dark:border-white/72 dark:bg-white/[0.025]">
              <Star className="h-4 w-4 fill-current" />
            </div>
          </div>

          <div className="mt-8 text-[28px] font-black leading-none text-emerald-500/78 dark:text-emerald-400/78">
            +12.5%
          </div>
          <div className="mt-7 flex h-11 items-end gap-2">
            {bars.map((bar, index) => (
              <motion.div
                key={`${bar.height}-${index}`}
                initial={shouldReduceMotion ? false : { height: 0 }}
                whileInView={shouldReduceMotion ? undefined : { height: `${bar.height}%` }}
                animate={shouldReduceMotion ? { height: `${bar.height}%` } : undefined}
                viewport={{ once: true, margin: '-60px' }}
                transition={shouldReduceMotion ? undefined : { duration: 0.45, ease: 'easeOut', delay: index * 0.04 }}
                className={`w-2.5 rounded-t ${bar.className}`}
                />
            ))}
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
          <h2 className="!m-0 !text-[1.65rem] !leading-[1.2] font-black tracking-normal text-slate-950 dark:text-white md:!text-[1.9rem]">
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
              <div aria-hidden="true" className="relative h-4 shrink-0 md:h-5" />
              <p className={`relative !m-0 text-base leading-relaxed ${mutedText}`}>
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
  const shouldReduceMotion = useReducedMotion()

  return (
    <section className={sectionShell}>
      <motion.div
        initial={shouldReduceMotion ? false : 'hidden'}
        whileInView={shouldReduceMotion ? undefined : 'visible'}
        animate={shouldReduceMotion ? { opacity: 1, y: 0 } : undefined}
        variants={revealUp}
        viewport={{ once: true, margin: '-80px' }}
        transition={shouldReduceMotion ? undefined : revealTransition}
        className={`mx-auto flex max-w-4xl flex-col items-center rounded-2xl px-8 py-12 text-center md:px-20 md:py-14 ${panelClass}`}
      >
        <h2 className="!m-0 !text-[1.78rem] !leading-[1.18] font-black text-slate-950 dark:text-white md:!text-[2.08rem]">
          {t('aiQuant.homepage.final.title')}
        </h2>
        <div aria-hidden="true" className="h-5 shrink-0 md:h-6" />
        <p className={`!m-0 max-w-2xl !text-[15px] !leading-[1.75] md:!text-[16px] ${mutedText}`}>
          {t('aiQuant.homepage.final.description')}
        </p>
        <div className="mt-9 flex w-full justify-center">
          <PrimaryCta href={ctaHref} label={t('aiQuant.homepage.finalCta')} className="min-h-[56px] px-9 py-3.5 !text-[16px] md:min-h-[60px] md:px-10 md:!text-[17px] [&_svg]:!h-[18px] [&_svg]:!w-[18px]" />
        </div>
      </motion.div>
    </section>
  )
}
