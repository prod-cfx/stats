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

jest.mock('./MarketPageClient', () => ({
  MarketPageClient: () => null,
}))

jest.mock('./ai-quant/plaza/PlazaPageClient', () => ({
  AiQuantPlazaPageClient: () => null,
}))

jest.mock('./liquidation-map/LiquidationMapClient', () => ({
  LiquidationMapClient: () => null,
}))

jest.mock('./long-short-ratio/LongShortRatioClient', () => ({
  LongShortRatioClient: () => null,
}))

jest.mock('./auth/login/LoginPageClient', () => ({
  LoginPageClient: () => null,
}))

jest.mock('./auth/telegram/callback/TelegramCallbackPageClient', () => ({
  TelegramCallbackPageClient: () => null,
}))

jest.mock('@/components/whale-tracking/notifications/NotificationsClient', () => ({
  NotificationsClient: () => null,
}))

jest.mock('@/components/whale-tracking/holdings/WhalePositionsTable', () => ({
  WhalePositionsTable: () => null,
}))

jest.mock('./whale-tracking/realtime/RealtimeWhalesClient', () => ({
  RealtimeWhalesClient: () => null,
}))

jest.mock('./ai-quant/backtest/[id]/BacktestReportClient', () => ({
  BacktestReportClient: () => null,
}))

jest.mock('./ai-quant/plaza/[templateId]/OfficialStrategyBacktestReportClient', () => ({
  OfficialStrategyBacktestReportClient: () => null,
}))

jest.mock('@/components/public-companies/PublicCompaniesTable', () => ({
  PublicCompaniesTable: () => null,
}))

