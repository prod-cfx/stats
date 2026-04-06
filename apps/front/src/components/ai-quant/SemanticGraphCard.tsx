import type { LlmSemanticGraph } from '@/lib/api'

interface SemanticGraphCardProps {
  semanticGraph: LlmSemanticGraph
}

export function SemanticGraphCard({ semanticGraph }: SemanticGraphCardProps) {
  return (
    <section className="rounded-2xl border border-[color:var(--cf-border)] bg-[color:var(--cf-surface)] p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-[color:var(--cf-text-strong)]">
            Semantic Graph
          </h2>
          <p className="mt-1 text-xs text-[color:var(--cf-muted)]">
            v{semanticGraph.version} · {semanticGraph.market.symbol} · {semanticGraph.market.primaryTimeframe}
          </p>
        </div>
        <div className="flex flex-wrap gap-2 text-xs text-[color:var(--cf-muted)]">
          <span className="rounded border border-[color:var(--cf-border)] px-2 py-1">
            nodes {semanticGraph.nodes.length}
          </span>
          <span className="rounded border border-[color:var(--cf-border)] px-2 py-1">
            actions {semanticGraph.actions.length}
          </span>
          <span className="rounded border border-[color:var(--cf-border)] px-2 py-1">
            risk {semanticGraph.risk.length}
          </span>
        </div>
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-3">
        <div className="rounded-xl border border-[color:var(--cf-border)] bg-[color:var(--cf-bg)] p-3">
          <p className="text-xs font-bold text-amber-400">NODES</p>
          <div className="mt-2 space-y-2">
            {semanticGraph.nodes.map(node => (
              <div key={node.id} className="text-sm text-[color:var(--cf-text)]">
                {node.phase} · {node.kind}
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-xl border border-[color:var(--cf-border)] bg-[color:var(--cf-bg)] p-3">
          <p className="text-xs font-bold text-sky-400">ACTIONS</p>
          <div className="mt-2 space-y-2">
            {semanticGraph.actions.map(action => (
              <div key={action.id} className="text-sm text-[color:var(--cf-text)]">
                {action.kind} · {action.sizePct}%
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-xl border border-[color:var(--cf-border)] bg-[color:var(--cf-bg)] p-3">
          <p className="text-xs font-bold text-emerald-400">RISK</p>
          <div className="mt-2 space-y-2">
            {semanticGraph.risk.length > 0
              ? semanticGraph.risk.map(item => (
                  <div key={item.id} className="text-sm text-[color:var(--cf-text)]">
                    {item.kind} · {item.valuePct}% · {item.effect}
                  </div>
                ))
              : <div className="text-sm text-[color:var(--cf-muted)]">No risk nodes</div>}
          </div>
        </div>
      </div>
    </section>
  )
}
