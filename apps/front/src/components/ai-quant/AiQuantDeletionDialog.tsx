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
        title: '删除策略',
        description: '该策略由「策略广场」直接运行生成，没有关联 AI Quant 会话。默认保留在我的策略列表中（仅可查看详情）；如不再需要可勾选下方选项彻底删除。',
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

  // errorMessage 出现时立即解锁 confirm ref：
  // 父组件在 catch 分支可能只设置 errorMessage 而 pending 维持 false（特别是
  // primaryHandler 同步抛错的边角），不会触发 pending 边沿。errorMessage 边沿
  // 解锁，保证错误展示后用户可以再次点确认或关闭弹框。
  useEffect(() => {
    if (errorMessage) confirmInFlightRef.current = false
  }, [errorMessage])

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

  // 视觉风格预设：safe = 绿/紫主按钮（默认 Enter 触发的安全操作），
  // destructive_primary = 红色破坏性主按钮，destructive_secondary = 红色破坏性副按钮，
  // neutral_secondary = 中性边框副按钮（取消/关闭）。
  const SAFE_PRIMARY_CLASS = 'rounded-xl bg-violet-600 px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60'
  const DESTRUCTIVE_PRIMARY_CLASS = 'rounded-xl bg-red-600 px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60'
  const DESTRUCTIVE_SECONDARY_CLASS = 'rounded-xl border border-red-500/40 bg-red-500/10 px-4 py-2 text-sm font-semibold text-red-400 disabled:cursor-not-allowed disabled:opacity-60'
  const NEUTRAL_SECONDARY_CLASS = 'rounded-xl border border-[color:var(--cf-border)] px-4 py-2 text-sm font-semibold text-[color:var(--cf-text-strong)] disabled:cursor-not-allowed disabled:opacity-60'

  let primaryLabel: string | null = null
  let primaryClassName = DESTRUCTIVE_PRIMARY_CLASS
  let primaryHandler: (() => void) | null = null

  let secondaryLabel: string | null = '取消'
  let secondaryClassName = NEUTRAL_SECONDARY_CLASS
  let secondaryHandler: (() => void) | null = onClose

  if (kind === 'running') {
    primaryLabel = '前往运行策略'
    primaryClassName = SAFE_PRIMARY_CLASS
    primaryHandler = onGoToRunningStrategy ?? null
    secondaryLabel = '关闭'
    secondaryHandler = onClose
  } else if (kind === 'with-conversation') {
    primaryLabel = deleteStoppedStrategy ? '删除会话和策略' : '仅删除会话'
    primaryClassName = DESTRUCTIVE_PRIMARY_CLASS
    primaryHandler = onConfirm
    secondaryLabel = '取消'
    secondaryHandler = onClose
  } else if (kind === 'no-conversation') {
    // plaza 分支：默认动作随复选框切换。
    // - 未勾选：主按钮「保留为只读」（safe），点击设置 viewOnlyAt → onKeepAsViewOnly
    // - 已勾选：主按钮「彻底删除策略」（destructive），点击归档 strategy → onConfirm
    // 副按钮固定为「取消」，关闭弹框不做任何操作。
    if (deleteStoppedStrategy) {
      primaryLabel = '彻底删除策略'
      primaryClassName = DESTRUCTIVE_PRIMARY_CLASS
      primaryHandler = onConfirm
    } else {
      primaryLabel = '保留为只读'
      primaryClassName = SAFE_PRIMARY_CLASS
      primaryHandler = onKeepAsViewOnly ?? null
    }
    secondaryLabel = '取消'
    secondaryHandler = onClose
  }

  const confirmDisabled = pending || kind === 'loading' || kind === 'unknown'
  // with-conversation 与 no-conversation 都暴露复选框：
  // - with-conversation：勾选 = 在删除会话之外同时归档策略
  // - no-conversation（plaza）：勾选 = 把主按钮从「保留为只读」切换到「彻底删除策略」
  const showCheckbox = kind === 'with-conversation' || kind === 'no-conversation'
  const showInfoBlock = kind === 'with-conversation' || kind === 'running' || kind === 'no-conversation'
  const checkboxLabel = kind === 'no-conversation'
    ? {
        main: '彻底删除策略记录（不可恢复）',
        hint: '勾选后该策略将从我的策略列表移除，不能再次运行。',
      }
    : {
        main: '同时删除已停止策略记录',
        hint: '删除后该策略将从我的策略列表移除，不能再次运行。',
      }

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
                {checkboxLabel.main}
                <span className="block text-xs leading-5 text-[color:var(--cf-muted)]">
                  {checkboxLabel.hint}
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
              className={secondaryClassName}
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
