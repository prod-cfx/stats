# AI Quant Homepage Screenshot-Faithful Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild the public AI Quant homepage so the dark theme closely matches the supplied screenshots, while Chinese, English, light theme, responsiveness, and subtle animation all remain production-ready.

**Architecture:** Keep the route and data flow unchanged. Rework `AiQuantMarketingHome.tsx` into local, code-built visual sections with theme-aware Tailwind classes, framer-motion animations, and locale-driven copy. Update the two locale JSON files so Chinese and English share the same page structure.

**Tech Stack:** Next.js App Router, React 19, TypeScript, Tailwind CSS 4, framer-motion, lucide-react, i18next locale JSON.

---

## File Structure

- Modify: `apps/front/src/components/ai-quant/AiQuantMarketingHome.tsx`
  - Owns the homepage layout, local visual components, motion variants, and theme-aware section styling.
- Modify: `apps/front/public/locales/zh/common.json`
  - Keeps Chinese copy close to the reference screenshots.
- Modify: `apps/front/public/locales/en/common.json`
  - Mirrors the Chinese information architecture with natural English copy.
- Optional modify: `apps/front/src/app/globals.css`
  - Only add small reusable animation keyframes if Tailwind/framer-motion cannot express a required ambient effect cleanly.

## Task 1: Baseline Guard And Locale Shape

**Files:**
- Modify: `apps/front/public/locales/zh/common.json`
- Modify: `apps/front/public/locales/en/common.json`

- [ ] **Step 1: Inspect the existing homepage locale object**

Run:

```bash
rg -n '"homepage"' apps/front/public/locales/zh/common.json apps/front/public/locales/en/common.json
```

Expected: both files contain `aiQuant.homepage`.

- [ ] **Step 2: Update Chinese homepage copy to the approved structure**

In `apps/front/public/locales/zh/common.json`, keep the existing `aiQuant.homepage` key and ensure it contains these values:

```json
{
  "heroCta": "立即体验",
  "finalCta": "开始创建策略",
  "hero": {
    "eyebrow": "NEXT-GEN AI QUANT",
    "title": "小白也能用的 AI 量化交易工具",
    "description": "描述你的交易想法，AI 自动生成策略，完成回测并帮你执行交易",
    "howItWorks": "了解工作原理"
  },
  "workflow": {
    "title": "4 步完成自动交易",
    "items": {
      "chat": {
        "title": "说出你的交易想法",
        "desc": "例如：\"BTC 下跌 3% 时买入，涨 5% 卖出。\""
      },
      "strategy": {
        "title": "AI 帮你生成完整策略",
        "desc": "自动识别交易品种、周期、止盈止损等规则。"
      },
      "backtest": {
        "title": "先回测，再决定是否运行",
        "desc": "验证策略效果，避免盲目上实盘。"
      },
      "deploy": {
        "title": "一键部署自动执行",
        "desc": "策略启动后自动执行，不用盯盘。"
      }
    }
  }
}
```

Also preserve and update the existing `features`, `advantages`, `final`, and `visual` subkeys so the component can keep using locale lookups. Use the screenshot wording already present in the current Chinese locale when it matches.

- [ ] **Step 3: Update English homepage copy with the same structure**

In `apps/front/public/locales/en/common.json`, keep the same keys as Chinese. Use this wording style:

```json
{
  "heroCta": "Try it now",
  "finalCta": "Create a strategy",
  "hero": {
    "eyebrow": "NEXT-GEN AI QUANT",
    "title": "AI quant trading tools beginners can use",
    "description": "Describe your trading idea. AI generates the strategy, runs the backtest, and helps execute it."
  },
  "workflow": {
    "title": "Automated trading in 4 steps"
  }
}
```

Ensure every key used by `AiQuantMarketingHome.tsx` exists in both locale files.

- [ ] **Step 4: Validate JSON syntax**

Run:

```bash
node -e "JSON.parse(require('fs').readFileSync('apps/front/public/locales/zh/common.json','utf8')); JSON.parse(require('fs').readFileSync('apps/front/public/locales/en/common.json','utf8')); console.log('locale json ok')"
```

Expected:

```text
locale json ok
```

- [ ] **Step 5: Commit locale baseline**

Run:

```bash
git add apps/front/public/locales/zh/common.json apps/front/public/locales/en/common.json
git commit -F - <<'MSG'
feat: align AI Quant homepage locale copy

Refs: #879
MSG
```

