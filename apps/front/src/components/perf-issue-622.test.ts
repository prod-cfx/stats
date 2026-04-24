import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from '@jest/globals'
import { getServerTranslator } from '@/lib/i18n/server'

const FRONT_ROOT = join(__dirname, '..')

function readFrontSource(relativePath: string) {
  return readFileSync(join(FRONT_ROOT, relativePath), 'utf8')
}

describe('issue #622 page-level RSC boundaries', () => {
  it('supports explicit server-side locale translation for page shells', async () => {
    const getTranslator = getServerTranslator as unknown as (locale: 'zh' | 'en') => Promise<{
      lng: 'zh' | 'en'
      t: (key: string) => string
    }>

    const zh = await getTranslator('zh')
    const en = await getTranslator('en')

    expect(zh.lng).toBe('zh')
    expect(en.lng).toBe('en')
    expect(zh.t('common.loading')).toBe('加载中...')
    expect(en.t('common.loading')).toBe('Loading...')
  })

  it('keeps translation-only entry pages as server components', () => {
    const translationOnlyPages = [
      'app/[lng]/aggregated-orderbook/page.tsx',
      'app/[lng]/liquidation-data/page.tsx',
      'app/[lng]/public-companies/page.tsx',
      'app/[lng]/whale-tracking/discover/page.tsx',
      'app/[lng]/whale-tracking/holdings/page.tsx',
      'app/[lng]/whale-tracking/realtime/page.tsx',
      'app/[lng]/whale-tracking/profile/page.tsx',
      'app/[lng]/whale-tracking/notifications/page.tsx',
      'app/[lng]/long-short-ratio/page.tsx',
      'app/[lng]/prediction-market/page.tsx',
      'app/[lng]/liquidation-map/page.tsx',
    ] as const

    for (const file of translationOnlyPages) {
      const source = readFrontSource(file)
      expect(source).not.toContain("'use client'")
      expect(source).not.toContain('useTranslation(')
      expect(source).toContain("from '@/lib/i18n/server'")
      expect(source).toContain('getServerTranslator')
    }
  })

  it('moves client-only hooks out of the remaining page entrypoints', () => {
    const pageToClientBoundary = [
      ['app/[lng]/page.tsx', 'MarketPageClient'],
      ['app/[lng]/account/page.tsx', 'AccountPageClient'],
      ['app/[lng]/auth/login/page.tsx', 'LoginPageClient'],
      ['app/[lng]/auth/telegram/callback/page.tsx', 'TelegramCallbackPageClient'],
      ['app/(redirect)/page.tsx', 'RootRedirectClient'],
    ] as const

    for (const [file, clientBoundary] of pageToClientBoundary) {
      const source = readFrontSource(file)
      expect(source).not.toContain("'use client'")
      expect(source).not.toContain('useRouter(')
      expect(source).not.toContain('useParams(')
      expect(source).not.toContain('useSearchParams(')
      expect(source).toContain(clientBoundary)
    }
  })

  it('keeps extracted client boundaries colocated and explicitly client-only', () => {
    const clientBoundaryFiles = [
      'app/[lng]/MarketPageClient.tsx',
      'app/[lng]/account/AccountPageClient.tsx',
      'app/[lng]/auth/login/LoginPageClient.tsx',
      'app/[lng]/auth/telegram/callback/TelegramCallbackPageClient.tsx',
      'app/(redirect)/RootRedirectClient.tsx',
    ] as const

    for (const file of clientBoundaryFiles) {
      const source = readFrontSource(file)
      expect(source).toContain("'use client'")
    }
  })
})
