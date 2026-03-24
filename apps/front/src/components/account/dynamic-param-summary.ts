export interface DynamicParamRow {
  key: string
  label: string
  value: string
}

function formatParamValue(value: unknown): string | null {
  if (typeof value === 'string') return value
  if (typeof value === 'number' || typeof value === 'boolean') return String(value)
  if (Array.isArray(value)) {
    const flat = value
      .map((item) => {
        if (typeof item === 'string' || typeof item === 'number' || typeof item === 'boolean')
          return String(item)
        return null
      })
      .filter((item): item is string => item !== null)
    return flat.length ? flat.join(', ') : null
  }
  return null
}

function extractSchemaProperties(paramSchema: Record<string, unknown>): Record<string, unknown> | null {
  const properties = paramSchema.properties
  if (!properties || typeof properties !== 'object' || Array.isArray(properties)) return null
  return properties as Record<string, unknown>
}

export function buildDynamicParamRows(
  paramSchema: Record<string, unknown> | null,
  paramValues: Record<string, unknown> | null,
): DynamicParamRow[] {
  if (!paramSchema || !paramValues) return []

  const properties = extractSchemaProperties(paramSchema)
  const rows: DynamicParamRow[] = []
  const seen = new Set<string>()

  if (properties) {
    for (const [key, config] of Object.entries(properties)) {
      const raw = paramValues[key]
      if (raw === undefined || raw === null || raw === '') continue
      const value = formatParamValue(raw)
      if (!value) continue

      const label = typeof config === 'object' && config !== null && !Array.isArray(config) && typeof config.title === 'string'
        ? config.title
        : key

      rows.push({ key, label, value })
      seen.add(key)
    }
  }

  for (const [key, raw] of Object.entries(paramValues)) {
    if (seen.has(key) || raw === undefined || raw === null || raw === '') continue
    const value = formatParamValue(raw)
    if (!value) continue
    rows.push({ key, label: key, value })
  }

  return rows
}

export function buildDynamicParamSummary(
  paramSchema: Record<string, unknown> | null,
  paramValues: Record<string, unknown> | null,
  limit = 3,
): string[] {
  if (limit <= 0) return []

  return buildDynamicParamRows(paramSchema, paramValues)
    .slice(0, limit)
    .map(item => `${item.label}: ${item.value}`)
}
