'use client'

import Link from 'next/link'
import { useEffect } from 'react'

export default function ErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    // eslint-disable-next-line no-console
    console.error('Global route error', error)
  }, [error])

  return (
    <div className="min-h-screen bg-[color:var(--cf-bg)] text-[color:var(--cf-text)] flex items-center justify-center p-6">
      <div className="max-w-md w-full text-center space-y-4">
        <div className="text-5xl font-black tracking-tight text-[color:var(--cf-text-strong)]">Oops</div>
        <div className="text-sm text-[color:var(--cf-muted)]">
          {error?.message || 'Something went wrong.'}
        </div>
        <div className="flex items-center justify-center gap-3">
          <button
            type="button"
            onClick={reset}
            className="inline-flex items-center justify-center px-4 py-2 rounded-md bg-primary text-white font-semibold hover:opacity-90 transition-opacity"
          >
            Try again
          </button>
          <Link
            href="/zh"
            className="inline-flex items-center justify-center px-4 py-2 rounded-md border border-[color:var(--cf-border)] text-[color:var(--cf-text-strong)] hover:bg-[color:var(--cf-surface)] transition-colors"
          >
            Back to Home
          </Link>
        </div>
      </div>
    </div>
  )
}

