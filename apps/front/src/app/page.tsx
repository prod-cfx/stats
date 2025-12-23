import { getHomePageData } from '@/services/home-service'

export default async function HomePage() {
  const data = await getHomePageData()

  return (
    <div className="min-h-screen bg-[#05070b] text-slate-50">
      {/* 顶部简单导航 */}
      <header className="border-b border-white/5 bg-black/30 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4">
          <div className="flex items-center gap-2">
            <span className="h-8 w-8 rounded-lg bg-gradient-to-br from-blue-500 to-violet-500" />
            <span className="text-sm font-semibold tracking-wide text-slate-100">
              Coinflux Stats
            </span>
          </div>
          <div className="hidden gap-4 text-xs text-slate-300 sm:flex">
            <span>数据聚合</span>
            <span>策略分析</span>
            <span>风险监控</span>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 pb-16 pt-8 space-y-16">
        {/* Hero */}
        <section className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-[#396bff] to-[#8b5cff] p-[1px]">
          <div className="relative flex flex-col gap-6 rounded-2xl bg-[#05070b]/95 px-6 py-10 sm:px-10 sm:py-14">
            <div className="max-w-xl space-y-4">
              <p className="text-xs font-medium uppercase tracking-[0.3em] text-slate-300">
                数据聚合 · 分析脚手架
              </p>
              <h1 className="text-balance text-3xl font-semibold tracking-tight sm:text-4xl">
                {data.hero.title}
              </h1>
              <p className="text-sm leading-relaxed text-slate-200 sm:text-base">
                {data.hero.subtitle}
              </p>
            </div>

            <div className="flex flex-wrap gap-3">
              <a
                href={data.hero.primaryAction.href}
                className="inline-flex items-center justify-center rounded-full bg-white px-4 py-2 text-xs font-medium text-slate-900 shadow-sm hover:bg-slate-100"
              >
                {data.hero.primaryAction.label}
              </a>
              <a
                href={data.hero.secondaryAction.href}
                className="inline-flex items-center justify-center rounded-full border border-white/20 px-4 py-2 text-xs font-medium text-slate-100 hover:border-white/40"
              >
                {data.hero.secondaryAction.label}
              </a>
            </div>
          </div>
        </section>

        {/* Why */}
        <section className="space-y-6">
          <div className="space-y-2">
            <h2 className="text-lg font-semibold text-slate-50">
              {data.whyCoinflux.title}
            </h2>
            <p className="text-sm text-slate-300">{data.whyCoinflux.subtitle}</p>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            {data.whyCoinflux.items.map(item => (
              <div
                key={item.title}
                className="flex h-full flex-col gap-3 rounded-xl border border-white/5 bg-slate-950/60 p-4"
              >
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-medium text-slate-100">{item.title}</p>
                </div>
                <div className="grid gap-3 text-xs text-slate-300 sm:grid-cols-2">
                  <div>
                    <p className="mb-1 font-semibold text-slate-200">
                      {item.painPointsTitle}
                    </p>
                    <ul className="space-y-1">
                      {item.painPoints.map(point => (
                        <li key={point} className="flex gap-2">
                          <span className="mt-[5px] h-[3px] w-[3px] rounded-full bg-slate-500" />
                          <span>{point}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                  <div>
                    <p className="mb-1 font-semibold text-slate-200">
                      {item.solutionTitle}
                    </p>
                    <ul className="space-y-1">
                      {item.solutions.map(point => (
                        <li key={point} className="flex gap-2">
                          <span className="mt-[5px] h-[3px] w-[3px] rounded-full bg-emerald-400" />
                          <span>{point}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Features */}
        <section className="space-y-6">
          <div className="space-y-2">
            <h2 className="text-lg font-semibold text-slate-50">
              {data.features.title}
            </h2>
            <p className="text-sm text-slate-300">{data.features.subtitle}</p>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            {data.features.items.map(feature => (
              <div
                key={feature.title}
                className="flex gap-3 rounded-xl border border-white/5 bg-slate-950/60 p-4"
              >
                <div className={`mt-1 flex h-9 w-9 items-center justify-center rounded-lg text-xs ${feature.iconColor}`}>
                  {/* 这里不渲染真实图片，只用图标色块占位 */}
                  <span className="text-[10px] font-semibold uppercase tracking-[0.15em]">
                    UI
                  </span>
                </div>
                <div className="space-y-1">
                  <p className="text-sm font-medium text-slate-100">{feature.title}</p>
                  <p className="text-xs text-slate-300">{feature.description}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Roadmap */}
        <section className="space-y-6">
          <div className="space-y-2">
            <h2 className="text-lg font-semibold text-slate-50">
              {data.roadmap.title}
            </h2>
            <p className="text-sm text-slate-300">{data.roadmap.subtitle}</p>
          </div>
          <ol className="space-y-3 border-l border-white/10 pl-4">
            {data.roadmap.items.map(phase => (
              <li key={phase.phase} className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="h-2 w-2 -translate-x-[9px] rounded-full bg-sky-400" />
                  <span className={`text-[11px] font-semibold uppercase tracking-[0.15em] ${phase.color}`}>
                    {phase.phase}
                  </span>
                </div>
                <p className="text-sm font-medium text-slate-100">{phase.title}</p>
                <ul className="mt-1 space-y-1 text-xs text-slate-300">
                  {phase.items.map(item => (
                    <li key={item} className="flex gap-2">
                      <span className="mt-[5px] h-[3px] w-[3px] rounded-full bg-slate-500" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </li>
            ))}
          </ol>
        </section>

        {/* CTA */}
        <section className="rounded-2xl border border-sky-500/40 bg-sky-950/40 px-6 py-8">
          <div className="space-y-3">
            <h2 className="text-lg font-semibold text-slate-50">
              {data.cta.title}
            </h2>
            <p className="text-sm text-slate-200">{data.cta.description}</p>
          </div>
          <div className="mt-5 flex flex-wrap gap-3">
            <a
              href={data.cta.primaryAction.href}
              className="inline-flex items-center justify-center rounded-full bg-sky-500 px-4 py-2 text-xs font-medium text-slate-950 shadow-sm hover:bg-sky-400"
            >
              {data.cta.primaryAction.label}
            </a>
            <a
              href={data.cta.secondaryAction.href}
              className="inline-flex items-center justify-center rounded-full border border-sky-400/60 px-4 py-2 text-xs font-medium text-sky-100 hover:border-sky-300"
            >
              {data.cta.secondaryAction.label}
            </a>
          </div>
        </section>
      </main>

      {/* 页脚 */}
      <footer className="border-t border-white/5 bg-black/40">
        <div className="mx-auto flex max-w-6xl flex-col gap-6 px-4 py-6 text-xs text-slate-400 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-1">
            <p className="font-medium text-slate-200">Coinflux Stats</p>
            <p className="max-w-md text-[11px]">
              针对加密和金融场景的数据聚合与分析脚手架，你可以在此基础上接入自己的后端与网关。
            </p>
          </div>
          <div className="flex flex-wrap gap-6">
            <div>
              <p className="mb-1 text-[11px] font-semibold text-slate-300">
                产品
              </p>
              <ul className="space-y-1">
                {data.footer.productLinks.map(link => (
                  <li key={link.label}>
                    <a href={link.href} className="hover:text-slate-200">
                      {link.label}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <p className="mb-1 text-[11px] font-semibold text-slate-300">
                支持
              </p>
              <ul className="space-y-1">
                {data.footer.supportLinks.map(link => (
                  <li key={link.label}>
                    <a href={link.href} className="hover:text-slate-200">
                      {link.label}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <p className="mb-1 text-[11px] font-semibold text-slate-300">
                集成与生态
              </p>
              <ul className="space-y-1">
                {data.footer.supportedBy.map(name => (
                  <li key={name}>{name}</li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </footer>
    </div>
  )
}
