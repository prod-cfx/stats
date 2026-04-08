function canonicalNumber(value: number): string {
  if (!Number.isFinite(value)) {
    throw new TypeError('non-finite numbers are not allowed')
  }

  if (Object.is(value, -0)) return '0'

  return JSON.stringify(value)
}

export function canonicalSerialize(value: unknown): string {
  if (value === undefined) {
    throw new TypeError('undefined is not allowed')
  }

  if (value === null) return 'null'
  if (typeof value === 'boolean') return value ? 'true' : 'false'
  if (typeof value === 'number') return canonicalNumber(value)
  if (typeof value === 'string') return JSON.stringify(value)

  if (Array.isArray(value)) {
    return `[${value.map(item => canonicalSerialize(item)).join(',')}]`
  }

  const entries = Object.entries(value as Record<string, unknown>)
    .filter(([, item]) => item !== undefined)
    .sort(([left], [right]) => left.localeCompare(right))

  return `{${entries.map(([key, item]) => `${JSON.stringify(key)}:${canonicalSerialize(item)}`).join(',')}}`
}
