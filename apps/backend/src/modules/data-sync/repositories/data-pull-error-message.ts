type ErrorRecord = Record<string, unknown>

function asRecord(value: unknown): ErrorRecord | null {
  return value && typeof value === 'object' ? value as ErrorRecord : null
}

function firstString(...values: unknown[]): string | null {
  for (const value of values) {
    if (typeof value === 'string' && value.trim()) return value
  }
  return null
}

function readArgs(record: ErrorRecord | null): ErrorRecord | null {
  return asRecord(record?.args)
}

function readResponse(error: ErrorRecord | null): ErrorRecord | null {
  const getResponse = error?.getResponse
  if (typeof getResponse !== 'function') return null

  try {
    return asRecord(getResponse.call(error))
  } catch {
    return null
  }
}

function extractDetail(error: unknown): string | null {
  const record = asRecord(error)
  const args = readArgs(record)
  const response = readResponse(record)
  const responseArgs = readArgs(response)

  return firstString(
    args?.reason,
    args?.detail,
    responseArgs?.reason,
    responseArgs?.detail,
    response?.reason,
    response?.detail,
  )
}

function sanitizeError(input: string): string {
  let result = input

  result = result.replace(
    /(api[_-]?key)\s*=\s*([^\s&]+)/gi,
    (_match, p1) => `${p1}=***`,
  )

  result = result.replace(
    /\b(AccessKeyId|SignatureNonce|Signature|Timestamp)=([^\s&]+)/g,
    (_match, p1) => `${p1}=***`,
  )

  result = result.replace(
    /(Authorization:\s*Bearer\s+)\S+/gi,
    '$1***',
  )

  return result
}

export function formatDataPullError(error: unknown, maxLength: number): string {
  const detail = extractDetail(error)
  const record = asRecord(error)
  const message = firstString(record?.message)
  const stack = firstString(record?.stack)

  const raw = typeof error === 'string'
    ? error
    : [message, detail && detail !== message ? detail : null, stack]
        .filter((part): part is string => typeof part === 'string' && part.length > 0)
        .join('\n') || JSON.stringify(error)

  const sanitized = sanitizeError(raw)

  if (sanitized.length <= maxLength) return sanitized
  return `${sanitized.slice(0, maxLength)}...`
}
