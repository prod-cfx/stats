/**
 * Loading state components and utilities
 */

import React from 'react'

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
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="rounded-lg bg-[#0f1219] border border-gray-800 p-8 shadow-2xl">
        <div className="flex flex-col items-center gap-4">
          <Spinner size="lg" className="text-[#396bff]" />
          <p className="text-sm text-gray-300">{message}</p>
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
 * Loading state wrapper component
 */
export function LoadingState({
  isLoading,
  error,
  children,
  loadingFallback,
  errorFallback,
}: {
  isLoading: boolean
  error?: Error | null
  children: React.ReactNode
  loadingFallback?: React.ReactNode
  errorFallback?: React.ReactNode
}) {
  if (isLoading) {
    return <>{loadingFallback || <Spinner className="text-[#396bff] mx-auto my-8" />}</>
  }

  if (error) {
    return (
      <>
        {errorFallback || (
          <div className="rounded-lg border border-red-500/20 bg-red-500/5 p-4 text-center">
            <p className="text-sm text-red-400">{error.message || '加载失败'}</p>
          </div>
        )}
      </>
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
    <div className="flex flex-col items-center justify-center py-12 text-center">
      {icon && <div className="mb-4 text-gray-600">{icon}</div>}
      <h3 className="text-lg font-semibold text-gray-300">{title}</h3>
      {description && <p className="mt-2 text-sm text-gray-400">{description}</p>}
      {action && <div className="mt-6">{action}</div>}
    </div>
  )
}