## Task 2: Rebuild Page Skeleton And Theme System

**Files:**
- Modify: `apps/front/src/components/ai-quant/AiQuantMarketingHome.tsx`

- [ ] **Step 1: Replace the root layout with a screenshot-style single-column narrative**

In `AiQuantMarketingHome`, make the top-level structure:

```tsx
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
```

Keep the existing route and `ctaHref` behavior unchanged.

- [ ] **Step 2: Add shared section and card class helpers**

Near the top of the file, add local constants:

```tsx
const sectionShell = 'relative border-t border-slate-200/70 bg-white/45 px-6 py-20 dark:border-white/[0.06] dark:bg-[#080c12]/80 md:px-8 md:py-24'
const blackSectionShell = 'relative border-t border-slate-200/70 bg-[#f8fafc] px-6 py-20 dark:border-white/[0.06] dark:bg-[#020305] md:px-8 md:py-24'
const panelClass = 'border border-slate-200/80 bg-white/75 shadow-[0_24px_80px_rgba(15,23,42,0.08)] backdrop-blur-xl dark:border-white/[0.08] dark:bg-[#10151d]/72 dark:shadow-[0_28px_100px_rgba(0,0,0,0.35)]'
const mutedText = 'text-slate-600 dark:text-[#8f98aa]'
```

Use these helpers only where they reduce repeated class strings.

- [ ] **Step 3: Add reusable reveal variants**

Add:

```tsx
const revealUp = {
  hidden: { opacity: 0, y: 24 },
  visible: { opacity: 1, y: 0 },
}

const revealTransition = {
  duration: 0.65,
  ease: [0.22, 1, 0.36, 1],
}
```

Use them on major sections with `viewport={{ once: true, margin: '-80px' }}`.

- [ ] **Step 4: Run TypeScript-oriented lint check for this file surface**

Run:

```bash
dx lint
```

Expected: no lint errors from `AiQuantMarketingHome.tsx`.

- [ ] **Step 5: Commit skeleton and theme foundation**

Run:

```bash
git add apps/front/src/components/ai-quant/AiQuantMarketingHome.tsx
git commit -F - <<'MSG'
feat: rebuild AI Quant homepage theme foundation

Refs: #879
MSG
```

## Task 3: Screenshot-Faithful Hero

**Files:**
- Modify: `apps/front/src/components/ai-quant/AiQuantMarketingHome.tsx`

- [ ] **Step 1: Add the ambient background component**

Create this local component:

```tsx
function ThemeAmbientBackground() {
  return (
    <div className="pointer-events-none fixed inset-0 z-0 overflow-hidden">
      <motion.div
        aria-hidden
        animate={{ opacity: [0.65, 1, 0.65], scale: [1, 1.05, 1] }}
        transition={{ duration: 8, repeat: Infinity, ease: 'easeInOut' }}
        className="absolute left-1/2 top-[-18rem] h-[38rem] w-[38rem] -translate-x-1/2 rounded-full bg-blue-500/10 blur-[110px] dark:bg-blue-500/16"
      />
      <motion.div
        aria-hidden
        animate={{ opacity: [0.45, 0.75, 0.45] }}
        transition={{ duration: 9, repeat: Infinity, ease: 'easeInOut', delay: 0.8 }}
        className="absolute left-[54%] top-[14rem] h-[28rem] w-[28rem] rounded-full bg-violet-500/10 blur-[120px] dark:bg-violet-600/18"
      />
    </div>
  )
}
```

- [ ] **Step 2: Rewrite `HeroSection` as a centered poster hero**

The hero should be full-width, centered, and close to the first screenshot:

