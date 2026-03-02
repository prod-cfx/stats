'use client'

import type { CryptoStockQuoteLatest } from '@/lib/api'

import { ArrowUpDown, ChevronDown, ChevronUp, Info, Search } from 'lucide-react'
import React, { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { LoadingState } from '@/components/ui/loading'
import { Modal } from '@/components/ui/Modal'
import { useAsync } from '@/hooks/use-async'
import { fetchCryptoStockQuotesLatest } from '@/lib/api'
import { AuthenticationError } from '@/lib/errors'
import { formatNumber } from '@/lib/formatters'
import { fetchPublicCompanyQuotes } from './fetch-public-company-quotes'
import { formatSignedAbsoluteChange, formatSignedPercentChange } from './change-formatters'

interface CompanyData {
  asset: string
  assetLogo: string
  name: string
  ticker: string
  exchange: string
  logo: string
  mNav: string
  marketCap: string
  holdingsValue: string
  holdingsAmount: string
  sharePrice: string
  change24h: string
  change1d: string
  change7d: string
  infoParagraphs?: string[]
}

const CompactValueCell = ({ rawValue, subText }: { rawValue: string; subText?: string }) => {
  if (!rawValue || rawValue === '-') return <span className="text-[color:var(--cf-muted)]">-</span>

  // Parse out the number and suffix without regex (avoid super-linear backtracking).
  // Handles formats like "55.07 B", "$58.14B", "671.27 K BTC"
  const cleanValue = rawValue.replace('$', '').trim()
  let i = 0
  while (i < cleanValue.length) {
    const ch = cleanValue[i]
    if ((ch >= '0' && ch <= '9') || ch === ',' || ch === '.') {
      i++
      continue
    }
    break
  }
  const num = cleanValue.slice(0, i)
  let rest = cleanValue.slice(i).trim()
  const suffixMatch = rest[0]?.toUpperCase()
  const suffix =
    suffixMatch && (suffixMatch === 'B' || suffixMatch === 'M' || suffixMatch === 'K')
      ? suffixMatch
      : ''
  if (suffix) rest = rest.slice(1).trim()
  const finalSubText = subText || rest

  if (num) {
    return (
      <div className="flex flex-col items-center leading-tight">
        <div className="flex items-baseline gap-0.5">
          <span className="font-mono font-medium text-[color:var(--cf-text-strong)]">{num}</span>
          {suffix && (
            <span className="ml-0.5 font-mono font-medium text-[color:var(--cf-text-strong)]">
              {suffix}
            </span>
          )}
        </div>
        {finalSubText && (
          <span className="mt-0.5 font-sans text-[10px] text-[color:var(--cf-muted)] uppercase">
            {finalSubText}
          </span>
        )}
      </div>
    )
  }

  return <span className="font-mono text-[color:var(--cf-text-strong)]">{rawValue}</span>
}

// 公开页面的静态示例数据：在未登录或接口不可用时作为兜底展示
const STATIC_COMPANY_DATA: CompanyData[] = [
  {
    asset: 'PYUSD',
    assetLogo: 'https://static.aicoinstorge.com/coin/20240606/171763829567331.png',
    name: 'PayPal Holdings, Inc.',
    ticker: 'PYPL',
    exchange: '美股-NASDAQ',
    logo: 'https://static.aicoinstorge.com/index/20250702/175145518572384.png',
    mNav: '-',
    marketCap: '55.07 B',
    holdingsValue: '-',
    holdingsAmount: '-',
    sharePrice: '$57.64',
    change24h: '+0.00%',
    change1d: '+0.00%',
    change7d: '+0.00%',
  },
  {
    asset: 'BTC',
    assetLogo: 'https://static.aicoinstorge.com/coin/20180523/152707758483056.png',
    name: 'MicroStrategy Incorporated',
    ticker: 'MSTR',
    exchange: '美股-NASDAQ',
    logo: 'https://static.aicoinstorge.com/index/20250702/175145459724376.jpg',
    mNav: '0.82',
    marketCap: '44.52 B',
    holdingsValue: '61.00 B',
    holdingsAmount: '673.78 K BTC',
    sharePrice: '$157.33',
    change24h: '+0.00%',
    change1d: '+0.00%',
    change7d: '+0.00%',
    infoParagraphs: [
      '微策略是一家美国的 software 公司，提供商业智能、移动软件和云端服务。',
      '该公司于 1989 年由迈克尔·塞勒（Michael J. Saylor）、桑朱·班萨尔（Sanju Bansal）和托马斯·斯宾纳（Thomas Spahr）创立，专门开发用于分析内部与外部数据的软件，协助进行商业决策以及开发移动应用程序。',
      '公司总部位于弗吉尼亚州泰森斯（Tysons），属于华盛顿都会区的一部分。塞勒为执行主席，自 1989 年至 2022 年担任 CEO。',
      '该公司因为持有巨量比特币而被认为是与比特币挂钩的“概念股”。',
    ],
  },
  {
    asset: 'USDC',
    assetLogo: 'https://static.aicoinstorge.com/coin/20220808/165993003785920.png',
    name: 'Circle Internet Group',
    ticker: 'CRCL',
    exchange: '美股-NYSE',
    logo: 'https://static.aicoinstorge.com/index/20251020/176096250685792.jpg',
    mNav: '0.27',
    marketCap: '17.22 B',
    holdingsValue: '64.54 B',
    holdingsAmount: '64.50 B USDC',
    sharePrice: '$82.94',
    change24h: '+0.00%',
    change1d: '+0.00%',
    change7d: '+0.00%',
  },
  {
    asset: 'ETH',
    assetLogo: 'https://static.aicoinstorge.com/coin/20250425/174556604535555.png',
    name: 'BitMine Immersion',
    ticker: 'BMNR',
    exchange: '美股-NYSE',
    logo: 'https://static.aicoinstorge.com/index/20251216/176585071943612.png',
    mNav: '0.94',
    marketCap: '12.81 B',
    holdingsValue: '12.67 B',
    holdingsAmount: '4.07 M ETH',
    sharePrice: '$30.07',
    change24h: '+0.00%',
    change1d: '+0.00%',
    change7d: '+0.00%',
  },
  {
    asset: 'BCH',
    assetLogo: 'https://static.aicoinstorge.com/coin/20240522/171633960967508.png',
    name: 'Bitdeer Technologies Group',
    ticker: 'BTDR',
    exchange: '美股-NASDAQ',
    logo: 'https://static.aicoinstorge.com/index/20250729/175376116579089.jpg',
    mNav: '-',
    marketCap: '1.75 B',
    holdingsValue: '-',
    holdingsAmount: '-',
    sharePrice: '$11.51',
    change24h: '+0.00%',
    change1d: '+0.00%',
    change7d: '+0.00%',
  },
]

type SortField =
  | keyof Pick<
      CompanyData,
      | 'mNav'
      | 'marketCap'
      | 'holdingsValue'
      | 'holdingsAmount'
      | 'sharePrice'
      | 'change24h'
      | 'change1d'
      | 'change7d'
    >
  | null
type SortDirection = 'asc' | 'desc' | null

export const PublicCompaniesTable = () => {
  const { t, i18n } = useTranslation()
  const [searchTerm, setSearchTerm] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [sortField, setSortField] = useState<SortField>('marketCap')
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc')
  const [selectedCompany, setSelectedCompany] = useState<CompanyData | null>(null)
  const [isAuthError, setIsAuthError] = useState(false)

  const {
    data: quotes,
    loading,
    error,
    execute: reload,
  } = useAsync<CryptoStockQuoteLatest[]>(
    async () => fetchPublicCompanyQuotes(fetchCryptoStockQuotesLatest),
    {
      onSuccess: () => {
        setIsAuthError(false)
      },
      onError: err => {
        if (err instanceof AuthenticationError) {
          setIsAuthError(true)
        }
      },
    },
  )

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchTerm)
    }, 300)
    return () => clearTimeout(timer)
  }, [searchTerm])

  const companies: CompanyData[] = useMemo(() => {
    if (isAuthError) {
      return STATIC_COMPANY_DATA
    }

    if (!quotes) return []

    return quotes.map(q => {
      // 全量依赖后端返回的扩展字段；缺失时在 UI 使用中性占位符，避免在界面展示 TODO
      const asset = q.assetSymbol ?? q.symbol
      const assetLogo = q.assetLogoUrl ?? '/images/icon-default.svg'
      const logo = q.companyLogoUrl ?? q.assetLogoUrl ?? '/images/icon-default.svg'
      const name = q.name ?? q.symbol
      const exchange = (() => {
        if (!q.exchange) return '-'
        // 中文环境：前缀“美股-”，英文环境直接展示原始交易所代码
        return i18n.language === 'en' ? q.exchange : `美股-${q.exchange}`
      })()

      const priceNumber = Number.parseFloat(q.price)
      const sharePrice =
        Number.isFinite(priceNumber) && priceNumber > 0 ? `$${formatNumber(priceNumber, 2)}` : '-'

      const formatCompact = (val: string | number | null) => {
        if (val == null || val === '') return '-'
        const num = typeof val === 'string' ? Number.parseFloat(val) : val
        if (Number.isNaN(num)) return '-'
        if (num >= 1e9) return `${(num / 1e9).toFixed(2)} B`
        if (num >= 1e6) return `${(num / 1e6).toFixed(2)} M`
        if (num >= 1e3) return `${(num / 1e3).toFixed(2)} K`
        return num.toString()
      }

      const marketCap = formatCompact(q.marketCap ?? null)

      const pctString = formatSignedPercentChange(q.priceChangePercent, q.priceChange, q.price)
      const oneDayChangeString = formatSignedAbsoluteChange(q.priceChange)

      return {
        asset,
        assetLogo,
        name,
        ticker: q.symbol,
        exchange,
        logo,
        mNav: q.mNav ?? '-',
        marketCap,
        holdingsValue: q.holdingsValue ?? '-',
        holdingsAmount: q.holdingsAmount ?? '-',
        sharePrice,
        change24h: pctString,
        change1d: oneDayChangeString,
        // 暂无真实 7 日涨跌幅数据，这里保留为占位符，后端补充后再改为真实字段映射
        change7d: '-',
        infoParagraphs: q.infoParagraphs,
      }
    })
  }, [i18n.language, isAuthError, quotes])

  const filteredCompanies = useMemo(() => {
    if (!companies.length) return []
    const keyword = debouncedSearch.trim().toLowerCase()
    if (!keyword) return companies
    return companies.filter(
      c => c.name.toLowerCase().includes(keyword) || c.ticker.toLowerCase().includes(keyword),
    )
  }, [companies, debouncedSearch])

  const sortedData = useMemo(() => {
    if (!filteredCompanies.length) return []
    if (!sortField || !sortDirection) return filteredCompanies

    const parseCompactNumber = (raw: string): number | null => {
      const val = raw.trim()
      if (!val || val === '-') return null

      // Keep sign; extract first number.
      const match = val.match(/[-+]?\d+(\.\d+)?/)
      if (!match || match.index == null) return null
      const numStr = match[0]
      const num = Number(numStr)
      if (!Number.isFinite(num)) return null

      // Detect unit right after the number (e.g. 3.1T, 47.4B, 671.27K BTC, 66.10万 BTC, 3.1万亿)
      // Note: only treat compact units when they are directly attached (or after trimming leading spaces).
      // If the suffix is separated by whitespace and looks like a symbol/code (e.g. "BTC"), we treat it as "no unit".
      const restRaw = val.slice(match.index + numStr.length)
      const rest = restRaw.trimStart()
      if (!rest) return num

      // CJK units (order matters: handle "万亿" before "万")
      if (rest.startsWith('万亿')) return num * 1e12
      if (rest.startsWith('兆')) return num * 1e12
      if (rest.startsWith('千亿')) return num * 1e11
      if (rest.startsWith('百亿')) return num * 1e10
      if (rest.startsWith('十亿')) return num * 1e9
      if (rest.startsWith('亿')) return num * 1e8
      if (rest.startsWith('万')) return num * 1e4

      // Latin compact units: extract first token (until whitespace or a non-letter symbol)
      // Examples:
      // - "1.2bn" => token "bn"
      // - "1.2 bn" => token "bn"
      // - "671.27K BTC" => token "K"
      // - "1.2B" => token "B"
      const tokenMatch = rest.match(/^[a-z]+/i)
      const token = tokenMatch?.[0]?.toLowerCase()
      if (token) {
        const multipliers: Record<string, number> = {
          // trillion
          t: 1e12,
          tn: 1e12,
          trn: 1e12,
          // billion
          b: 1e9,
          bn: 1e9,
          // million
          m: 1e6,
          mn: 1e6,
          // thousand
          k: 1e3,
          kn: 1e3,
        }

        const multiplier = multipliers[token]
        if (multiplier != null) return num * multiplier

        // Unknown unit token: fail loudly (but keep UI working by pushing it to top in desc sorts)
        console.error(
          `[PublicCompaniesTable] Unknown unit token: "${token}" (raw="${val}", rest="${rest}")`,
        )
        return null
      }

      return num
    }

    const parsePercent = (raw: string): number | null => {
      const v = raw.trim()
      if (!v || v === '-') return null
      const num = Number(v.replace('%', ''))
      return Number.isFinite(num) ? num : null
    }

    const sortValueOf = (row: CompanyData, field: SortField): number | null => {
      if (!field) return null
      const raw = row[field]
      // Percent fields
      if (field === 'change24h' || field === 'change1d' || field === 'change7d')
        return parsePercent(raw)
      // mNAV: plain number or '-'
      if (field === 'mNav') return parseCompactNumber(raw)
      // Currency / compact values: $xxB, $xx, etc.
      if (field === 'marketCap' || field === 'holdingsValue' || field === 'sharePrice')
        return parseCompactNumber(raw.replace('$', '').replaceAll(',', ''))
      // holdingsAmount: e.g. "671.27K BTC", "64.50B USDC"
      if (field === 'holdingsAmount') return parseCompactNumber(raw.replaceAll(',', ''))
      return parseCompactNumber(raw)
    }

    return [...filteredCompanies].sort((a, b) => {
      const aVal = sortValueOf(a, sortField)
      const bVal = sortValueOf(b, sortField)
      // Always push missing/invalid values to the bottom, regardless of sort direction.
      const aMissing = aVal == null
      const bMissing = bVal == null
      if (aMissing && bMissing) return 0
      if (aMissing) return 1
      if (bMissing) return -1

      return sortDirection === 'asc' ? aVal - bVal : bVal - aVal
    })
  }, [filteredCompanies, sortField, sortDirection])

  const renderValueWithColor = (val: string) => {
    const isPositive = val.startsWith('+')
    const isNegative = val.startsWith('-')
    return (
      <span
        className={isPositive ? 'text-green-400' : isNegative ? 'text-red-400' : 'text-[#e6edf3]'}
      >
        {val}
      </span>
    )
  }

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      if (sortDirection === 'desc') {
        setSortDirection('asc')
      } else if (sortDirection === 'asc') {
        setSortField(null)
        setSortDirection(null)
      } else {
        setSortDirection('desc')
      }
    } else {
      setSortField(field)
      setSortDirection('desc')
    }
  }

  const renderSortIcon = (field: SortField) => {
    if (sortField !== field)
      return (
        <ArrowUpDown className="h-3 w-3 text-[color:var(--cf-muted)] opacity-30 transition-opacity group-hover:opacity-100" />
      )
    return sortDirection === 'desc' ? (
      <ChevronDown className="text-primary h-3 w-3" />
    ) : (
      <ChevronUp className="text-primary h-3 w-3" />
    )
  }

  const formatExchange = React.useCallback(
    (exchange: string) => {
      if (i18n.language !== 'en') return exchange
      if (exchange === '美股-NASDAQ') return 'US-NASDAQ'
      if (exchange === '美股-NYSE') return 'US-NYSE'
      return exchange
    },
    [i18n.language],
  )

  const selectedCompanyInfoParagraphs = useMemo(() => {
    if (!selectedCompany) return []
    if (selectedCompany.infoParagraphs?.length) {
      // If current UI is English but the stored paragraphs are Chinese, fall back to translated template copy.
      if (
        i18n.language === 'en' &&
        selectedCompany.infoParagraphs.some(p => /[\u4E00-\u9FFF]/.test(p))
      ) {
        return [
          t('publicCompanies.modal.fallbackLine1', {
            name: selectedCompany.name,
            ticker: selectedCompany.ticker,
          }),
          t('publicCompanies.modal.fallbackLine2', {
            exchange: formatExchange(selectedCompany.exchange),
            asset: selectedCompany.asset,
            mNav: selectedCompany.mNav,
          }),
        ]
      }
      return selectedCompany.infoParagraphs
    }
    return [
      t('publicCompanies.modal.fallbackLine1', {
        name: selectedCompany.name,
        ticker: selectedCompany.ticker,
      }),
      t('publicCompanies.modal.fallbackLine2', {
        exchange: formatExchange(selectedCompany.exchange),
        asset: selectedCompany.asset,
        mNav: selectedCompany.mNav,
      }),
    ]
  }, [formatExchange, i18n.language, selectedCompany, t])

  return (
    <div className="space-y-4 md:space-y-6">
      <div className="relative w-full md:max-w-md">
        <div className="group focus-within:from-primary focus-within:to-secondary rounded-xl bg-[color:var(--cf-border)] p-[1px] transition-colors focus-within:bg-gradient-to-r">
          <div className="relative rounded-xl bg-[color:var(--cf-surface)]">
            <Search className="group-focus-within:text-primary absolute top-1/2 left-4 h-4 w-4 -translate-y-1/2 text-[color:var(--cf-muted)] transition-colors md:h-5 md:w-5" />
            <input
              type="text"
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              placeholder={t('publicCompanies.searchPlaceholder')}
              className="w-full rounded-xl border-0 bg-transparent py-2 pr-4 pl-10 text-xs text-[color:var(--cf-text)] transition-all placeholder:text-[color:var(--cf-muted)] focus:ring-0 focus:outline-none md:py-2.5 md:pl-12 md:text-sm"
            />
          </div>
        </div>
      </div>

      <div className="relative min-h-[400px] overflow-hidden rounded-xl border border-[color:var(--cf-border)] bg-[color:var(--cf-surface)] shadow-lg">
        {isAuthError && (
          <div className="space-y-1 border-b border-[color:var(--cf-border)] bg-[color:var(--cf-surface-2)]/60 px-4 pt-4 pb-2 text-center md:space-y-2 md:px-6 md:pt-6">
            <h3 className="text-sm font-semibold text-[color:var(--cf-text-strong)] md:text-base">
              {t('publicCompanies.authRequiredTitle', '登录后可查看实时币股榜单')}
            </h3>
            <p className="mx-auto max-w-2xl text-[10px] text-[color:var(--cf-muted)] md:text-xs">
              {t(
                'publicCompanies.authRequiredDescription',
                '当前表格展示的是示例数据，登录后将自动切换为来自交易所的实时币股持仓与估值。',
              )}
            </p>
          </div>
        )}
        <LoadingState
          isLoading={loading && !isAuthError}
          error={!isAuthError && !!error}
          onRetry={reload}
          isEmpty={!loading && sortedData.length === 0}
        >
          <div className="animate-in fade-in cf-scrollbar overflow-x-auto duration-500">
            <table className="w-full min-w-[1000px] border-collapse md:min-w-[1200px]">
              <thead>
                <tr className="border-b border-[color:var(--cf-border)] bg-[color:var(--cf-surface-2)]/70 text-[10px] font-bold text-[color:var(--cf-muted)] md:text-xs">
                  <th className="sticky left-0 z-10 border-r border-[color:var(--cf-border)] bg-[color:var(--cf-surface)] px-4 py-4 text-left md:px-6 md:py-6">
                    {t('publicCompanies.columns.asset')}
                  </th>
                  <th className="sticky left-[70px] z-10 border-r border-[color:var(--cf-border)] bg-[color:var(--cf-surface)] px-4 py-4 text-left md:left-[88px] md:px-6 md:py-6">
                    {t('publicCompanies.columns.company')}
                  </th>
                  <th className="px-2 py-4 font-bold md:px-4 md:py-6">
                    <button
                      type="button"
                      onClick={() => handleSort('mNav')}
                      className="group flex w-full items-center justify-center gap-1 uppercase transition-colors hover:text-[color:var(--cf-text-strong)]"
                    >
                      mNAV {renderSortIcon('mNav')}
                    </button>
                  </th>
                  <th className="px-2 py-4 font-bold md:px-4 md:py-6">
                    <button
                      type="button"
                      onClick={() => handleSort('marketCap')}
                      className="group flex w-full items-center justify-center gap-1 transition-colors hover:text-[color:var(--cf-text-strong)]"
                    >
                      {t('publicCompanies.columns.marketCap')} {renderSortIcon('marketCap')}
                    </button>
                  </th>
                  <th className="px-2 py-4 font-bold md:px-4 md:py-6">
                    <button
                      type="button"
                      onClick={() => handleSort('holdingsValue')}
                      className="group flex w-full items-center justify-center gap-1 transition-colors hover:text-[color:var(--cf-text-strong)]"
                    >
                      {t('publicCompanies.columns.holdingsValue')} {renderSortIcon('holdingsValue')}
                    </button>
                  </th>
                  <th className="px-2 py-4 font-bold md:px-4 md:py-6">
                    <button
                      type="button"
                      onClick={() => handleSort('holdingsAmount')}
                      className="group flex w-full items-center justify-center gap-1 transition-colors hover:text-[color:var(--cf-text-strong)]"
                    >
                      {t('publicCompanies.columns.holdingsAmount')}{' '}
                      {renderSortIcon('holdingsAmount')}
                    </button>
                  </th>
                  <th className="px-2 py-4 font-bold md:px-4 md:py-6">
                    <button
                      type="button"
                      onClick={() => handleSort('sharePrice')}
                      className="group flex w-full items-center justify-center gap-1 transition-colors hover:text-[color:var(--cf-text-strong)]"
                    >
                      {t('publicCompanies.columns.sharePrice')} {renderSortIcon('sharePrice')}
                    </button>
                  </th>
                  <th className="px-2 py-4 font-bold md:px-4 md:py-6">
                    <button
                      type="button"
                      onClick={() => handleSort('change24h')}
                      className="group flex w-full items-center justify-center gap-1 text-center transition-colors hover:text-[color:var(--cf-text-strong)]"
                    >
                      {t('publicCompanies.columns.change24h')} {renderSortIcon('change24h')}
                    </button>
                  </th>
                  <th className="px-2 py-4 font-bold md:px-4 md:py-6">
                    <button
                      type="button"
                      onClick={() => handleSort('change1d')}
                      className="group flex w-full items-center justify-center gap-1 text-center transition-colors hover:text-[color:var(--cf-text-strong)]"
                    >
                      {t('publicCompanies.columns.change1d')} {renderSortIcon('change1d')}
                    </button>
                  </th>
                  <th className="px-2 py-4 font-bold md:px-4 md:py-6">
                    <button
                      type="button"
                      onClick={() => handleSort('change7d')}
                      className="group flex w-full items-center justify-center gap-1 text-center transition-colors hover:text-[color:var(--cf-text-strong)]"
                    >
                      {t('publicCompanies.columns.change7d')} {renderSortIcon('change7d')}
                    </button>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[color:var(--cf-border)] text-[11px] md:text-sm">
                {sortedData.map((row, index) => (
                  <tr
                    key={index}
                    className="cursor-pointer transition-colors hover:bg-[color:var(--cf-surface-hover)]"
                    onClick={() => setSelectedCompany(row)}
                  >
                    <td className="sticky left-0 z-10 border-r border-[color:var(--cf-border)] bg-[color:var(--cf-surface)] px-4 py-3 group-hover:bg-[color:var(--cf-surface-hover)] md:px-6 md:py-4">
                      <div className="flex items-center justify-start gap-2 md:gap-3">
                        <div className="h-5 w-5 flex-none md:h-6 md:w-6">
                          <img
                            src={row.assetLogo}
                            alt={row.asset}
                            className="h-full w-full rounded-full object-contain"
                          />
                        </div>
                        <span className="min-w-[40px] font-medium text-[color:var(--cf-text-strong)] md:min-w-[50px]">
                          {row.asset}
                        </span>
                      </div>
                    </td>
                    <td className="sticky left-[70px] z-10 border-r border-[color:var(--cf-border)] bg-[color:var(--cf-surface)] px-4 py-3 group-hover:bg-[color:var(--cf-surface-hover)] md:left-[88px] md:px-6 md:py-4">
                      <div className="flex min-w-0 items-center justify-start gap-2 md:gap-3">
                        <div className="h-6 w-6 flex-none overflow-hidden rounded-full bg-white p-0.5 md:h-8 md:w-8 md:p-1">
                          <img
                            src={row.logo}
                            alt={row.name}
                            className="h-full w-full object-contain"
                          />
                        </div>
                        <div className="flex min-w-0 flex-col">
                          <div className="flex min-w-0 items-start gap-1">
                            <span className="min-w-0 truncate font-semibold text-[color:var(--cf-text-strong)]">
                              {row.name}
                            </span>
                            <button
                              type="button"
                              aria-label={t('publicCompanies.aria.viewCompanyInfo')}
                              className="-mt-1 hidden flex-none rounded-lg p-1 text-[color:var(--cf-muted)] transition-colors hover:bg-[color:var(--cf-surface-hover)] hover:text-[color:var(--cf-text-strong)] md:block"
                              onClick={e => {
                                e.stopPropagation()
                                setSelectedCompany(row)
                              }}
                            >
                              <Info className="h-4 w-4" />
                            </button>
                          </div>
                          <span className="truncate text-[10px] text-[color:var(--cf-muted)] uppercase md:text-xs">
                            {row.ticker} {formatExchange(row.exchange)}
                          </span>
                        </div>
                      </div>
                    </td>
                    <td className="px-2 py-3 text-center md:px-4 md:py-4">
                      <span
                        className={
                          row.mNav !== '-' && Number.parseFloat(row.mNav) < 1
                            ? 'text-red-400'
                            : 'text-[color:var(--cf-text)]'
                        }
                      >
                        {row.mNav}
                      </span>
                    </td>
                    <td className="px-2 py-3 text-center md:px-4 md:py-4">
                      <CompactValueCell rawValue={row.marketCap} subText="USD" />
                    </td>
                    <td className="px-2 py-3 text-center md:px-4 md:py-4">
                      <CompactValueCell rawValue={row.holdingsValue} subText="USD" />
                    </td>
                    <td className="px-2 py-3 text-center md:px-4 md:py-4">
                      <CompactValueCell rawValue={row.holdingsAmount} />
                    </td>
                    <td className="px-2 py-3 text-center font-mono text-[color:var(--cf-text-strong)] md:px-4 md:py-4">
                      {row.sharePrice}
                    </td>
                    <td className="px-2 py-3 text-center font-mono md:px-4 md:py-4">
                      {renderValueWithColor(row.change24h)}
                    </td>
                    <td className="px-2 py-3 text-center font-mono md:px-4 md:py-4">
                      {renderValueWithColor(row.change1d)}
                    </td>
                    <td className="px-2 py-3 text-center font-mono md:px-4 md:py-4">
                      {renderValueWithColor(row.change7d)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </LoadingState>
      </div>

      {/* Company Detail Modal */}
      <Modal
        isOpen={!!selectedCompany}
        onClose={() => setSelectedCompany(null)}
        title={t('publicCompanies.modal.title')}
        width="max-w-xl"
      >
        <div className="space-y-6">
          <div className="flex items-start gap-4 border-b border-[color:var(--cf-border)] pb-4">
            <div className="h-12 w-12 flex-none rounded-xl bg-white p-2">
              <img src={selectedCompany?.logo} className="h-full w-full object-contain" alt="" />
            </div>
            <div className="min-w-0">
              <h3 className="truncate text-xl leading-tight font-bold text-[color:var(--cf-text-strong)]">
                {selectedCompany?.name}
              </h3>
              <div className="mt-2 flex flex-wrap gap-3">
                <span className="text-xs text-[color:var(--cf-muted)]">
                  {t('publicCompanies.modal.ticker')}:{' '}
                  <span className="font-bold text-[color:var(--cf-text)]">
                    {selectedCompany?.ticker}
                  </span>
                </span>
                <span className="text-xs text-[color:var(--cf-muted)]">
                  {t('publicCompanies.modal.exchange')}:{' '}
                  <span className="font-bold text-[color:var(--cf-text)]">
                    {selectedCompany ? formatExchange(selectedCompany.exchange) : ''}
                  </span>
                </span>
              </div>
            </div>
          </div>

          <div className="space-y-3">
            <p className="text-sm font-bold tracking-wider text-[color:var(--cf-muted)] uppercase">
              {t('publicCompanies.modal.sectionTitle')}
            </p>
            <div className="px-1 text-sm leading-relaxed text-[color:var(--cf-text)]">
              {selectedCompanyInfoParagraphs.map((p, idx) => (
                <React.Fragment key={idx}>
                  <p>{p}</p>
                  {idx !== selectedCompanyInfoParagraphs.length - 1 && <div className="h-4" />}
                </React.Fragment>
              ))}
            </div>
          </div>
        </div>
      </Modal>
    </div>
  )
}
