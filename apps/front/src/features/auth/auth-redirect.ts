export type AuthLocale = 'zh' | 'en'

export function normalizeAuthRedirect(redirect: string | null | undefined, lng: AuthLocale): string | undefined {
  if (!redirect) return undefined
  if (redirect === `/${lng}` || redirect.startsWith(`/${lng}/`) || redirect.startsWith(`/${lng}?`)) {
    return redirect
  }
  return undefined
}

export function normalizeAuthRedirectOrFallback(
  redirect: string | null | undefined,
  lng: AuthLocale,
  fallback: string,
) {
  return normalizeAuthRedirect(redirect, lng) ?? fallback
}
