/**
 * Loading state components and utilities
 */

'use client'

import React from 'react'
import { useTranslation } from 'react-i18next'

/**
 * Spinner component for loading states
 */
export function Spinner({ size = 'md', className = '' }: { size?: 'sm' | 'md' | 'lg'; className?: string }) {
  const sizeClasses = {
    sm: 'h-4 w-4',
    md: 'h-8 w-8',
    lg: 'h-12 w-12',
  }

  return (
    <div className={`inline-block ${className}`}>
      <svg
        className={`animate-spin ${sizeClasses[size]}`}
        xmlns="http://www.w3.org/2000/svg"
        fill="none"
        viewBox="0 0 24 24"
      >
        <circle
          className="opacity-25"
          cx="12"
          cy="12"
          r="10"
          stroke="currentColor"
          strokeWidth="4"
        />
        <path
          className="opacity-75"
          fill="currentColor"
          d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
        />
      </svg>
    </div>
  )
}

/**
 * Full page loading overlay
 */
export function LoadingOverlay({ message = '加载中...' }: { message?: string }) {
  const { t } = useTranslation()
  const resolvedMessage = message ?? t('common.loading')
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="rounded-lg bg-[#0f1219] border border-gray-800 p-8 shadow-2xl">
        <div className="flex flex-col items-center gap-4">
          <Spinner size="lg" className="text-[#396bff]" />
          <p className="text-sm text-gray-300">{resolvedMessage}</p>
        </div>
      </div>
    </div>
  )
}

/**
 * Inline loading state for buttons
 */
export function ButtonSpinner() {
  return <Spinner size="sm" className="mr-2" />
}

/**
 * Skeleton loader for content placeholders
 */
export function Skeleton({ className = '', width = '100%', height = '20px' }: {
  className?: string
  width?: string | number
  height?: string | number
}) {
  return (
    <div
      className={`animate-pulse rounded bg-gray-800/50 ${className}`}
      style={{ width, height }}
    />
  )
}

/**
 * Strategy card skeleton loader
 */
export function StrategyCardSkeleton() {
  return (
    <div className="rounded-xl border border-gray-800 bg-[#0a0d14] p-6">
      <div className="flex items-start gap-4">
        <Skeleton width={48} height={48} className="rounded-lg" />
        <div className="flex-1 space-y-3">
          <Skeleton width="60%" height={24} />
          <Skeleton width="40%" height={16} />
          <div className="flex gap-2 mt-4">
            <Skeleton width={80} height={24} className="rounded-full" />
            <Skeleton width={80} height={24} className="rounded-full" />
          </div>
        </div>
      </div>
      <div className="mt-4 grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Skeleton width="50%" height={12} />
          <Skeleton width="70%" height={20} />
        </div>
        <div className="space-y-2">
          <Skeleton width="50%" height={12} />
          <Skeleton width="70%" height={20} />
        </div>
      </div>
    </div>
  )
}

/**
 * Table row skeleton loader
 */
export function TableRowSkeleton({ columns = 5 }: { columns?: number }) {
  return (
    <tr className="border-b border-gray-800">
      {Array.from({ length: columns }).map((_, i) => (
        <td key={i} className="px-4 py-4">
          <Skeleton height={16} />
        </td>
      ))}
    </tr>
  )
}

/**
 * Error state component with retry
 */
export function ErrorState({ message = '数据加载失败（Mock）', onRetry }: { message?: string; onRetry?: () => void }) {
  const { t } = useTranslation()
  const resolvedMessage = message ?? t('common.loadFailed')
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center animate-in fade-in duration-300">
      <div className="w-16 h-16 rounded-full bg-red-500/10 flex items-center justify-center mb-6">
        <svg className="w-8 h-8 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      </div>
      <h3 className="text-xl font-bold text-[#e6edf3] mb-2">{resolvedMessage}</h3>
      <p className="text-[#8b949e] mb-8 max-w-md">{t('common.mockHint')}</p>
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="px-6 py-2 bg-gradient-to-r from-primary to-secondary text-white rounded-md font-bold shadow-lg shadow-primary/20 hover:opacity-90 active:scale-95 transition-all"
        >
          {t('common.retry')}
        </button>
      )}
    </div>
  )
}

/**
 * Loading state wrapper component
 */
export function LoadingState({
  isLoading,
  error,
  isEmpty,
  children,
  loadingFallback,
  onRetry,
}: {
  isLoading: boolean
  error?: boolean
  isEmpty?: boolean
  children: React.ReactNode
  loadingFallback?: React.ReactNode
  onRetry?: () => void
}) {
  const { t } = useTranslation()
  if (isLoading) {
    return <>{loadingFallback || (
      <div className="py-20 flex justify-center">
        <Spinner size="lg" className="text-primary" />
      </div>
    )}</>
  }

  if (error) {
    return <ErrorState onRetry={onRetry} />
  }

  if (isEmpty) {
    return (
      <EmptyState 
        title={t('common.emptyTitle')}
        description={t('common.emptyDescription')}
        action={onRetry && (
          <button onClick={onRetry} className="text-primary hover:underline text-sm font-medium">
            {t('common.clearFiltersAndRetry')}
          </button>
        )}
      />
    )
  }

  return <>{children}</>
}

/**
 * Empty state component
 */
export function EmptyState({
  icon,
  title,
  description,
  action,
}: {
  icon?: React.ReactNode
  title: string
  description?: string
  action?: React.ReactNode
}) {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center animate-in fade-in duration-300">
      {icon || (
        <div className="w-16 h-16 rounded-full bg-[#21262d] flex items-center justify-center mb-6">
          <svg className="w-8 h-8 text-[#8b949e]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
          </svg>
        </div>
      )}
      <h3 className="text-xl font-bold text-[#e6edf3] mb-2">{title}</h3>
      {description && <p className="text-[#8b949e] mb-8 max-w-md">{description}</p>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  )
}
