import i18next from 'i18next'

import enCommon from '../../../public/locales/en/common.json'
import zhCommon from '../../../public/locales/zh/common.json'

export type AppLocale = 'zh' | 'en'

/**
 * In `output: 'export'` mode, Next.js cannot use dynamic
 * APIs like `cookies()` or `headers()` when pre-rendering.
 *
 * We therefore resolve the locale at build time only.
 * You can control the default via `NEXT_PUBLIC_DEFAULT_LOCALE`.
 */
const DEFAULT_LOCALE: AppLocale
  = (process.env.NEXT_PUBLIC_DEFAULT_LOCALE === 'en' ? 'en' : 'zh')

export function getRequestLocale(): AppLocale {
  return DEFAULT_LOCALE
}

export async function getServerTranslator() {
  const lng = getRequestLocale()
  const instance = i18next.createInstance()
  await instance.init({
    lng,
    fallbackLng: 'zh',
    supportedLngs: ['zh', 'en'],
    nonExplicitSupportedLngs: true,
    defaultNS: 'common',
    ns: ['common'],
    interpolation: { escapeValue: false },
    resources: {
      en: { common: enCommon as any },
      zh: { common: zhCommon as any },
    },
  })

  return {
    lng,
    t: instance.t.bind(instance),
  } as const
}

