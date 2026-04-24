import { describe, expect, it, jest } from '@jest/globals'

jest.mock('@/components/layout/Footer', () => ({
  Footer: () => null,
}))

jest.mock('@/components/layout/Navbar', () => ({
  Navbar: () => null,
}))

jest.mock('@/components/ai-quant/AiQuantMarketingHome', () => ({
  AiQuantMarketingHome: () => null,
}))

jest.mock('@/components/ui/Typography', () => ({
  BodyText: ({ children }: { children: unknown }) => children,
  PageTitle: ({ children }: { children: unknown }) => children,
}))

jest.mock('./ai-quant/AiQuantPageClient', () => ({
  AiQuantPageClient: () => null,
}))

jest.mock('./trade/TradingPageClient', () => ({
  __esModule: true,
  default: () => null,
}))

jest.mock('@/components/whale-tracking/discover/DiscoverGrid', () => ({
  DiscoverGrid: () => null,
}))

jest.mock('./whale-tracking/profile/WhaleProfileClientPage', () => ({
  WhaleProfileClientPage: () => null,
}))

jest.mock('./aggregated-orderbook/AggregatedOrderBookClient', () => ({
  AggregatedOrderBookClient: () => null,
}))

jest.mock('./liquidation-data/LiquidationDataClient', () => ({
  LiquidationDataClient: () => null,
}))

jest.mock('./prediction-market/PredictionMarketGridClient', () => ({
  PredictionMarketGridClient: () => null,
}))

jest.mock('@/components/public-companies/PublicCompaniesTable', () => ({
  PublicCompaniesTable: () => null,
}))

interface MetadataModule {
  generateMetadata?: (args: { params: { lng: string } }) => Promise<{
    title?: unknown
    description?: unknown
    openGraph?: Record<string, unknown>
    twitter?: Record<string, unknown>
    alternates?: Record<string, unknown>
  }>
}

interface LocaleExpectation {
  title: string
  description: string
  locale: string
  url: string
}

interface PageExpectation {
  name: string
  loadModule: () => Promise<MetadataModule>
  zh: LocaleExpectation
  en: LocaleExpectation
}

const defaultOgImage = 'https://coinflux.ai/images/hero-chart.png'

