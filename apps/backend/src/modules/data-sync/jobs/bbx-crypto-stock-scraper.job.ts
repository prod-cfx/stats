import type { DataPullJob, DataPullJobContext, JobMetaSchema, JobRunResult } from '../contracts/data-pull-job'
import { Injectable, Logger } from '@nestjs/common'
import { chromium } from 'playwright'
// eslint-disable-next-line ts/consistent-type-imports
import { CryptoStockQuotesRepository } from '@/modules/crypto-stock-quotes/crypto-stock-quotes.repository'

/**
 * 从 BBX 页面抓取的币股数据结构
 */
interface BbxScrapedQuote {
  symbol: string
  name: string
  exchange: string
  companyType?: string
  mNav?: number
  marketCap?: number
  holdingValue?: number
  holdingQuantity?: number
  holdingCoin?: string
  price: number
  priceChangePercent?: number
}

interface BbxScraperJobCursor {
  lastFetchTime?: string
}

/**
 * 任务级配置参数
 */
interface BbxScraperMeta {
  /**
   * 目标页面 URL（可选，默认使用 BBX 传统金融页面）
   */
  url?: string
  /**
   * 页面加载等待时间（毫秒）
   */
  waitTimeout?: number
}

/**
 * BBX 币股数据页面抓取 Job
 *
 * 功能：
 * - 使用 Playwright 无头浏览器抓取 BBX 传统金融页面数据
 * - 提取币股报价、mNAV、持仓等信息
 * - 自动去重和更新数据
 *
 * 配置：
 * - data_pull_tasks.meta.url: 目标页面 URL（可选）
 * - data_pull_tasks.meta.waitTimeout: 页面等待时间（可选，默认 10000ms）
 */
@Injectable()
export class BbxCryptoStockScraperJob implements DataPullJob<BbxScraperMeta> {
  readonly key = 'bbx-crypto-stock-scraper'
  readonly name = 'BBX 币股数据页面抓取'
  readonly metaSchema: JobMetaSchema = {
    description: '从 BBX 加密概念股页面抓取币股报价数据（仅保留持币价值≥1B的记录）',
    fields: [
      {
        name: 'url',
        type: 'string',
        required: false,
        description: '目标页面 URL',
        defaultValue: 'https://bbx.com/zh-Hans',
      },
      {
        name: 'waitTimeout',
        type: 'number',
        required: false,
        description: '页面加载等待时间（毫秒）',
        defaultValue: 10000,
      },
    ],
    example: {
      url: 'https://bbx.com/zh-Hans',
      waitTimeout: 10000,
    },
  }
  private readonly logger = new Logger(BbxCryptoStockScraperJob.name)

  // ========== 业务规则常量 ==========

  /** 持币价值最小阈值（USD），仅保留≥此值的记录 */
  private static readonly MIN_HOLDING_VALUE_THRESHOLD = 1e9

  // ========== 正则表达式常量 ==========

  /** 股票代码和交易所：匹配 "MSTR美股-NASDAQ" 或 "dMSTR美股-NYSE"，允许 2-6 位字母前缀 */
  private static readonly STOCK_INFO_REGEX = /([A-Z]{2,6})美股-(NASDAQ|NYSE|OTCMARKETS)/i

  /** 从带前缀的符号中提取纯大写股票代码：如 dMSTR -> MSTR */
  private static readonly SYMBOL_EXTRACT_REGEX = /([A-Z]{2,5})$/

