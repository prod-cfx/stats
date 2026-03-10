import type { StrategyLogicGraph } from './logic-graph-model'

interface LogicGraphPreviewProps {
  graph: StrategyLogicGraph
  onConfirm: () => void
  onRevise: () => void
}

export function LogicGraphPreview({ graph, onConfirm, onRevise }: LogicGraphPreviewProps) {
  return (
    <section className="rounded-2xl border border-[color:var(--cf-border)] bg-[color:var(--cf-surface)] p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-[color:var(--cf-text-strong)]">策略逻辑图确认</h2>
          <p className="mt-1 text-xs text-[color:var(--cf-muted)]">
            版本 v{graph.version} · 状态 {graph.status === 'confirmed' ? '已确认' : '待确认'}
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
            {graph.actions.map(item => (
              <div key={item.id} className="text-sm text-[color:var(--cf-text)]">
                {item.action} {item.amount} 的 {item.target}
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-xl border border-[color:var(--cf-border)] bg-[color:var(--cf-bg)] p-3">
          <p className="text-xs font-bold text-emerald-400">EXECUTE</p>
          <div className="mt-2 flex flex-wrap gap-2 text-xs text-[color:var(--cf-muted)]">
            <span className="rounded border border-[color:var(--cf-border)] px-2 py-1">{graph.meta.exchange.toUpperCase()}</span>
            <span className="rounded border border-[color:var(--cf-border)] px-2 py-1">{graph.meta.symbol}</span>
            <span className="rounded border border-[color:var(--cf-border)] px-2 py-1">{graph.meta.timeframe}</span>
            {graph.risk.map(item => (
              <span key={item} className="rounded border border-[color:var(--cf-border)] px-2 py-1">{item}</span>
            ))}
          </div>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={onConfirm}
          className={`rounded-xl px-4 py-2 text-sm font-bold text-white ${
            graph.status === 'confirmed'
              ? 'bg-emerald-600'
              : 'bg-gradient-to-r from-primary to-secondary'
          }`}
        >
          {graph.status === 'confirmed' ? '已确认，可回测' : '确认并回测'}
        </button>
        <button
          type="button"
          onClick={onRevise}
          className="rounded-xl border border-[color:var(--cf-border)] px-4 py-2 text-sm font-semibold text-[color:var(--cf-text-strong)]"
        >
          返回对话修改
        </button>
      </div>
    </section>
  )
}

