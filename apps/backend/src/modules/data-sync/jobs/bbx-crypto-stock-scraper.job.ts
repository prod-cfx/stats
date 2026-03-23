import type { APIRequestContext } from 'playwright'
import type {
  DataPullJob,
  DataPullJobContext,
  JobMetaSchema,
  JobRunResult,
} from '../contracts/data-pull-job'
import { Injectable, Logger } from '@nestjs/common'
import { chromium } from 'playwright'

import { defaultEnvAccessor } from '@/common/env/env.accessor'
// eslint-disable-next-line ts/consistent-type-imports
import { CryptoStockQuotesRepository } from '@/modules/crypto-stock-quotes/crypto-stock-quotes.repository'
import { DataSyncOperationTimeoutException } from '../exceptions/data-sync-operation-timeout.exception'

const SYMBOL_EXTRACT_REGEX = /([A-Z][A-Z0-9.]{1,9})/g

export function parseBbxCompactNumber(input: string): number | undefined {
  const text = normalizeBbxWhitespace(input)
  if (!text || text === '-') return undefined

  // Normalize spaces/newlines like: "1386.6 B\nUSD" -> "1386.6 B USD"
  const normalized = normalizeBbxWhitespace(text)

  // Match: 1,386.6 B | 233.51B | 10.72 B | 45.4 BUSD | 210.66 MUSD | 45.4 B HKD
  // NOTE: BBX sometimes renders unit+currency without whitespace, e.g. "41.11 BUSD".
  const match = normalized.match(/([\d,.]+)\s*([TBMK])(?=\b|[A-Z])/i)
  if (!match) return undefined

  const rawNum = match[1]!.replace(/,/g, '')
  const num = Number.parseFloat(rawNum)
  if (Number.isNaN(num)) return undefined

  const suffix = match[2]!.toUpperCase()
  if (suffix === 'T') return num * 1e12
  if (suffix === 'B') return num * 1e9
  if (suffix === 'M') return num * 1e6
  if (suffix === 'K') return num * 1e3
  return undefined
}

