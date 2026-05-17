'use client'

type UserAvatarSize = 'sm' | 'md' | 'lg'

interface UserAvatarProps {
  userId: string
  name?: string | null
  src?: string | null
  size?: UserAvatarSize
  className?: string
  testId?: string
}

const sizeClassNames: Record<UserAvatarSize, string> = {
  sm: 'h-8 w-8',
  md: 'h-10 w-10',
  lg: 'h-14 w-14',
}

const identiconClassNames: Record<UserAvatarSize, string> = {
  sm: 'h-full w-full',
  md: 'h-full w-full',
  lg: 'h-full w-full',
}

function hashString(value: string) {
  let hash = 2166136261
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index)
    hash = Math.imul(hash, 16777619)
  }
  return hash >>> 0
}

function getIdenticonCells(userId: string) {
  const hash = hashString(userId)
  const palettes = [
    {
      base: 'bg-blue-600',
      colors: ['bg-amber-700', 'bg-sky-400', 'bg-amber-800'],
    },
    {
      base: 'bg-violet-600',
      colors: ['bg-cyan-400', 'bg-slate-300', 'bg-indigo-900'],
    },
    {
      base: 'bg-sky-600',
      colors: ['bg-emerald-400', 'bg-slate-200', 'bg-blue-900'],
    },
    {
      base: 'bg-indigo-600',
      colors: ['bg-orange-500', 'bg-teal-300', 'bg-slate-900'],
    },
  ]
  const palette = palettes[hash % palettes.length]

  return Array.from({ length: 25 }, (_, index) => {
    const row = Math.floor(index / 5)
    const col = index % 5
    const mirroredCol = col > 2 ? 4 - col : col
    const bitIndex = row * 3 + mirroredCol
    const active = ((hash >> bitIndex) & 1) === 1 || (row === 2 && mirroredCol === 1)
    if (!active) return palette.base
    return palette.colors[(hash + row + mirroredCol) % palette.colors.length]
  })
}

export function UserAvatar({
  userId,
  name,
  src,
  size = 'md',
  className = '',
  testId,
}: UserAvatarProps) {
  const label = name || userId
  const cells = getIdenticonCells(userId)

  return (
    <span
      aria-label={label}
      data-testid={testId}
      className={`relative inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full border border-[color:var(--cf-border)] bg-[color:var(--cf-surface)] shadow-sm ${sizeClassNames[size]} ${className}`}
    >
      {src ? (
        <img
          src={src}
          alt={label}
          className="h-full w-full object-cover"
          referrerPolicy="no-referrer"
        />
      ) : (
        <span
          className={`grid shrink-0 grid-cols-5 grid-rows-5 overflow-hidden ${identiconClassNames[size]}`}
          aria-hidden="true"
        >
          {cells.map((cellClassName, index) => (
            <span key={`${userId}-cell-${index}`} className={cellClassName} />
          ))}
        </span>
      )}
    </span>
  )
}
