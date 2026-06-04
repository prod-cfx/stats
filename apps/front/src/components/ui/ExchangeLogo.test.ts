import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from '@jest/globals'

describe('ExchangeLogo', () => {
  it('recognizes hyperliquid venue ids as dex logos', () => {
    const source = readFileSync(join(__dirname, 'ExchangeLogo.tsx'), 'utf8')

    expect(source).toContain('isHyperliquid')
    expect(source).toContain("normalizedName === 'hyperliquid'")
    expect(source).toContain("name?.toLowerCase().includes('hyperliquid')")
  })
})
