'use client'

import { useEffect, useRef } from 'react'

export type AiQuantDeletionDialogKind =
  | 'loading'
  | 'unknown'
  | 'running'
  | 'with-conversation'
  | 'no-conversation'

export interface AiQuantDeletionDialogProps {
  open: boolean
  kind: AiQuantDeletionDialogKind
  pending: boolean
  errorMessage: string | null
  conversation?: { title: string } | null
  strategy?: { name?: string | null; id: string }
  deleteStoppedStrategy: boolean
  onToggleDeleteStoppedStrategy: (next: boolean) => void
  onConfirm: () => void
  onKeepAsViewOnly?: () => void
  onGoToRunningStrategy?: () => void
  onClose: () => void
}

interface DialogContent {
  title: string
  description: string
}

function resolveContent(kind: AiQuantDeletionDialogKind): DialogContent {
  switch (kind) {
    case 'loading':
      return {
        title: '正在确认策略状态',
        description: '正在确认关联策略的运行状态。',
      }
    case 'unknown':
      return {
        title: '暂时无法删除',
        description: '暂时无法确认该策略是否正在运行。为避免误删运行中的策略，请稍后重试。',
      }
    case 'running':
      return {
        title: '当前策略正在运行',
        description: '当前会话关联的策略正在运行，不能删除。请先前往策略详情停止运行；如有持仓或挂单，可选择仅停止或平仓并停止。',
      }
    case 'no-conversation':
      return {
        title: '删除策略记录',
        description: '该策略没有关联会话，可选择保留为只读或彻底删除策略记录。',
      }
    case 'with-conversation':
    default:
      return {
        title: '删除 AI Quant 会话',
        description: '这个会话已生成过策略，当前策略已停止。默认只删除 AI 对话和生成过程，不删除我的策略列表中的策略记录。',
      }
  }
}

