'use client'

import type { QuantParams } from '@/app/[lng]/ai-quant/AiQuantPageClient'
import { STRATEGY_PRESETS } from './strategy-presets'

interface StrategyPlazaProps {
  onRunStrategy: (strategyId: string, preset: Partial<QuantParams>, presetName: string) => void
  onEditStrategy: (strategyId: string, preset: Partial<QuantParams>, presetName: string) => void
  subtitle?: string
}

export function StrategyPlaza({
  onRunStrategy,
  onEditStrategy,
  subtitle = '从推荐策略开始，或继续在上面对话自定义参数。',
}: StrategyPlazaProps) {
  return (
    <section className="rounded-2xl border border-[color:var(--cf-border)] bg-[color:var(--cf-surface)] p-5">
      <h2 className="text-lg font-semibold text-[color:var(--cf-text-strong)]">策略广场</h2>
      <p className="mt-1 text-sm text-[color:var(--cf-muted)]">{subtitle}</p>

      <div className="mt-4 grid gap-3 md:grid-cols-3">
        {STRATEGY_PRESETS.map(preset => (
          <article
            key={preset.id}
            className="rounded-xl border border-[color:var(--cf-border)] bg-[color:var(--cf-bg)] p-4"
          >
            <h3 className="text-base font-semibold text-[color:var(--cf-text-strong)]">{preset.name}</h3>
            <p className="mt-1 text-sm text-[color:var(--cf-muted)]">{preset.desc}</p>
            <div className="mt-4 grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => onRunStrategy(preset.id, preset.params, preset.name)}
                className="rounded-lg bg-gradient-to-r from-primary to-secondary px-3 py-1.5 text-sm font-semibold text-white"
              >
                运行
              </button>
              <button
                type="button"
                onClick={() => onEditStrategy(preset.id, preset.params, preset.name)}
                className="rounded-lg border border-[color:var(--cf-border)] px-3 py-1.5 text-sm font-semibold text-[color:var(--cf-text-strong)]"
              >
                编辑
              </button>
            </div>
          </article>
        ))}
      </div>
    </section>
  )
}
