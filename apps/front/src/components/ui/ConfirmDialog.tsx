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
  disabled?: boolean
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
  disabled = false,
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
        onClick={disabled ? undefined : onCancel}
      />

      {/* Dialog */}
      <div className="pointer-events-none fixed inset-0 z-[9999] flex items-center justify-center p-4">
        <div
          className="animate-in zoom-in-95 fade-in pointer-events-auto max-h-[calc(100dvh-2rem)] w-[calc(100vw-2rem)] max-w-[380px] overflow-y-auto rounded-xl border border-[color:var(--cf-border)] bg-[color:var(--cf-surface)] p-4 shadow-2xl duration-200 sm:p-5"
          onClick={e => e.stopPropagation()}
        >
          {/* Icon */}
          <div className="mb-3 flex h-9 w-9 items-center justify-center rounded-full bg-red-500/10">
            <AlertTriangle className="h-[18px] w-[18px] text-red-500" />
          </div>

          {/* Content */}
          <div className="mb-5 space-y-2">
            <h3 className="!text-[15px] !font-semibold !leading-[22px] text-[color:var(--cf-text-strong)]">{title}</h3>
            <p className="!text-sm !font-normal !leading-[22px] whitespace-pre-line text-[color:var(--cf-muted)]">
              {description}
            </p>
          </div>

          {/* Actions */}
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <button
              type="button"
              disabled={disabled}
              onClick={onCancel}
              className="min-h-9 w-full rounded-full bg-[color:var(--cf-surface-2)] px-3.5 py-1.5 !text-xs !font-semibold !leading-5 text-[color:var(--cf-text-strong)] transition-colors hover:bg-[color:var(--cf-surface-hover)] disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
            >
              {cancelText}
            </button>
            <button
              type="button"
              disabled={disabled}
              onClick={onConfirm}
              className={`min-h-9 w-full rounded-full px-3.5 py-1.5 !text-xs !font-semibold !leading-5 shadow-lg transition disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto ${confirmButtonClass}`}
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
