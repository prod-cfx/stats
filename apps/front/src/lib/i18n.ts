'use client'

import i18n from 'i18next'
import LanguageDetector from 'i18next-browser-languagedetector'
import { initReactI18next } from 'react-i18next'

import enCommon from '../../public/locales/en/common.json'
import zhCommon from '../../public/locales/zh/common.json'

// Prevent multiple initializations
if (!i18n.isInitialized) {
  i18n
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

export default i18n

