import React from 'react'

/**
 * Coinflux mark: A geometric "C" shape with a horizontal split on the left.
 * The right side is open (approx 90 degrees opening).
 * The shape itself uses a gradient fill.
 */
export function CoinfluxMark({ className = '' }: { className?: string }) {
  const id = React.useId()
  const gradientId = `coinflux-grad-${id.replace(/:/g, '')}`

  return (
    <svg
      viewBox="0 0 100 100"
      className={className}
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      focusable="false"
    >
      <defs>
        <linearGradient id={gradientId} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="var(--color-primary, #3b82f6)" />
          <stop offset="100%" stopColor="var(--color-secondary, #8b5cf6)" />
        </linearGradient>
      </defs>

      <g fill={`url(#${gradientId})`}>
        {/* 
           Top Segment:
           - Start Outer Left: (8.1, 47)
           - Arc to Outer Right: (79.7, 20.3) [Angle -45 deg]
           - Line to Inner Right: (67, 33) [Angle -45 deg]
           - Arc to Inner Left: (26.2, 47)
           - Close
        */}
        <path d="
          M 8.1 47
          A 42 42 0 0 1 79.7 20.3
          L 67 33
          A 24 24 0 0 0 26.2 47
          Z
        " />

        {/* 
           Bottom Segment:
           - Start Outer Left: (8.1, 53)
           - Arc to Outer Right: (79.7, 79.7) [Angle +45 deg]
           - Line to Inner Right: (67, 67) [Angle +45 deg]
           - Arc to Inner Left: (26.2, 53)
           - Close
        */}
        <path d="
          M 8.1 53
          A 42 42 0 0 0 79.7 79.7
          L 67 67
          A 24 24 0 0 1 26.2 53
          Z
        " />
      </g>
    </svg>
  )
}
