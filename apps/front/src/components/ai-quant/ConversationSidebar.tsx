'use client'

import { CheckCircle2, ChevronDown, Pencil, Trash2, X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
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
  mobileTrigger?: 'inline' | 'external'
  mobileSheetOpen?: boolean
  onMobileSheetOpenChange?: (open: boolean) => void
}

function formatTime(ts: number) {
  const d = new Date(ts)
  const hh = String(d.getHours()).padStart(2, '0')
  const mm = String(d.getMinutes()).padStart(2, '0')
  return `${hh}:${mm}`
}

function getHistoryCount(items: ConversationItem[]) {
  return Math.max(0, items.length - 1)
}

function getMobileSummary(t: ReturnType<typeof useTranslation>['t'], items: ConversationItem[]) {
  return t('aiQuant.mobileCurrentSessionSummary', {
    count: getHistoryCount(items),
    defaultValue: `当前会话 · ${getHistoryCount(items)} 个历史会话收起`,
  })
}

interface ConversationListItemProps {
  item: ConversationItem
  active: boolean
  editing: boolean
  draftTitle: string
  focusOnEdit: boolean
  t: ReturnType<typeof useTranslation>['t']
  onDraftTitleChange: (title: string) => void
  onBeginRename: (item: ConversationItem) => void
  onCancelRename: () => void
  onCommitRename: (item: ConversationItem) => void
  onDelete: (id: string) => void
  onSwitch: (id: string) => void
  mobileDrawer?: boolean
}

function ConversationListItem({
  item,
  active,
  editing,
  draftTitle,
  focusOnEdit,
  t,
  onDraftTitleChange,
  onBeginRename,
  onCancelRename,
  onCommitRename,
  onDelete,
  onSwitch,
  mobileDrawer = false,
}: ConversationListItemProps) {
  const inputRef = useRef<HTMLInputElement | null>(null)

  useEffect(() => {
    if (!editing || !focusOnEdit) return

    inputRef.current?.focus()
    inputRef.current?.select()
  }, [editing, focusOnEdit, item.id])

  return (
    <div
      data-testid={`conversation-item-${item.id}`}
      data-active-conversation={active ? 'true' : undefined}
      className={`w-full rounded-xl border px-3 py-2 text-left transition ${
        mobileDrawer
          ? active
            ? 'border-violet-400 bg-violet-500/10 shadow-sm shadow-violet-500/10'
            : 'border-[color:var(--cf-border)] bg-[color:var(--cf-bg)] hover:bg-[color:var(--cf-surface-hover)]'
          : active
            ? 'border-violet-400 bg-violet-500/10 shadow-sm shadow-violet-500/10 dark:border-violet-500/50 dark:bg-violet-500/15'
            : 'border-[color:var(--cf-border)] bg-[color:var(--cf-bg)] hover:bg-[color:var(--cf-surface-hover)]'
      }`}
    >
      {editing ? (
        <input
          ref={inputRef}
          data-testid={`conversation-title-input-${item.id}`}
          value={draftTitle}
          onChange={event => onDraftTitleChange(event.target.value)}
          onClick={event => event.stopPropagation()}
          onBlur={() => onCommitRename(item)}
          onKeyDown={event => {
            event.stopPropagation()
            if (event.key === 'Enter') {
              onCommitRename(item)
            }
            if (event.key === 'Escape') {
              onCancelRename()
            }
          }}
          className="h-8 w-full rounded-lg border border-[color:var(--cf-border)] bg-[color:var(--cf-surface)] px-2 text-sm text-[color:var(--cf-text)]"
        />
      ) : (
        <button
          type="button"
          data-testid={`conversation-switch-${item.id}`}
          onClick={() => onSwitch(item.id)}
          className="block w-full min-w-0 rounded-lg text-left focus:outline-none focus:ring-2 focus:ring-primary/40"
        >
          <span className="flex w-full min-w-0 items-start justify-between gap-2">
            <span className={`min-w-0 truncate text-left text-sm font-semibold ${mobileDrawer ? 'text-[color:var(--cf-text-strong)]' : 'text-[color:var(--cf-text-strong)]'}`}>
              {item.title}
            </span>
            {active && (
              <span
                className="mt-0.5 inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full text-violet-600 dark:text-violet-300"
                aria-label={t('aiQuant.current')}
                title={t('aiQuant.current')}
              >
                <CheckCircle2 className="h-4 w-4" />
              </span>
            )}
          </span>
          <span className={`mt-1 block text-xs ${mobileDrawer ? 'text-[color:var(--cf-muted)]' : 'text-[color:var(--cf-muted)]'}`}>{t('aiQuant.updatedAt')} {formatTime(item.updatedAt)}</span>
        </button>
      )}
      <div className="mt-2 flex items-center gap-2">
        <button
          type="button"
          data-testid={`rename-conversation-${item.id}`}
          onClick={() => {
            onBeginRename(item)
          }}
          className={`inline-flex h-7 w-7 items-center justify-center rounded-md border ${mobileDrawer ? 'border-[color:var(--cf-border)] bg-[color:var(--cf-surface)] text-[color:var(--cf-muted)] hover:text-[color:var(--cf-text-strong)]' : 'border-[color:var(--cf-border)] text-[color:var(--cf-muted)] hover:text-[color:var(--cf-text-strong)]'}`}
          aria-label={t('common.rename', { defaultValue: 'Rename' })}
        >
          <Pencil className="h-3.5 w-3.5" />
        </button>
        <button
          type="button"
          data-testid={`delete-conversation-${item.id}`}
          onClick={() => {
            onDelete(item.id)
          }}
          className={`inline-flex h-7 w-7 items-center justify-center rounded-md border ${mobileDrawer ? 'border-[color:var(--cf-border)] bg-[color:var(--cf-surface)] text-[color:var(--cf-muted)] hover:text-red-400' : 'border-[color:var(--cf-border)] text-[color:var(--cf-muted)] hover:text-red-400'}`}
          aria-label={t('common.delete', { defaultValue: 'Delete' })}
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  )
}