function normalizeBbxWhitespace(input: string): string {
  return input
    .replace(/[\u00A0\u202F\u200B\uFEFF]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

export function parseBbxMarketCapText(input: string): number | undefined {
  // Market cap cell often looks like:
  // "1386.6 B\nUSD" or "45.4 B\nHKD" or "-"
  return parseBbxCompactNumber(input)
}

export function parseBbxPriceText(input: string): number | undefined {
  const text = normalizeBbxWhitespace(input)
  if (!text || text === '-') return undefined
  const normalized = normalizeBbxWhitespace(text)
  // Price is usually a plain number, sometimes with $ and commas.
  const match = normalized.match(/\$?\s*([\d,.]+)/)
  if (!match) return undefined
  const raw = match[1]!.replace(/,/g, '')
  const num = Number.parseFloat(raw)
  return Number.isNaN(num) ? undefined : num
}

interface ParsedStockInfo {
  symbol: string
  exchange: string
}

export function parseBbxStockInfoFromCompanyCell(input: string): ParsedStockInfo | undefined {
  const normalized = normalizeBbxWhitespace(input.replace(/[—–−]/g, '-'))
  if (!normalized) return undefined

  // 先定位市场标识与交易所（这比假设 symbol 在行首更稳健）
  const marketRe = /(美股|港股|加股|英股|日股|韩股|德股|法股|澳股)\s*-\s*([A-Z0-9-]+)/i
  const marketMatch = normalized.match(marketRe)
  if (!marketMatch || marketMatch.index == null) return undefined

  const exchange = marketMatch[2]!.toUpperCase()

  // 在 market 标识之前寻找最靠近它的 symbol 候选（处理 "...MSTR美股-NASDAQ"）
  const prefix = normalized.slice(0, marketMatch.index)
  SYMBOL_EXTRACT_REGEX.lastIndex = 0
  const matches = Array.from(prefix.matchAll(SYMBOL_EXTRACT_REGEX))
    .map(m => m[1])
    .filter(Boolean)
  if (matches.length === 0) return undefined

  return {
    symbol: matches[matches.length - 1]!,
    exchange,
  }
}

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
  rawData?: Record<string, unknown>
}

interface BbxCompanyListItem {
  symbol: string
  name?: string
  exchange?: string
  companyType?: string
  price?: number
  priceChangePercent?: number
  marketCap?: number
  mNav?: number
  holdingValue?: number
  holdingQuantity?: number
  holdingCoin?: string
  rawMarketCap?: string
  rawData?: Record<string, unknown>
}

interface BbxCompanyListFetchResult {
  items: BbxCompanyListItem[]
  totalCount: number
  filteredSymbols: string[]
  filteredCount: number
  filteredTotalCount: number
  sortCheckPassed: boolean
  usedLocalSort: boolean
  fetchSucceeded: boolean
  usedItems: BbxCompanyListItem[]
}

interface BbxCompanyListDiagnostics {
  topKeys: string[]
  dataKeys?: string[]
  listNodeKeys?: string[]
  listLength?: number
  sampleItemKeys?: string[][]
  sampleMarketCaps?: Array<{ key: string; value: string | number | boolean | null | undefined }>
}

interface BbxEnrichmentFailure {
  symbol: string
  reason: string
}

interface BbxEnrichmentStats {
  totalCount: number
  successCount: number
  failCount: number
  successRate: number
  failures: BbxEnrichmentFailure[]
  timeBudgetExceeded: boolean
}

interface BbxEnrichmentResult {
  quotes: BbxScrapedQuote[]
  stats: BbxEnrichmentStats
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
    description: '从 BBX 加密概念股页面抓取币股报价数据（仅保留市值≥1B的记录）',
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

  /** 市值最小阈值（USD），仅保留≥此值的记录 */
  private static readonly MIN_MARKET_CAP_THRESHOLD = 1e9
  private static readonly COMPANY_LIST_ENDPOINT = 'https://bbx.com/api/company-list?lan=cn'
  private static readonly SORT_CHECK_SAMPLE_SIZE = 10
  private static readonly ENRICHMENT_CONCURRENCY = 4
  private static readonly ENRICHMENT_MAX_RETRIES = 2
  private static readonly ENRICHMENT_PER_TICKER_TIMEOUT_MS = 25000
  private static readonly ENRICHMENT_TIME_BUDGET_MS = 12 * 60 * 1000
  private static readonly ENRICHMENT_MAX_SCROLL_ITERATIONS = 30

  // ========== 正则表达式常量 ==========

  /** 持仓金额：$+数字+B/M/K后缀，排除市值（紧跟USD）（如 $61.98B） */
  private static readonly HOLDING_VALUE_REGEX = /\$([\d,.]+)([BMK])(?!USD)/i

  /** 持仓数量：持仓金额后的 数字+单位(可选)+币种，如 64.50BUSDC 或 49940BTC */
  private static readonly HOLDING_QTY_REGEX =
    /([0-9,.]+)(?:([BMK])([A-Z]{3,5})|([A-Z]{2,5}))(?=\$)/i

  /** 涨跌幅：价格后的百分比（如 +0.00% 或 -1.23%） */
  // eslint-disable-next-line regexp/no-super-linear-backtracking
  private static readonly PRICE_CHANGE_REGEX = /\$[\d,.]+([+-]?\d+\.\d+)%/

  constructor(private readonly repo: CryptoStockQuotesRepository) {}

  async run(ctx: DataPullJobContext<BbxScraperMeta>): Promise<JobRunResult> {
    const cursor = this.parseCursor(ctx.cursor)
    const jobUrl = ctx.meta?.url ?? 'https://bbx.com/zh-Hans'
    const waitTimeout = ctx.meta?.waitTimeout ?? 10000
    this.logger.log(
      `Starting BBX company list fetch from: ${BbxCryptoStockScraperJob.COMPANY_LIST_ENDPOINT}`,
    )

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
        userAgent:
          'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        viewport: { width: 1920, height: 1080 },
        locale: 'zh-CN',
      })

      const listResult = await this.fetchCompanyList(context.request)
      this.logger.log(
        `BBX list API totals: total=${listResult.totalCount}, items=${listResult.items.length}, >=1B=${listResult.filteredCount}, sortCheck=${listResult.sortCheckPassed ? 'pass' : 'local-sort'}`,
      )
      this.logger.log(
        `BBX list API >=1B raw count (before holdingValue filter): ${listResult.filteredTotalCount}`,
      )
      if (!listResult.fetchSucceeded || listResult.items.length === 0) {
        this.logger.warn('BBX list API failed or returned empty list')
        return {
          fetchedCount: 0,
          newCursor: JSON.stringify({ ...cursor, lastFetchTime: new Date().toISOString() }),
          meta: { note: 'List API empty or failed' },
        }
      }

      const topItems = listResult.usedItems.length
        ? listResult.usedItems
        : listResult.items
            .filter(
              item => (item.marketCap ?? 0) >= BbxCryptoStockScraperJob.MIN_MARKET_CAP_THRESHOLD,
            )
            .slice()
            .sort((a, b) => (b.marketCap ?? 0) - (a.marketCap ?? 0))
            .slice(0, 30)

      if (topItems.length === 0) {
        this.logger.warn('No quotes extracted from BBX list API')
        return {
          fetchedCount: 0,
          newCursor: JSON.stringify({ ...cursor, lastFetchTime: new Date().toISOString() }),
          meta: { note: 'No quotes extracted from list API' },
        }
      }

      if (topItems.length < 10) {
        this.logger.warn(
          `BBX list API returned only ${topItems.length} records after filter; expected 10-30`,
        )
      }

      const domEnrichmentEnabled = defaultEnvAccessor.bool('BBX_SCRAPER_DOM_ENRICH')
      let domQuotesBySymbol: Map<string, BbxScrapedQuote> | undefined
      if (domEnrichmentEnabled) {
        this.logger.warn('BBX DOM enrichment enabled via BBX_SCRAPER_DOM_ENRICH=1')
        const symbols = topItems.map(item => item.symbol)
        const page = await context.newPage()
        try {
          await this.prepareConceptPage(page, jobUrl, waitTimeout)
          const domQuotes = await this.extractQuotes(page, undefined, new Set(symbols))
          this.logger.log(`BBX DOM extract enabled: quotes=${domQuotes.length}`)
        } finally {
          await page.close().catch(() => undefined)
        }
        const domResult = await this.enrichQuotesBySymbols(context, jobUrl, waitTimeout, symbols)
        this.logger.log(
          `BBX DOM enrichment enabled: successRate=${(domResult.stats.successRate * 100).toFixed(
            2,
          )}%, total=${domResult.stats.totalCount}, success=${domResult.stats.successCount}, fail=${domResult.stats.failCount}`,
        )
        domQuotesBySymbol = new Map(domResult.quotes.map(quote => [quote.symbol, quote]))
      }

      const quotes: BbxScrapedQuote[] = topItems.map(item => {
        const enriched = domQuotesBySymbol?.get(item.symbol)
        return {
          symbol: item.symbol,
          name: enriched?.name ?? item.name ?? item.symbol,
          exchange: enriched?.exchange ?? item.exchange ?? 'UNKNOWN',
          companyType: enriched?.companyType ?? item.companyType,
          mNav: enriched?.mNav ?? item.mNav ?? 0,
          marketCap: enriched?.marketCap ?? item.marketCap,
          holdingValue: enriched?.holdingValue ?? item.holdingValue ?? 0,
          holdingQuantity: enriched?.holdingQuantity ?? item.holdingQuantity ?? 0,
          holdingCoin: enriched?.holdingCoin ?? item.holdingCoin,
          price: enriched?.price ?? item.price ?? 0,
          priceChangePercent: enriched?.priceChangePercent ?? item.priceChangePercent,
          rawData: item.rawData,
        }
      })

      const missingPriceCount = quotes.filter(quote => !(quote.price > 0)).length
      if (missingPriceCount > 0) {
        this.logger.warn(`BBX list API missing price for ${missingPriceCount} records`)
      }

      const buildFailureReasons = (quote: BbxScrapedQuote): string[] => {
        const reasons: string[] = []
        if (!(quote.price > 0)) reasons.push('missing-price')
        if (!(quote.marketCap != null)) reasons.push('missing-marketCap')
        else if (quote.marketCap < BbxCryptoStockScraperJob.MIN_MARKET_CAP_THRESHOLD)
          reasons.push('marketCap-below-1b')
        return reasons
      }

      const failures: BbxEnrichmentFailure[] = []
      const successQuotes: BbxScrapedQuote[] = []
      const reasonCounts = new Map<string, number>()
      const missingPriceChangeSymbols: string[] = []

      for (const quote of quotes) {
        const reasons = buildFailureReasons(quote)
        if (reasons.length === 0) {
          successQuotes.push(quote)
        } else {
          failures.push({ symbol: quote.symbol, reason: reasons.join('|') })
          for (const reason of reasons) {
            reasonCounts.set(reason, (reasonCounts.get(reason) ?? 0) + 1)
          }
        }

        if (quote.priceChangePercent == null) missingPriceChangeSymbols.push(quote.symbol)
      }

      const totalCount = quotes.length
      // 业务硬规则：仅写入 holdingValue > 0 的记录。
      // 注意：该规则不参与 successRate 门禁，避免数据源部分标的无持仓时整批被跳过。
      const writableFilterFailures: BbxEnrichmentFailure[] = []
      const writableQuotes: BbxScrapedQuote[] = []
      for (const quote of successQuotes) {
        const isWritable = quote.holdingValue != null && quote.holdingValue > 0
        if (isWritable) {
          writableQuotes.push(quote)
        } else {
          writableFilterFailures.push({ symbol: quote.symbol, reason: 'invalid-holdingValue' })
        }
      }
      if (writableFilterFailures.length > 0) {
        failures.push(...writableFilterFailures)
        reasonCounts.set(
          'invalid-holdingValue',
          (reasonCounts.get('invalid-holdingValue') ?? 0) + writableFilterFailures.length,
        )
        this.logger.log(
          `BBX write filter: ${successQuotes.length} -> ${writableQuotes.length} (removed ${successQuotes.length - writableQuotes.length} with null/zero holdingValue)`,
        )
      }
      // successRate 只衡量抓取/解析质量（price + marketCap），不包含业务写入过滤。
      const qualitySuccessCount = successQuotes.length
      const qualityFailCount = totalCount - qualitySuccessCount
      const successRate = totalCount > 0 ? qualitySuccessCount / totalCount : 0
      const failureListSample = failures.slice(0, 20)
      const failureSummary = JSON.stringify(failureListSample)
      const reasonSummary = JSON.stringify(Object.fromEntries(reasonCounts.entries()))
      const missingPriceChangeSample = JSON.stringify(missingPriceChangeSymbols.slice(0, 20))

      this.logger.log(`Extracted ${quotes.length} quotes from BBX list API`)
      this.logger.log(
        `BBX validation: successRate=${(successRate * 100).toFixed(2)}%, total=${totalCount}, qualitySuccess=${qualitySuccessCount}, qualityFail=${qualityFailCount}, writable=${writableQuotes.length}, businessFiltered=${writableFilterFailures.length}, reasons=${reasonSummary}, missingPriceChange=${missingPriceChangeSymbols.length}, missingPriceChangeSample=${missingPriceChangeSample}, sampleFailures=${failureSummary}`,
      )

      if (successRate < 0.95) {
        this.logger.warn(
          `BBX write skipped: successRate=${(successRate * 100).toFixed(2)}% < 95%, total=${totalCount}, qualitySuccess=${qualitySuccessCount}, qualityFail=${qualityFailCount}, writable=${writableQuotes.length}`,
        )
        const newCursor: BbxScraperJobCursor = {
          lastFetchTime: new Date().toISOString(),
        }
        return {
          fetchedCount: 0,
          newCursor: JSON.stringify(newCursor),
          meta: {
            note: 'skipped: successRate below 95%',
            symbols: successQuotes.map(q => q.symbol),
            fetchTime: newCursor.lastFetchTime,
            totalCount,
            qualitySuccessCount,
            qualityFailCount,
            writableCount: writableQuotes.length,
            businessFilteredCount: writableFilterFailures.length,
          },
        }
      }

      const quoteTimestamp = new Date()
      if (writableQuotes.length === 0) {
        this.logger.warn('BBX write skipped: no writable quotes after holdingValue filter')
        return {
          fetchedCount: 0,
          newCursor: JSON.stringify({ ...cursor, lastFetchTime: quoteTimestamp.toISOString() }),
          meta: { note: 'no writable quotes after holdingValue filter' },
        }
      }
      const count = await this.repo.upsertBbxScraperQuotesBySymbolReplace(
        writableQuotes.map(quote => ({
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

      this.logger.log(
        `BBX write completed: fetchedCount=${count}, successRate=${(successRate * 100).toFixed(
          2,
        )}%, qualityFailures=${qualityFailCount}, businessFiltered=${writableFilterFailures.length}, sample=${failureSummary}`,
      )

      const newCursor: BbxScraperJobCursor = {
        lastFetchTime: new Date().toISOString(),
      }

      return {
        fetchedCount: count,
        newCursor: JSON.stringify(newCursor),
        meta: {
          symbols: successQuotes.map(q => q.symbol),
          fetchTime: newCursor.lastFetchTime,
          totalCount,
          qualitySuccessCount,
          qualityFailCount,
          writableCount: writableQuotes.length,
          businessFilteredCount: writableFilterFailures.length,
        },
      }
    } finally {
      await browser.close()
    }
  }

  private async prepareConceptPage(
    page: import('playwright').Page,
    url: string,
    waitTimeout: number,
    snapshot?: (phaseName: string) => Promise<void>,
  ): Promise<void> {
    try {
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 })
      this.logger.log(`Page loaded: ${url}`)
    } catch (error) {
      this.logger.warn(
        `Page goto timeout, continuing anyway: ${error instanceof Error ? error.message : String(error)}`,
      )
    }
    await snapshot?.('after-goto')

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
      this.logger.warn(
        `Failed to click "全部" button or wait for table: ${error instanceof Error ? error.message : String(error)}`,
      )
    }
    await snapshot?.('after-click-all')

    // 等待数据表格加载：优先等待元素出现，失败后 fallback 到固定等待
    try {
      await page.waitForSelector('table tbody tr', { timeout: waitTimeout })
      this.logger.log('Table rows appeared')

      // 额外等待确保数据填充（React/Vue等框架可能先渲染空行）
      await page.waitForTimeout(3000)
      this.logger.log('Waited 3s for data population')
    } catch {
      this.logger.warn('waitForSelector timeout, falling back to fixed wait')
      await page.waitForTimeout(waitTimeout)

      // Fallback 后检测页面状态，区分「加载失败」和「无数据」
      const pageContent = await page.content()
      const hasErrorIndicator =
        pageContent.includes('error') ||
        pageContent.includes('失败') ||
        pageContent.includes('网络异常')
      const hasNoDataIndicator = pageContent.includes('暂无数据') || pageContent.includes('no data')
      const rowsAfterWait = await page.$$('table tbody tr')

      if (rowsAfterWait.length === 0) {
        if (hasErrorIndicator) {
          this.logger.error('Page load failed: detected error indicators in page content')
        } else if (hasNoDataIndicator) {
          this.logger.warn('Page loaded but contains no data indicator')
        } else {
          this.logger.warn(
            `Page state unclear: no .crypto-row found after fallback wait. URL: ${url}`,
          )
        }
      } else {
        this.logger.log(`Found ${rowsAfterWait.length} table rows after fallback wait`)
      }
    }
  }

  private async getHeaderTexts(
    table: import('playwright').ElementHandle<HTMLElement>,
  ): Promise<string[]> {
    const fromThead = await table
      .$$eval('thead tr th, thead tr td', (ths: Element[]) =>
        ths.map(th => (th.textContent ?? '').replace(/\s+/g, ' ').trim()),
      )
      .catch(() => [])

    if (fromThead.length > 0) return fromThead

    const fromTh = await table
      .$$eval('tr th', (ths: Element[]) =>
        ths.map(th => (th.textContent ?? '').replace(/\s+/g, ' ').trim()),
      )
      .catch(() => [])

    if (fromTh.length > 0) return fromTh

    // Fallback: some tables don't render <thead>, treat first row as header.
    const maybeHeader = await table
      .$$eval('tbody tr:first-child td', (tds: Element[]) =>
        tds.map(td => (td.textContent ?? '').replace(/\s+/g, ' ').trim()),
      )
      .catch(() => [])

    const hasKnownHeader = maybeHeader.some(h => {
      const v = h.toLowerCase()
      return (
        v.includes('mnav') || v.includes('市值') || v.includes('market cap') || v.includes('价格')
      )
    })

    return hasKnownHeader ? maybeHeader : []
  }

  private async looksLikeConceptStockTable(
    table: import('playwright').ElementHandle<HTMLElement>,
    headers: string[],
  ): Promise<boolean> {
    // Column index might not be the first column (Table[0] has headers: 币种 | 公司 | ...)
    const companyColIndex = headers.findIndex(h => h.replace(/\s+/g, '').includes('公司'))
    const resolvedCompanyColIndex = companyColIndex >= 0 ? companyColIndex : 0

    const sampleCells = await table
      .$$eval(
        'tbody tr',
        (trs: Element[], idx: number) =>
          trs.slice(0, 8).map(tr => {
            const cells = Array.from(tr.querySelectorAll('td'))
            return (cells[idx]?.textContent ?? '').trim()
          }),
        resolvedCompanyColIndex,
      )
      .catch(() => [])

    return sampleCells.some(text => Boolean(parseBbxStockInfoFromCompanyCell(text)))
  }

  private async resolveTargetTable(page: import('playwright').Page): Promise<{
    table: import('playwright').ElementHandle<HTMLElement>
    headerTexts: string[]
  } | null> {
    // 先定位目标表格：必须同时包含 mNAV 与 市值/Market Cap 表头。
    // 优先选择“表头 + 行内容”都匹配的表；否则退化到仅表头匹配的表（避免识别过严导致 0 表）。
    const tables = await page.$$('table')
    let targetTable: import('playwright').ElementHandle<HTMLElement> | null = null
    let headerTexts: string[] = []

    // 先打印每张 table 的摘要，方便线上定位选择失败原因
    for (let i = 0; i < tables.length; i++) {
      const table = tables[i] as import('playwright').ElementHandle<HTMLElement>
      const headers = await this.getHeaderTexts(table)
      const hasMnav = headers.some(h => h.toLowerCase().includes('mnav'))
      const hasMarketCap = headers.some(h => {
        const v = h.toLowerCase()
        return v.includes('市值') || v.includes('market cap') || v.includes('市场价值')
      })
      const looksRight =
        hasMnav && hasMarketCap ? await this.looksLikeConceptStockTable(table, headers) : false
      this.logger.log(
        `Table[${i}] headers=${headers.join(' | ')}; hasMnav=${hasMnav}; hasMarketCap=${hasMarketCap}; looksLikeConceptStock=${looksRight}`,
      )
    }

    for (const table of tables) {
      const headers = await this.getHeaderTexts(
        table as import('playwright').ElementHandle<HTMLElement>,
      )

      const hasMnav = headers.some(h => h.toLowerCase().includes('mnav'))
      const hasMarketCap = headers.some(h => {
        const v = h.toLowerCase()
        return v.includes('市值') || v.includes('market cap') || v.includes('市场价值')
      })

      if (!hasMnav || !hasMarketCap) continue

      const looksRight = await this.looksLikeConceptStockTable(
        table as import('playwright').ElementHandle<HTMLElement>,
        headers,
      )
      if (!looksRight) continue

      targetTable = table as import('playwright').ElementHandle<HTMLElement>
      headerTexts = headers
      break
    }

    if (!targetTable) {
      for (const table of tables) {
        const headers = await this.getHeaderTexts(
          table as import('playwright').ElementHandle<HTMLElement>,
        )
        const hasMnav = headers.some(h => h.toLowerCase().includes('mnav'))
        const hasMarketCap = headers.some(h => {
          const v = h.toLowerCase()
          return v.includes('市值') || v.includes('market cap') || v.includes('市场价值')
        })
        if (hasMnav && hasMarketCap) {
          targetTable = table as import('playwright').ElementHandle<HTMLElement>
          headerTexts = headers
          this.logger.warn('Target table selected by headers only (content check failed)')
          break
        }
      }
    }

    if (!targetTable) {
      this.logger.warn(
        `No target table found (tables=${tables.length}). Skip extraction to avoid wrong table.`,
      )
      return null
    }

    return { table: targetTable, headerTexts }
  }

  private resolveCompanyColumnIndex(headerTexts: string[]): number {
    const companyHeaderIndex = headerTexts.findIndex(h => {
      const v = h.replace(/\s+/g, '').toLowerCase()
      return v.includes('公司') || v.includes('company')
    })
    return companyHeaderIndex >= 0 ? companyHeaderIndex : 1
  }

  private async resolvePriceColumnIndex(
    rows: import('playwright').ElementHandle<Element>[],
    headerTexts: string[],
    mNavHeaderIndex: number,
    marketCapHeaderIndex: number,
  ): Promise<number> {
    const priceHeaderIndex = headerTexts.findIndex(t => {
      const v = t.toLowerCase()
      return v.includes('价格') || v.includes('现价') || v.includes('price')
    })

    if (priceHeaderIndex >= 0) return priceHeaderIndex

    const sampleCount = Math.min(10, rows.length)
    const counts = new Map<number, number>()

    for (let i = 0; i < sampleCount; i++) {
      const cells: string[] = await rows[i]
        .$$eval('td', tds => tds.map(td => (td.textContent ?? '').trim()))
        .catch(() => [])

      for (let idx = 0; idx < cells.length; idx++) {
        if (idx === mNavHeaderIndex || idx === marketCapHeaderIndex) continue
        const price = parseBbxPriceText(cells[idx] ?? '')
        if (price && price > 0) counts.set(idx, (counts.get(idx) ?? 0) + 1)
      }
    }

    let bestIndex = -1
    let bestCount = 0
    for (const [idx, count] of counts.entries()) {
      if (count > bestCount) {
        bestCount = count
        bestIndex = idx
      }
    }

    if (bestIndex >= 0 && bestCount >= 3) return bestIndex
    if (mNavHeaderIndex > 0) return mNavHeaderIndex - 1
    if (marketCapHeaderIndex > 0) return marketCapHeaderIndex - 1
    return 1
  }

  private async findScrollableContainer(
    table: import('playwright').ElementHandle<HTMLElement>,
  ): Promise<import('playwright').ElementHandle<HTMLElement> | null> {
    try {
      const handle = await table.evaluateHandle((el: HTMLElement) => {
        let cur: HTMLElement | null = el
        for (let i = 0; i < 8 && cur; i++) {
          const style = window.getComputedStyle(cur)
          const overflowY = style.overflowY
          const canScroll =
            (overflowY === 'auto' || overflowY === 'scroll') &&
            cur.scrollHeight > cur.clientHeight + 24
          if (canScroll) return cur
          cur = cur.parentElement
        }
        return null
      })

      return handle.asElement() as import('playwright').ElementHandle<HTMLElement> | null
    } catch {
      return null
    }
  }

  public async enrichQuotesBySymbols(
    context: import('playwright').BrowserContext,
    url: string,
    waitTimeout: number,
    symbols: string[],
    snapshot?: (phaseName: string) => Promise<void>,
  ): Promise<BbxEnrichmentResult> {
    const startTime = Date.now()
    const timeBudgetMs = BbxCryptoStockScraperJob.ENRICHMENT_TIME_BUDGET_MS
    const maxRetries = BbxCryptoStockScraperJob.ENRICHMENT_MAX_RETRIES
    const perTickerTimeoutMs = BbxCryptoStockScraperJob.ENRICHMENT_PER_TICKER_TIMEOUT_MS
    const concurrency = BbxCryptoStockScraperJob.ENRICHMENT_CONCURRENCY
    const uniqueSymbols = Array.from(new Set(symbols.map(symbol => symbol.toUpperCase())))

    const quoteBySymbol = new Map<string, BbxScrapedQuote>()
    const failureBySymbol = new Map<string, string>()
    let timeBudgetExceeded = false

    const withTimeout = async <T>(promise: Promise<T>, timeoutMs: number): Promise<T> =>
      new Promise((resolve, reject) => {
        const timer = setTimeout(() => {
          reject(new DataSyncOperationTimeoutException({ operation: 'bbx-crypto-stock-scraper', timeoutMs }))
        }, timeoutMs)
        promise
          .then(resolve)
          .catch(reject)
          .finally(() => clearTimeout(timer))
      })

    const processSymbol = async (symbol: string) => {
      for (let attempt = 0; attempt <= maxRetries; attempt++) {
        if (Date.now() - startTime > timeBudgetMs) {
          return { status: 'failed', reason: 'time-budget-exceeded' }
        }

        const page = await context.newPage()
        try {
          await this.prepareConceptPage(page, url, waitTimeout, snapshot)
          const result = await withTimeout(
            this.extractQuoteForSymbol(page, symbol),
            perTickerTimeoutMs,
          )
          if (result.quote) return { status: 'success', quote: result.quote }
          const reason = result.reason ?? 'parse-failed'
          if (attempt >= maxRetries) return { status: 'failed', reason }
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error)
          const reason = message.includes('timeout') ? 'timeout' : 'parse-failed'
          if (attempt >= maxRetries) return { status: 'failed', reason }
        } finally {
          await page.close().catch(() => undefined)
        }
      }

      return { status: 'failed', reason: 'parse-failed' }
    }

    let index = 0
    let active = 0

    await new Promise<void>(resolve => {
      const launchNext = () => {
        if (Date.now() - startTime > timeBudgetMs) {
          timeBudgetExceeded = true
        }

        while (!timeBudgetExceeded && active < concurrency && index < uniqueSymbols.length) {
          if (Date.now() - startTime > timeBudgetMs) {
            timeBudgetExceeded = true
            break
          }
          const symbol = uniqueSymbols[index++]
          active++
          processSymbol(symbol)
            .then(result => {
              if (result.status === 'success') {
                quoteBySymbol.set(result.quote.symbol, result.quote)
              } else {
                failureBySymbol.set(symbol, result.reason)
              }
            })
            .catch(error => {
              failureBySymbol.set(
                symbol,
                error instanceof Error && error.message.includes('timeout')
                  ? 'timeout'
                  : 'parse-failed',
              )
            })
            .finally(() => {
              active--
              if ((index >= uniqueSymbols.length || timeBudgetExceeded) && active === 0) {
                resolve()
                return
              }
              launchNext()
            })
        }

        if ((index >= uniqueSymbols.length || timeBudgetExceeded) && active === 0) {
          resolve()
        }
      }

      launchNext()
    })

    if (timeBudgetExceeded) {
      for (const symbol of uniqueSymbols) {
        if (!quoteBySymbol.has(symbol) && !failureBySymbol.has(symbol)) {
          failureBySymbol.set(symbol, 'time-budget-exceeded')
        }
      }
    }

    const failures: BbxEnrichmentFailure[] = Array.from(failureBySymbol.entries()).map(
      ([symbol, reason]) => ({ symbol, reason }),
    )

    const totalCount = uniqueSymbols.length
    const successCount = quoteBySymbol.size
    const failCount = failures.length
    const successRate = totalCount > 0 ? successCount / totalCount : 0

    return {
      quotes: Array.from(quoteBySymbol.values()),
      stats: {
        totalCount,
        successCount,
        failCount,
        successRate,
        failures,
        timeBudgetExceeded,
      },
    }
  }

  private async extractQuoteForSymbol(
    page: import('playwright').Page,
    symbol: string,
  ): Promise<{ quote?: BbxScrapedQuote; reason?: string }> {
    const resolved = await this.resolveTargetTable(page)
    if (!resolved) return { reason: 'table-not-found' }

    const { table: targetTable, headerTexts } = resolved
    const mNavHeaderIndex = headerTexts.findIndex(t => t.toLowerCase().includes('mnav'))
    const marketCapHeaderIndex = headerTexts.findIndex(t => {
      const v = t.toLowerCase()
      return v.includes('市值') || v.includes('market cap') || v.includes('市场价值')
    })
    const resolvedCompanyIndex = this.resolveCompanyColumnIndex(headerTexts)

    let rows = await targetTable.$$('tbody tr')
    const resolvedPriceIndex = await this.resolvePriceColumnIndex(
      rows,
      headerTexts,
      mNavHeaderIndex,
      marketCapHeaderIndex,
    )

    const scrollContainer = await this.findScrollableContainer(targetTable)
    const symbolUpper = symbol.toUpperCase()

    let foundCells: string[] | null = null
    let foundCompanyCellText = ''
    let foundRowText = ''
    let foundExchange = ''

    for (let iter = 0; iter < BbxCryptoStockScraperJob.ENRICHMENT_MAX_SCROLL_ITERATIONS; iter++) {
      rows = await targetTable.$$('tbody tr')
      for (const row of rows) {
        const cells: string[] = await row
          .$$eval('td', tds => tds.map(td => (td.textContent ?? '').trim()))
          .catch(() => [])
        if (cells.length === 0) continue

        const companyCellText = cells[resolvedCompanyIndex] ?? ''
        const stockInfo = parseBbxStockInfoFromCompanyCell(companyCellText)
        if (!stockInfo) continue
        if (stockInfo.symbol.toUpperCase() !== symbolUpper) continue

        foundCells = cells
        foundCompanyCellText = companyCellText
        foundRowText = cells.join(' ')
        foundExchange = stockInfo.exchange
        break
      }

      if (foundCells) break

      try {
        if (scrollContainer) {
          await scrollContainer.evaluate(el => {
            el.scrollBy(0, Math.max(240, Math.floor(el.clientHeight * 0.85)))
          })
        } else {
          await page.mouse.wheel(0, 1200)
        }
      } catch {
        await page.mouse.wheel(0, 1200)
      }
      await page.waitForTimeout(300)
    }

    if (!foundCells) return { reason: 'row-not-found' }

    const priceCellText = foundCells[resolvedPriceIndex] ?? ''
    const stockPrice = parseBbxPriceText(priceCellText) ?? 0
    if (!(stockPrice > 0)) return { reason: 'parse-failed:price' }

    const marketCapCellText =
      marketCapHeaderIndex >= 0 && marketCapHeaderIndex < foundCells.length
        ? foundCells[marketCapHeaderIndex]
        : foundCells.at(-1)
    const marketCap = marketCapCellText ? parseBbxMarketCapText(marketCapCellText) : undefined
    if (!marketCap) return { reason: 'parse-failed:marketCap' }

    const companyDisplayName = foundCompanyCellText
      .split('\n')
      .map((s: string) => s.trim())
      .filter(Boolean)[0]

    const mNavCellText =
      mNavHeaderIndex >= 0 && mNavHeaderIndex < foundCells.length
        ? foundCells[mNavHeaderIndex]
        : undefined
    const mNavStr = mNavCellText?.replace(/\s+/g, '').trim()

    const holdingMatch = foundRowText.match(BbxCryptoStockScraperJob.HOLDING_VALUE_REGEX)
    const holdingQtyMatch = foundRowText.match(BbxCryptoStockScraperJob.HOLDING_QTY_REGEX)
    const priceChangeMatch = foundRowText.match(BbxCryptoStockScraperJob.PRICE_CHANGE_REGEX)

    const priceChangePercent = priceChangeMatch
      ? Number.parseFloat(priceChangeMatch[1] ?? '')
      : undefined

    return {
      quote: {
        symbol: symbolUpper,
        name: companyDisplayName ?? symbolUpper,
        exchange: foundExchange,
        companyType: undefined,
        mNav: mNavStr ? this.parseNumber(mNavStr) : undefined,
        marketCap,
        holdingValue: holdingMatch
          ? this.parseMarketCap(`${holdingMatch[1]}${holdingMatch[2] ?? ''}`)
          : undefined,
        holdingQuantity: holdingQtyMatch
          ? this.parseMarketCap(`${holdingQtyMatch[1]}${holdingQtyMatch[2] ?? ''}`)
          : undefined,
        holdingCoin: holdingQtyMatch?.[3] || holdingQtyMatch?.[4],
        price: stockPrice,
        priceChangePercent,
      },
    }
  }

  /**
   * 从页面提取币股数据
   * 使用表格行选择器获取数据行，从行文本中正则提取各字段
   */
  public async extractQuotes(
    page: import('playwright').Page,
    snapshot?: (phaseName: string) => Promise<void>,
    allowedSymbols?: Set<string>,
  ): Promise<BbxScrapedQuote[]> {
    const quotes: BbxScrapedQuote[] = []

    const getHeaderTexts = async (table: import('playwright').ElementHandle<HTMLElement>) => {
      const fromThead = await table
        .$$eval('thead tr th, thead tr td', (ths: Element[]) =>
          ths.map(th => (th.textContent ?? '').replace(/\s+/g, ' ').trim()),
        )
        .catch(() => [])

      if (fromThead.length > 0) return fromThead

      const fromTh = await table
        .$$eval('tr th', (ths: Element[]) =>
          ths.map(th => (th.textContent ?? '').replace(/\s+/g, ' ').trim()),
        )
        .catch(() => [])

      if (fromTh.length > 0) return fromTh

      // Fallback: some tables don't render <thead>, treat first row as header.
      const maybeHeader = await table
        .$$eval('tbody tr:first-child td', (tds: Element[]) =>
          tds.map(td => (td.textContent ?? '').replace(/\s+/g, ' ').trim()),
        )
        .catch(() => [])

      const hasKnownHeader = maybeHeader.some(h => {
        const v = h.toLowerCase()
        return (
          v.includes('mnav') || v.includes('市值') || v.includes('market cap') || v.includes('价格')
        )
      })

      return hasKnownHeader ? maybeHeader : []
    }

    const trySortByMarketCapDesc = async (
      table: import('playwright').ElementHandle<HTMLElement>,
    ): Promise<void> => {
      try {
        const headerCells = await table.$$('thead tr th, thead tr td, tr th')
        if (headerCells.length === 0) {
          this.logger.warn('No header cells found in target table; skip sorting')
          return
        }

        let marketCapHeader: import('playwright').ElementHandle<HTMLElement> | null = null
        for (const cell of headerCells) {
          const raw = await cell.evaluate(el => (el.textContent ?? '') as string)
          const text = normalizeBbxWhitespace(raw)
          const v = text.toLowerCase()
          if (v.includes('市值') || v.includes('market cap') || v.includes('市场价值')) {
            marketCapHeader = cell as import('playwright').ElementHandle<HTMLElement>
            break
          }
        }

        if (!marketCapHeader) {
          this.logger.warn('Market cap header not found inside target table; skip sorting')
          return
        }

        // Click twice to reach descending (UI cycles asc/desc/none). Keep waits short to avoid slowing the job.
        await marketCapHeader.click()
        await page.waitForTimeout(800)
        await marketCapHeader.click()
        await page.waitForTimeout(1200)
        this.logger.log('Sorted target table by market cap (attempted descending)')
      } catch (error) {
        this.logger.warn(
          `Failed to sort target table by market cap: ${error instanceof Error ? error.message : String(error)}`,
        )
      }
    }

    const findScrollableContainer = async (
      table: import('playwright').ElementHandle<HTMLElement>,
    ): Promise<import('playwright').ElementHandle<HTMLElement> | null> => {
      try {
        const handle = await table.evaluateHandle((el: HTMLElement) => {
          let cur: HTMLElement | null = el
          for (let i = 0; i < 8 && cur; i++) {
            const style = window.getComputedStyle(cur)
            const overflowY = style.overflowY
            const canScroll =
              (overflowY === 'auto' || overflowY === 'scroll') &&
              cur.scrollHeight > cur.clientHeight + 24
            if (canScroll) return cur
            cur = cur.parentElement
          }
          return null
        })

        return handle.asElement() as import('playwright').ElementHandle<HTMLElement> | null
      } catch {
        return null
      }
    }

    const looksLikeConceptStockTable = async (
      table: import('playwright').ElementHandle<HTMLElement>,
    ) => {
      // Column index might not be the first column (Table[0] has headers: 币种 | 公司 | ...)
      const headers = await getHeaderTexts(table)
      const companyColIndex = headers.findIndex(h => h.replace(/\s+/g, '').includes('公司'))
      const resolvedCompanyColIndex = companyColIndex >= 0 ? companyColIndex : 0

      const sampleCells = await table
        .$$eval(
          'tbody tr',
          (trs: Element[], idx: number) =>
            trs.slice(0, 8).map(tr => {
              const cells = Array.from(tr.querySelectorAll('td'))
              return (cells[idx]?.textContent ?? '').trim()
            }),
          resolvedCompanyColIndex,
        )
        .catch(() => [])

      return sampleCells.some(text => Boolean(parseBbxStockInfoFromCompanyCell(text)))
    }

    // 先定位目标表格：必须同时包含 mNAV 与 市值/Market Cap 表头。
    // 优先选择“表头 + 行内容”都匹配的表；否则退化到仅表头匹配的表（避免识别过严导致 0 表）。
    const tables = await page.$$('table')
    let targetTable: import('playwright').ElementHandle<HTMLElement> | null = null
    let headerTexts: string[] = []

    // 先打印每张 table 的摘要，方便线上定位选择失败原因
    for (let i = 0; i < tables.length; i++) {
      const table = tables[i] as import('playwright').ElementHandle<HTMLElement>
      const headers = await getHeaderTexts(table)
      const hasMnav = headers.some(h => h.toLowerCase().includes('mnav'))
      const hasMarketCap = headers.some(h => {
        const v = h.toLowerCase()
        return v.includes('市值') || v.includes('market cap') || v.includes('市场价值')
      })
      const looksRight = hasMnav && hasMarketCap ? await looksLikeConceptStockTable(table) : false
      this.logger.log(
        `Table[${i}] headers=${headers.join(' | ')}; hasMnav=${hasMnav}; hasMarketCap=${hasMarketCap}; looksLikeConceptStock=${looksRight}`,
      )
    }

    for (const table of tables) {
      const headers = await getHeaderTexts(table as import('playwright').ElementHandle<HTMLElement>)

      const hasMnav = headers.some(h => h.toLowerCase().includes('mnav'))
      const hasMarketCap = headers.some(h => {
        const v = h.toLowerCase()
        return v.includes('市值') || v.includes('market cap') || v.includes('市场价值')
      })

      if (!hasMnav || !hasMarketCap) continue

      const looksRight = await looksLikeConceptStockTable(
        table as import('playwright').ElementHandle<HTMLElement>,
      )
      if (!looksRight) continue

      targetTable = table as import('playwright').ElementHandle<HTMLElement>
      headerTexts = headers
      break
    }

    if (!targetTable) {
      for (const table of tables) {
        const headers = await getHeaderTexts(
          table as import('playwright').ElementHandle<HTMLElement>,
        )
        const hasMnav = headers.some(h => h.toLowerCase().includes('mnav'))
        const hasMarketCap = headers.some(h => {
          const v = h.toLowerCase()
          return v.includes('市值') || v.includes('market cap') || v.includes('市场价值')
        })
        if (hasMnav && hasMarketCap) {
          targetTable = table as import('playwright').ElementHandle<HTMLElement>
          headerTexts = headers
          this.logger.warn('Target table selected by headers only (content check failed)')
          break
        }
      }
    }

    if (!targetTable) {
      this.logger.warn(
        `No target table found (tables=${tables.length}). Skip extraction to avoid wrong table.`,
      )
      return []
    }

    // 关键：在“目标表格”内部点击市值列头进行排序（避免点到页面其它表导致排序无效）
    await trySortByMarketCapDesc(targetTable)
    await snapshot?.('after-sort')

    const mNavHeaderIndex = headerTexts.findIndex(t => t.toLowerCase().includes('mnav'))
    const marketCapHeaderIndex = headerTexts.findIndex(t => {
      const v = t.toLowerCase()
      return v.includes('市值') || v.includes('market cap') || v.includes('市场价值')
    })

    const companyHeaderIndex = headerTexts.findIndex(h => {
      const v = h.replace(/\s+/g, '').toLowerCase()
      return v.includes('公司') || v.includes('company')
    })
    // Table[0] headers: 币种 | 公司 | mNAV ...
    const resolvedCompanyIndex = companyHeaderIndex >= 0 ? companyHeaderIndex : 1

    // 仅抓取目标表格的 tbody 行（注意：BBX 可能是虚拟列表，DOM 行数可能恒定）
    let rows = await targetTable.$$('tbody tr')
    this.logger.log(`Found ${rows.length} table rows (initial viewport)`)

    // 价格列：优先按表头识别；否则用前几行“可解析价格”次数最多的列；最后再 fallback。
    const priceHeaderIndex = headerTexts.findIndex(t => {
      const v = t.toLowerCase()
      return v.includes('价格') || v.includes('现价') || v.includes('price')
    })

    let resolvedPriceIndex: number
    if (priceHeaderIndex >= 0) {
      resolvedPriceIndex = priceHeaderIndex
    } else {
      const sampleCount = Math.min(10, rows.length)
      const counts = new Map<number, number>()

      for (let i = 0; i < sampleCount; i++) {
        const cells: string[] = await rows[i]
          .$$eval('td', tds => tds.map(td => (td.textContent ?? '').trim()))
          .catch(() => [])

        for (let idx = 0; idx < cells.length; idx++) {
          if (idx === mNavHeaderIndex || idx === marketCapHeaderIndex) continue
          const price = parseBbxPriceText(cells[idx] ?? '')
          if (price && price > 0) counts.set(idx, (counts.get(idx) ?? 0) + 1)
        }
      }

      let bestIndex = -1
      let bestCount = 0
      for (const [idx, count] of counts.entries()) {
        if (count > bestCount) {
          bestCount = count
          bestIndex = idx
        }
      }

      if (bestIndex >= 0 && bestCount >= 3) {
        resolvedPriceIndex = bestIndex
      } else if (mNavHeaderIndex > 0) {
        resolvedPriceIndex = mNavHeaderIndex - 1
      } else if (marketCapHeaderIndex > 0) {
        resolvedPriceIndex = marketCapHeaderIndex - 1
      } else {
        resolvedPriceIndex = 1
      }
    }

    if (mNavHeaderIndex >= 0) {
      this.logger.log(
        `Detected mNAV column index: ${mNavHeaderIndex} (header="${headerTexts[mNavHeaderIndex]}")`,
      )
    }
    if (marketCapHeaderIndex >= 0) {
      this.logger.log(
        `Detected market cap column index: ${marketCapHeaderIndex} (header="${headerTexts[marketCapHeaderIndex]}")`,
      )
    }
    this.logger.log(`Target table headers: ${headerTexts.join(' | ')}`)
    this.logger.log(
      `Resolved company column index: ${resolvedCompanyIndex} (header="${headerTexts[resolvedCompanyIndex] ?? 'unknown'}")`,
    )
    this.logger.log(
      `Resolved price column index: ${resolvedPriceIndex} (header="${headerTexts[resolvedPriceIndex] ?? 'unknown'}")`,
    )

    // 调试：检查前3行的HTML结构（首屏）
    if (rows.length > 0) {
      for (let i = 0; i < Math.min(3, rows.length); i++) {
        const html = await rows[i].evaluate(el => el.outerHTML)
        this.logger.debug(`Row ${i} HTML (first 300 chars): ${html.substring(0, 300)}`)
      }
    }

    // 虚拟列表/分页：反复采集“当前可见行”，滚动后继续，直到连续多次没有新 symbol。
    const quoteBySymbol = new Map<string, BbxScrapedQuote>()
    const scrollContainer = await findScrollableContainer(targetTable)
    this.logger.log(
      `Virtual scroll: scrollableContainer=${scrollContainer ? 'yes' : 'no'}; viewportRows=${rows.length}`,
    )

    let skippedNoText = 0
    let skippedNoStockInfo = 0
    let skippedNotInList = 0
    let loggedMarketCapParseFailures = 0
    let loggedNewQuotes = 0

    const extractVisibleOnce = async (): Promise<number> => {
      rows = await targetTable.$$('tbody tr')
      let newlyAdded = 0

      for (let i = 0; i < rows.length; i++) {
        try {
          const cells: string[] = await rows[i]
            .$$eval('td', tds => tds.map(td => (td.textContent ?? '').trim()))
            .catch(() => [])

          const rowText = cells.join(' ')
          if (!rowText.trim()) {
            skippedNoText++
            continue
          }

          const companyCellText = cells[resolvedCompanyIndex] ?? ''
          const stockInfo = parseBbxStockInfoFromCompanyCell(companyCellText)
          if (!stockInfo) {
            skippedNoStockInfo++
            continue
          }

          const symbol = stockInfo.symbol
          if (allowedSymbols && !allowedSymbols.has(symbol)) {
            skippedNotInList++
            continue
          }
          if (quoteBySymbol.has(symbol)) continue

          const exchange = stockInfo.exchange

          const priceCellText = cells[resolvedPriceIndex] ?? ''
          const stockPrice = parseBbxPriceText(priceCellText) ?? 0
          if (!(stockPrice > 0)) continue

          const companyDisplayName = companyCellText
            .split('\n')
            .map((s: string) => s.trim())
            .filter(Boolean)[0]

          const mNavCellText =
            mNavHeaderIndex >= 0 && mNavHeaderIndex < cells.length
              ? cells[mNavHeaderIndex]
              : undefined
          const mNavStr = mNavCellText?.replace(/\s+/g, '').trim()

          const marketCapCellText =
            marketCapHeaderIndex >= 0 && marketCapHeaderIndex < cells.length
              ? cells[marketCapHeaderIndex]
              : cells.at(-1)
          const marketCap = marketCapCellText ? parseBbxMarketCapText(marketCapCellText) : undefined

          if (!marketCap && loggedMarketCapParseFailures < 3) {
            loggedMarketCapParseFailures++
            this.logger.warn(
              `marketCap parse failed (sample ${loggedMarketCapParseFailures}/3) row=${i}, headerIndex=${marketCapHeaderIndex}, header="${headerTexts[marketCapHeaderIndex] ?? 'unknown'}", headerCount=${headerTexts.length}, cellCount=${cells.length}`,
            )
            this.logger.warn(`marketCap raw cell text: ${JSON.stringify(marketCapCellText ?? '')}`)
            this.logger.warn(
              `row cells snapshot (0..${Math.min(10, cells.length) - 1}): ${JSON.stringify(
                cells.slice(0, 10),
              )}`,
            )
            this.logger.warn(`company cell raw: ${JSON.stringify(companyCellText)}`)
          }

          const holdingMatch = rowText.match(BbxCryptoStockScraperJob.HOLDING_VALUE_REGEX)
          const holdingQtyMatch = rowText.match(BbxCryptoStockScraperJob.HOLDING_QTY_REGEX)
          const holdingValue = holdingMatch
            ? this.parseMarketCap(`${holdingMatch[1]}${holdingMatch[2] ?? ''}`)
            : undefined

          const quote: BbxScrapedQuote = {
            symbol,
            name: companyDisplayName ?? symbol,
            exchange,
            companyType: undefined,
            mNav: mNavStr ? this.parseNumber(mNavStr) : undefined,
            marketCap,
            holdingValue,
            holdingQuantity: holdingQtyMatch
              ? this.parseMarketCap(`${holdingQtyMatch[1]}${holdingQtyMatch[2] ?? ''}`)
              : undefined,
            holdingCoin: holdingQtyMatch?.[3] || holdingQtyMatch?.[4],
            price: stockPrice,
            priceChangePercent: undefined,
          }

          quoteBySymbol.set(symbol, quote)
          newlyAdded++

          if (loggedNewQuotes < 12) {
            loggedNewQuotes++
            this.logger.debug(
              `Collected ${quote.symbol}: price=$${quote.price}, marketCap=${quote.marketCap ?? 'undefined'}`,
            )
          }
        } catch (error) {
          this.logger.warn(
            `Failed to extract row ${i}: ${error instanceof Error ? error.message : String(error)}`,
          )
        }
      }

      return newlyAdded
    }

    const maxIterations = 80
    const stopAfterNoNewFor = 3
    let noNewCount = 0

    for (let iter = 0; iter < maxIterations; iter++) {
      const newlyAdded = await extractVisibleOnce()
      if (newlyAdded === 0) noNewCount++
      else noNewCount = 0

      if (noNewCount >= stopAfterNoNewFor) break

      // 继续向下滚动加载/切换下一屏
      try {
        if (scrollContainer) {
          await scrollContainer.evaluate(el => {
            el.scrollBy(0, Math.max(240, Math.floor(el.clientHeight * 0.85)))
          })
        } else {
          await page.mouse.wheel(0, 1200)
        }
      } catch {
        await page.mouse.wheel(0, 1200)
      }

      await page.waitForTimeout(450)
    }
    await snapshot?.('after-scroll')

    quotes.push(...quoteBySymbol.values())

    this.logger.log(
      `Extraction summary: viewportRows=${rows.length}, ${skippedNoText} no text, ${skippedNoStockInfo} no stock info, ${skippedNotInList} not-in-list, ${quotes.length} unique quotes`,
    )

    // 只保留市值≥1B的记录
    const filtered = quotes.filter(
      q => (q.marketCap ?? 0) >= BbxCryptoStockScraperJob.MIN_MARKET_CAP_THRESHOLD,
    )
    this.logger.log(
      `Filtered ${quotes.length} quotes to ${filtered.length} with marketCap ≥ ${BbxCryptoStockScraperJob.MIN_MARKET_CAP_THRESHOLD / 1e9}B`,
    )

    // 调试：输出前5个记录的详细信息（无论是否被过滤）
    if (quotes.length > 0) {
      const samples = quotes.slice(0, 5)
      this.logger.log(`Sample extracted quotes (first 5):`)
      samples.forEach(q => {
        this.logger.log(
          `  ${q.symbol}: price=$${q.price}, marketCap=${q.marketCap ?? 'undefined'}, holdingValue=${q.holdingValue ?? 'undefined'}`,
        )
      })
    }

    // 如果过滤后为空但原始数据不为空，说明过滤条件可能有问题
    if (filtered.length === 0 && quotes.length > 0) {
      this.logger.warn(`All ${quotes.length} quotes were filtered out by marketCap >= 1B threshold`)
      this.logger.warn(`Sample filtered quotes:`)
      const samples = quotes.slice(0, 5)
      samples.forEach(q => {
        this.logger.warn(`  ${q.symbol}: marketCap=${q.marketCap ?? 'undefined'}`)
      })
    }

    return filtered
  }

  private async fetchCompanyList(request: APIRequestContext): Promise<BbxCompanyListFetchResult> {
    const items: BbxCompanyListItem[] = []
    const queryUrl = BbxCryptoStockScraperJob.COMPANY_LIST_ENDPOINT
    const netlogEnabled = defaultEnvAccessor.bool('BBX_SCRAPER_NETLOG')
    let totalCount = 0
    let lastDiagnostics: BbxCompanyListDiagnostics | undefined

    const truncateText = (text: string, maxLength = 160) =>
      text.length > maxLength ? `${text.slice(0, maxLength)}...` : text

    const sanitizeLogValue = (value: unknown): string | number | boolean | null | undefined => {
      if (value == null) return undefined
      if (typeof value === 'string') return truncateText(value)
      if (typeof value === 'number' || typeof value === 'boolean') return value
      if (Array.isArray(value)) return `[array:${value.length}]`
      return '[object]'
    }

    const logDiagnostics = (
      phase: string,
      diagnostics: BbxCompanyListDiagnostics | undefined,
      level: 'log' | 'warn' = 'log',
    ) => {
      if (!netlogEnabled || !diagnostics) return
      const base = `[bbx-list] ${phase}`
      this.logger[level](
        `${base} schema: topKeys=${JSON.stringify(diagnostics.topKeys)} dataKeys=${JSON.stringify(
          diagnostics.dataKeys ?? [],
        )} listNodeKeys=${JSON.stringify(diagnostics.listNodeKeys ?? [])} listLength=${diagnostics.listLength ?? 'unknown'}`,
      )
      if (diagnostics.sampleItemKeys?.length) {
        this.logger[level](
          `${base} sample item keys: ${JSON.stringify(diagnostics.sampleItemKeys)}`,
        )
      }
      if (diagnostics.sampleMarketCaps?.length) {
        this.logger[level](
          `${base} sample marketCap: ${JSON.stringify(diagnostics.sampleMarketCaps)}`,
        )
      }
    }

    let fetchedAnyPage = false

    try {
      const response = await request.get(queryUrl)
      const status = response.status()
      const contentType = response.headers()['content-type'] ?? 'unknown'
      if (netlogEnabled) {
        this.logger.log(`[bbx-list] status=${status} contentType=${contentType}`)
      }
      if (!response.ok()) {
        this.logger.warn(`BBX list API request failed: status=${response.status()}`)
      } else {
        const data = (await response.json()) as unknown
        const diagnostics = this.buildCompanyListDiagnostics(data, sanitizeLogValue)
        lastDiagnostics = diagnostics
        logDiagnostics('list', diagnostics)
        const extracted = this.extractCompanyListFromResponse(data)
        if (extracted) {
          items.push(...extracted.items)
          totalCount = extracted.totalCount ?? items.length
          fetchedAnyPage = true
          this.logger.log(`BBX list API: got ${extracted.items.length} items`)
        }
      }
    } catch (error) {
      this.logger.warn(
        `BBX list API request error: ${error instanceof Error ? error.message : String(error)}`,
      )
    }

    const sortCheckPassed = this.checkMarketCapSorted(items)
    let usedLocalSort = false
    if (!sortCheckPassed) {
      this.logger.warn('BBX list API marketCap not sorted; applying local sort')
      items.sort((a, b) => (b.marketCap ?? 0) - (a.marketCap ?? 0))
      usedLocalSort = true
    }

    const filteredRaw = items.filter(
      item => (item.marketCap ?? 0) >= BbxCryptoStockScraperJob.MIN_MARKET_CAP_THRESHOLD,
    )
    const sortedFiltered = filteredRaw
      .slice()
      .sort((a, b) => (b.marketCap ?? 0) - (a.marketCap ?? 0))

    const usedItems = sortedFiltered.slice(0, 30)

    totalCount = totalCount || items.length

    if (filteredRaw.length === 0 && items.length > 0) {
      this.logger.warn('BBX list API returned items but none passed marketCap >= 1B filter')
    }

    if (netlogEnabled && filteredRaw.length === 0 && items.length > 0) {
      const samples = items.slice(0, 5).map(item => ({
        symbol: item.symbol,
        marketCap: item.marketCap ?? null,
        rawMarketCap: item.rawMarketCap ?? null,
      }))
      this.logger.warn(`[bbx-list] marketCap samples: ${JSON.stringify(samples)}`)
    }

    if (netlogEnabled && (items.length === 0 || filteredRaw.length === 0)) {
      this.logger.warn('[bbx-list] 结构诊断日志: list API 结果异常')
      logDiagnostics('structure-check', lastDiagnostics, 'warn')
    }

    return {
      items,
      totalCount,
      filteredSymbols: usedItems.map(item => item.symbol),
      filteredCount: usedItems.length,
      filteredTotalCount: filteredRaw.length,
      sortCheckPassed,
      usedLocalSort,
      fetchSucceeded: fetchedAnyPage,
      usedItems,
    }
  }

  private extractCompanyListFromResponse(data: unknown): {
    items: BbxCompanyListItem[]
    totalCount?: number
  } | null {
    if (!data) return null

    const list = Array.isArray(data)
      ? data
      : (() => {
          if (typeof data !== 'object') return undefined
          const root = data as Record<string, unknown>
          const rootData = root.data
          if (Array.isArray(rootData)) return rootData
          const dataNode = this.findFirstRecordDeep(root, ['data', 'result', 'payload'], 3) ?? root
          const listHit =
            this.findFirstArrayDeep(
              dataNode,
              ['list', 'items', 'rows', 'records', 'companyList'],
              4,
            ) ??
            this.findFirstArrayDeep(root, ['list', 'items', 'rows', 'records', 'companyList'], 4)
          return listHit?.list
        })()

    if (!list) return null

    const items: BbxCompanyListItem[] = []
    for (const entry of list) {
      if (!entry || typeof entry !== 'object') continue
      const record = entry as Record<string, unknown>
      const symbol =
        this.getFirstString(record, [
          'symbol',
          'ticker',
          'code',
          'stockSymbol',
          'stock_code',
          'stockCode',
        ]) ?? this.getFirstString(record, ['companySymbol', 'company_code'])
      if (!symbol) continue

      const marketCapCandidate = this.getMarketCapCandidate(record)
      const rawMarketCap =
        typeof marketCapCandidate.value === 'string' ? marketCapCandidate.value : undefined

      const marketCap = this.parseMarketCapValue(
        marketCapCandidate.value ??
          this.getFirstValue(record, [
            'marketCap',
            'market_cap',
            'marketcap',
            'marketCapUsd',
            'market_cap_usd',
            'marketCapUSD',
            'marketCapValue',
            'market_cap_value',
            'marketValue',
            'market_value',
          ]) ??
          rawMarketCap,
      )

      const name =
        this.getFirstString(record, ['name', 'companyName', 'company_name', 'stockName']) ??
        this.getFirstString(record, ['company', 'title'])
      const exchange = this.getFirstString(record, ['exchange', 'market', 'marketCode'])
      const companyType = this.getFirstString(record, ['companyType', 'type', 'category'])

      const price = this.parseNumericValue(
        this.getFirstValue(record, [
          'stockPrice',
          'price',
          'lastPrice',
          'last',
          'close',
          'currentPrice',
        ]),
      )
      const priceChangePercent = this.parsePercentValue(
        this.getFirstValue(record, [
          'priceChange24h',
          'priceChangePercent',
          'price_change_percent',
          'changePercent',
          'changeRate',
          'change24h',
        ]),
      )

      const mNavSelection = this.resolveMNavSelection(record)

      items.push({
        symbol: symbol.toUpperCase(),
        name,
        exchange,
        companyType,
        price,
        priceChangePercent,
        marketCap,
        mNav: mNavSelection.mNav,
        holdingValue: mNavSelection.holdingValue,
        holdingQuantity: mNavSelection.holdingQuantity,
        holdingCoin: mNavSelection.coin,
        rawMarketCap,
        rawData: {
          companyListItem: record,
          mNavData: mNavSelection.entry,
          coin: mNavSelection.coin,
        },
      })
    }

    const dataNode =
      data && typeof data === 'object'
        ? this.findFirstRecordDeep(
            data as Record<string, unknown>,
            ['data', 'result', 'payload'],
            3,
          )
        : undefined
    const totalCount = dataNode
      ? this.getFirstNumber(dataNode, ['total', 'totalCount', 'count', 'total_size', 'totalSize'])
      : undefined

    return { items, totalCount }
  }

  private checkMarketCapSorted(items: BbxCompanyListItem[]): boolean {
    const caps = items
      .map(item => item.marketCap)
      .filter((cap): cap is number => typeof cap === 'number' && cap > 0)

    if (caps.length < 2) return true
    const sampleSize = Math.min(BbxCryptoStockScraperJob.SORT_CHECK_SAMPLE_SIZE, caps.length)
    for (let i = 1; i < sampleSize; i++) {
      if (caps[i - 1] < caps[i]) return false
    }
    return true
  }

  private resolveMNavSelection(record: Record<string, unknown>): {
    entry?: Record<string, unknown>
    coin?: string
    mNav?: number
    holdingValue?: number
    holdingQuantity?: number
  } {
    const candidates = this.getFirstArray(record, [
      'mNavData',
      'mnavData',
      'mNavList',
      'mnavList',
      'mNavs',
      'mnavs',
    ])
    if (!candidates || candidates.length === 0) return {}

    const coinValueKeys = [
      'coinValueUSD',
      'coinValueUsd',
      'coinValue',
      'holdingValueUSD',
      'holdingValueUsd',
      'holdingValue',
      'valueUsd',
      'valueUSD',
    ]

    let bestEntry: Record<string, unknown> | undefined
    let bestValue = -1

    for (const entry of candidates) {
      if (!entry || typeof entry !== 'object' || Array.isArray(entry)) continue
      const recordEntry = entry as Record<string, unknown>
      const coinValue = this.parseMarketCapValue(this.getFirstValue(recordEntry, coinValueKeys))
      if (coinValue == null) continue
      if (coinValue > bestValue) {
        bestValue = coinValue
        bestEntry = recordEntry
      }
    }

    if (!bestEntry) {
      const fallback = candidates.find(
        entry => entry && typeof entry === 'object' && !Array.isArray(entry),
      ) as Record<string, unknown> | undefined
      if (!fallback) return {}
      bestEntry = fallback
    }

    const coin = this.getFirstString(bestEntry, [
      'coin',
      'coinSymbol',
      'symbol',
      'asset',
      'coinName',
    ])
    const mNav = this.parseNumericValue(
      this.getFirstValue(bestEntry, ['mNav', 'mNAV', 'mnav', 'nav', 'mNavValue', 'mnavValue']),
    )
    const holdingValue = this.parseMarketCapValue(this.getFirstValue(bestEntry, coinValueKeys))
    const holdingQuantity = this.parseNumericValue(
      this.getFirstValue(bestEntry, [
        'holdingAmount',
        'holdingQuantity',
        'holdingQty',
        'amount',
        'holding_amount',
        'holding_qty',
      ]),
    )

    return {
      entry: bestEntry,
      coin,
      mNav,
      holdingValue,
      holdingQuantity,
    }
  }

  private getMarketCapCandidate(record: Record<string, unknown>): {
    key?: string
    value?: unknown
  } {
    const keys = [
      'marketCap',
      'market_cap',
      'marketcap',
      'marketCapUsd',
      'market_cap_usd',
      'marketCapUSD',
      'marketCapValue',
      'market_cap_value',
      'marketValue',
      'market_value',
      'marketCapText',
      'market_cap_text',
      'marketCapStr',
      'market_cap_str',
    ]

    for (const key of keys) {
      if (key in record) return { key, value: record[key] }
    }

    for (const [key, value] of Object.entries(record)) {
      if (this.isMarketCapKey(key)) return { key, value }
    }

    return {}
  }

  private isMarketCapKey(key: string): boolean {
    return /market.*cap|market.*value|mktcap/i.test(key)
  }

  private getFirstValue(record: Record<string, unknown>, keys: string[]): unknown | undefined {
    for (const key of keys) {
      if (key in record) return record[key]
    }
    return undefined
  }

  private getFirstArray(record: Record<string, unknown>, keys: string[]): unknown[] | undefined {
    for (const key of keys) {
      const value = record[key]
      if (Array.isArray(value)) return value
    }
    return undefined
  }

  private parseNumericValue(value: unknown): number | undefined {
    if (typeof value === 'number') return Number.isNaN(value) ? undefined : value
    if (typeof value === 'string') {
      const cleaned = value.replace(/[,$%\s]/g, '')
      if (!cleaned) return undefined
      const parsed = Number.parseFloat(cleaned)
      return Number.isNaN(parsed) ? undefined : parsed
    }
    return undefined
  }

  private parsePercentValue(value: unknown): number | undefined {
    return this.parseNumericValue(value)
  }

  private parseMarketCapValue(value: unknown): number | undefined {
    if (typeof value === 'number') return Number.isNaN(value) ? undefined : value
    if (typeof value === 'string') {
      const parsedWithUnit = parseBbxMarketCapText(value)
      if (parsedWithUnit != null) return parsedWithUnit
      const plain = Number.parseFloat(value.replace(/,/g, ''))
      return Number.isNaN(plain) ? undefined : plain
    }
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      const record = value as Record<string, unknown>
      const unit = this.getFirstString(record, [
        'unit',
        'unitText',
        'unitName',
        'currency',
        'currencyCode',
        'currencySymbol',
      ])
      const numeric = this.getFirstNumber(record, [
        'value',
        'amount',
        'marketCap',
        'market_cap',
        'marketcap',
      ])
      if (numeric != null) {
        const normalized = unit ? this.parseMarketCapValue(`${numeric} ${unit}`) : undefined
        return normalized ?? numeric
      }

      const text = this.getFirstString(record, [
        'text',
        'display',
        'value',
        'amount',
        'marketCap',
        'market_cap',
        'marketcap',
      ])
      if (text) {
        const combined = unit ? `${text} ${unit}` : text
        return this.parseMarketCapValue(combined)
      }
    }
    return undefined
  }

  private getFirstString(record: Record<string, unknown>, keys: string[]): string | undefined {
    for (const key of keys) {
      const value = record[key]
      if (typeof value === 'string' && value.trim()) return value.trim()
      if (typeof value === 'number') return String(value)
    }
    return undefined
  }

  private getFirstNumber(record: Record<string, unknown>, keys: string[]): number | undefined {
    for (const key of keys) {
      const value = record[key]
      if (typeof value === 'number' && !Number.isNaN(value)) return value
      if (typeof value === 'string' && value.trim()) {
        const parsed = Number.parseFloat(value.replace(/,/g, ''))
        if (!Number.isNaN(parsed)) return parsed
      }
    }
    return undefined
  }

  public getFirstBoolean(record: Record<string, unknown>, keys: string[]): boolean | undefined {
    for (const key of keys) {
      const value = record[key]
      if (typeof value === 'boolean') return value
    }
    return undefined
  }

  private findFirstRecord(
    record: Record<string, unknown>,
    keys: string[],
  ): Record<string, unknown> | undefined {
    for (const key of keys) {
      const value = record[key]
      if (value && typeof value === 'object' && !Array.isArray(value))
        return value as Record<string, unknown>
    }
    return undefined
  }

  private findFirstRecordDeep(
    record: Record<string, unknown>,
    keys: string[],
    maxDepth: number,
  ): Record<string, unknown> | undefined {
    if (maxDepth <= 0) return undefined
    const direct = this.findFirstRecord(record, keys)
    if (direct) return direct
    for (const value of Object.values(record)) {
      if (value && typeof value === 'object' && !Array.isArray(value)) {
        const found = this.findFirstRecordDeep(value as Record<string, unknown>, keys, maxDepth - 1)
        if (found) return found
      }
    }
    return undefined
  }

  private findFirstArrayDeep(
    record: Record<string, unknown>,
    keys: string[],
    maxDepth: number,
  ): { list: unknown[]; container: Record<string, unknown> } | undefined {
    if (maxDepth <= 0) return undefined
    for (const key of keys) {
      const value = record[key]
      if (Array.isArray(value)) return { list: value, container: record }
    }
    for (const value of Object.values(record)) {
      if (value && typeof value === 'object' && !Array.isArray(value)) {
        const found = this.findFirstArrayDeep(value as Record<string, unknown>, keys, maxDepth - 1)
        if (found) return found
      }
    }
    return undefined
  }

  private buildCompanyListDiagnostics(
    data: unknown,
    sanitizeLogValue: (value: unknown) => string | number | boolean | null | undefined,
  ): BbxCompanyListDiagnostics {
    if (!data || typeof data !== 'object') return { topKeys: [] }
    const root = data as Record<string, unknown>
    const topKeys = Object.keys(root).slice(0, 12)
    const dataNode = this.findFirstRecordDeep(root, ['data', 'result', 'payload'], 3)
    const dataKeys = dataNode ? Object.keys(dataNode).slice(0, 12) : undefined
    const listHit =
      (dataNode
        ? this.findFirstArrayDeep(dataNode, ['list', 'items', 'rows', 'records', 'companyList'], 4)
        : undefined) ??
      this.findFirstArrayDeep(root, ['list', 'items', 'rows', 'records', 'companyList'], 4)

    const diagnostics: BbxCompanyListDiagnostics = { topKeys, dataKeys }
    if (!listHit) return diagnostics

    diagnostics.listNodeKeys = Object.keys(listHit.container).slice(0, 12)
    diagnostics.listLength = listHit.list.length

    const samples = listHit.list.slice(0, 3)
    diagnostics.sampleItemKeys = samples
      .map(item =>
        item && typeof item === 'object' && !Array.isArray(item)
          ? Object.keys(item as Record<string, unknown>).slice(0, 12)
          : [],
      )
      .filter(keys => keys.length > 0)

    const marketSamples: Array<{
      key: string
      value: string | number | boolean | null | undefined
    }> = []
    for (const item of samples) {
      if (!item || typeof item !== 'object' || Array.isArray(item)) continue
      const record = item as Record<string, unknown>
      const candidate = this.getMarketCapCandidate(record)
      if (candidate.key) {
        marketSamples.push({ key: candidate.key, value: sanitizeLogValue(candidate.value) })
        continue
      }
    }
    if (marketSamples.length > 0) diagnostics.sampleMarketCaps = marketSamples

    return diagnostics
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
