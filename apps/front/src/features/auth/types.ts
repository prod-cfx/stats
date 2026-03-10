export type AuthLoginMethod = 'email' | 'telegram'

export interface TelegramAuthInfo {
  id: string
  username?: string | null
  isLinked: boolean
}

export interface AuthSession {
  userId: string
  email?: string | null
  telegram?: TelegramAuthInfo | null
  loginMethods: AuthLoginMethod[]
  accessToken: string
  expiresAt: number
}

export interface AuthContextValue {
  session: AuthSession | null
  isAuthenticated: boolean
  isLoading: boolean
  sendEmailCode: (email: string) => Promise<void>
  loginWithEmailCode: (email: string, code: string) => Promise<void>
  loginWithTelegramCallback: (payload: {
    source: 'web' | 'desktop' | 'webapp'
    telegramId: string
    authDate: string
    hash: string
    firstName?: string
    lastName?: string
    username?: string
    photoUrl?: string
  }) => Promise<void>
  createTelegramDesktopIntent: (payload: {
    intent: 'login' | 'bind'
    lng: 'zh' | 'en'
    redirect?: string
  }) => Promise<{
    intentId: string
    deepLink: string
    webLink: string
    callbackUrl: string
    expiresInSeconds: number
  }>
  getTelegramDesktopIntentStatus: (intentId: string) => Promise<{ status: 'pending' | 'confirmed' | 'expired' }>
  loginWithTelegramDesktopIntent: (intentId: string) => Promise<void>
  bindEmail: (email: string, code: string) => Promise<void>
  bindTelegram: (payload: {
    telegramId: string
    authDate: string
    hash: string
    firstName?: string
    lastName?: string
    username?: string
    photoUrl?: string
  }) => Promise<void>
  bindTelegramByDesktopIntent: (intentId: string) => Promise<void>
  logout: () => void
}
