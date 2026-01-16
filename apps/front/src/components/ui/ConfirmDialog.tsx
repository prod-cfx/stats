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
        className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[9998] animate-in fade-in duration-200"
        onClick={onCancel}
      />

      {/* Dialog */}
      <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 pointer-events-none">
        <div
          className="bg-[color:var(--cf-surface)] border border-[color:var(--cf-border)] rounded-xl shadow-2xl max-w-md w-full p-6 pointer-events-auto animate-in zoom-in-95 fade-in duration-200"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Icon */}
          <div className="flex items-center justify-center w-12 h-12 rounded-full bg-red-500/10 mb-4">
            <AlertTriangle className="w-6 h-6 text-red-500" />
          </div>

          {/* Content */}
          <div className="space-y-3 mb-6">
            <h3 className="text-xl font-bold text-[color:var(--cf-text-strong)]">{title}</h3>
            <p className="text-[color:var(--cf-muted)] text-sm leading-relaxed whitespace-pre-line">
              {description}
            </p>
          </div>

          {/* Actions */}
          <div className="flex gap-3">
            <button
              type="button"
              onClick={onCancel}
              className="flex-1 px-4 py-2.5 bg-[color:var(--cf-surface-2)] hover:bg-[color:var(--cf-surface-hover)] text-[color:var(--cf-text-strong)] rounded-lg transition-colors text-sm font-medium"
            >
              {cancelText}
            </button>
            <button
              type="button"
              onClick={onConfirm}
              className={`flex-1 px-4 py-2.5 rounded-lg transition-all text-sm font-medium shadow-lg active:scale-95 ${confirmButtonClass}`}
            >
              {confirmText}
            </button>
          </div>
        </div>
      </div>
    </>,
    document.body
  )
}