```tsx
function HeroSection({ ctaHref }: { ctaHref: string }) {
  const { t } = useTranslation()
  const title = t('aiQuant.homepage.hero.title')

  return (
    <section className="relative overflow-hidden px-6 pb-24 pt-20 dark:bg-[#020305] md:px-8 md:pb-32 md:pt-28">
      <HeroLines />
      <HeroParticles />
      <motion.div
        initial="hidden"
        animate="visible"
        variants={revealUp}
        transition={revealTransition}
        className="relative z-10 mx-auto flex max-w-4xl flex-col items-center text-center"
      >
        <div className="inline-flex items-center gap-2 rounded-full border border-blue-500/40 bg-blue-500/10 px-4 py-1.5 text-[10px] font-bold uppercase tracking-[0.18em] text-blue-600 dark:border-blue-300/55 dark:bg-blue-500/10 dark:text-[#5d83ff]">
          <Zap className="h-3 w-3" />
          {t('aiQuant.homepage.hero.eyebrow')}
        </div>
        <h1 className="mt-7 max-w-4xl text-balance text-5xl font-black leading-[1.08] tracking-normal text-slate-950 dark:text-white sm:text-6xl md:text-7xl">
          <GradientTitle title={title} lng={title.includes('AI 量化') ? 'zh' : 'en'} />
        </h1>
        <p className={`mt-7 max-w-2xl text-sm leading-7 md:text-base ${mutedText}`}>
          {t('aiQuant.homepage.hero.description')}
        </p>
        <div className="mt-10">
          <PrimaryCta href={ctaHref} label={t('aiQuant.homepage.heroCta')} />
        </div>
      </motion.div>
    </section>
  )
}
```

- [ ] **Step 3: Add `GradientTitle`, `HeroLines`, and `HeroParticles`**

Use local helper components:

```tsx
function GradientTitle({ title, lng }: { title: string, lng: 'zh' | 'en' }) {
  const target = lng === 'zh' ? 'AI 量化' : 'AI quant'
  const parts = title.split(target)

  if (parts.length === 1) return <>{title}</>

  return (
    <>
      {parts.map((part, index) => (
        <span key={`${part}-${index}`}>
          {part}
          {index < parts.length - 1 && (
            <span className="bg-gradient-to-r from-[#3e69ff] via-[#6d57ff] to-[#8a5bff] bg-clip-text text-transparent">
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
    <>
      <div className="absolute left-[10%] top-24 h-px w-[30rem] rotate-[-7deg] bg-blue-500/10 dark:bg-blue-400/12" />
      <div className="absolute right-[8%] top-72 h-px w-[34rem] rotate-[-7deg] bg-violet-500/10 dark:bg-violet-400/12" />
    </>
  )
}

function HeroParticles() {
  const dots = [
    'left-[25%] top-28 bg-blue-500',
    'left-[16%] top-[21rem] bg-blue-500',
    'right-[33%] top-40 bg-violet-500',
    'right-[25%] top-[24rem] bg-violet-500',
  ]

  return (
    <>
      {dots.map((className, index) => (
        <motion.span
          key={className}
          animate={{ y: [0, index % 2 === 0 ? -8 : 8, 0], opacity: [0.45, 1, 0.45] }}
          transition={{ duration: 4 + index, repeat: Infinity, ease: 'easeInOut' }}
          className={`absolute h-1.5 w-1.5 rounded-full shadow-[0_0_14px_currentColor] ${className}`}
        />
      ))}
    </>
  )
}
```

- [ ] **Step 4: Check hero visually in dark and light mode**

Run:

```bash
dx start front --dev
```

Open `/zh` and `/en`. Expected: dark hero visually matches the first screenshot composition; light hero remains readable and polished.

- [ ] **Step 5: Commit hero**

Run:

```bash
git add apps/front/src/components/ai-quant/AiQuantMarketingHome.tsx
git commit -F - <<'MSG'
feat: recreate AI Quant homepage hero

Refs: #879
MSG
```

## Task 4: Workflow And Advantage Cards

**Files:**
- Modify: `apps/front/src/components/ai-quant/AiQuantMarketingHome.tsx`

- [ ] **Step 1: Rewrite `WorkflowSection`**

Use `sectionShell`, centered title, and four cards:

```tsx
function WorkflowSection() {
  const { t } = useTranslation()

  return (
    <section id="workflow" className={sectionShell}>
      <div className="mx-auto max-w-7xl">
        <motion.h2
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: '-80px' }}
          variants={revealUp}
          transition={revealTransition}
          className="text-center text-2xl font-black tracking-normal text-slate-950 dark:text-white md:text-3xl"
        >
          {t('aiQuant.homepage.workflow.title')}
        </motion.h2>
        <div className="mt-14 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {workflowKeys.map((key, index) => (
            <motion.div
              key={key}
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, margin: '-80px' }}
              variants={revealUp}
              transition={{ ...revealTransition, delay: index * 0.06 }}
              whileHover={{ y: -4 }}
              className={`rounded-xl p-7 ${panelClass}`}
            >
              <div className="text-xs font-black text-blue-600 dark:text-[#2f6cff]">0{index + 1}</div>
              <h3 className="mt-5 text-base font-bold text-slate-950 dark:text-white">
                {t(`aiQuant.homepage.workflow.items.${key}.title`)}
              </h3>
              <p className={`mt-4 text-sm leading-7 ${mutedText}`}>
                {t(`aiQuant.homepage.workflow.items.${key}.desc`)}
              </p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  )
}
```

