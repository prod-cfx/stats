'use client'

import i18n from 'i18next'
import LanguageDetector from 'i18next-browser-languagedetector'
import Backend from 'i18next-http-backend'
import { initReactI18next } from 'react-i18next'

// Prevent multiple initializations
if (!i18n.isInitialized) {
  i18n
    // load translation using http -> see /public/locales (i.e. https://github.com/i18next/react-i18next/tree/master/example/react/public/locales)
    // learn more: https://github.com/i18next/i18next-http-backend
    .use(Backend)
    // detect user language
    // learn more: https://github.com/i18next/i18next-browser-languagedetector
    .use(LanguageDetector)
    // pass the i18n instance to react-i18next.
    .use(initReactI18next)
    // init i18next
    // for all options read: https://www.i18next.com/overview/configuration-options
    .init({
      // Default to Chinese, but allow automatic detection via LanguageDetector
      fallbackLng: 'zh',
      debug: process.env.NODE_ENV === 'development',

      supportedLngs: ['zh', 'en'],
      nonExplicitSupportedLngs: true,
      
      interpolation: {
        escapeValue: false, // not needed for react as it escapes by default
      },
      
      backend: {
        loadPath: '/locales/{{lng}}/{{ns}}.json',
      },

      defaultNS: 'common',
      ns: ['common'],

      react: {
        useSuspense: false,
      },
    })
}

export default i18n