export function ConversationSidebar({
  items,
  activeId,
  onSwitch,
  onCreate,
  onRename,
  onDelete,
  mobileTrigger = 'inline',
  mobileSheetOpen: controlledMobileSheetOpen,
  onMobileSheetOpenChange,
}: ConversationSidebarProps) {
  const { t } = useTranslation()
  const [editingId, setEditingId] = useState<string | null>(null)
  const [draftTitle, setDraftTitle] = useState('')
  const [uncontrolledMobileSheetOpen, setUncontrolledMobileSheetOpen] = useState(false)
  const mobileTriggerRef = useRef<HTMLButtonElement | null>(null)
  const mobileCloseButtonRef = useRef<HTMLButtonElement | null>(null)
  const wasMobileSheetOpenRef = useRef(false)
  const mobileSheetTitleId = 'ai-quant-mobile-conversation-sheet-title'
  const activeItem = items.find(item => item.id === activeId) ?? items[0]
  const mobileSheetOpen = controlledMobileSheetOpen ?? uncontrolledMobileSheetOpen
  const setMobileSheetOpen = (open: boolean) => {
    if (controlledMobileSheetOpen === undefined) {
      setUncontrolledMobileSheetOpen(open)
    }
    onMobileSheetOpenChange?.(open)
  }

  useEffect(() => {
    if (!mobileSheetOpen) return

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setMobileSheetOpen(false)
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [mobileSheetOpen])

  useEffect(() => {
    if (mobileSheetOpen) {
      wasMobileSheetOpenRef.current = true
      mobileCloseButtonRef.current?.focus()
      return
    }

    if (wasMobileSheetOpenRef.current) {
      wasMobileSheetOpenRef.current = false
      mobileTriggerRef.current?.focus()
    }
  }, [mobileSheetOpen])

  const beginRename = (item: ConversationItem) => {
    setEditingId(item.id)
    setDraftTitle(item.title)
  }

  const commitRename = (item: ConversationItem) => {
    const next = draftTitle.trim()
    if (next) onRename(item.id, next)
    setEditingId(null)
  }

  const switchConversation = (id: string, closeMobile = false) => {
    onSwitch(id)
    if (closeMobile) setMobileSheetOpen(false)
  }

  const createConversation = () => {
    onCreate()
    setMobileSheetOpen(false)
  }

  return (
    <>
      <div className="md:hidden">
        {mobileTrigger === 'inline' && (
          <button
            type="button"
            ref={mobileTriggerRef}
            data-testid="mobile-conversation-trigger"
            onClick={() => setMobileSheetOpen(true)}
            className="md:hidden flex min-h-12 w-full items-center justify-between gap-3 rounded-2xl border border-[color:var(--cf-border)] bg-[color:var(--cf-surface)] px-3 py-2 text-left shadow-sm"
          >
            <span className="min-w-0">
              <span className="block truncate text-sm font-bold text-[color:var(--cf-text-strong)]">
                {activeItem?.title ?? t('aiQuant.newChat')}
              </span>
              <span className="mt-0.5 block truncate text-xs text-[color:var(--cf-muted)]">
                {getMobileSummary(t, items)}
              </span>
            </span>
            <ChevronDown className="h-4 w-4 shrink-0 text-[color:var(--cf-muted)]" />
          </button>
        )}

        {mobileSheetOpen && (
          <div
            data-testid="mobile-conversation-sheet"
            className="cf-side-drawer-backdrop fixed inset-0 z-[80] flex items-stretch md:hidden"
            role="dialog"
            aria-modal="true"
            aria-labelledby={mobileSheetTitleId}
            onClick={() => setMobileSheetOpen(false)}
          >
            <div
              className="cf-side-drawer-panel h-full w-[86vw] max-w-[360px] overflow-hidden rounded-r-[28px] p-4 pt-[calc(env(safe-area-inset-top)+1rem)] pb-[calc(env(safe-area-inset-bottom)+1rem)]"
              onClick={event => event.stopPropagation()}
            >
              <div className="mb-4 flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h2 id={mobileSheetTitleId} className="text-lg font-bold text-[color:var(--cf-text-strong)]">
                    {t('aiQuant.conversationSelector', { defaultValue: '选择会话' })}
                  </h2>
                  <div className="mt-0.5 text-xs text-[color:var(--cf-muted)]">
                    {getMobileSummary(t, items)}
                  </div>
                </div>
                <button
                  type="button"
                  ref={mobileCloseButtonRef}
                  onClick={() => setMobileSheetOpen(false)}
                  className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-[color:var(--cf-border)] bg-[color:var(--cf-surface)] text-[color:var(--cf-muted)] shadow-sm hover:text-[color:var(--cf-text-strong)]"
                  aria-label={t('common.close', { defaultValue: 'Close' })}
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <button
                type="button"
                data-testid="mobile-create-conversation"
                onClick={createConversation}
                className="mb-3 min-h-11 w-full rounded-xl bg-gradient-to-r from-[#3f6fff] to-[#8b5cf6] px-3 text-sm font-bold text-white shadow-sm transition-all"
              >
                {t('aiQuant.createChat')}
              </button>

              <div className="max-h-[calc(100dvh-9.5rem)] space-y-2 overflow-y-auto pr-1">
                {items.map(item => (
                  <ConversationListItem
                    key={item.id}
                    item={item}
                    active={item.id === activeId}
                    editing={editingId === item.id}
                    draftTitle={draftTitle}
                    focusOnEdit
                    t={t}
                    onDraftTitleChange={setDraftTitle}
                    onBeginRename={beginRename}
                    onCancelRename={() => setEditingId(null)}
                    onCommitRename={commitRename}
                    onDelete={onDelete}
                    onSwitch={id => switchConversation(id, true)}
                    mobileDrawer
                  />
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      <aside className="hidden max-h-[42dvh] overflow-hidden rounded-2xl border border-[color:var(--cf-border)] bg-[color:var(--cf-surface)] p-3 md:block md:max-h-none">
        <button
          type="button"
          onClick={onCreate}
          className="cf-primary-cta mb-3 min-h-11 w-full rounded-xl px-3 text-sm font-bold transition-all"
        >
          {t('aiQuant.createChat')}
        </button>

        <div data-testid="conversation-sidebar-list" className="max-h-[calc(42dvh-4rem)] space-y-2 overflow-y-auto pr-1 md:max-h-none md:overflow-visible md:pr-0">
          {items.map(item => (
            <ConversationListItem
              key={item.id}
              item={item}
              active={item.id === activeId}
              editing={editingId === item.id}
              draftTitle={draftTitle}
              focusOnEdit={!mobileSheetOpen}
              t={t}
              onDraftTitleChange={setDraftTitle}
              onBeginRename={beginRename}
              onCancelRename={() => setEditingId(null)}
              onCommitRename={commitRename}
              onDelete={onDelete}
              onSwitch={id => switchConversation(id)}
            />
          ))}
        </div>
      </aside>
    </>
  )
}