- [ ] **Step 2: Rewrite `AdvantageSection`**

Match the reference 2x2 card layout:

```tsx
function AdvantageSection() {
  const { t } = useTranslation()

  return (
    <section className={blackSectionShell}>
      <div className="mx-auto max-w-5xl">
        <h2 className="text-center text-2xl font-black text-slate-950 dark:text-white md:text-3xl">
          {t('aiQuant.homepage.advantages.title')}
        </h2>
        <div className="mt-14 grid gap-5 md:grid-cols-2">
          {advantageKeys.map((key, index) => (
            <motion.div
              key={key}
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, margin: '-80px' }}
              variants={revealUp}
              transition={{ ...revealTransition, delay: index * 0.05 }}
              className={`relative overflow-hidden rounded-xl p-8 ${panelClass}`}
            >
              <div className="absolute right-5 top-3 text-5xl font-black text-slate-950/[0.04] dark:text-white/[0.035]">0{index + 1}</div>
              <h3 className="relative text-base font-bold text-slate-950 dark:text-white">
                {t(`aiQuant.homepage.advantages.items.${key}.title`)}
              </h3>
              <p className={`relative mt-4 text-sm leading-7 ${mutedText}`}>
                {t(`aiQuant.homepage.advantages.items.${key}.desc`)}
              </p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  )
}
```

- [ ] **Step 3: Verify responsive card layout**

Run the app and inspect widths around 390px, 768px, and 1280px. Expected: cards do not overflow and text stays within card bounds.

- [ ] **Step 4: Commit cards**

Run:

```bash
git add apps/front/src/components/ai-quant/AiQuantMarketingHome.tsx
git commit -F - <<'MSG'
feat: match AI Quant workflow and advantage cards

Refs: #879
MSG
```

## Task 5: Feature Sections And Code-Built Visuals

**Files:**
- Modify: `apps/front/src/components/ai-quant/AiQuantMarketingHome.tsx`

- [ ] **Step 1: Rewrite `FeatureSection`**

Use alternating text/visual layout and screenshot-like spacing:

```tsx
function FeatureSection({ featureKey, reverse = false }: { featureKey: FeatureKey, reverse?: boolean }) {
  const { t } = useTranslation()

  return (
    <section className={featureKey === 'conversation' || featureKey === 'deploy' ? blackSectionShell : sectionShell}>
      <div className={`mx-auto grid max-w-7xl items-center gap-12 md:grid-cols-2 md:gap-16 ${reverse ? 'md:[&>*:first-child]:order-2' : ''}`}>
        <motion.div initial="hidden" whileInView="visible" viewport={{ once: true, margin: '-80px' }} variants={revealUp} transition={revealTransition}>
          <div className="text-[11px] font-black text-blue-600 dark:text-[#2f6cff]">
            {t(`aiQuant.homepage.features.${featureKey}.eyebrow`)}
          </div>
          <h2 className="mt-4 text-2xl font-black leading-tight text-slate-950 dark:text-white md:text-3xl">
            {t(`aiQuant.homepage.features.${featureKey}.title`)}
          </h2>
          <p className={`mt-5 max-w-xl text-sm leading-7 md:text-base ${mutedText}`}>
            {t(`aiQuant.homepage.features.${featureKey}.description`)}
          </p>
        </motion.div>
        <motion.div initial="hidden" whileInView="visible" viewport={{ once: true, margin: '-80px' }} variants={revealUp} transition={{ ...revealTransition, delay: 0.08 }}>
          <FeatureVisual featureKey={featureKey} />
        </motion.div>
      </div>
    </section>
  )
}
```

- [ ] **Step 2: Replace `ConversationVisual` with screenshot-like chat and strategy panels**

Create `ConversationStrategyVisual` and route `featureKey === 'conversation'` to it. It must include the AI prompt, user prompt, three generated rows, and a green processing dot:

