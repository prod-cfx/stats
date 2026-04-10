import type { StrategyLogicGraph } from './logic-graph-model'
import { useTranslation } from 'react-i18next'

interface LogicGraphPreviewProps {
  graph: StrategyLogicGraph
  onConfirm: () => void
  onRevise: () => void
  confirmDisabled?: boolean
}

export function LogicGraphPreview({
  graph,
  onConfirm,
  onRevise,
  confirmDisabled = false,
}: LogicGraphPreviewProps) {
  const { t } = useTranslation()
  const executionTags = graph.meta.executionTags?.length
    ? graph.meta.executionTags
    : graph.risk

  return (
    <section className="rounded-2xl border border-[color:var(--cf-border)] bg-[color:var(--cf-surface)] p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-[color:var(--cf-text-strong)]">{t('aiQuant.messages.graphTitle')}</h2>
          <p className="mt-1 text-xs text-[color:var(--cf-muted)]">
            {t('aiQuant.messages.version')} v{graph.version} · {t('aiQuant.messages.status')} {graph.status === 'confirmed' ? t('aiQuant.status.confirmed') : t('aiQuant.status.pending')}
          </p>
        </div>
      </div>

      <div className="mt-4 space-y-3">
        <div className="rounded-xl border border-[color:var(--cf-border)] bg-[color:var(--cf-bg)] p-3">
          <p className="text-xs font-bold text-amber-400">IF</p>
          <div className="mt-2 space-y-2">
            {graph.trigger.map(item => (
              <div key={item.id} className="text-sm text-[color:var(--cf-text)]">
                {item.join && <span className="mr-2 rounded bg-violet-500/15 px-1.5 py-0.5 text-xs text-violet-300">{item.join}</span>}
                {item.subject} {item.operator} {item.value}
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-xl border border-[color:var(--cf-border)] bg-[color:var(--cf-bg)] p-3">
          <p className="text-xs font-bold text-sky-400">THEN</p>
          <div className="mt-2 space-y-2">
            {graph.actions.length > 0
              ? graph.actions.map(item => (
                  <div key={item.id} className="text-sm text-[color:var(--cf-text)]">
                    {item.action} {item.amount} 的 {item.target}
                  </div>
                ))
              : <div className="text-sm text-[color:var(--cf-muted)]">等待策略规则补充</div>}
          </div>
        </div>

        <div className="rounded-xl border border-[color:var(--cf-border)] bg-[color:var(--cf-bg)] p-3">
          <p className="text-xs font-bold text-emerald-400">EXECUTE</p>
          <div className="mt-2 flex flex-wrap gap-2 text-xs text-[color:var(--cf-muted)]">
            <span className="rounded border border-[color:var(--cf-border)] px-2 py-1">{graph.meta.exchange.toUpperCase()}</span>
            <span className="rounded border border-[color:var(--cf-border)] px-2 py-1">{graph.meta.symbol}</span>
            <span className="rounded border border-[color:var(--cf-border)] px-2 py-1">{graph.meta.timeframe}</span>
            {executionTags.map(item => (
              <span key={item} className="rounded border border-[color:var(--cf-border)] px-2 py-1">{item}</span>
            ))}
          </div>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={onConfirm}
          disabled={confirmDisabled}
          className={`rounded-xl px-4 py-2 text-sm font-bold text-white ${
            graph.status === 'confirmed'
              ? 'bg-emerald-600'
              : 'bg-gradient-to-r from-primary to-secondary'
          } disabled:cursor-not-allowed disabled:opacity-60`}
        >
          {graph.status === 'confirmed' ? t('aiQuant.messages.confirmedGraph') : t('aiQuant.messages.confirmGraph')}
        </button>
        <button
          type="button"
          onClick={onRevise}
          className="rounded-xl border border-[color:var(--cf-border)] px-4 py-2 text-sm font-semibold text-[color:var(--cf-text-strong)]"
        >
          {t('aiQuant.messages.returnRevise')}
        </button>
      </div>
    </section>
  )
}
