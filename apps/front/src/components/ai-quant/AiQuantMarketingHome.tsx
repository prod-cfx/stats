'use client'

import { motion, type Transition } from 'framer-motion'
import { ArrowRight, BarChart3, Cpu, LineChart, Play, ShieldCheck, Sparkles, TrendingUp, Zap } from 'lucide-react'
import Link from 'next/link'
import { useTranslation } from 'react-i18next'

type FeatureKey = 'conversation' | 'backtest' | 'deploy' | 'plaza'
type AdvantageKey = 'barrier' | 'logic' | 'validation' | 'closedLoop'

const sectionShell = 'relative border-t border-slate-200/70 bg-white/45 px-6 py-20 dark:border-white/[0.06] dark:bg-[#080c12]/80 md:px-8 md:py-24'
const blackSectionShell = 'relative border-t border-slate-200/70 bg-[#f8fafc] px-6 py-20 dark:border-white/[0.06] dark:bg-[#020305] md:px-8 md:py-24'
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
        <HeroSection ctaHref={ctaHref} />
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
      <div className="absolute inset-0 bg-[linear-gradient(to_right,rgba(15,23,42,0.045)_1px,transparent_1px),linear-gradient(to_bottom,rgba(15,23,42,0.04)_1px,transparent_1px)] bg-[size:44px_44px] dark:bg-[linear-gradient(to_right,rgba(255,255,255,0.025)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.025)_1px,transparent_1px)]" />
      <div className="absolute -top-40 left-1/2 h-[34rem] w-[34rem] -translate-x-1/2 rounded-full bg-primary/14 blur-[120px] dark:bg-primary/16" />
      <div className="absolute top-1/3 -left-48 h-[30rem] w-[30rem] rounded-full bg-cyan-300/18 blur-[120px] dark:bg-cyan-500/8" />
      <div className="absolute -right-40 bottom-0 h-[32rem] w-[32rem] rounded-full bg-emerald-300/18 blur-[120px] dark:bg-emerald-500/8" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,rgba(255,255,255,0.72),transparent_45%)] dark:bg-[radial-gradient(circle_at_50%_0%,rgba(255,255,255,0.06),transparent_48%)]" />
    </div>
  )
}

function HeroSection({ ctaHref }: { ctaHref: string }) {
  const { t } = useTranslation()

  return (
    <section className="relative pt-12 pb-16 md:pt-20 md:pb-24">
      <div className="mx-auto max-w-7xl px-6 md:px-8">
        <div className="grid items-center gap-12 lg:grid-cols-[1fr_1.1fr]">
          <motion.div
            initial="hidden"
            animate="visible"
            variants={revealUp}
            transition={revealTransition}
            className="max-w-2xl"
          >
            <div className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-4 py-1.5 text-[11px] font-bold tracking-[0.2em] text-primary uppercase">
              <Sparkles className="h-3 w-3" />
              Next-Gen AI Quant
            </div>
            <h1 className="mt-8 text-6xl font-extrabold leading-[1.08] tracking-tight text-white antialiased sm:text-7xl md:text-8xl lg:text-[5.5rem] lg:leading-[1.06] xl:text-[6rem] xl:leading-[1.05]">
              {t('aiQuant.homepage.hero.title').split('AI 量化').map((part, i, arr) => (
                <span key={i}>
                  {part}
                  {i < arr.length - 1 && (
                    <span className="bg-gradient-to-r from-[#a5b4fc] via-primary to-[#c4b5fd] bg-clip-text text-transparent">
                      AI 量化
                    </span>
                  )}
                </span>
              ))}
            </h1>
            <p className={`mt-10 max-w-xl text-[15px] leading-[1.65] md:text-base md:leading-relaxed ${mutedText}`}>
              {t('aiQuant.homepage.hero.description')}
            </p>
            <div className="mt-10">
              <PrimaryCta href={ctaHref} label={t('aiQuant.homepage.heroCta')} />
            </div>
          </motion.div>

          <div className="relative mt-12 lg:mt-0 flex justify-end">
            <HeroVisual />
          </div>
        </div>
      </div>
    </section>
  )
}

