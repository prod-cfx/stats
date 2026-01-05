'use client'

import i18n from 'i18next'
import LanguageDetector from 'i18next-browser-languagedetector'
import { initReactI18next } from 'react-i18next'

import enCommon from '../../public/locales/en/common.json'
import zhCommon from '../../public/locales/zh/common.json'

// Prevent multiple initializations
if (!i18n.isInitialized) {
  const isBrowser = typeof window !== 'undefined'
  i18n
    // Detect user language ONLY in the browser.
    // On the server (SSR of client components), using LanguageDetector can pick up Node env locale (often "en")
    // and cause hydration mismatch (server "en" vs client "zh").
    .use(isBrowser ? LanguageDetector : { type: '3rdParty', init: () => {} } as any)
    // pass the i18n instance to react-i18next.
    .use(initReactI18next)
    // init i18next
    // for all options read: https://www.i18next.com/overview/configuration-options
    .init({
      // Default to Chinese. Browser will still auto-detect via LanguageDetector.
      fallbackLng: 'zh',
      // Force a deterministic language during SSR to avoid hydration mismatch.
      lng: isBrowser ? undefined : 'zh',
      debug: process.env.NODE_ENV === 'development',

      supportedLngs: ['zh', 'en'],
      nonExplicitSupportedLngs: true,
      
      interpolation: {
        escapeValue: false, // not needed for react as it escapes by default
      },

      defaultNS: 'common',
      ns: ['common'],
      resources: {
        en: { common: enCommon },
        zh: { common: zhCommon },
      },

      react: {
        useSuspense: false,
      },
    })
}

// Ensure newly added translation keys are available even during HMR,
// because the init() block runs only once due to the isInitialized guard.
i18n.addResourceBundle('en', 'common', enCommon, true, true)
i18n.addResourceBundle('zh', 'common', zhCommon, true, true)

export default i18n

