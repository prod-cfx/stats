import type { DisplayBlock, DisplayExecuteItem, DisplayLogicGraph } from './display-logic-graph'
import { useTranslation } from 'react-i18next'
import { localizeDisplayLogicGraph } from './display-logic-graph'

interface DisplayLogicGraphPreviewProps {
  graph: DisplayLogicGraph
  onConfirm: () => void
  onRevise: () => void
  confirmDisabled?: boolean
  confirmed?: boolean
  publishedSnapshotId?: string | null
}

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
  publishedSnapshotId = null,
}: DisplayLogicGraphPreviewProps) {
  const { t, i18n } = useTranslation()
  const locale = (i18n?.resolvedLanguage ?? i18n?.language ?? 'zh').toLowerCase().startsWith('en')
    ? 'en'
    : 'zh'
  const localizedGraph = localizeDisplayLogicGraph(graph, locale)
  const normalizedSnapshotId = typeof publishedSnapshotId === 'string'
    ? publishedSnapshotId.trim()
    : ''

  return (
    <section className="rounded-2xl border border-[color:var(--cf-border)] bg-[color:var(--cf-surface)] px-5 py-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="!text-[15px] !font-semibold !leading-[22px] text-[color:var(--cf-text-strong)]">
            {t('aiQuant.messages.graphTitle')}
          </h2>
        </div>
      </div>

      <div className="mt-4 space-y-3">
        {localizedGraph.blocks.map(block => (
          <div key={`${block.type}-${block.items[0]?.id ?? 'block'}`} className="rounded-2xl border border-[color:var(--cf-border)] bg-[color:var(--cf-bg)] px-3 py-2">
            <p className="!text-xs !font-semibold !leading-5 uppercase tracking-[0.2em] text-[color:var(--cf-muted)]">
              {getBlockHeading(block.type)}
            </p>

            {block.type === 'EXECUTE'
              ? (
                  <div className="mt-3 flex flex-wrap gap-2 !text-xs !font-normal !leading-5 text-[color:var(--cf-muted)]">
                    {block.items.filter(isExecuteItem).map(item => (
                      <span key={item.id} className="rounded border border-[color:var(--cf-border)] px-2 py-1">
                        {getExecuteLabel(item)}
                      </span>
                    ))}
                  </div>
                )
              : (
                  <div className="mt-3 space-y-3 rounded-2xl border border-[color:var(--cf-border)] bg-[color:var(--cf-surface)] px-3 py-2">
                    {block.items.some(item => item.kind === 'condition') && (
                      <div>
                        <p className="!text-xs !font-semibold !leading-5 text-amber-400">IF</p>
                        <div className="mt-2 space-y-2">
                          {block.items
                            .filter(item => item.kind === 'condition')
                            .map(item => (
                              <div key={item.id} className="!text-sm !leading-[22px] text-[color:var(--cf-text)]">
                                {item.text}
                              </div>
                            ))}
                        </div>
                      </div>
                    )}

                    {block.items.some(item => item.kind === 'action') && (
                      <div>
                        <p className="!text-xs !font-semibold !leading-5 text-sky-400">THEN</p>
                        <div className="mt-2 space-y-2">
                          {block.items
                            .filter(item => item.kind === 'action')
                            .map(item => (
                              <div key={item.id} className="!text-sm !leading-[22px] text-[color:var(--cf-text)]">
                                {item.text}
                              </div>
                            ))}
                        </div>
                      </div>
                    )}
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
          className={`rounded-full px-3.5 py-1.5 !text-xs !font-semibold !leading-5 text-white ${
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
          className="rounded-full border border-[color:var(--cf-border)] px-3.5 py-1.5 !text-xs !font-semibold !leading-5 text-[color:var(--cf-text-strong)]"
        >
          {t('aiQuant.messages.returnRevise')}
        </button>
      </div>

      {confirmed && normalizedSnapshotId && (
        <div className="mt-3 rounded-lg border border-[color:var(--cf-border)] bg-[color:var(--cf-bg)] px-3 py-2 !text-xs !font-normal !leading-5 text-[color:var(--cf-muted)]">
          <span className="!font-semibold text-[color:var(--cf-text-strong)]">
            {t('aiQuant.messages.snapshotId')}
          </span>
          <span className="mx-1">:</span>
          <span className="break-all font-mono">{normalizedSnapshotId}</span>
        </div>
      )}
    </section>
  )
}