const pageExpectations: PageExpectation[] = [
  {
    name: 'home',
    loadModule: async () => import('./page'),
    zh: {
      title: 'AI量化策略生成与自动化交易 | Coinflux',
      description: '用 AI 生成可回测的量化策略，并完成回测验证与一键部署。',
      locale: 'zh_CN',
      url: 'https://coinflux.ai/zh/',
    },
    en: {
      title: 'AI Quant Strategy Generation & Automated Trading | Coinflux',
      description: 'Generate backtestable quant strategies with AI, then validate and deploy in one flow.',
      locale: 'en_US',
      url: 'https://coinflux.ai/en/',
    },
  },
  {
    name: 'ai-quant',
    loadModule: async () => import('./ai-quant/page'),
    zh: {
      title: 'AI量化策略回测与部署 | Coinflux',
      description: '对话创建策略、回测评估，达标后再一键部署。',
      locale: 'zh_CN',
      url: 'https://coinflux.ai/zh/ai-quant',
    },
    en: {
      title: 'AI Quant Strategy Builder | Coinflux',
      description: 'Create strategies via chat, backtest, and deploy in one click.',
      locale: 'en_US',
      url: 'https://coinflux.ai/en/ai-quant',
    },
  },
  {
    name: 'trade',
    loadModule: async () => import('./trade/page'),
    zh: {
      title: '加密交易终端与实时行情 | Coinflux',
      description: '实时查看合约与现货行情、资金费率、持仓量与盘口深度。',
      locale: 'zh_CN',
      url: 'https://coinflux.ai/zh/trade',
    },
    en: {
      title: 'Crypto Trading Terminal & Live Markets | Coinflux',
      description:
        'Track spot and perpetual markets, funding, open interest, and orderbook depth in real time.',
      locale: 'en_US',
      url: 'https://coinflux.ai/en/trade',
    },
  },
  {
    name: 'whale-tracking/discover',
    loadModule: async () => import('./whale-tracking/discover/page'),
    zh: {
      title: '鲸鱼交易者发现与筛选 | Coinflux',
      description: '发现最有价值的交易者',
      locale: 'zh_CN',
      url: 'https://coinflux.ai/zh/whale-tracking/discover',
    },
    en: {
      title: 'Whale Trader Discovery & Rankings | Coinflux',
      description: 'Discover the most valuable traders',
      locale: 'en_US',
      url: 'https://coinflux.ai/en/whale-tracking/discover',
    },
  },
  {
    name: 'whale-tracking/profile',
    loadModule: async () => import('./whale-tracking/profile/page'),
    zh: {
      title: '鲸鱼地址深度档案 | Coinflux',
      description: '查看鲸鱼地址的持仓、历史成交、胜率与收益表现。',
      locale: 'zh_CN',
      url: 'https://coinflux.ai/zh/whale-tracking/profile',
    },
    en: {
      title: 'Whale Wallet Profile & Performance | Coinflux',
      description: 'Inspect whale wallet positions, trade history, win rate, and performance.',
      locale: 'en_US',
      url: 'https://coinflux.ai/en/whale-tracking/profile',
    },
  },
  {
    name: 'aggregated-orderbook',
    loadModule: async () => import('./aggregated-orderbook/page'),
    zh: {
      title: '聚合挂单与订单流分析 | Coinflux',
      description: '全网深度及订单流聚合分析',
      locale: 'zh_CN',
      url: 'https://coinflux.ai/zh/aggregated-orderbook',
    },
    en: {
      title: 'Aggregated Orderbook & Order Flow Analysis | Coinflux',
      description: 'Market depth and order flow aggregation analysis',
      locale: 'en_US',
      url: 'https://coinflux.ai/en/aggregated-orderbook',
    },
  },
  {
    name: 'liquidation-data',
    loadModule: async () => import('./liquidation-data/page'),
    zh: {
      title: '全网实时爆仓数据 | Coinflux',
      description: '追踪全网实时爆仓数据',
      locale: 'zh_CN',
      url: 'https://coinflux.ai/zh/liquidation-data',
    },
    en: {
      title: 'Real-Time Crypto Liquidation Data | Coinflux',
      description: 'Track real-time liquidations across the market',
      locale: 'en_US',
      url: 'https://coinflux.ai/en/liquidation-data',
    },
  },
  {
    name: 'prediction-market',
    loadModule: async () => import('./prediction-market/page'),
    zh: {
      title: '链上预测市场与概率追踪 | Coinflux',
      description: '基于链上数据的未来趋势预测',
      locale: 'zh_CN',
      url: 'https://coinflux.ai/zh/prediction-market',
    },
    en: {
      title: 'On-Chain Prediction Markets & Probabilities | Coinflux',
      description: 'Future trend forecasts based on on-chain data',
      locale: 'en_US',
      url: 'https://coinflux.ai/en/prediction-market',
    },
  },
  {
    name: 'public-companies',
    loadModule: async () => import('./public-companies/page'),
    zh: {
      title: '上市公司加密资产持仓 | Coinflux',
      description: '持有加密资产的上市公司概览',
      locale: 'zh_CN',
      url: 'https://coinflux.ai/zh/public-companies',
    },
    en: {
      title: 'Public Companies Holding Crypto Assets | Coinflux',
      description: 'Overview of public companies holding crypto assets',
      locale: 'en_US',
      url: 'https://coinflux.ai/en/public-companies',
    },
  },
]

async function expectMetadata(
  module: MetadataModule,
  lng: 'zh' | 'en',
  expectation: LocaleExpectation,
) {
  expect(typeof module.generateMetadata).toBe('function')

  const metadata = await module.generateMetadata!({ params: { lng } })

  expect(metadata.title).toBe(expectation.title)
  expect(metadata.description).toBe(expectation.description)
  expect(metadata.alternates).toMatchObject({
    canonical: expectation.url,
  })
  expect(metadata.openGraph).toMatchObject({
    title: expectation.title,
    description: expectation.description,
    locale: expectation.locale,
    siteName: 'Coinflux',
    type: 'website',
    url: expectation.url,
    images: [
      expect.objectContaining({
        url: defaultOgImage,
      }),
    ],
  })
  expect(metadata.twitter).toMatchObject({
    card: 'summary_large_image',
    title: expectation.title,
    description: expectation.description,
    images: [defaultOgImage],
  })
}

describe('front page metadata', () => {
  it.each(pageExpectations)('adds locale-aware metadata for $name', async expectation => {
    const module = await expectation.loadModule()

    await expectMetadata(module, 'zh', expectation.zh)
    await expectMetadata(module, 'en', expectation.en)
  })
})