```tsx
function ConversationStrategyVisual() {
  const { t } = useTranslation()
  const rows = [
    { icon: TrendingUp, label: t('aiQuant.homepage.visual.rule1'), action: 'BUY', tone: 'blue' },
    { icon: Activity, label: t('aiQuant.homepage.visual.rule3'), action: 'SELL', tone: 'amber' },
    { icon: Lock, label: t('aiQuant.homepage.visual.rule2'), action: '10%', tone: 'violet' },
  ]

  return (
    <div className="space-y-4">
      <div className={`rounded-xl p-6 ${panelClass}`}>
        <div className="flex items-start gap-4">
          <Bot className="mt-1 h-4 w-4 text-slate-500 dark:text-white/55" />
          <div className="rounded-xl bg-blue-600/10 px-4 py-3 text-xs leading-6 text-slate-700 dark:bg-blue-500/10 dark:text-[#9aa6bd]">
            {t('aiQuant.homepage.visual.assistant')}
          </div>
        </div>
        <div className="mt-4 flex justify-end">
          <div className="max-w-[80%] rounded-xl border border-slate-300 px-4 py-3 text-xs text-slate-950 dark:border-white/60 dark:text-white">
            {t('aiQuant.homepage.visual.userPrompt')}
          </div>
        </div>
      </div>
      <div className={`rounded-xl p-5 ${panelClass}`}>
        <div className="mb-5 flex items-center justify-between">
          <div className="flex items-center gap-2 text-[11px] font-black text-blue-600 dark:text-[#2f6cff]">
            <Sparkles className="h-4 w-4" />
            {t('aiQuant.homepage.visual.parsedStrategy')}
          </div>
          <div className="flex items-center gap-1.5 text-[10px] text-emerald-500">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 shadow-[0_0_10px_currentColor]" />
            Processing
          </div>
        </div>
        <div className="space-y-3">
          {rows.map((row, index) => (
            <motion.div key={row.label} initial={{ opacity: 0, x: 12 }} whileInView={{ opacity: 1, x: 0 }} transition={{ delay: index * 0.08 }} className="flex items-center justify-between rounded-lg border border-slate-200/80 bg-slate-50/80 px-4 py-3 dark:border-white/[0.06] dark:bg-[#111720]">
              <div className="flex items-center gap-3">
                <div className="grid h-9 w-9 place-items-center rounded-lg bg-blue-500/10 text-blue-500">
                  <row.icon className="h-4 w-4" />
                </div>
                <span className="text-xs font-semibold text-slate-900 dark:text-white">{row.label}</span>
              </div>
              <span className="rounded-md border border-blue-500/20 bg-blue-500/10 px-2 py-1 text-[10px] font-black text-blue-600 dark:text-blue-300">{row.action}</span>
            </motion.div>
          ))}
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Replace backtest visual with animated SVG bars and curve**

Create `BacktestResultVisual` with fixed aspect ratio, bars, curve, and metric cards. Use existing locale metric labels:

```tsx
function BacktestResultVisual() {
  const { t } = useTranslation()
  const bars = [78, 82, 74, 88, 90, 86, 93, 89, 96, 91, 98, 94, 99, 95]
  const labels = ['W1', 'W2', 'W3', 'W4', 'W5', 'W6', 'W7', 'D1', 'D2', 'D3', 'D4', 'D5', 'D6', 'D7']

  return (
    <div className={`rounded-xl p-5 ${panelClass}`}>
      <div className="mb-6 flex items-center justify-between">
        <div className="text-sm font-bold text-slate-950 dark:text-white">{t('aiQuant.backtestResult')}</div>
        <div className="grid h-9 w-9 place-items-center rounded-lg border border-blue-500/20 bg-blue-500/10 text-blue-600 dark:text-blue-400">
          <BarChart3 className="h-4 w-4" />
        </div>
      </div>
      <div className="relative h-40 overflow-hidden rounded-lg border border-slate-200/70 bg-slate-50/80 px-5 py-4 dark:border-white/[0.04] dark:bg-[#0f141d]">
        <div className="absolute inset-x-5 bottom-8 top-4 flex items-end gap-2">
          {bars.map((height, index) => (
            <motion.div key={`${height}-${index}`} initial={{ height: 0 }} whileInView={{ height: `${height}%` }} viewport={{ once: true }} transition={{ duration: 0.6, delay: index * 0.025 }} className={`flex-1 ${index % 4 === 2 ? 'bg-red-500/18' : 'bg-emerald-500/20'}`} />
          ))}
        </div>
        <svg className="absolute inset-x-5 bottom-8 top-4 h-[calc(100%-3rem)] w-[calc(100%-2.5rem)] overflow-visible" preserveAspectRatio="none" viewBox="0 0 140 100">
          <motion.path initial={{ pathLength: 0 }} whileInView={{ pathLength: 1 }} viewport={{ once: true }} transition={{ duration: 1.2 }} d="M0 72 L10 67 L20 65 L30 70 L40 60 L50 63 L60 55 L70 58 L80 52 L90 56 L100 47 L110 51 L120 44 L130 46 L140 49" fill="none" stroke="#3f6dff" strokeWidth="2" />
        </svg>
        <div className="absolute bottom-2 left-5 right-5 grid grid-cols-7 gap-2 text-[9px] text-slate-400 dark:text-white/25">
          {labels.filter((_, index) => index % 2 === 0).map(label => <span key={label}>{label}</span>)}
        </div>
      </div>
      <div className="mt-5 grid grid-cols-2 gap-3">
        <MetricCard label={t('aiQuant.homepage.visual.metrics.return')} value="+18.4%" positive />
        <MetricCard label={t('aiQuant.homepage.visual.metrics.winRate')} value="63%" />
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Replace deploy visual with animated orbit**

Create `DeployOrbitVisual` with concentric circles:

```tsx
function DeployOrbitVisual() {
  const { t } = useTranslation()

  return (
    <div className={`relative grid aspect-square min-h-[320px] place-items-center overflow-hidden rounded-2xl ${panelClass}`}>
      <motion.div animate={{ scale: [1, 1.04, 1], opacity: [0.45, 0.7, 0.45] }} transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }} className="absolute h-56 w-56 rounded-full border border-slate-300 dark:border-white/16" />
      <motion.div animate={{ rotate: 360 }} transition={{ duration: 18, repeat: Infinity, ease: 'linear' }} className="absolute h-36 w-36 rounded-full border border-slate-400 border-t-blue-500 dark:border-white/45 dark:border-t-blue-400" />
      <div className="relative grid place-items-center">
        <div className="absolute h-24 w-24 rounded-full bg-blue-500/15 blur-2xl" />
        <div className="relative grid h-20 w-20 place-items-center rounded-2xl border border-white/15 bg-gradient-to-br from-amber-500/25 via-violet-500/35 to-cyan-500/30 shadow-[0_0_40px_rgba(79,70,229,0.45)]">
          <Zap className="h-7 w-7 text-cyan-300" />
        </div>
        <div className="mt-5 text-sm font-black uppercase tracking-wide text-slate-950 dark:text-white">
          {t('aiQuant.homepage.visual.deployAction')}
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 5: Replace plaza visual with floating cards**

Create `StrategyPlazaVisual` with a highlighted performance card and background strategy cards. Keep dimensions stable with `aspect-[1.22]`:

```tsx
function StrategyPlazaVisual() {
  const { t } = useTranslation()

  const backgroundCards = [
    { label: t('aiQuant.homepage.visual.plaza.grid'), value: '95%', className: 'left-10 top-14 -rotate-6 opacity-55' },
    { label: t('aiQuant.homepage.visual.plaza.reversion'), value: 'Ready', className: 'bottom-10 left-14 rotate-[-2deg] opacity-60' },
    { label: t('aiQuant.homepage.visual.plaza.breakout'), value: '+8.3%', className: 'right-10 top-20 rotate-6 opacity-55' },
  ]

  return (
    <div className="relative mx-auto aspect-[1.22] w-full max-w-[560px] overflow-hidden rounded-2xl border border-slate-200/80 bg-slate-100/75 shadow-[0_24px_80px_rgba(15,23,42,0.08)] dark:border-white/[0.04] dark:bg-[#090713] dark:shadow-[0_32px_120px_rgba(0,0,0,0.4)]">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_45%_38%,rgba(68,92,255,0.22),transparent_38%)] dark:bg-[radial-gradient(circle_at_45%_38%,rgba(68,92,255,0.18),transparent_40%)]" />
      {backgroundCards.map(card => (
        <motion.div
          key={card.label}
          animate={{ y: [0, -8, 0] }}
          transition={{ duration: 5, repeat: Infinity, ease: 'easeInOut' }}
          className={`absolute w-40 rounded-xl border border-slate-300/70 bg-white/65 p-4 backdrop-blur-xl dark:border-white/[0.06] dark:bg-[#131824]/80 ${card.className}`}
        >
          <div className="text-[10px] font-bold text-slate-500 dark:text-white/35">{card.label}</div>
          <div className="mt-4 text-xl font-black text-emerald-500">{card.value}</div>
          <div className="mt-4 flex h-8 items-end gap-1">
            {[20, 38, 52, 28, 46].map((height, index) => (
              <span key={`${height}-${index}`} style={{ height }} className="w-2 rounded-t bg-emerald-500/55" />
            ))}
          </div>
        </motion.div>
      ))}
      <motion.div
        whileHover={{ y: -4 }}
        className="absolute left-1/2 top-1/2 w-56 -translate-x-1/2 -translate-y-1/2 rounded-xl border border-slate-300 bg-white/80 p-6 shadow-[0_24px_70px_rgba(15,23,42,0.16)] backdrop-blur-xl dark:border-white/65 dark:bg-[#151c2a]/90 dark:shadow-[0_30px_90px_rgba(0,0,0,0.45)]"
      >
        <div className="flex items-center justify-between">
          <div>
            <div className="text-sm font-bold text-slate-950 dark:text-white">{t('aiQuant.homepage.visual.plaza.trend')}</div>
            <div className="mt-1 text-[11px] text-slate-500 dark:text-white/45">{t('aiQuant.homepage.visual.plaza.template')}</div>
          </div>
          <div className="grid h-8 w-8 place-items-center rounded-lg border border-blue-500/35 bg-blue-500/10 text-blue-600 dark:text-blue-300">
            <Star className="h-4 w-4" />
          </div>
        </div>
        <div className="mt-5 text-3xl font-black text-emerald-500">+12.5%</div>
        <div className="mt-5 flex h-10 items-end gap-1.5">
          {[20, 34, 46, 24, 40, 52, 48].map((height, index) => (
            <span key={`${height}-${index}`} style={{ height }} className={`w-3 rounded-t ${index === 3 ? 'bg-red-400/70' : 'bg-emerald-500/75'}`} />
          ))}
        </div>
      </motion.div>
    </div>
  )
}
```

Add `Star` to the `lucide-react` import list if it is not already imported.

- [ ] **Step 6: Wire `FeatureVisual` to the new visual component names**

Use:

```tsx
function FeatureVisual({ featureKey }: { featureKey: FeatureKey }) {
  if (featureKey === 'conversation') return <ConversationStrategyVisual />
  if (featureKey === 'backtest') return <BacktestResultVisual />
  if (featureKey === 'deploy') return <DeployOrbitVisual />
  return <StrategyPlazaVisual />
}
```

- [ ] **Step 7: Commit feature visuals**

Run:

```bash
git add apps/front/src/components/ai-quant/AiQuantMarketingHome.tsx
git commit -F - <<'MSG'
feat: recreate AI Quant homepage feature visuals

