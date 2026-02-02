import type { Locator } from 'playwright'
import type {
  DataPullJob,
  DataPullJobContext,
  JobMetaSchema,
  JobRunResult,
} from '../contracts/data-pull-job'
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
    description: '从 BBX 加密概念股页面抓取币股报价数据（仅保留市值≥1B USD的记录）',
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
  private static readonly MIN_MARKET_CAP_USD_THRESHOLD = 1e9

  // ========== 正则表达式常量 ==========

  /** 股票代码和交易所：兼容中英与多种短横线（如 "TSLA 美股 - NASDAQ" / "TSLA US - NASDAQ"） */
  private static readonly STOCK_INFO_REGEX =
    /\b([A-Z]{1,6}(?:\.[A-Z])?)(?:\s+(?:美股|US|U\.S\.|USA))?\s*[\-–—]\s*(NASDAQ|NYSE|OTCMARKETS)(?=[^A-Z]|$)/i

  /** 从带前缀的符号中提取纯大写股票代码：如 dMSTR -> MSTR */
  private static readonly SYMBOL_EXTRACT_REGEX = /([A-Z]{1,5}(?:\.[A-Z])?)$/

  /** 公司名称：匹配以常见公司后缀结尾的英文名称 */
  private static readonly COMPANY_NAME_REGEX =
    /([A-Z][A-Z\s.,'&()/-]+?(?:Inc\.?|Corp\.?|Ltd\.?|Group|Company|Solutions|Holdings|Technologies|Immersion|Industries)?)(?=[A-Z]{1,6}(?:\.[A-Z])?\s*美股)/i

  /** 公司类型：在交易所信息后、价格前的文本 */
  private static readonly COMPANY_TYPE_REGEX =
    /美股\s*-\s*(?:NASDAQ|NYSE|OTCMARKETS)\s*([A-Z][A-Z\s/]*)(?=\d)/i

  /** mNAV：交易所信息后的 4 位小数格式（如 0.8120） */
  // eslint-disable-next-line regexp/prefer-d
  private static readonly MNAV_REGEX = /美股\s*-\s*(?:NASDAQ|NYSE|OTCMARKETS)[^0-9]*(\d\.\d{4})/i

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
        userAgent:
          'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        viewport: { width: 1920, height: 1080 },
        locale: 'zh-CN',
      })

      const page = await context.newPage()

      // BBX 页面通常会保持长连接，networkidle 可能永远等不到。
      // 这里改用 domcontentloaded + 显式等待表格出现。
      await this.gotoWithRetry(page, url, Math.max(30_000, waitTimeout))

      // 点击"全部"按钮展开完整列表（优先尝试 Tab，再 fallback 到纯文本匹配）
      try {
        const allTab = page.getByRole('tab', { name: '全部' }).first()
        if ((await allTab.count()) > 0) {
          await allTab.click()
          this.logger.log('Clicked "全部" button')

          // 等待table元素出现（最多10秒）
          await page.waitForSelector(
            '.ant-table-tbody tr:not(.ant-table-measure-row):not([aria-hidden="true"]), table tbody tr',
            { timeout: 10000 },
          )
          this.logger.log('Table rows appeared after clicking "全部"')

          // 额外等待2秒确保数据完全加载
          await page.waitForTimeout(2000)
        } else {
          const allButtons = await page.locator('text="全部"').all()
          if (allButtons.length > 0) {
            await allButtons[0].click()
            this.logger.log('Clicked "全部" button')
            await page.waitForSelector(
              '.ant-table-tbody tr:not(.ant-table-measure-row):not([aria-hidden="true"]), table tbody tr',
              { timeout: 10000 },
            )
            this.logger.log('Table rows appeared after clicking "全部"')
            await page.waitForTimeout(2000)
          }
        }
      } catch (error) {
        this.logger.warn(
          `Failed to click "全部" button or wait for table: ${error instanceof Error ? error.message : String(error)}`,
        )
      }

      // 点击"市值"列头2次（降序排序）
      try {
        const marketCapHeader = page.locator('th, div, span', { hasText: '市值' }).first()

        // 先等待元素可见（最多10秒）
        await marketCapHeader.waitFor({ state: 'visible', timeout: 10000 })

        await marketCapHeader.click()
        this.logger.log('Clicked "市值" header (1st time - ascending)')
        await page.waitForTimeout(2000)

        await marketCapHeader.click()
        this.logger.log('Clicked "市值" header (2nd time - descending)')
        await page.waitForTimeout(3000)
      } catch {
        // 兼容英文表头：Market Cap
        try {
          const marketCapHeaderEn = page.locator('th, div, span', { hasText: 'Market Cap' }).first()
          await marketCapHeaderEn.waitFor({ state: 'visible', timeout: 5000 })
          await marketCapHeaderEn.click()
          this.logger.log('Clicked "Market Cap" header (1st time - ascending)')
          await page.waitForTimeout(2000)
          await marketCapHeaderEn.click()
          this.logger.log('Clicked "Market Cap" header (2nd time - descending)')
          await page.waitForTimeout(3000)
        } catch (error2) {
          this.logger.warn(
            `Failed to click market cap header: ${error2 instanceof Error ? error2.message : String(error2)}`,
          )
          // 点击失败不影响继续执行，直接提取当前可见数据
          this.logger.log('Continuing without sorting, will extract visible data')
        }
      }

      // 等待数据表格加载：优先等待元素出现，失败后 fallback 到固定等待
      try {
        await page.waitForSelector(
          '.ant-table-tbody tr.ant-table-row, .ant-table-tbody tr, table tbody tr',
          { timeout: waitTimeout },
        )
      } catch {
        this.logger.warn('waitForSelector timeout, falling back to fixed wait')
        await page.waitForTimeout(waitTimeout)

        // Fallback 后检测页面状态，区分「加载失败」和「无数据」
        const pageContent = await page.content()
        const hasErrorIndicator =
          pageContent.includes('error') ||
          pageContent.includes('失败') ||
          pageContent.includes('网络异常')
        const hasNoDataIndicator =
          pageContent.includes('暂无数据') || pageContent.includes('no data')
        const rowsAfterWait = await page.$$('.ant-table-tbody tr, table tbody tr')

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

      // 提取表格数据
      const quotes = await this.extractQuotes(page)

      if (quotes.length === 0) {
        this.logger.warn('No quotes extracted from BBX page')

        // 尝试输出轻量诊断信息（写入 executions.meta，便于在后台查看，不依赖 stdout 日志）
        const debug = await this.buildDebugMeta(page)
        return {
          fetchedCount: 0,
          newCursor: JSON.stringify({ ...cursor, lastFetchTime: new Date().toISOString() }),
          meta: { note: 'No quotes extracted', debug },
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
          debug: await this.buildDebugMeta(page, {
            extractedCount: quotes.length,
            filteredCount: quotes.length,
          }),
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

    const debugCounters = {
      rowsSeen: 0,
      rowsNonEmpty: 0,
      identityOk: 0,
      priceOk: 0,
      marketCapParsed: 0,
      passedFilter: 0,
      sampleIdentityFailures: [] as string[],
    }

    // 页面会同时渲染多个表（如币种行情表 + 币股/加密概念股表）。
    // 必须先选中目标表，否则会把币种行情表的行喂给 parseIdentity，导致全部失败。
    const table = await this.pickBbxDataTable(page)

    await this.loadMoreRowsIfNeeded(table)

    // 这里不再依赖 thead/th 定位列：该页面会把多个 header 混在一起，导致列索引错位。
    // 直接按 tr.textContent 做解析更稳定。
    const rowsLocator = await this.pickBodyRowsLocator(table)
    const rows = await rowsLocator.elementHandles()
    this.logger.log(`Found ${rows.length} table rows`)

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i]
      try {
        debugCounters.rowsSeen += 1
        const rowText = await row
          .evaluate(el => {
            const ht = el as HTMLElement
            return (ht.textContent || '').trim()
          })
          .then(t => t.replace(/\s+/g, ' ').trim())
        if (!rowText) continue

        debugCounters.rowsNonEmpty += 1

        const quote = this.parseQuoteFromRowText(rowText)
        if (!quote) {
          if (debugCounters.sampleIdentityFailures.length < 3) {
            debugCounters.sampleIdentityFailures.push(rowText.slice(0, 200))
          }
          continue
        }

        debugCounters.identityOk += 1
        if (typeof quote.marketCap === 'number') debugCounters.marketCapParsed += 1

        if (quote.price > 0) {
          debugCounters.priceOk += 1
          quotes.push(quote)
        }
      } catch (error) {
        this.logger.warn(
          `Failed to extract row ${i}: ${error instanceof Error ? error.message : String(error)}`,
        )
      }
    }

    const parsedMarketCapCount = quotes.filter(q => typeof q.marketCap === 'number').length
    const filtered = quotes.filter(
      q => (q.marketCap ?? 0) >= BbxCryptoStockScraperJob.MIN_MARKET_CAP_USD_THRESHOLD,
    )
    debugCounters.passedFilter = filtered.length
    this.logger.log(
      `Filtered ${quotes.length} quotes to ${filtered.length} with marketCap ≥ ${BbxCryptoStockScraperJob.MIN_MARKET_CAP_USD_THRESHOLD / 1e9}B USD (parsedMarketCap=${parsedMarketCapCount})`,
    )

    // 仅在本次执行周期内保存，便于写入 execution.meta.debug（buildDebugMeta 会读取此字段）。
    ;(page as any).__bbxDebugCounters = debugCounters

    return filtered
  }

  private parseQuoteFromRowText(rowText: string): BbxScrapedQuote | null {
    const identity = this.parseIdentity('', rowText)
    if (!identity) return null

    const nameMatch = rowText.match(BbxCryptoStockScraperJob.COMPANY_NAME_REGEX)
    const typeMatch = rowText.match(BbxCryptoStockScraperJob.COMPANY_TYPE_REGEX)

    const mNavMatch = rowText.match(/\b(\d+\.\d{4})\b/)
    const mNav = mNavMatch ? this.parseNumber(mNavMatch[1]) : undefined

    const marketCap = this.parseUsdMarketCapFromRowText(rowText)
    const price = this.parsePriceFromRowText(rowText) ?? 0
    const priceChangePercent = this.parseChangePercentFromRowText(rowText)

    return {
      symbol: identity.symbol,
      name: identity.name ?? nameMatch?.[1]?.trim() ?? identity.symbol,
      exchange: identity.exchange,
      companyType: typeMatch?.[1]?.trim(),
      mNav,
      marketCap,
      holdingValue: this.parseHoldingValueFromRowText(rowText),
      holdingQuantity: undefined,
      holdingCoin: undefined,
      price,
      priceChangePercent,
    }
  }

  private parseUsdMarketCapFromRowText(rowText: string): number | undefined {
    if (!rowText || !/USD/i.test(rowText)) return undefined

    // 行文本经常存在字段粘连（例如 mNAV + marketCap 紧贴在一起）。
    // 优先：从 mNAV（四位小数）之后的片段里解析首个 x.xx BUSD/MUSD/...，避免误把 mNAV 的尾部拼进市值。
    const mNavMatch = rowText.match(/\d\.\d{4}/)
    if (mNavMatch?.index !== undefined) {
      const after = rowText.slice(mNavMatch.index + mNavMatch[0].length)
      const tailMatch = after.match(
        /(\d{1,3}(?:,\d{3})*(?:\.\d+)?|\d+(?:\.\d+)?)\s*([KMBT])\s*USD/i,
      )
      if (tailMatch) {
        const parsed = this.parseUsdMarketCap(tailMatch[0])
        if (typeof parsed === 'number') return parsed
      }
    }

    // fallback：整行扫描（但会跳过明显的“数字.数字”粘连导致的假匹配，并按最右侧匹配优先）
    return this.parseUsdMarketCap(rowText)
  }

  private async extractFirstRowTdsViaTableRoot(table: Locator): Promise<string[]> {
    try {
      const rowHandle = await (await this.pickBodyRowsLocator(table)).first().elementHandle()
      if (!rowHandle) return []

      const texts = await rowHandle
        .evaluate(el => {
          const cells = Array.from(el.querySelectorAll('td'))
          return cells.map(td => (td.textContent ?? '').replace(/\s+/g, ' ').trim())
        })
        .catch(() => [])

      return Array.isArray(texts) ? texts : []
    } catch {
      return []
    }
  }

  private resolveIndex(
    preferred: number | undefined,
    fallback: number | undefined,
    cellCount: number,
  ): number | undefined {
    if (typeof preferred === 'number' && preferred >= 0 && preferred < cellCount) return preferred
    if (typeof fallback === 'number' && fallback >= 0 && fallback < cellCount) return fallback
    return undefined
  }

  private async pickBodyRowsLocator(table: Locator): Promise<Locator> {
    const antRows = table.locator(
      '.ant-table-tbody tr:not(.ant-table-measure-row):not([aria-hidden="true"])',
    )
    if ((await antRows.count().catch(() => 0)) > 0) return antRows
    return table.locator('tbody tr')
  }

  /**
   * 从首行 cell 文本推断列索引，避免 header 与 tbody 不对齐。
   * 适配币股表的典型布局：mNAV | 市值(…USD) | 持币价值($…B) | 股价($….) | 24h涨跌(+…%)
   */
  private inferColumnIndexes(cellTexts: string[]): {
    mNavIndex?: number
    marketCapIndex?: number
    holdingValueIndex?: number
    priceIndex?: number
    changeIndex?: number
  } {
    const cleaned = cellTexts.map(t => (t ?? '').replace(/\s+/g, ' ').trim())

    const marketCapIndex = cleaned.findIndex(t => /USD/i.test(t))
    const holdingValueIndex = cleaned.findIndex(
      t => /^\$[\d,.]+\s*[KMBT]?\b/i.test(t) && !/USD/i.test(t),
    )

    // price：$数字（不带 B/M/K/T 的那种），优先取在 holdingValue 后面的第一个
    const isPlainUsdPrice = (t: string) => /^\$[\d,.]+$/.test(t)
    const priceCandidates = cleaned
      .map((t, i) => ({ t, i }))
      .filter(x => isPlainUsdPrice(x.t))
      .map(x => x.i)

    const priceIndex =
      typeof holdingValueIndex === 'number' && holdingValueIndex >= 0
        ? priceCandidates.find(i => i > holdingValueIndex)
        : priceCandidates[0]

    const changeIndex = cleaned.findIndex(t => /%/.test(t))

    // mNAV：类似 0.8842 / 1.1210 的四位小数
    const mNavIndex = cleaned.findIndex(t => /^\d+\.\d{4}$/.test(t))

    return {
      mNavIndex: mNavIndex >= 0 ? mNavIndex : undefined,
      marketCapIndex: marketCapIndex >= 0 ? marketCapIndex : undefined,
      holdingValueIndex: holdingValueIndex >= 0 ? holdingValueIndex : undefined,
      priceIndex: typeof priceIndex === 'number' ? priceIndex : undefined,
      changeIndex: changeIndex >= 0 ? changeIndex : undefined,
    }
  }

  private parsePriceFromRowText(rowText: string): number | undefined {
    if (!rowText) return undefined
    const matches = [...rowText.matchAll(/\$([\d,.]+)(?![KMBT])/g)]
    if (matches.length === 0) return undefined
    const last = matches[matches.length - 1]?.[1]
    return last ? this.parseNumber(last) : undefined
  }

  private parseChangePercentFromRowText(rowText: string): number | undefined {
    if (!rowText) return undefined
    const match = rowText.match(/([+-]?\d+\.\d+)%/)
    if (!match) return undefined
    return this.parseNumber(match[1])
  }

  private findHeaderIndex(headers: string[], keys: string[]): number | undefined {
    const normalized = headers.map(h => h.replace(/\s+/g, '').toLowerCase())
    for (const k of keys) {
      const key = k.replace(/\s+/g, '').toLowerCase()
      const exact = normalized.findIndex(h => h === key)
      if (exact >= 0) return exact
      const fuzzy = normalized.findIndex(h => h.includes(key))
      if (fuzzy >= 0) return fuzzy
    }
    return undefined
  }

  private findAllHeaderIndexes(headers: string[], keys: string[]): number[] {
    const normalized = headers.map(h => h.replace(/\s+/g, '').toLowerCase())
    const wanted = keys.map(k => k.replace(/\s+/g, '').toLowerCase())
    const matches: number[] = []

    for (let i = 0; i < normalized.length; i += 1) {
      const h = normalized[i]
      if (!h) continue
      if (wanted.some(k => h === k || h.includes(k))) matches.push(i)
    }
    return matches
  }

  /**
   * 选择“市值/Market Cap”列索引。
   * - 页面可能同时渲染多个表/多个“市值”列
   * - 若存在“持币价值/Holding Value”列，优先选择其左侧相邻的市值列（常见为：mNAV | 市值 | 持币价值）
   */
  private pickMarketCapIndex(
    headers: string[],
    holdingValueIndex: number | undefined,
  ): number | undefined {
    const candidates = this.findAllHeaderIndexes(headers, ['市值', 'market cap', 'marketcap'])
    if (candidates.length === 0) return undefined

    if (typeof holdingValueIndex === 'number') {
      const adjacent = candidates.find(idx => idx === holdingValueIndex - 1)
      if (typeof adjacent === 'number') return adjacent

      // 次优：距离 holdingValue 最近且在其左侧
      const leftSide = candidates.filter(idx => idx < holdingValueIndex)
      if (leftSide.length > 0) return leftSide[leftSide.length - 1]
    }

    // 默认取第一个出现的市值列
    return candidates[0]
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

  private parsePercent(text: string): number | undefined {
    if (!text || text === '-') return undefined
    const cleaned = text.trim().replace('%', '')
    return this.parseNumber(cleaned)
  }

  private parseUsdMarketCap(text: string): number | undefined {
    if (!text || text === '-') return undefined
    const normalized = text.replace(/\s+/g, ' ').trim()
    if (!/USD/i.test(normalized)) return undefined

    // 单位在 BBX 上通常表现为 BUSD/MUSD/KUSD/TUSD。
    // number 允许 1 个小数点；允许出现逗号分隔。
    const matches = [
      ...normalized.matchAll(/(\d{1,3}(?:,\d{3})*(?:\.\d+)?|\d+(?:\.\d+)?)\s*([KMBT])\s*USD/gi),
    ]
    if (matches.length === 0) return undefined

    let best: { value: number; index: number } | undefined
    for (const m of matches) {
      const index = m.index ?? -1

      // 过滤明显的“字段粘连”假匹配：如 "0.8842.37 BUSD" 中从 "8842.37" 开始的匹配，
      // 其前一位是 '.' 且前二位是数字。
      if (index >= 2) {
        const prev = normalized[index - 1]
        const prev2 = normalized[index - 2]
        if (prev === '.' && /\d/.test(prev2)) continue
      }

      const raw = m[1]
      const unit = m[2]?.toUpperCase()
      let value = this.parseNumber(raw)
      if (!value) continue

      if (unit === 'T') value *= 1e12
      else if (unit === 'B') value *= 1e9
      else if (unit === 'M') value *= 1e6
      else if (unit === 'K') value *= 1e3

      // 市值在一行里通常只出现一次；若出现多次，优先取“最右侧”的那个，
      // 以减少 mNAV/其它字段粘连导致的错配。
      if (!best || index > best.index) best = { value, index }
    }

    return best?.value
  }

  private parseHoldingValueFromRowText(rowText: string): number | undefined {
    if (!rowText) return undefined
    const match = rowText.match(BbxCryptoStockScraperJob.HOLDING_VALUE_REGEX)
    if (!match) return undefined
    let value = this.parseNumber(match[1])
    if (!value) return undefined

    const unit = match[2]?.toUpperCase()
    if (unit === 'B') value *= 1e9
    else if (unit === 'M') value *= 1e6
    else if (unit === 'K') value *= 1e3
    return value
  }

  /**
   * 从首列/整行文本中解析 symbol/exchange/name。
   * - 不依赖固定的“美股 - NASDAQ”格式，尽量兼容 BBX 页面渲染差异
   */
  private parseIdentity(
    firstCell: string,
    rowText: string,
  ): { symbol: string; exchange: string; name?: string } | null {
    const combined = `${firstCell} ${rowText}`.replace(/\s+/g, ' ').trim()

    // 不能对整行做 upper-case：公司名里的小写尾字符（例如 Incorporated 的 d）会变成大写，
    // 与 ticker 粘连后导致误判（例如 dMSTR）。ticker 必须用严格的大写匹配。
    const stockInfoMatch = combined.match(BbxCryptoStockScraperJob.STOCK_INFO_REGEX)

    const exchange =
      stockInfoMatch?.[2] ?? combined.match(/\b(NASDAQ|NYSE|OTCMARKETS)(?=[^A-Z]|$)/)?.[1] ?? null
    if (!exchange) return null

    // symbol 优先：STOCK_INFO_REGEX 捕获 -> fallback 用“最后一个大写 token”
    const rawSymbol = stockInfoMatch?.[1]
    const extracted = rawSymbol?.match(BbxCryptoStockScraperJob.SYMBOL_EXTRACT_REGEX)?.[1]

    const fallbackSymbol = (() => {
      // 注意：BBX 行文本可能是 "...IncorporatedMSTR美股-NASDAQ..."，
      // symbol 前后不一定存在 word-boundary（大小写仍属于 \w），因此不能依赖 \b。
      const tokens = combined.match(/[A-Z]{1,6}(?:\.[A-Z])?/g)
      if (!tokens || tokens.length === 0) return null
      return tokens[tokens.length - 1]
    })()

    const symbol = extracted ?? fallbackSymbol
    if (!symbol) return null

    // name：优先从首列中剥离 symbol/exchange 信息，取剩余非空文本
    const cleanedFirst = firstCell
      .replace(new RegExp(`\\b${symbol}\\b`, 'g'), '')
      .replace(/\b(NASDAQ|NYSE|OTCMARKETS)\b/gi, '')
      .replace(/美股|\bUSA\b|\bUS\b|U\.S\./gi, '')
      .replace(/[\-–—]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()

    const name = cleanedFirst || undefined

    return { symbol, exchange, name }
  }

  private async gotoWithRetry(
    page: import('playwright').Page,
    url: string,
    timeout: number,
  ): Promise<void> {
    const retriable =
      /ERR_CONNECTION_CLOSED|ERR_CONNECTION_RESET|ERR_TIMED_OUT|ECONNRESET|ETIMEDOUT/i

    let lastError: unknown
    for (let attempt = 1; attempt <= 3; attempt += 1) {
      try {
        await page.goto(url, { waitUntil: 'domcontentloaded', timeout })
        return
      } catch (e) {
        lastError = e
        const message = e instanceof Error ? e.message : String(e)
        if (!retriable.test(message) || attempt === 3) throw e
        await page.waitForTimeout(500 * attempt)
      }
    }

    // 理论上不会到这里
    throw lastError instanceof Error ? lastError : new Error(String(lastError))
  }

  private async buildDebugMeta(
    page: import('playwright').Page,
    counts?: { extractedCount?: number; filteredCount?: number },
  ): Promise<Record<string, unknown>> {
    try {
      const title = await page.title().catch(() => '')
      const url = page.url()
      const antTableCount = await page
        .locator('.ant-table')
        .count()
        .catch(() => 0)
      const rowCount = await page
        .locator(
          '.ant-table-tbody tr:not(.ant-table-measure-row):not([aria-hidden="true"]), table tbody tr',
        )
        .count()
        .catch(() => 0)

      const pickedTable = await this.pickBbxDataTable(page)
      const pickedRowCount = await (await this.pickBodyRowsLocator(pickedTable))
        .count()
        .catch(() => 0)

      const headerTexts = await page
        .locator('.ant-table thead th, table thead th')
        .allTextContents()
        .then(xs => xs.map(x => x.replace(/\s+/g, ' ').trim()).filter(Boolean))
        .catch(() => [])

      const pickedHeaderTexts = await pickedTable
        .locator('thead th')
        .allTextContents()
        .then(xs => xs.map(x => x.replace(/\s+/g, ' ').trim()).filter(Boolean))
        .catch(() => [])

      const firstRowTds = await this.extractFirstRowTdsViaTableRoot(pickedTable)
      const inferred = this.inferColumnIndexes(firstRowTds)

      const sampleRowsLocator = await this.pickBodyRowsLocator(pickedTable)
      const sampleRows = await sampleRowsLocator
        .evaluateAll(rows => {
          const texts: string[] = []
          for (let i = 0; i < rows.length && i < 3; i += 1) {
            const t = (rows[i]?.textContent ?? '').replace(/\s+/g, ' ').trim()
            if (t) texts.push(t.slice(0, 200))
          }
          return texts
        })
        .catch(() => [])

      // 轻量判断是否遇到挑战/拦截
      const html = await page.content().catch(() => '')
      const blocked =
        /captcha|cloudflare|verify you are human|attention required|安全验证|人机验证/i.test(html)

      // 仅保留很小的片段，避免把大 HTML 写进 meta
      const snippet = html ? html.replace(/\s+/g, ' ').slice(0, 300) : ''

      return {
        url,
        title,
        antTableCount,
        rowCount,
        headers: headerTexts,
        pickedRowCount,
        pickedHeaders: pickedHeaderTexts,
        firstRowTds,
        inferred,
        sampleRows,
        extractedCount: counts?.extractedCount ?? null,
        filteredCount: counts?.filteredCount ?? null,
        counters: (page as any).__bbxDebugCounters ?? null,
        blocked,
        snippet,
      }
    } catch (e) {
      return {
        error: e instanceof Error ? e.message : String(e),
      }
    }
  }

  private async pickHeadersForBodyRow(table: Locator, expectedColumns: number): Promise<string[]> {
    const rows = table.locator('thead tr')
    const rowCount = await rows.count().catch(() => 0)
    if (rowCount === 0) return []

    // 选择 th 数量与 tbody td 数量一致的那一行。
    // 若 expectedColumns=0（极端情况），就返回最后一行（通常是最“细”的那行）。
    let picked: string[] | null = null
    for (let i = 0; i < rowCount; i += 1) {
      const ths = rows.nth(i).locator('th')
      const count = await ths.count().catch(() => 0)
      if (expectedColumns > 0 && count === expectedColumns) {
        picked = await ths
          .allTextContents()
          .then(xs => xs.map(x => x.replace(/\s+/g, ' ').trim()))
          .catch(() => [])
        break
      }
    }

    if (picked) return picked

    return rows
      .nth(rowCount - 1)
      .locator('th')
      .allTextContents()
      .then(xs => xs.map(x => x.replace(/\s+/g, ' ').trim()))
      .catch(() => [])
  }

  private async loadMoreRowsIfNeeded(table: Locator) {
    const tableBody = table.locator('.ant-table-body').first()
    if ((await tableBody.count()) === 0) return

    let lastRowCount = 0
    let stableRounds = 0
    for (let i = 0; i < 20; i++) {
      const current = await table.locator('.ant-table-tbody tr').count()
      if (current > lastRowCount) {
        lastRowCount = current
        stableRounds = 0
      } else {
        stableRounds++
        if (stableRounds >= 3) break
      }

      await tableBody.evaluate(el => {
        ;(el as HTMLElement).scrollTop = (el as HTMLElement).scrollHeight
      })
      // Locator 上无法直接 waitForTimeout，这里用元素所在的 frame/page。
      await tableBody.page().waitForTimeout(500)
    }
  }

  private async pickBbxDataTable(page: import('playwright').Page) {
    // 页面可能同时渲染：
    // - 币种行情表（无“美股-NASDAQ/NYSE”之类的交易所标记）
    // - 币股/加密概念股表（行里包含 “美股- NASDAQ/NYSE/OTCMARKETS”）
    // 仅靠 header 文本不可靠（页面会混入多个 header），这里用“行内容是否匹配交易所信息”来选表。

    const candidates = page.locator('.ant-table, table')
    const count = await candidates.count().catch(() => 0)
    if (count <= 0) return page.locator('.ant-table, table').first()

    let bestIndex = 0
    let bestScore = -1

    for (let i = 0; i < count; i += 1) {
      const table = candidates.nth(i)
      const rows = await this.pickBodyRowsLocator(table)
      const sample = await rows
        .evaluateAll(els => {
          const out: string[] = []
          for (let j = 0; j < els.length && j < 5; j += 1) {
            const t = (els[j]?.textContent ?? '').replace(/\s+/g, ' ').trim()
            if (t) out.push(t)
          }
          return out
        })
        .catch(() => [])

      const joined = Array.isArray(sample) ? sample.join(' ') : ''
      let score = 0
      if (/美股\s*[\-–—]\s*(?:NASDAQ|NYSE|OTCMARKETS)/i.test(joined)) score += 100
      if (BbxCryptoStockScraperJob.STOCK_INFO_REGEX.test(joined)) score += 100
      if (/\bmNAV\b|持币价值|Holding Value/i.test(joined)) score += 10
      if (/公司|Company/i.test(joined)) score += 2

      if (score > bestScore) {
        bestScore = score
        bestIndex = i
      }
    }

    return candidates.nth(bestIndex)
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