  /** 公司名称：匹配以常见公司后缀结尾的英文名称 */
  // eslint-disable-next-line regexp/no-dupe-characters-character-class
  private static readonly COMPANY_NAME_REGEX = /([A-Za-z][A-Za-z\s.,'&()/-]+?(?:Inc\.?|Corp\.?|Ltd\.?|Group|Company|Solutions|Holdings|Technologies|Immersion|Industries)?)(?=[A-Z]{2,6}美股)/i

  /** 公司类型：在交易所信息后、价格前的文本 */
  // eslint-disable-next-line regexp/no-dupe-characters-character-class, regexp/no-useless-lazy
  private static readonly COMPANY_TYPE_REGEX = /美股-(?:NASDAQ|NYSE|OTCMARKETS)\s*([A-Za-z][A-Za-z\s/]*?)(?=\d)/i

  /** mNAV：交易所信息后的 4 位小数格式（如 0.8120） */
  // eslint-disable-next-line regexp/prefer-d
  private static readonly MNAV_REGEX = /美股-(?:NASDAQ|NYSE|OTCMARKETS)[^0-9]*(\d\.\d{4})/i

  /** 市值：mNAV 后紧跟的数字 + B/M/K USD 格式（如 44.52 BUSD） */
  // eslint-disable-next-line regexp/no-super-linear-backtracking
  private static readonly MARKET_CAP_REGEX = /\d\.\d{4}(\d+\.?\d*)\s*([BMK])USD/i

  /** 持仓金额：$+数字+B/M/K后缀，排除市值（紧跟USD）（如 $61.98B） */
  private static readonly HOLDING_VALUE_REGEX = /\$([\d,.]+)([BMK])(?!USD)/i

  /** 持仓数量：持仓金额后的 数字+单位(可选)+币种，如 64.50BUSDC 或 49940BTC */
  private static readonly HOLDING_QTY_REGEX = /([0-9,.]+)(?:([BMK])([A-Z]{3,5})|([A-Z]{2,5}))(?=\$)/i

  /** 涨跌幅：价格后的百分比（如 +0.00% 或 -1.23%） */
  // eslint-disable-next-line regexp/no-super-linear-backtracking
  private static readonly PRICE_CHANGE_REGEX = /\$[\d,.]+([+-]?\d+\.\d+)%/

  constructor(private readonly repo: CryptoStockQuotesRepository) {}

  async run(ctx: DataPullJobContext<BbxScraperMeta>): Promise<JobRunResult> {
    const cursor = this.parseCursor(ctx.cursor)
    const url = ctx.meta?.url ?? 'https://bbx.com/zh-Hans'
    const waitTimeout = ctx.meta?.waitTimeout ?? 10000

    this.logger.log(`Starting BBX page scrape from: ${url}`)

    const browser = await chromium.launch({
      headless: true,
      args: [
        '--disable-gpu',
        '--no-sandbox',
        '--disable-dev-shm-usage',
        '--disable-extensions',
        '--disable-background-networking',
        '--disable-default-apps',
        '--disable-sync',
        '--disable-translate',
        '--metrics-recording-only',
        '--mute-audio',
        '--no-first-run',
      ],
    })

    try {
      const context = await browser.newContext({
        userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        viewport: { width: 1920, height: 1080 },
        locale: 'zh-CN',
      })

      const page = await context.newPage()

      await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 })


      // 点击"全部"按钮展开完整列表
      try {
        const allButtons = await page.locator('text="全部"').all()
        if (allButtons.length > 0) {
          await allButtons[0].click()
          this.logger.log('Clicked "全部" button')

          // 等待table元素出现（最多10秒）
          await page.waitForSelector('table tbody tr', { timeout: 10000 })
          this.logger.log('Table rows appeared after clicking "全部"')

          // 额外等待2秒确保数据完全加载
          await page.waitForTimeout(2000)
        }
      } catch (error) {
        this.logger.warn(`Failed to click "全部" button or wait for table: ${error instanceof Error ? error.message : String(error)}`)
      }

      // 点击"持币价值"列头2次（降序排序）
      try {
        const holdingValueHeader = page.locator('text="持币价值"').first()

        // 先等待元素可见（最多10秒）
        await holdingValueHeader.waitFor({ state: 'visible', timeout: 10000 })

        await holdingValueHeader.click()
        this.logger.log('Clicked "持币价值" header (1st time - ascending)')
        await page.waitForTimeout(2000)

        await holdingValueHeader.click()
        this.logger.log('Clicked "持币价值" header (2nd time - descending)')
        await page.waitForTimeout(3000)
      } catch (error) {
        this.logger.warn(`Failed to click "持币价值" header: ${error instanceof Error ? error.message : String(error)}`)
        // 点击失败不影响继续执行，直接提取当前可见数据
        this.logger.log('Continuing without sorting, will extract visible data')
      }

      // 等待数据表格加载：优先等待元素出现，失败后 fallback 到固定等待
      try {
        await page.waitForSelector('table tbody tr', { timeout: waitTimeout })
      } catch {
        this.logger.warn('waitForSelector timeout, falling back to fixed wait')
        await page.waitForTimeout(waitTimeout)

        // Fallback 后检测页面状态，区分「加载失败」和「无数据」
        const pageContent = await page.content()
        const hasErrorIndicator = pageContent.includes('error') || pageContent.includes('失败') || pageContent.includes('网络异常')
        const hasNoDataIndicator = pageContent.includes('暂无数据') || pageContent.includes('no data')
        const rowsAfterWait = await page.$$('table tbody tr')

        if (rowsAfterWait.length === 0) {
          if (hasErrorIndicator) {
            this.logger.error('Page load failed: detected error indicators in page content')
          } else if (hasNoDataIndicator) {
            this.logger.warn('Page loaded but contains no data indicator')
          } else {
            this.logger.warn(`Page state unclear: no .crypto-row found after fallback wait. URL: ${url}`)
          }
        } else {
          this.logger.log(`Found ${rowsAfterWait.length} table rows after fallback wait`)
        }
      }

      // 提取表格数据
      const quotes = await this.extractQuotes(page)

      if (quotes.length === 0) {
        this.logger.warn('No quotes extracted from BBX page')
        return {
          fetchedCount: 0,
          newCursor: JSON.stringify({ ...cursor, lastFetchTime: new Date().toISOString() }),
          meta: { note: 'No quotes extracted' },
        }
      }

      this.logger.log(`Extracted ${quotes.length} quotes from BBX page`)

      // 写入数据库
      const quoteTimestamp = new Date()
      const count = await this.repo.upsertQuotes(
        quotes.map(quote => ({
          symbol: quote.symbol,
          name: quote.name,
          exchange: quote.exchange,
          price: quote.price,
          openPrice: null,
          highPrice: null,
          lowPrice: null,
          closePrice: null,
          volume: null,
          turnover: null,
          priceChange: null,
          priceChangePercent: quote.priceChangePercent ?? null,
          marketCap: quote.marketCap ?? null,
          peRatio: null,
          high52Week: null,
          low52Week: null,
          mNav: quote.mNav ?? null,
          holdingValue: quote.holdingValue ?? null,
          holdingQuantity: quote.holdingQuantity ?? null,
          companyType: quote.companyType ?? null,
          source: 'BBX_SCRAPER',
          quoteTimestamp,
          rawData: quote,
        })),
      )

      const newCursor: BbxScraperJobCursor = {
        lastFetchTime: new Date().toISOString(),
      }

      return {
        fetchedCount: count,
        newCursor: JSON.stringify(newCursor),
        meta: {
          symbols: quotes.map(q => q.symbol),
          fetchTime: newCursor.lastFetchTime,
        },
      }
    } finally {
      await browser.close()
    }
  }

