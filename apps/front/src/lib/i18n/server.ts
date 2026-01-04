import i18next from 'i18next'
import { cookies, headers } from 'next/headers'

import enCommon from '../../../public/locales/en/common.json'
import zhCommon from '../../../public/locales/zh/common.json'

export type AppLocale = 'zh' | 'en'

function normalizeLocale(input?: string | null): AppLocale | null {
  if (!input)
    return null
  const v = input.toLowerCase()
  if (v.startsWith('zh'))
    return 'zh'
  if (v.startsWith('en'))
    return 'en'
  return null
}

export function getRequestLocale(): AppLocale {
  // i18next-browser-languagedetector defaults to `i18next` cookie key
  const cookieLng = normalizeLocale(cookies().get('i18next')?.value)
  if (cookieLng)
    return cookieLng

  const accept = headers().get('accept-language')
  const acceptLng = normalizeLocale(accept?.split(',')?.[0])
  return acceptLng ?? 'zh'
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


