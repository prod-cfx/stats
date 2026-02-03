import {
  parseBbxCompactNumber,
  parseBbxMarketCapText,
  parseBbxPriceText,
  parseBbxStockInfoFromCompanyCell,
} from './bbx-crypto-stock-scraper.job'

describe('bbx-crypto-stock-scraper parsing', () => {
  describe('parseBbxCompactNumber', () => {
    it('parses B suffix with spaces', () => {
      expect(parseBbxCompactNumber('1386.6 B')).toBe(1386.6e9)
    })

    it('parses B suffix without spaces', () => {
      expect(parseBbxCompactNumber('233.51B')).toBe(233.51e9)
    })

    it('parses values with commas', () => {
      expect(parseBbxCompactNumber('1,386.6 B')).toBe(1386.6e9)
    })

    it('parses T/M/K suffix', () => {
      expect(parseBbxCompactNumber('1.2T')).toBe(1.2e12)
      expect(parseBbxCompactNumber('10.72 M')).toBe(10.72e6)
      expect(parseBbxCompactNumber('673.78K')).toBe(673.78e3)
    })

    it('returns undefined for empty or invalid input', () => {
      expect(parseBbxCompactNumber('')).toBeUndefined()
      expect(parseBbxCompactNumber('-')).toBeUndefined()
      expect(parseBbxCompactNumber('USD')).toBeUndefined()
      expect(parseBbxCompactNumber('not a number')).toBeUndefined()
    })
  })

  describe('parseBbxMarketCapText', () => {
    it('parses multiline market cap cell text', () => {
      expect(parseBbxMarketCapText('1386.6 B\nUSD')).toBe(1386.6e9)
      expect(parseBbxMarketCapText('45.4 B\nHKD')).toBe(45.4e9)
    })

    it('returns undefined for missing value', () => {
      expect(parseBbxMarketCapText('-')).toBeUndefined()
    })
  })

  describe('parseBbxPriceText', () => {
    it('parses price with $ and commas', () => {
      expect(parseBbxPriceText('$1,234.56')).toBe(1234.56)
      expect(parseBbxPriceText('1,234.56')).toBe(1234.56)
    })

    it('returns undefined for empty or invalid input', () => {
      expect(parseBbxPriceText('')).toBeUndefined()
      expect(parseBbxPriceText('-')).toBeUndefined()
      expect(parseBbxPriceText('USD')).toBeUndefined()
      expect(parseBbxPriceText('not a number')).toBeUndefined()
    })
  })

  describe('parseBbxStockInfoFromCompanyCell', () => {
    it('parses NASDAQ symbols', () => {
      expect(parseBbxStockInfoFromCompanyCell('特斯拉 TSLA 美股-NASDAQ')).toEqual({
        symbol: 'TSLA',
        exchange: 'NASDAQ',
      })
      expect(parseBbxStockInfoFromCompanyCell('Reddit RDDT 美股 - NASDAQ')).toEqual({
        symbol: 'RDDT',
        exchange: 'NASDAQ',
      })
    })

    it('parses NYSE symbols', () => {
      expect(parseBbxStockInfoFromCompanyCell('BlackRock BLK 美股-NYSE')).toEqual({
        symbol: 'BLK',
        exchange: 'NYSE',
      })
      expect(parseBbxStockInfoFromCompanyCell('MercadoLibre MELI 美股 - NYSE')).toEqual({
        symbol: 'MELI',
        exchange: 'NYSE',
      })
    })
  })
})
