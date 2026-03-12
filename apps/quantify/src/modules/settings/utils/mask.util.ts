export function isSensitiveKeyPath(key: string): boolean {
  const lowered = key.toLowerCase()
  return (
    lowered.endsWith('.secret')
    || lowered.endsWith('.apikey')
    || lowered.endsWith('.api_key')
    || lowered.endsWith('.token')
    || lowered.endsWith('.password')
    || lowered.includes('webhooksecrets')
    || lowered === 'payment.wgqpay'
  )
}

const SENSITIVE_FIELD_NAMES = new Set([
  'secret',
  'apiKey',
  'api_key',
  'token',
  'password',
  'clientSecret',
  'accessKey',
  'privateKey',
])

export function maskStringValue(v: string): string {
  if (!v)
    return ''
  if (v.length <= 4)
    return '****'
  return `${v.slice(0, 2)}****${v.slice(-2)}`
}

export function maskJsonDeep(obj: unknown): unknown {
  if (obj === null || obj === undefined)
    return obj
  if (Array.isArray(obj))
    return obj.map(maskJsonDeep)
  if (typeof obj === 'object') {
    const out: Record<string, unknown> = {}
    for (const [k, v] of Object.entries(obj)) {
      if (SENSITIVE_FIELD_NAMES.has(k)) {
        if (typeof v === 'string')
          out[k] = maskStringValue(v)
        else out[k] = '****'
      }
      else {
        out[k] = maskJsonDeep(v)
      }
    }
    return out
  }
  return obj
}

export function maskSettingValue(key: string, type: string, rawValue: string): string {
  const loweredKey = key.toLowerCase()
  if (!isSensitiveKeyPath(loweredKey))
    return rawValue
  try {
    if (type === 'json') {
      const parsed = JSON.parse(rawValue)
      // webhookSecrets: 浠绘剰鍙跺瓙瀛楃涓茬粺涓€鑴辨晱
      if (loweredKey.includes('webhooksecrets')) {
        const maskAll = (obj: unknown): unknown => {
          if (obj === null || obj === undefined)
            return obj
          if (Array.isArray(obj))
            return obj.map(maskAll)
          if (typeof obj === 'object') {
            const out: Record<string, unknown> = {}
            for (const [k, v] of Object.entries(obj))
              out[k] = maskAll(v)
            return out
          }
          if (typeof obj === 'string')
            return '__MASKED__'
          return obj
        }
        return JSON.stringify(maskAll(parsed))
      }
      const masked = maskJsonDeep(parsed)
      return JSON.stringify(masked)
    }
  }
  catch {
    // ignore JSON parse errors, fallback to string masking
  }
  return maskStringValue(rawValue ?? '')
}

export function isMaskedString(val: unknown): boolean {
  return typeof val === 'string' && (val === '__MASKED__' || val.includes('****'))
}

export function mergeMaskedJson(existing: unknown, incoming: unknown): unknown {
  if (incoming === undefined)
    return existing
  if (existing === undefined)
    return incoming
  if (isMaskedString(incoming))
    return existing
  if (Array.isArray(existing) && Array.isArray(incoming)) {
    // 绠€鍗曠瓥鐣ワ細鑻ユ暟缁勫厓绱犱负鎺╃爜鍒欎繚鐣欏師鍊硷紝鍚﹀垯鏇挎崲瀵瑰簲绱㈠紩
    const len = Math.max(existing.length, incoming.length)
    const out: unknown[] = []
    for (let i = 0; i < len; i++) {
      out[i] = mergeMaskedJson(existing[i], incoming[i])
    }
    return out
  }
  if (typeof existing === 'object' && existing && typeof incoming === 'object' && incoming) {
    const existingObj = existing as Record<string, unknown>
    const incomingObj = incoming as Record<string, unknown>
    const keys = new Set([...Object.keys(existingObj), ...Object.keys(incomingObj)])
    const out: Record<string, unknown> = {}
    for (const k of keys)
      out[k] = mergeMaskedJson(existingObj[k], incomingObj[k])
    return out
  }
  return incoming
}
