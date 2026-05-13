'use client'

import type { ElementType, ReactNode } from 'react'
import { AlertTriangle, CheckCircle2, Info, X, XCircle } from 'lucide-react'
import { createContext, useCallback, use, useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'

interface Toast {
  id: string
  type: 'success' | 'error' | 'warning' | 'info'
  message: string
  description?: string
  duration?: number
}

interface ToastContextType {
  toasts: Toast[]
  showToast: (toast: Omit<Toast, 'id'>) => void
  removeToast: (id: string) => void
}

const ToastContext = createContext<ToastContextType | undefined>(undefined)

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((toast) => toast.id !== id))
  }, [])

  const showToast = useCallback((toast: Omit<Toast, 'id'>) => {
    const id = Math.random().toString(36).substring(7)
    const duration = toast.duration ?? 3000

    setToasts((prev) => [...prev, { ...toast, id }])

    if (duration > 0) {
      setTimeout(() => {
        removeToast(id)
      }, duration)
    }
  }, [removeToast])

  const value = useMemo(() => ({ toasts, showToast, removeToast }), [toasts, showToast, removeToast])

  return (
    <ToastContext value={value}>
      {children}
      <ToastContainer toasts={toasts} onRemove={removeToast} />
    </ToastContext>
  )
}

function ToastContainer({ toasts, onRemove }: { toasts: Toast[]; onRemove: (id: string) => void }) {
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    // eslint-disable-next-line react-hooks-extra/no-direct-set-state-in-use-effect
    setMounted(true)
  }, [])

  if (!mounted) return null

  return createPortal(
    <div className="pointer-events-none fixed right-4 top-5 z-[9999] flex w-[calc(100vw-2rem)] max-w-[360px] flex-col gap-2 sm:right-6">
      {toasts.map((toast) => (
        <ToastItem key={toast.id} toast={toast} onRemove={onRemove} />
      ))}
    </div>,
    document.body
  )
}

function ToastItem({ toast, onRemove }: { toast: Toast; onRemove: (id: string) => void }) {
  const typeStyles: Record<Toast['type'], { icon: ElementType; iconClassName: string; accentClassName: string }> = {
    success: {
      icon: CheckCircle2,
      iconClassName: 'bg-emerald-500/10 text-emerald-500',
      accentClassName: 'bg-emerald-500',
    },
    error: {
      icon: XCircle,
      iconClassName: 'bg-red-500/10 text-red-500',
      accentClassName: 'bg-red-500',
    },
    warning: {
      icon: AlertTriangle,
      iconClassName: 'bg-amber-500/10 text-amber-500',
      accentClassName: 'bg-amber-500',
    },
    info: {
      icon: Info,
      iconClassName: 'bg-primary/10 text-primary',
      accentClassName: 'bg-primary',
    },
  }

  const style = typeStyles[toast.type]
  const Icon = style.icon

  return (
    <div
      role="status"
      className="pointer-events-auto relative overflow-hidden rounded-xl border border-[color:var(--cf-border)] bg-[color:var(--cf-surface)] px-3.5 py-3 text-[color:var(--cf-text)] shadow-[0_16px_40px_rgba(15,23,42,0.12)] backdrop-blur-sm animate-in fade-in slide-in-from-top-2 duration-200 dark:shadow-black/30"
    >
      <div className={`absolute inset-y-2 left-0 w-0.5 rounded-full ${style.accentClassName}`} />
      <div className="flex items-start gap-2.5">
        <span className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full ${style.iconClassName}`}>
          <Icon className="h-4 w-4" />
        </span>

        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-[color:var(--cf-text-strong)]">{toast.message}</p>
          {toast.description && (
            <p className="mt-1 line-clamp-2 text-xs leading-5 text-[color:var(--cf-muted)]">{toast.description}</p>
          )}
        </div>

        <button
          type="button"
          aria-label="Dismiss notification"
          onClick={() => onRemove(toast.id)}
          className="-mr-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-[color:var(--cf-muted)] transition hover:bg-[color:var(--cf-surface-hover)] hover:text-[color:var(--cf-text-strong)]"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  )
}

// eslint-disable-next-line react-refresh/only-export-components
export function useToast() {
  const context = use(ToastContext)
  if (!context) {
    throw new Error('useToast must be used within ToastProvider')
  }

  return {
    toast: context.showToast,
    success: (message: string, description?: string) =>
      context.showToast({ type: 'success', message, description }),
    error: (message: string, description?: string) =>
      context.showToast({ type: 'error', message, description }),
    warning: (message: string, description?: string) =>
      context.showToast({ type: 'warning', message, description }),
    info: (message: string, description?: string) =>
      context.showToast({ type: 'info', message, description }),
  }
}
