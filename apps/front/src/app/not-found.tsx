import Link from 'next/link'

export default function NotFound() {
  return (
    <div className="min-h-screen bg-[color:var(--cf-bg)] text-[color:var(--cf-text)] flex items-center justify-center p-6">
      <div className="max-w-md w-full text-center space-y-4">
        <div className="text-6xl font-black tracking-tight text-[color:var(--cf-text-strong)]">404</div>
        <div className="text-sm text-[color:var(--cf-muted)]">Page not found.</div>
        <div>
          <Link
            href="/zh"
            className="inline-flex items-center justify-center px-4 py-2 rounded-md bg-primary text-white font-semibold hover:opacity-90 transition-opacity"
          >
            Back to Home
          </Link>
        </div>
      </div>
    </div>
  )
}