  /**
   * 从页面提取币股数据
   * 使用表格行选择器获取数据行，从行文本中正则提取各字段
   */
  private async extractQuotes(page: import('playwright').Page): Promise<BbxScrapedQuote[]> {
    const quotes: BbxScrapedQuote[] = []

    // 使用 .crypto-row 选择器获取所有数据行
    const rows = await page.$$('table tbody tr, .ant-table-tbody tr')
    this.logger.log(`Found ${rows.length} table rows`)

    const texts = await Promise.all(rows.map(row => row.textContent()))

    for (let i = 0; i < texts.length; i++) {
      try {
        const text = texts[i]
        if (!text) continue

        const stockInfoMatch = text.match(BbxCryptoStockScraperJob.STOCK_INFO_REGEX)
        if (!stockInfoMatch) continue

        const rawSymbol = stockInfoMatch[1]
        const symbolMatch = rawSymbol.match(BbxCryptoStockScraperJob.SYMBOL_EXTRACT_REGEX)
        if (!symbolMatch) continue

        const symbol = symbolMatch[1]
        const exchange = stockInfoMatch[2].toUpperCase()

        const nameMatch = text.match(BbxCryptoStockScraperJob.COMPANY_NAME_REGEX)
        const typeMatch = text.match(BbxCryptoStockScraperJob.COMPANY_TYPE_REGEX)
        const mNavMatch = text.match(BbxCryptoStockScraperJob.MNAV_REGEX)
        const mNavStr = mNavMatch?.[1]
        const marketCapMatch = text.match(BbxCryptoStockScraperJob.MARKET_CAP_REGEX)
        const holdingMatch = text.match(BbxCryptoStockScraperJob.HOLDING_VALUE_REGEX)
        const holdingQtyMatch = text.match(BbxCryptoStockScraperJob.HOLDING_QTY_REGEX)

        // 提取股价：找到后面紧跟涨跌幅的价格
        const priceMatches = text.match(/\$([\d,.]+)/g)
        let stockPrice: number | undefined
        for (const pm of priceMatches ?? []) {
          const priceIndex = text.indexOf(pm)
          const afterPrice = text.slice(priceIndex + pm.length, priceIndex + pm.length + 10)
          if (afterPrice.match(/^[+-]?\d+\.\d+%/)) {
            stockPrice = this.parseNumber(pm.replace('$', ''))
            break
          }
        }

        const changeMatch = text.match(BbxCryptoStockScraperJob.PRICE_CHANGE_REGEX)

        const quote: BbxScrapedQuote = {
          symbol,
          name: nameMatch?.[1]?.trim() ?? symbol,
          exchange,
          companyType: typeMatch?.[1]?.trim(),
          mNav: mNavStr ? this.parseNumber(mNavStr) : undefined,
          marketCap: marketCapMatch ? this.parseMarketCap(`${marketCapMatch[1]}${marketCapMatch[2]}`) : undefined,
          holdingValue: holdingMatch ? this.parseMarketCap(`${holdingMatch[1]}${holdingMatch[2] ?? ''}`) : undefined,
          holdingQuantity: holdingQtyMatch
            ? this.parseMarketCap(`${holdingQtyMatch[1]}${holdingQtyMatch[2] ?? ''}`)
            : undefined,
          holdingCoin: holdingQtyMatch?.[3] || holdingQtyMatch?.[4],
          price: stockPrice ?? 0,
          priceChangePercent: changeMatch ? this.parseNumber(changeMatch[1]) : undefined,
        }

        if (quote.price > 0) {
          quotes.push(quote)
          this.logger.debug(`Extracted [${i}] ${quote.symbol}: price=$${quote.price}, mNav=${quote.mNav}`)
        }
      } catch (error) {
        this.logger.warn(`Failed to extract row ${i}: ${error instanceof Error ? error.message : String(error)}`)
      }
    }

    // 只保留持币价值≥1B的记录
    const filtered = quotes.filter(
      q => (q.holdingValue ?? 0) >= BbxCryptoStockScraperJob.MIN_HOLDING_VALUE_THRESHOLD,
    )
    this.logger.log(
      `Filtered ${quotes.length} quotes to ${filtered.length} with holdingValue ≥ ${BbxCryptoStockScraperJob.MIN_HOLDING_VALUE_THRESHOLD / 1e9}B`,
    )

    // 调试：输出前5个被过滤的原因
    if (filtered.length === 0 && quotes.length > 0) {
      const samples = quotes.slice(0, 5)
      this.logger.warn(`Sample filtered quotes:`)
      samples.forEach(q => {
        this.logger.warn(`  ${q.symbol}: holdingValue=${q.holdingValue ?? 'undefined'}`)
      })
    }

    return filtered
  }

  /**
   * 解析数值
   */
  private parseNumber(text: string): number | undefined {
    if (!text || text === '-') return undefined
    const cleaned = text.replace(/[,$\s]/g, '')
    const num = Number.parseFloat(cleaned)
    return Number.isNaN(num) ? undefined : num
  }

  /**
   * 解析市值（支持 B/M/K 后缀）
   */
  private parseMarketCap(text: string): number | undefined {
    if (!text || text === '-') return undefined
    const match = text.match(/\$?([\d,.]+)\s*([BMK])?/i)
    if (!match) return undefined

    let value = this.parseNumber(match[1])
    if (!value) return undefined

    const suffix = match[2]?.toUpperCase()
    if (suffix === 'B') value *= 1e9
    else if (suffix === 'M') value *= 1e6
    else if (suffix === 'K') value *= 1e3

    return value
  }

  private parseCursor(currentCursor: string | null): BbxScraperJobCursor {
    if (!currentCursor) return {}
    try {
      return JSON.parse(currentCursor) as BbxScraperJobCursor
    } catch {
      this.logger.warn(`Failed to parse cursor: ${currentCursor}`)
      return {}
    }
  }
}