Refs: #879
MSG
```

## Task 6: Final CTA, Responsiveness, And Light Theme Polish

**Files:**
- Modify: `apps/front/src/components/ai-quant/AiQuantMarketingHome.tsx`

- [ ] **Step 1: Rewrite `FinalCtaSection`**

Use a centered panel similar to the last screenshot:

```tsx
function FinalCtaSection({ ctaHref }: { ctaHref: string }) {
  const { t } = useTranslation()

  return (
    <section className={sectionShell}>
      <motion.div initial="hidden" whileInView="visible" viewport={{ once: true, margin: '-80px' }} variants={revealUp} transition={revealTransition} className={`mx-auto max-w-4xl rounded-2xl px-8 py-12 text-center md:px-20 md:py-14 ${panelClass}`}>
        <h2 className="text-2xl font-black text-slate-950 dark:text-white md:text-3xl">
          {t('aiQuant.homepage.final.title')}
        </h2>
        <p className={`mx-auto mt-5 max-w-2xl text-sm leading-7 ${mutedText}`}>
          {t('aiQuant.homepage.final.description')}
        </p>
        <div className="mt-8">
          <PrimaryCta href={ctaHref} label={t('aiQuant.homepage.finalCta')} />
        </div>
      </motion.div>
    </section>
  )
}
```

- [ ] **Step 2: Update `PrimaryCta` to match the reference button**

Use:

```tsx
function PrimaryCta({ href, className = '', label }: { href: string, className?: string, label: string }) {
  return (
    <Link
      href={href}
      className={`group inline-flex min-h-12 items-center justify-center gap-2 rounded-lg bg-gradient-to-r from-[#3474ff] to-[#8a55ff] px-7 py-3 text-sm font-bold text-white shadow-[0_14px_40px_rgba(79,70,229,0.35)] transition duration-200 hover:-translate-y-0.5 hover:shadow-[0_18px_54px_rgba(79,70,229,0.48)] active:translate-y-0 ${className}`}
    >
      {label}
      <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
    </Link>
  )
}
```

- [ ] **Step 3: Audit mobile dimensions in the component**

Ensure all large visuals use one of these constraints:

```tsx
className="mx-auto w-full max-w-[520px]"
className="aspect-[1.22]"
className="min-h-[320px]"
className="overflow-hidden"
```

Expected: no visual extends past the viewport at 390px width.

- [ ] **Step 4: Commit final polish**

Run:

```bash
git add apps/front/src/components/ai-quant/AiQuantMarketingHome.tsx
git commit -F - <<'MSG'
feat: polish AI Quant homepage CTA and responsiveness

