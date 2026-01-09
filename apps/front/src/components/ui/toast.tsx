'use client'

import type { ReactNode } from 'react'
import { createContext, use, useCallback, useEffect, useMemo, useState } from 'react'
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
    <div className="fixed top-4 right-4 z-[9999] flex flex-col gap-2 pointer-events-none">
      {toasts.map((toast) => (
        <ToastItem key={toast.id} toast={toast} onRemove={onRemove} />
      ))}
    </div>,
    document.body
  )
}

function ToastItem({ toast, onRemove }: { toast: Toast; onRemove: (id: string) => void }) {
  const typeStyles = {
    success: 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400',
    error: 'bg-red-500/10 border-red-500/30 text-red-400',
    warning: 'bg-amber-500/10 border-amber-500/30 text-amber-400',
    info: 'bg-primary/10 border-primary/30 text-primary',
  }

  const iconPaths = {
    success: 'M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z',
    error: 'M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z',
    warning: 'M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z',
    info: 'M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z',
  }

  return (
    <div
      className={`
        pointer-events-auto
        min-w-[320px] max-w-md
        rounded-lg border backdrop-blur-sm
        px-4 py-3
        shadow-lg
        animate-in slide-in-from-top-2 fade-in duration-200
        ${typeStyles[toast.type]}
      `}
    >
      <div className="flex items-start gap-3">
        <svg
          className="h-5 w-5 flex-shrink-0 mt-0.5"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d={iconPaths[toast.type]}
          />
        </svg>

        <div className="flex-1">
          <p className="text-sm font-medium">{toast.message}</p>
          {toast.description && (
            <p className="mt-1 text-xs opacity-90">{toast.description}</p>
          )}
        </div>

        <button
          type="button"
          onClick={() => onRemove(toast.id)}
          className="flex-shrink-0 opacity-70 hover:opacity-100 transition-opacity"
        >
          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M6 18L18 6M6 6l12 12"
            />
          </svg>
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