function HeroVisual() {
  return (
    <div className="relative flex items-center justify-end py-10 w-full">
      {/* Background Glow */}
      <div className="absolute top-1/2 right-1/4 h-[400px] w-[400px] -translate-y-1/2 translate-x-1/4 rounded-full bg-primary/10 blur-[100px] -z-10" />
      
      {/* Main Abstract Panel */}
      <motion.div
        initial={{ opacity: 0, x: 20 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 1, ease: "easeOut" }}
        className="relative z-10 w-full max-w-[560px] rounded-[24px] border border-white/5 bg-[#0a0a0a]/90 p-1 shadow-2xl backdrop-blur-xl"
      >
        <div className="overflow-hidden rounded-[20px] bg-[#050505] p-6">
          <div className="flex items-center justify-between mb-8">
            <div className="flex items-center gap-3">
              <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center text-primary border border-primary/20">
                <Cpu className="h-4 w-4" />
              </div>
              <div>
                <div className="text-sm font-medium text-white/90">AI Strategy Engine</div>
                <div className="text-[10px] text-emerald-500 font-mono tracking-widest mt-0.5 uppercase">Active • V2.4.1</div>
              </div>
            </div>
            <div className="flex gap-1.5">
              <div className="h-1.5 w-1.5 rounded-full bg-white/20" />
              <div className="h-1.5 w-1.5 rounded-full bg-white/20" />
              <div className="h-1.5 w-1.5 rounded-full bg-white/20" />
            </div>
          </div>
          
          {/* Abstract Chart Area */}
          <div className="relative h-[200px] w-full rounded-xl border border-white/5 bg-black/40 overflow-hidden mb-6">
            {/* Grid lines */}
            <div className="absolute inset-0 bg-[linear-gradient(to_right,#ffffff03_1px,transparent_1px),linear-gradient(to_bottom,#ffffff03_1px,transparent_1px)] bg-[size:24px_24px]" />
            
            {/* Glowing Line Chart */}
            <svg className="absolute inset-0 h-full w-full" preserveAspectRatio="none" viewBox="0 0 100 100">
              <defs>
                <linearGradient id="chart-gradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="rgba(100,108,255,0.3)" />
                  <stop offset="100%" stopColor="rgba(100,108,255,0)" />
                </linearGradient>
                <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
                  <feGaussianBlur stdDeviation="2" result="blur" />
                  <feComposite in="SourceGraphic" in2="blur" operator="over" />
                </filter>
              </defs>
              <path d="M0,100 L0,70 Q15,65 25,75 T50,55 T75,30 T100,20 L100,100 Z" fill="url(#chart-gradient)" />
              <path d="M0,70 Q15,65 25,75 T50,55 T75,30 T100,20" fill="none" stroke="rgba(100,108,255,0.8)" strokeWidth="1.5" filter="url(#glow)" />
              
              {/* Data points */}
              <circle cx="25" cy="75" r="2" fill="#fff" className="drop-shadow-[0_0_4px_#fff]" />
              <circle cx="50" cy="55" r="2" fill="#fff" className="drop-shadow-[0_0_4px_#fff]" />
              <circle cx="75" cy="30" r="2" fill="#fff" className="drop-shadow-[0_0_4px_#fff]" />
              <circle cx="100" cy="20" r="2" fill="#fff" className="drop-shadow-[0_0_4px_#fff]" />
            </svg>
          </div>

          {/* Data Rows */}
          <div className="space-y-2">
            <div className="flex items-center justify-between rounded-lg bg-white/[0.02] px-4 py-3 border border-white/5">
              <span className="text-xs text-white/40 font-mono">Signal Confidence</span>
              <span className="text-xs font-bold text-white">94.2%</span>
            </div>
            <div className="flex items-center justify-between rounded-lg bg-white/[0.02] px-4 py-3 border border-white/5">
              <span className="text-xs text-white/40 font-mono">Execution Latency</span>
              <span className="text-xs font-bold text-white">12ms</span>
            </div>
          </div>
        </div>
      </motion.div>

      {/* Floating Elements */}
      <motion.div
        animate={{ y: [0, -8, 0] }}
        transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
        className="absolute top-8 -right-4 z-20 md:-right-8"
      >
        <div className="rounded-xl border border-white/10 bg-[#111]/90 p-3 shadow-2xl backdrop-blur-xl flex items-center gap-3">
          <div className="grid h-8 w-8 place-items-center rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            <TrendingUp className="h-4 w-4" />
          </div>
          <div className="pr-2">
            <div className="text-[9px] font-medium text-white/40 uppercase tracking-wider">Total Return</div>
            <div className="text-sm font-bold text-emerald-400">+124.8%</div>
          </div>
        </div>
      </motion.div>

      <motion.div
        animate={{ y: [0, 8, 0] }}
        transition={{ duration: 5, repeat: Infinity, ease: "easeInOut", delay: 0.5 }}
        className="absolute bottom-16 -left-4 z-20 md:-left-8"
      >
        <div className="rounded-xl border border-white/10 bg-[#111]/90 p-3 shadow-2xl backdrop-blur-xl flex items-center gap-3">
          <div className="grid h-8 w-8 place-items-center rounded-lg bg-primary/10 text-primary border border-primary/20">
            <ShieldCheck className="h-4 w-4" />
          </div>
          <div className="pr-2">
            <div className="text-[9px] font-medium text-white/40 uppercase tracking-wider">Max Drawdown</div>
            <div className="text-sm font-bold text-white">8.2%</div>
          </div>
        </div>
      </motion.div>
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

  return (
    <section id="workflow" className={sectionShell}>
      <div className="mx-auto max-w-7xl">
        <div className="text-center mb-16">
          <h2 className="text-3xl font-bold tracking-tight text-white md:text-5xl">
            {t('aiQuant.homepage.workflow.title')}
          </h2>
        </div>
        <div className="grid gap-6 md:grid-cols-4">
          {workflowKeys.map((key, index) => (
            <motion.div
              key={key}
              initial="hidden"
              whileInView="visible"
              variants={revealUp}
              viewport={{ once: true }}
              transition={{ ...revealTransition, delay: index * 0.1 }}
              className="group relative rounded-2xl border border-white/5 bg-white/[0.02] p-8 transition-all hover:bg-white/[0.04] hover:border-white/10"
            >
              <div className="mb-8 text-xs font-black text-primary/40 group-hover:text-primary transition-colors">0{index + 1}</div>
              <h3 className="text-xl font-bold text-white">
                {t(`aiQuant.homepage.workflow.items.${key}.title`)}
              </h3>
              <p className="mt-4 text-sm leading-relaxed text-white/40">
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
    <section className={blackSectionShell}>
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
          <h2 className="text-3xl font-bold tracking-tight text-white md:text-5xl">
            {t(`aiQuant.homepage.features.${featureKey}.title`)}
          </h2>
          <p className="mt-6 text-base leading-relaxed text-white/50 md:text-lg">
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
          <div className="rounded-2xl bg-white/5 px-5 py-3 text-sm text-white/80 border border-white/5">
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
            <div className="flex items-center gap-3 text-sm text-white/70">
              <div className="h-2 w-2 rounded-full bg-sky-400 shadow-[0_0_8px_#38bdf8]" />
              {t('aiQuant.homepage.visual.rule1')}
            </div>
            <div className="flex items-center gap-3 text-sm text-white/70">
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
    <div className="rounded-[2rem] border border-white/10 bg-gradient-to-br from-white/[0.05] to-transparent p-8 shadow-2xl backdrop-blur-xl">
      <div className="flex items-center justify-between mb-8">
        <div className="text-xs font-medium text-white/40 uppercase tracking-widest">{t('aiQuant.backtestResult')}</div>
        <div className="h-10 w-10 rounded-2xl bg-primary/10 flex items-center justify-center text-primary border border-primary/20">
          <BarChart3 className="h-5 w-5" />
        </div>
      </div>
      <div className="h-48 w-full bg-black/20 rounded-2xl flex items-end p-4 gap-2 border border-white/5">
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
        <div className="p-4 rounded-2xl bg-white/[0.02] border border-white/5">
          <div className="text-[10px] text-white/40 uppercase font-medium mb-1">Return</div>
          <div className="text-xl font-bold text-emerald-400">+18.4%</div>
        </div>
        <div className="p-4 rounded-2xl bg-white/[0.02] border border-white/5">
          <div className="text-[10px] text-white/40 uppercase font-medium mb-1">Win Rate</div>
          <div className="text-xl font-bold text-white">63%</div>
        </div>
      </div>
    </div>
  )
}

function DeployVisual() {
  const { t } = useTranslation()
  return (
    <div className="rounded-[2rem] border border-white/10 bg-gradient-to-br from-white/[0.05] to-transparent p-8 shadow-2xl backdrop-blur-xl">
      <div className="space-y-4">
        {[
          { label: t('aiQuant.homepage.visual.deployRows.snapshot'), status: 'ACTIVE' },
          { label: t('aiQuant.homepage.visual.deployRows.backtestGate'), status: 'PASSED' },
          { label: t('aiQuant.homepage.visual.deployRows.exchangeApi'), status: 'SECURE' }
        ].map((item, i) => (
          <div key={i} className="flex items-center justify-between p-5 rounded-2xl bg-white/[0.02] border border-white/5">
            <span className="text-sm font-medium text-white/70">{item.label}</span>
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
        <div key={i} className="rounded-[2rem] border border-white/10 bg-gradient-to-br from-white/[0.05] to-transparent p-6 shadow-2xl backdrop-blur-xl hover:bg-white/[0.08] transition-all">
          <div className="h-12 w-12 rounded-2xl bg-primary/10 flex items-center justify-center text-primary mb-6 border border-primary/20">
            <card.icon className="h-6 w-6" />
          </div>
          <h3 className="text-base font-bold text-white mb-1">{card.title}</h3>
          <div className="text-2xl font-bold text-emerald-400">{card.stat}</div>
        </div>
      ))}
    </div>
  )
}

function AdvantageSection() {
  const { t } = useTranslation()
  return (
    <section className={sectionShell}>
      <div className="mx-auto max-w-7xl">
        <div className="text-center mb-20">
          <h2 className="text-3xl font-bold tracking-tight text-white md:text-5xl">
            {t('aiQuant.homepage.advantages.title')}
          </h2>
        </div>
        <div className="grid gap-6 md:grid-cols-2">
          {advantageKeys.map((key, index) => (
            <div key={key} className="group relative rounded-2xl border border-white/5 bg-white/[0.02] p-10 transition-all hover:bg-white/[0.04] hover:border-white/10">
              <div className="text-5xl font-black text-white/[0.02] absolute top-6 right-8 group-hover:text-primary/5 transition-colors">0{index + 1}</div>
              <h3 className="text-2xl font-bold text-white mb-4">
                {t(`aiQuant.homepage.advantages.items.${key}.title`)}
              </h3>
              <p className="text-base leading-relaxed text-white/40">
                {t(`aiQuant.homepage.advantages.items.${key}.desc`)}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

function FinalCtaSection({ ctaHref }: { ctaHref: string }) {
  const { t } = useTranslation()
  return (
    <section className={blackSectionShell}>
      <motion.div 
        initial="hidden"
        whileInView="visible"
        variants={revealUp}
        viewport={{ once: true }}
        transition={revealTransition}
        className="mx-auto max-w-4xl rounded-3xl border border-white/10 bg-gradient-to-b from-white/[0.05] to-transparent p-12 text-center shadow-2xl backdrop-blur-3xl md:p-20"
      >
        <h2 className="text-3xl font-bold tracking-tight text-white md:text-6xl">
          {t('aiQuant.homepage.final.title')}
        </h2>
        <p className="mx-auto mt-6 max-w-xl text-base text-white/40 md:text-lg">
          {t('aiQuant.homepage.final.description')}
        </p>
        <div className="mt-10">
          <PrimaryCta href={ctaHref} label={t('aiQuant.homepage.finalCta')} className="scale-110" />
        </div>
      </motion.div>
    </section>
  )
}
