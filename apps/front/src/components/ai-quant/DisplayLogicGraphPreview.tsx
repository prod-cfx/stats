import { useTranslation } from 'react-i18next'
import type { DisplayBlock, DisplayExecuteItem, DisplayLogicGraph } from './display-logic-graph'

interface DisplayLogicGraphPreviewProps {
  graph: DisplayLogicGraph
  onConfirm: () => void
  onRevise: () => void
  confirmDisabled?: boolean
  confirmed?: boolean
}

const EMPTY_THEN_FALLBACK = '等待策略规则补充'

function getBlockHeading(type: DisplayBlock['type']) {
  switch (type) {
    case 'IF':
      return 'IF'
    case 'AND_AT_THEN':
      return 'AND AT THEN'
    case 'OR_THEN':
      return 'OR THEN'
    case 'EXECUTE':
      return 'EXECUTE'
  }
}

function getExecuteLabel(item: DisplayExecuteItem) {
  return item.text
}

function isExecuteItem(item: DisplayBlock['items'][number]): item is DisplayExecuteItem {
  return item.kind === 'execute'
}

export function DisplayLogicGraphPreview({
  graph,
  onConfirm,
  onRevise,
  confirmDisabled = false,
  confirmed = false,
}: DisplayLogicGraphPreviewProps) {
  const { t } = useTranslation()

  return (
    <section className="rounded-2xl border border-[color:var(--cf-border)] bg-[color:var(--cf-surface)] p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-[color:var(--cf-text-strong)]">
            {t('aiQuant.messages.graphTitle')}
          </h2>
        </div>
      </div>

      <div className="mt-4 space-y-3">
        {graph.blocks.map(block => (
          <div key={`${block.type}-${block.items[0]?.id ?? 'block'}`} className="rounded-xl border border-[color:var(--cf-border)] bg-[color:var(--cf-bg)] p-3">
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-[color:var(--cf-muted)]">
              {getBlockHeading(block.type)}
            </p>

            {block.type === 'EXECUTE'
              ? (
                  <div className="mt-3 flex flex-wrap gap-2 text-xs text-[color:var(--cf-muted)]">
                    {block.items.filter(isExecuteItem).map(item => (
                      <span key={item.id} className="rounded border border-[color:var(--cf-border)] px-2 py-1">
                        {getExecuteLabel(item)}
                      </span>
                    ))}
                  </div>
                )
              : (
                  <div className="mt-3 space-y-3 rounded-xl border border-[color:var(--cf-border)] bg-[color:var(--cf-surface)] p-3">
                    <div>
                      <p className="text-xs font-bold text-amber-400">IF</p>
                      <div className="mt-2 space-y-2">
                        {block.items
                          .filter(item => item.kind === 'condition')
                          .map(item => (
                            <div key={item.id} className="text-sm text-[color:var(--cf-text)]">
                              {item.text}
                            </div>
                          ))}
                      </div>
                    </div>

                    <div>
                      <p className="text-xs font-bold text-sky-400">THEN</p>
                      <div className="mt-2 space-y-2">
                        {block.items.some(item => item.kind === 'action')
                          ? block.items
                              .filter(item => item.kind === 'action')
                              .map(item => (
                                <div key={item.id} className="text-sm text-[color:var(--cf-text)]">
                                  {item.text}
                                </div>
                              ))
                          : <div className="text-sm text-[color:var(--cf-muted)]">{EMPTY_THEN_FALLBACK}</div>}
                      </div>
                    </div>
                  </div>
                )}
          </div>
        ))}
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={onConfirm}
          disabled={confirmDisabled}
          className={`rounded-xl px-4 py-2 text-sm font-bold text-white ${
            confirmed
              ? 'bg-emerald-600'
              : 'bg-gradient-to-r from-primary to-secondary'
          } disabled:cursor-not-allowed disabled:opacity-60`}
        >
          {confirmed ? t('aiQuant.messages.confirmedGraph') : t('aiQuant.messages.confirmGraph')}
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
