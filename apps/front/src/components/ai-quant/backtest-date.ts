export function formatBacktestDate(input?: string | null): string {
  if (!input) return '-'
  const date = new Date(input)
  if (Number.isNaN(date.getTime())) return '-'
  const year = date.getUTCFullYear()
  const month = String(date.getUTCMonth() + 1).padStart(2, '0')
  const day = String(date.getUTCDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export function formatBacktestRange(startAt?: string | null, endAt?: string | null): string {
  const start = formatBacktestDate(startAt)
  const end = formatBacktestDate(endAt)
  if (start === '-' || end === '-') return '-'
  return `${start} ~ ${end}`
}
