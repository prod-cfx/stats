export interface StrategyStats {
  monthlyReturn: string // e.g. "+18.3%"
  maxDrawdown: string   // e.g. "-9.4%"
}

export interface StrategyMeta {
  runningDays: number
  followers: number
  assetsUnderManagement: string // e.g. "48,320 USDT"
}

export interface Strategy {
  id: string
  name: string // e.g. "BTC-AI-Trend v1"
  tags: string[] // e.g. ["趋势跟踪", "Hyperliquid 永续"] - combined in design as "趋势跟踪 / Hyperliquid 永续"
  description: string
  icon: string // Path to SVG
  stats: StrategyStats
  meta: StrategyMeta
  riskLevel?: 'Low' | 'Medium' | 'High' // inferred from text, helpful for styling if needed
  isSubscribed?: boolean // 用户是否已订阅该策略（登录用户有值，匿名用户为 undefined）
}

export interface StrategiesPageData {
  title: string
  subtitle: string
  strategies: Strategy[]
}

// Details Page Types

export interface ActionItem {
  time: string
  action: string
  actionType: 'open' | 'close' | 'partial'
  future: string
  margin: string
  direction: 'Long' | 'Short'
  amount: string
  price: string
  reason: string
}

export interface StrategyDetail extends Strategy {
  fullSubtitle: string
  tagsDetailed: {
    category: string // "AI 策略"
    market: string // "Hyperliquid · BTC 永续"
    risk: string // "风险: 中"
  }
  modelTip: string
  chart: {
    totalYield: string
    maxDrawdown: string
    annualYield: string
    winRate: string
  }
  intro: {
    title: string
    description: string
    items: string[]
  }
  recentActions: ActionItem[]
  isSubscribed?: boolean // 当前用户是否已订阅该策略
}
