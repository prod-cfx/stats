'use client'

import { AlertTriangle } from 'lucide-react'
import React, { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'

interface ConfirmDialogProps {
  isOpen: boolean
  title: string
  description: string
  confirmText?: string
  cancelText?: string
  confirmVariant?: 'danger' | 'primary'
  onConfirm: () => void
  onCancel: () => void
}

export function ConfirmDialog({
  isOpen,
  title,
  description,
  confirmText = '确认',
  cancelText = '取消',
  confirmVariant = 'danger',
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    // eslint-disable-next-line react-hooks-extra/no-direct-set-state-in-use-effect -- hydrate on mount only
    setMounted(true)
  }, [])

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = 'unset'
    }
    return () => {
      document.body.style.overflow = 'unset'
    }
  }, [isOpen])

  if (!mounted || !isOpen) return null

  const confirmButtonClass =
    confirmVariant === 'danger'
      ? 'bg-red-600 hover:bg-red-700 text-white'
      : 'bg-gradient-to-r from-primary to-secondary hover:opacity-90 text-white'

  return createPortal(
    <>
      {/* Backdrop */}
      <div
        className="animate-in fade-in fixed inset-0 z-[9998] bg-black/60 backdrop-blur-sm duration-200"
        onClick={onCancel}
      />

      {/* Dialog */}
      <div className="pointer-events-none fixed inset-0 z-[9999] flex items-center justify-center p-4">
        <div
          className="animate-in zoom-in-95 fade-in pointer-events-auto w-full max-w-md rounded-xl border border-[color:var(--cf-border)] bg-[color:var(--cf-surface)] p-6 shadow-2xl duration-200"
          onClick={e => e.stopPropagation()}
        >
          {/* Icon */}
          <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-red-500/10">
            <AlertTriangle className="h-6 w-6 text-red-500" />
          </div>

          {/* Content */}
          <div className="mb-6 space-y-3">
            <h3 className="text-xl font-bold text-[color:var(--cf-text-strong)]">{title}</h3>
            <p className="text-sm leading-relaxed whitespace-pre-line text-[color:var(--cf-muted)]">
              {description}
            </p>
          </div>

          {/* Actions */}
          <div className="flex gap-3">
            <button
              type="button"
              onClick={onCancel}
              className="flex-1 rounded-lg bg-[color:var(--cf-surface-2)] px-4 py-2.5 text-sm font-medium text-[color:var(--cf-text-strong)] transition-colors hover:bg-[color:var(--cf-surface-hover)]"
            >
              {cancelText}
            </button>
            <button
              type="button"
              onClick={onConfirm}
              className={`flex-1 rounded-lg px-4 py-2.5 text-sm font-medium shadow-lg transition-all active:scale-95 ${confirmButtonClass}`}
            >
              {confirmText}
            </button>
          </div>
        </div>
      </div>
    </>,
    document.body,
  )
}