interface MetadataModule {
  generateMetadata?: (args: { params: Record<string, string> }) => Promise<{
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
  params?: Record<string, string>
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
    name: 'market',
    loadModule: async () => import('./market/page'),
    zh: {
      title: '加密市场行情与聚合数据 | Coinflux',
      description: '查看加密资产价格、成交量、资金费率和市场结构数据。',
      locale: 'zh_CN',
      url: 'https://coinflux.ai/zh/market',
    },
    en: {
      title: 'Crypto Market Data & Aggregated Signals | Coinflux',
      description: 'View crypto prices, volume, funding rates, and market structure data.',
      locale: 'en_US',
      url: 'https://coinflux.ai/en/market',
    },
  },
  {
    name: 'ai-quant/plaza',
    loadModule: async () => import('./ai-quant/plaza/page'),
    zh: {
      title: 'AI量化策略广场 | Coinflux',
      description: '浏览、筛选和复用社区量化策略模板与实盘策略。',
      locale: 'zh_CN',
      url: 'https://coinflux.ai/zh/ai-quant/plaza',
    },
    en: {
      title: 'AI Quant Strategy Plaza | Coinflux',
      description: 'Browse, filter, and reuse community quant strategy templates and live strategies.',
      locale: 'en_US',
      url: 'https://coinflux.ai/en/ai-quant/plaza',
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
    name: 'liquidation-map',
    loadModule: async () => import('./liquidation-map/page'),
    zh: {
      title: '加密清算热力图 | Coinflux',
      description: '查看主要交易对的清算密集区和潜在流动性位置。',
      locale: 'zh_CN',
      url: 'https://coinflux.ai/zh/liquidation-map',
    },
    en: {
      title: 'Crypto Liquidation Heatmap | Coinflux',
      description: 'Inspect liquidation clusters and potential liquidity zones across major pairs.',
      locale: 'en_US',
      url: 'https://coinflux.ai/en/liquidation-map',
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
  {
    name: 'long-short-ratio',
    loadModule: async () => import('./long-short-ratio/page'),
    zh: {
      title: '多空比与市场情绪分析 | Coinflux',
      description: '跟踪主要加密资产多空持仓比例与市场情绪变化。',
      locale: 'zh_CN',
      url: 'https://coinflux.ai/zh/long-short-ratio',
    },
    en: {
      title: 'Long-Short Ratio & Market Sentiment | Coinflux',
      description: 'Track long-short positioning ratios and market sentiment across major crypto assets.',
      locale: 'en_US',
      url: 'https://coinflux.ai/en/long-short-ratio',
    },
  },
  {
    name: 'auth/login',
    loadModule: async () => import('./auth/login/page'),
    zh: {
      title: '登录 Coinflux | Coinflux',
      description: '登录 Coinflux，管理交易看板、AI 量化策略与鲸鱼追踪通知。',
      locale: 'zh_CN',
      url: 'https://coinflux.ai/zh/auth/login',
    },
    en: {
      title: 'Sign in to Coinflux | Coinflux',
      description: 'Sign in to manage trading dashboards, AI quant strategies, and whale alerts.',
      locale: 'en_US',
      url: 'https://coinflux.ai/en/auth/login',
    },
  },
  {
    name: 'auth/telegram/callback',
    loadModule: async () => import('./auth/telegram/callback/page'),
    zh: {
      title: 'Telegram 授权回调 | Coinflux',
      description: '完成 Telegram 登录或绑定后返回 Coinflux。',
      locale: 'zh_CN',
      url: 'https://coinflux.ai/zh/auth/telegram/callback',
    },
    en: {
      title: 'Telegram Authorization Callback | Coinflux',
      description: 'Return to Coinflux after completing Telegram sign-in or binding.',
      locale: 'en_US',
      url: 'https://coinflux.ai/en/auth/telegram/callback',
    },
  },
  {
    name: 'whale-tracking/notifications',
    loadModule: async () => import('./whale-tracking/notifications/page'),
    zh: {
      title: '鲸鱼通知与监控规则 | Coinflux',
      description: '管理鲸鱼地址提醒、通知偏好与实时监控规则。',
      locale: 'zh_CN',
      url: 'https://coinflux.ai/zh/whale-tracking/notifications',
    },
    en: {
      title: 'Whale Alerts & Monitoring Rules | Coinflux',
      description: 'Manage whale wallet alerts, notification preferences, and live monitoring rules.',
      locale: 'en_US',
      url: 'https://coinflux.ai/en/whale-tracking/notifications',
    },
  },
  {
    name: 'whale-tracking/realtime',
    loadModule: async () => import('./whale-tracking/realtime/page'),
    zh: {
      title: '实时鲸鱼交易追踪 | Coinflux',
      description: '实时查看大额链上交易、鲸鱼转账与市场异动。',
      locale: 'zh_CN',
      url: 'https://coinflux.ai/zh/whale-tracking/realtime',
    },
    en: {
      title: 'Real-Time Whale Trade Tracking | Coinflux',
      description: 'Monitor large on-chain trades, whale transfers, and market-moving activity in real time.',
      locale: 'en_US',
      url: 'https://coinflux.ai/en/whale-tracking/realtime',
    },
  },
  {
    name: 'whale-tracking/holdings',
    loadModule: async () => import('./whale-tracking/holdings/page'),
    zh: {
      title: '鲸鱼持仓排行与组合分析 | Coinflux',
      description: '查看鲸鱼钱包持仓、资产分布与组合变化。',
      locale: 'zh_CN',
      url: 'https://coinflux.ai/zh/whale-tracking/holdings',
    },
    en: {
      title: 'Whale Holdings Rankings & Portfolio Analysis | Coinflux',
      description: 'Review whale wallet holdings, asset allocation, and portfolio changes.',
      locale: 'en_US',
      url: 'https://coinflux.ai/en/whale-tracking/holdings',
    },
  },
  {
    name: 'ai-quant/backtest/[id]',
    loadModule: async () => import('./ai-quant/backtest/[id]/page'),
    params: { id: 'bt_123' },
    zh: {
      title: 'AI 量化回测报告 | Coinflux',
      description: '查看 AI 量化策略回测结果、收益曲线、风险指标与交易明细。',
      locale: 'zh_CN',
      url: 'https://coinflux.ai/zh/ai-quant/backtest/bt_123',
    },
    en: {
      title: 'AI Quant Backtest Report | Coinflux',
      description: 'Review AI quant backtest results, equity curves, risk metrics, and trade details.',
      locale: 'en_US',
      url: 'https://coinflux.ai/en/ai-quant/backtest/bt_123',
    },
  },
  {
    name: 'ai-quant/plaza/[templateId]',
    loadModule: async () => import('./ai-quant/plaza/[templateId]/page'),
    params: { templateId: 'template_123' },
    zh: {
      title: '官方策略回测报告 | Coinflux',
      description: '查看策略广场官方模板的历史回测表现、风险指标与交易明细。',
      locale: 'zh_CN',
      url: 'https://coinflux.ai/zh/ai-quant/plaza/template_123',
    },
    en: {
      title: 'Official Strategy Backtest Report | Coinflux',
      description: 'Review historical backtest performance, risk metrics, and trades for an official strategy template.',
      locale: 'en_US',
      url: 'https://coinflux.ai/en/ai-quant/plaza/template_123',
    },
  },
]

async function expectMetadata(
  module: MetadataModule,
  lng: 'zh' | 'en',
  expectation: LocaleExpectation,
  params: Record<string, string> = {},
) {
  expect(typeof module.generateMetadata).toBe('function')

  const metadata = await module.generateMetadata!({ params: { lng, ...params } })

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

    await expectMetadata(module, 'zh', expectation.zh, expectation.params)
    await expectMetadata(module, 'en', expectation.en, expectation.params)
  })
})
