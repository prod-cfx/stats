import type { Metadata } from 'next'
import type { AppLocale } from '@/lib/i18n/server'
import { getRequestLocale } from '@/lib/i18n/server'

type PageMetadataKey =
  | 'ai-quant'
  | 'trade'
  | 'whale-tracking/discover'
  | 'whale-tracking/profile'
  | 'aggregated-orderbook'
  | 'liquidation-data'
  | 'prediction-market'
  | 'public-companies'

interface LocalizedMetadataContent {
  title: string
  description: string
}

interface PageMetadataDefinition {
  pathname: `/${string}`
  zh: LocalizedMetadataContent
  en: LocalizedMetadataContent
}

const SITE_NAME = 'Coinflux'
const SITE_URL = 'https://coinflux.ai'
const DEFAULT_OG_IMAGE = `${SITE_URL}/images/hero-chart.png`

const PAGE_METADATA_DEFINITIONS: Record<PageMetadataKey, PageMetadataDefinition> = {
  'ai-quant': {
    pathname: '/ai-quant',
    zh: {
      title: 'AI量化策略回测与部署',
      description: '对话创建策略、回测评估，达标后再一键部署。',
    },
    en: {
      title: 'AI Quant Strategy Builder',
      description: 'Create strategies via chat, backtest, and deploy in one click.',
    },
  },
  trade: {
    pathname: '/trade',
    zh: {
      title: '加密交易终端与实时行情',
      description: '实时查看合约与现货行情、资金费率、持仓量与盘口深度。',
    },
    en: {
      title: 'Crypto Trading Terminal & Live Markets',
      description:
        'Track spot and perpetual markets, funding, open interest, and orderbook depth in real time.',
    },
  },
  'whale-tracking/discover': {
    pathname: '/whale-tracking/discover',
    zh: {
      title: '鲸鱼交易者发现与筛选',
      description: '发现最有价值的交易者',
    },
    en: {
      title: 'Whale Trader Discovery & Rankings',
      description: 'Discover the most valuable traders',
    },
  },
  'whale-tracking/profile': {
    pathname: '/whale-tracking/profile',
    zh: {
      title: '鲸鱼地址深度档案',
      description: '查看鲸鱼地址的持仓、历史成交、胜率与收益表现。',
    },
    en: {
      title: 'Whale Wallet Profile & Performance',
      description: 'Inspect whale wallet positions, trade history, win rate, and performance.',
    },
  },
  'aggregated-orderbook': {
    pathname: '/aggregated-orderbook',
    zh: {
      title: '聚合挂单与订单流分析',
      description: '全网深度及订单流聚合分析',
    },
    en: {
      title: 'Aggregated Orderbook & Order Flow Analysis',
      description: 'Market depth and order flow aggregation analysis',
    },
  },
  'liquidation-data': {
    pathname: '/liquidation-data',
    zh: {
      title: '全网实时爆仓数据',
      description: '追踪全网实时爆仓数据',
    },
    en: {
      title: 'Real-Time Crypto Liquidation Data',
      description: 'Track real-time liquidations across the market',
    },
  },
  'prediction-market': {
    pathname: '/prediction-market',
    zh: {
      title: '链上预测市场与概率追踪',
      description: '基于链上数据的未来趋势预测',
    },
    en: {
      title: 'On-Chain Prediction Markets & Probabilities',
      description: 'Future trend forecasts based on on-chain data',
    },
  },
  'public-companies': {
    pathname: '/public-companies',
    zh: {
      title: '上市公司加密资产持仓',
      description: '持有加密资产的上市公司概览',
    },
    en: {
      title: 'Public Companies Holding Crypto Assets',
      description: 'Overview of public companies holding crypto assets',
    },
  },
}

function buildTitle(title: string) {
  return `${title} | ${SITE_NAME}`
}

function buildAbsolutePageUrl(locale: AppLocale, pathname: `/${string}`) {
  return `${SITE_URL}/${locale}${pathname}`
}

export function getPageMetadata(pageKey: PageMetadataKey, locale?: string): Metadata {
  const resolvedLocale = getRequestLocale(locale)
  const definition = PAGE_METADATA_DEFINITIONS[pageKey]
  const content = definition[resolvedLocale]
  const title = buildTitle(content.title)
  const url = buildAbsolutePageUrl(resolvedLocale, definition.pathname)

  return {
    title,
    description: content.description,
    alternates: {
      canonical: url,
    },
    openGraph: {
      title,
      description: content.description,
      type: 'website',
      siteName: SITE_NAME,
      locale: resolvedLocale === 'zh' ? 'zh_CN' : 'en_US',
      url,
      images: [
        {
          url: DEFAULT_OG_IMAGE,
          width: 1200,
          height: 630,
          alt: title,
        },
      ],
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description: content.description,
      images: [DEFAULT_OG_IMAGE],
    },
  }
}
