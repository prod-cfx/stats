'use client'

import i18next from 'i18next'
import LanguageDetector from 'i18next-browser-languagedetector'
import { initReactI18next } from 'react-i18next'

import enCommon from '../../public/locales/en/common.json'
import zhCommon from '../../public/locales/zh/common.json'

export type AppLocale = 'zh' | 'en'

export function createAppI18n(initialLocale: AppLocale) {
  const instance = i18next.createInstance()
  const isBrowser = typeof window !== 'undefined'

  if (isBrowser) {
    instance.use(LanguageDetector)
  }

  instance.use(initReactI18next)

  // NOTE: initImmediate=false makes init synchronous on the server-render pass of Client Components
  // so SSR HTML is rendered in the correct request locale.
  // On the browser it still works fine and avoids a flash/mismatch.
  instance.init({
    initImmediate: false,
    lng: initialLocale,
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
    detection: {
      // Prefer server-provided cookie; fall back to browser language.
      order: ['cookie', 'navigator'],
      caches: ['cookie'],
      lookupCookie: 'i18next',
    },
    react: { useSuspense: false },
    debug: process.env.NODE_ENV === 'development',
  })

  // Ensure newly added translation keys are available even during HMR
  instance.addResourceBundle('en', 'common', enCommon as any, true, true)
  instance.addResourceBundle('zh', 'common', zhCommon as any, true, true)

  return instance
}

