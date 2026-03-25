'use client'

import { Pencil, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'

interface ConversationItem {
  id: string
  title: string
  updatedAt: number
}

interface ConversationSidebarProps {
  items: ConversationItem[]
  activeId: string
  onSwitch: (id: string) => void
  onCreate: () => void
  onRename: (id: string, title: string) => void
  onDelete: (id: string) => void
}

function formatTime(ts: number) {
  const d = new Date(ts)
  const hh = String(d.getHours()).padStart(2, '0')
  const mm = String(d.getMinutes()).padStart(2, '0')
  return `${hh}:${mm}`
}

export function ConversationSidebar({ items, activeId, onSwitch, onCreate, onRename, onDelete }: ConversationSidebarProps) {
  const { t } = useTranslation()
  const [editingId, setEditingId] = useState<string | null>(null)
  const [draftTitle, setDraftTitle] = useState('')

  return (
    <aside className="rounded-2xl border border-[color:var(--cf-border)] bg-[color:var(--cf-surface)] p-3">
      <button
        type="button"
        onClick={onCreate}
        className="mb-3 w-full rounded-xl bg-gradient-to-r from-violet-500 to-purple-600 px-3 py-2 text-sm font-bold text-white transition-all hover:from-violet-600 hover:to-purple-700"
      >
        {t('aiQuant.createChat')}
      </button>

      <div className="space-y-2">
        {items.map(item => {
          const active = item.id === activeId
          return (
            <div
              key={item.id}
              className={`w-full rounded-xl border px-3 py-2 text-left transition ${
                active
                  ? 'border-violet-500/40 bg-violet-500/10'
                  : 'border-[color:var(--cf-border)] bg-[color:var(--cf-bg)] hover:bg-[color:var(--cf-surface-hover)]'
              }`}
            >
              {editingId === item.id ? (
                <input
                  autoFocus
                  value={draftTitle}
                  onChange={event => setDraftTitle(event.target.value)}
                  onBlur={() => {
                    const next = draftTitle.trim()
                    if (next) onRename(item.id, next)
                    setEditingId(null)
                  }}
                  onKeyDown={event => {
                    if (event.key === 'Enter') {
                      const next = draftTitle.trim()
                      if (next) onRename(item.id, next)
                      setEditingId(null)
                    }
                    if (event.key === 'Escape') setEditingId(null)
                  }}
                  className="h-8 w-full rounded-lg border border-[color:var(--cf-border)] bg-[color:var(--cf-surface)] px-2 text-sm text-[color:var(--cf-text)]"
                />
              ) : (
                <button
                  type="button"
                  onClick={() => onSwitch(item.id)}
                  className="w-full truncate text-left text-sm font-semibold text-[color:var(--cf-text-strong)]"
                >
                  {item.title}
                </button>
              )}
              <div className="mt-1 text-xs text-[color:var(--cf-muted)]">{t('aiQuant.updatedAt')} {formatTime(item.updatedAt)}</div>
              <div className="mt-2 flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setEditingId(item.id)
                    setDraftTitle(item.title)
                  }}
                  className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-[color:var(--cf-border)] text-[color:var(--cf-muted)] hover:text-[color:var(--cf-text-strong)]"
                  aria-label={t('common.rename', { defaultValue: 'Rename' })}
                >
                  <Pencil className="h-3.5 w-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => onDelete(item.id)}
                  className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-[color:var(--cf-border)] text-[color:var(--cf-muted)] hover:text-red-400"
                  aria-label={t('common.delete', { defaultValue: 'Delete' })}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          )
        })}
      </div>
    </aside>
  )
}