Refs: #879
MSG
```

## Task 7: Verification And Visual Acceptance

**Files:**
- Verify: `apps/front/src/components/ai-quant/AiQuantMarketingHome.tsx`
- Verify: `apps/front/public/locales/zh/common.json`
- Verify: `apps/front/public/locales/en/common.json`

- [ ] **Step 1: Run locale JSON validation**

Run:

```bash
node -e "for (const f of ['apps/front/public/locales/zh/common.json','apps/front/public/locales/en/common.json']) JSON.parse(require('fs').readFileSync(f,'utf8')); console.log('locale json ok')"
```

Expected:

```text
locale json ok
```

- [ ] **Step 2: Run frontend lint**

Run:

```bash
dx lint
```

Expected: command exits successfully. If unrelated existing lint errors appear, record them and still fix any errors caused by the touched files.

- [ ] **Step 3: Start frontend**

Run:

```bash
dx start front --dev
```

Expected: frontend is available on port `3001`.

- [ ] **Step 4: Inspect pages in browser**

Check:

```text
http://localhost:3001/zh
http://localhost:3001/en
```

Expected:

- Dark mode resembles the supplied screenshots in layout, colors, card style, and visual illustrations.
- Light mode is intentionally styled and readable.
- Hero, workflow, four features, advantages, and final CTA all render.
- CTA links navigate to `/zh/ai-quant` and `/en/ai-quant`.

- [ ] **Step 5: Inspect responsive widths**

Use desktop and mobile viewport checks:

```text
1440 x 900
1065 x 512
390 x 844
```

Expected: no clipped text, no horizontal scroll, no overlapping visual panels.

- [ ] **Step 6: Final visual correction pass**

Compare against the provided screenshots and adjust only these high-impact details if needed:

```text
hero vertical spacing
heading size and line-height
blue/violet glow strength
card border opacity
feature visual scale
section padding
```

Expected: the page reads as a faithful recreation, not as the previous dashboard-heavy version.

- [ ] **Step 7: Commit verification polish if changes were made**

Run only if Step 6 changed files:

```bash
git add apps/front/src/components/ai-quant/AiQuantMarketingHome.tsx apps/front/public/locales/zh/common.json apps/front/public/locales/en/common.json
git commit -F - <<'MSG'
fix: polish AI Quant homepage visual fidelity

Refs: #879
MSG
```

## Self-Review

Spec coverage:

- Screenshot-faithful dark theme: Tasks 2, 3, 4, 5, 6, and 7.
- Light theme: Tasks 2, 6, and 7.
- Chinese and English copy: Task 1.
- Code-built visuals: Task 5.
- Motion: Tasks 3, 4, 5, and 6.
- CTA route preservation: Tasks 2 and 7.
- Responsive verification: Tasks 4, 6, and 7.

Placeholder scan:

- No task is left without a concrete owner, file path, command, or JSX example where code is required.
- Every visual component has concrete JSX or an exact wiring instruction.

Type consistency:

- `FeatureKey`, `AdvantageKey`, `workflowKeys`, `featureKeys`, and `advantageKeys` remain the existing names.
- New local visual names are consistently referenced by `FeatureVisual`.
