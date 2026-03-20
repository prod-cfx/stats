export type TelegramCallbackSource = 'web' | 'desktop' | 'webapp'
export type TelegramCallbackIntent = 'login' | 'bind'

interface QueryLike {
  get: (key: string) => string | null
}

interface ResolveTelegramCallbackPayloadInput {
  query: QueryLike
  hash?: string
  lng?: string
}

interface TelegramPayload {
  source: TelegramCallbackSource
  telegramId: string
  authDate: string
  hash: string
  firstName?: string
  lastName?: string
  username?: string
  photoUrl?: string
}

export interface TelegramCallbackResolution {
  source: TelegramCallbackSource
  intent: TelegramCallbackIntent
  desktopIntentId: string
  redirect: string
  payload: TelegramPayload
}

interface TelegramFallbackFields {
  id?: string
  auth_date?: string
  hash?: string
  first_name?: string
  last_name?: string
  username?: string
  photo_url?: string
}

function parseSource(value: string | null): TelegramCallbackSource {
  if (value === 'desktop') return 'desktop'
  if (value === 'webapp') return 'webapp'
  return 'web'
}

function parseIntent(value: string | null): TelegramCallbackIntent {
  return value === 'bind' ? 'bind' : 'login'
}

function normalizeRedirect(value: string | null, lng: string) {
  if (!value) return `/${lng}/account`
  return value.startsWith('/') && !value.startsWith('//') ? value : `/${lng}/account`
}

function stripHashPrefix(hash: string | undefined): string {
  if (!hash) return ''
  return hash.startsWith('#') ? hash.slice(1) : hash
}

function parseHashParams(hash: string | undefined): URLSearchParams {
  return new URLSearchParams(stripHashPrefix(hash))
}

function decodeBase64Utf8(value: string): string | null {
  const normalized = value.replace(/\s/g, '+').replace(/-/g, '+').replace(/_/g, '/')
  const padding = normalized.length % 4
  const padded = padding === 0 ? normalized : `${normalized}${'='.repeat(4 - padding)}`

  try {
    if (typeof atob === 'function') {
      const binary = atob(padded)
      if (typeof TextDecoder !== 'undefined') {
        const bytes = Uint8Array.from(binary, char => char.charCodeAt(0))
        return new TextDecoder().decode(bytes)
      }

      // Fallback for environments without TextDecoder (e.g. some jest/jsdom setups).
      return decodeURIComponent(
        Array.from(binary)
          .map(char => `%${char.charCodeAt(0).toString(16).padStart(2, '0')}`)
          .join(''),
      )
    }

    if (typeof Buffer !== 'undefined') {
      return Buffer.from(padded, 'base64').toString('utf8')
    }
  }
  catch {
    return null
  }

  return null
}

function parseTgAuthResult(hashParams: URLSearchParams): TelegramFallbackFields {
  const encoded = hashParams.get('tgAuthResult')
  if (!encoded) return {}

  const decoded = decodeBase64Utf8(encoded)
  if (!decoded) return {}

  try {
    const parsed = JSON.parse(decoded) as Record<string, unknown>
    if (!parsed || typeof parsed !== 'object') return {}

    const readString = (key: keyof TelegramFallbackFields) => (typeof parsed[key] === 'string' ? parsed[key] : undefined)
    const readStringOrNumber = (key: keyof TelegramFallbackFields) => {
      const value = parsed[key]
      if (typeof value === 'string')
        return value
      if (typeof value === 'number')
        return String(value)
      return undefined
    }

    return {
      id: readStringOrNumber('id'),
      auth_date: readStringOrNumber('auth_date'),
      hash: readString('hash'),
      first_name: readString('first_name'),
      last_name: readString('last_name'),
      username: readString('username'),
      photo_url: readString('photo_url'),
    }
  }
  catch {
    return {}
  }
}

function pickParam(query: QueryLike, hashParams: URLSearchParams, key: string): string {
  return query.get(key) || hashParams.get(key) || ''
}

function pickPayloadParam(
  query: QueryLike,
  hashParams: URLSearchParams,
  tgAuthResult: TelegramFallbackFields,
  key: keyof TelegramFallbackFields,
): string {
  return query.get(key) || hashParams.get(key) || tgAuthResult[key] || ''
}

function toOptional(value: string): string | undefined {
  return value || undefined
}

export function resolveTelegramCallbackPayload(input: ResolveTelegramCallbackPayloadInput): TelegramCallbackResolution {
  const lng = input.lng === 'en' ? 'en' : 'zh'
  const hashParams = parseHashParams(input.hash)
  const tgAuthResult = parseTgAuthResult(hashParams)

  const source = parseSource(input.query.get('source') || hashParams.get('source'))
  const intent = parseIntent(input.query.get('intent') || hashParams.get('intent'))
  const desktopIntentId = pickParam(input.query, hashParams, 'desktop_intent')
  const redirect = normalizeRedirect(input.query.get('redirect') || hashParams.get('redirect'), lng)

  return {
    source,
    intent,
    desktopIntentId,
    redirect,
    payload: {
      source,
      telegramId: pickPayloadParam(input.query, hashParams, tgAuthResult, 'id'),
      authDate: pickPayloadParam(input.query, hashParams, tgAuthResult, 'auth_date'),
      hash: pickPayloadParam(input.query, hashParams, tgAuthResult, 'hash'),
      firstName: toOptional(pickPayloadParam(input.query, hashParams, tgAuthResult, 'first_name')),
      lastName: toOptional(pickPayloadParam(input.query, hashParams, tgAuthResult, 'last_name')),
      username: toOptional(pickPayloadParam(input.query, hashParams, tgAuthResult, 'username')),
      photoUrl: toOptional(pickPayloadParam(input.query, hashParams, tgAuthResult, 'photo_url')),
    },
  }
}
