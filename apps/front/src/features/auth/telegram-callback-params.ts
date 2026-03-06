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
  return value.startsWith('/') ? value : `/${lng}/account`
}

function stripHashPrefix(hash: string | undefined): string {
  if (!hash) return ''
  return hash.startsWith('#') ? hash.slice(1) : hash
}

function parseHashParams(hash: string | undefined): URLSearchParams {
  return new URLSearchParams(stripHashPrefix(hash))
}

function pickParam(query: QueryLike, hashParams: URLSearchParams, key: string): string {
  return query.get(key) || hashParams.get(key) || ''
}

function toOptional(value: string): string | undefined {
  return value || undefined
}

export function resolveTelegramCallbackPayload(input: ResolveTelegramCallbackPayloadInput): TelegramCallbackResolution {
  const lng = input.lng === 'en' ? 'en' : 'zh'
  const hashParams = parseHashParams(input.hash)

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
      telegramId: pickParam(input.query, hashParams, 'id'),
      authDate: pickParam(input.query, hashParams, 'auth_date'),
      hash: pickParam(input.query, hashParams, 'hash'),
      firstName: toOptional(pickParam(input.query, hashParams, 'first_name')),
      lastName: toOptional(pickParam(input.query, hashParams, 'last_name')),
      username: toOptional(pickParam(input.query, hashParams, 'username')),
      photoUrl: toOptional(pickParam(input.query, hashParams, 'photo_url')),
    },
  }
}