export function AiQuantDeletionDialog({
  open,
  kind,
  pending,
  errorMessage,
  conversation,
  strategy,
  deleteStoppedStrategy,
  onToggleDeleteStoppedStrategy,
  onConfirm,
  onKeepAsViewOnly,
  onGoToRunningStrategy,
  onClose,
}: AiQuantDeletionDialogProps) {
  const dialogRef = useRef<HTMLDivElement | null>(null)
  const primaryButtonRef = useRef<HTMLButtonElement | null>(null)
  // pending state 是异步生效的；从「点击主按钮」到 setState 反映 pending=true
  // 之间存在一帧 race window，遮罩点击/Esc 可能在此时仍然把弹框关掉。
  // 用 ref 在主按钮触发时立即锁住，让 onClose 路径同步识别。
  const confirmInFlightRef = useRef(false)

  useEffect(() => {
    confirmInFlightRef.current = pending
  }, [pending])

  useEffect(() => {
    if (!open) {
      confirmInFlightRef.current = false
      return
    }

    const previousActiveElement = document.activeElement instanceof HTMLElement
      ? document.activeElement
      : null
    primaryButtonRef.current?.focus()

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        if (!pending && !confirmInFlightRef.current) onClose()
        return
      }

      if (event.key !== 'Tab') return
      const focusableElements = Array.from(
        dialogRef.current?.querySelectorAll<HTMLElement>(
          'button:not(:disabled), input:not(:disabled), [href], [tabindex]:not([tabindex="-1"])',
        ) ?? [],
      )
      if (focusableElements.length === 0) return
      const firstElement = focusableElements[0]
      const lastElement = focusableElements[focusableElements.length - 1]
      if (event.shiftKey && document.activeElement === firstElement) {
        event.preventDefault()
        lastElement.focus()
      } else if (!event.shiftKey && document.activeElement === lastElement) {
        event.preventDefault()
        firstElement.focus()
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('keydown', handleKeyDown)
      previousActiveElement?.focus()
    }
  }, [open, pending, onClose])

  if (!open) return null

  const { title, description } = resolveContent(kind)

  let primaryLabel: string | null = null
  let primaryClassName = 'rounded-xl bg-red-600 px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60'
  let primaryHandler: (() => void) | null = null

  if (kind === 'running') {
    primaryLabel = '前往运行策略'
    primaryClassName = 'rounded-xl bg-violet-600 px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60'
    primaryHandler = onGoToRunningStrategy ?? null
  } else if (kind === 'with-conversation') {
    primaryLabel = deleteStoppedStrategy ? '删除会话和策略' : '仅删除会话'
    primaryHandler = onConfirm
  } else if (kind === 'no-conversation') {
    primaryLabel = '删除策略记录'
    primaryHandler = onConfirm
  }

  let secondaryLabel: string | null = '取消'
  let secondaryHandler: (() => void) | null = onClose

  if (kind === 'no-conversation') {
    secondaryLabel = '保留为只读'
    secondaryHandler = onKeepAsViewOnly ?? null
  } else if (kind === 'running') {
    secondaryLabel = '关闭'
    secondaryHandler = onClose
  }

  const confirmDisabled = pending || kind === 'loading' || kind === 'unknown'
  const showCheckbox = kind === 'with-conversation'
  const showInfoBlock = kind === 'with-conversation' || kind === 'running' || kind === 'no-conversation'

  const handleBackdropClick = () => {
    if (!pending && !confirmInFlightRef.current) onClose()
  }

  const handlePrimaryClick = () => {
    if (!primaryHandler || confirmDisabled || confirmInFlightRef.current) return
    // 同步锁住，防止与遮罩/Esc 的 race。
    confirmInFlightRef.current = true
    primaryHandler()
  }

  return (
    <div
      className="fixed inset-0 z-[95] flex items-center justify-center bg-black/50 px-4"
      onClick={handleBackdropClick}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="ai-quant-deletion-dialog-title"
        ref={dialogRef}
        className="w-full max-w-[560px] rounded-2xl border border-[color:var(--cf-border)] bg-[color:var(--cf-surface)] p-5"
        onClick={event => event.stopPropagation()}
      >
        <h3
          id="ai-quant-deletion-dialog-title"
          className="text-lg font-semibold text-[color:var(--cf-text-strong)]"
        >
          {title}
        </h3>
        <p className="mt-2 text-sm leading-6 text-[color:var(--cf-muted)]">
          {description}
        </p>

        {showInfoBlock && (conversation || strategy) && (
          <div className="mt-4 grid gap-2 rounded-xl border border-[color:var(--cf-border)] bg-black/10 p-3 text-sm text-[color:var(--cf-text)]">
            {conversation && (
              <div className="flex justify-between gap-3">
                <span className="text-[color:var(--cf-muted)]">会话</span>
                <span className="text-right text-[color:var(--cf-text-strong)]">
                  {conversation.title}
                </span>
              </div>
            )}
            {strategy && (
              <div className="flex justify-between gap-3">
                <span className="text-[color:var(--cf-muted)]">策略</span>
                <span className="text-right text-[color:var(--cf-text-strong)]">
                  {strategy.name?.trim() || strategy.id}
                </span>
              </div>
            )}
          </div>
        )}

        {showCheckbox && (
          <>
            <label
              className={`mt-4 flex items-start gap-2 rounded-xl border p-3 text-sm transition-colors ${
                deleteStoppedStrategy
                  ? 'border-red-500/40 bg-red-500/10 text-[color:var(--cf-text-strong)]'
                  : 'border-[color:var(--cf-border)] bg-[color:var(--cf-bg)] text-[color:var(--cf-text)]'
              }`}
            >
              <input
                type="checkbox"
                className="mt-1"
                checked={deleteStoppedStrategy}
                disabled={pending}
                onChange={event => onToggleDeleteStoppedStrategy(event.target.checked)}
              />
              <span>
                同时删除已停止策略记录
                <span className="block text-xs leading-5 text-[color:var(--cf-muted)]">
                  删除后该策略将从我的策略列表移除，不能再次运行。
                </span>
              </span>
            </label>
            {deleteStoppedStrategy && (
              <div
                role="alert"
                data-testid="ai-quant-deletion-destructive-warning"
                className="mt-2 rounded-xl border border-red-500/40 bg-red-500/10 px-3 py-2 text-xs leading-5 text-red-200"
              >
                此操作不可恢复。继续之前请确认你已不再需要该策略记录。
              </div>
            )}
          </>
        )}

        {errorMessage && (
          <div className="mt-4 rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-400">
            {errorMessage}
          </div>
        )}

        <div className="mt-5 flex flex-wrap gap-2">
          {primaryLabel && primaryHandler && (
            <button
              ref={primaryButtonRef}
              type="button"
              data-testid="ai-quant-deletion-primary"
              disabled={confirmDisabled}
              onClick={handlePrimaryClick}
              className={primaryClassName}
            >
              {primaryLabel}
            </button>
          )}
          {secondaryLabel && secondaryHandler && (
            <button
              type="button"
              data-testid="ai-quant-deletion-secondary"
              disabled={pending}
              onClick={secondaryHandler}
              className="rounded-xl border border-[color:var(--cf-border)] px-4 py-2 text-sm font-semibold text-[color:var(--cf-text-strong)] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {secondaryLabel}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

export default AiQuantDeletionDialog
