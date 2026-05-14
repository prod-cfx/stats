'use client';

import { X } from 'lucide-react';
import React, { useCallback, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  width?: string;
  loading?: boolean;
}

export const Modal = ({
  isOpen,
  onClose,
  title,
  children,
  footer,
  width = 'max-w-2xl',
  loading = false,
}: ModalProps) => {
  const { t } = useTranslation();
  const handleEsc = useCallback(
    (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    },
    [onClose]
  );

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
      window.addEventListener('keydown', handleEsc);
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => {
      document.body.style.overflow = 'unset';
      window.removeEventListener('keydown', handleEsc);
    };
  }, [isOpen, handleEsc]);

  if (!isOpen) return null;

  return createPortal(
    <div className="fixed inset-0 z-[999] flex items-center justify-center p-4">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200" 
        onClick={onClose}
      />
      
      {/* Content */}
      <div
        className={`relative z-10 flex min-h-0 max-h-[calc(100dvh-2rem)] w-[calc(100vw-2rem)] ${width} flex-col overflow-hidden rounded-2xl border border-[color:var(--cf-border)] bg-[color:var(--cf-surface)] shadow-2xl animate-in zoom-in-95 fade-in duration-200`}
      >
        {/* Header */}
        <div className="flex shrink-0 items-center justify-between border-b border-[color:var(--cf-border)] px-6 py-4">
          <h3 className="text-lg font-bold text-[color:var(--cf-text-strong)]">{title}</h3>
          <button 
            type="button"
            onClick={onClose}
            className="p-1 text-[color:var(--cf-muted)] hover:text-[color:var(--cf-text-strong)] transition-colors rounded-lg hover:bg-[color:var(--cf-surface-hover)]"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="relative min-h-0 flex-1 overflow-y-auto">
          {loading && (
            <div className="absolute inset-0 z-20 flex items-center justify-center bg-[color:var(--cf-surface)]/80 backdrop-blur-[2px]">
              <div className="flex flex-col items-center gap-3">
                <div className="w-10 h-10 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
                <p className="text-sm text-[color:var(--cf-muted)]">{t('common.loading')}</p>
              </div>
            </div>
          )}
          <div className="p-6">
            {children}
          </div>
        </div>

        {/* Footer */}
        {footer && (
          <div className="shrink-0 border-t border-[color:var(--cf-border)] bg-[color:var(--cf-surface-2)]/70 px-6 py-4">
            {footer}
          </div>
        )}
      </div>
    </div>,
    document.body
  );
};
