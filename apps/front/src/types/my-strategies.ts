export interface StatItem {
  label: string
  value: string
  subValue: string
  valueColor?: string // 'white' | 'green' | 'red'
  subValueColor?: string // 'gray' | 'green' | 'red'
}

export interface StrategyItem {
  id: string // 订阅 ID
  llmStrategyInstanceId: string // LLM 策略实例 ID (用于跳转详情页)
  name: string
  subName: string
  icon: string // path to icon
  account: string
  accountSub: string
  fund: string
  pnl: string
  pnlValue: string // For color determination (+/-)
  amount: number
  state: 'active' | 'paused' | 'error'
  stateText: string
}

export interface OpenPositionItem {
  id: string
  index: string
  openTime: string
  symbol: string
  symbolIcon: string
  side: 'Long' | 'Short'
  sideText: string
  leverage: string
  amount: string
  /** 原始数量值，用于计算（避免格式化后的字符串解析问题） */
  rawAmount: number
  entryPrice: string
  markPrice: string
  liqPrice: string
  margin: string
  accountBalance: string
  marginRatio: string
  unrealizedPnl: string
  unrealizedPnlValue: string // '+' | '-'
  roi: string
  roiValue: string // '+' | '-'
  // 平仓所需的额外信息
  userStrategyAccountId?: string
  exchangeId?: string
  marketType?: string
}

export interface PositionItem {
  id: string
  index: string
  openTime: string
  closeTime: string
  symbol: string
  symbolIcon: string
  side: 'Long' | 'Short'
  sideText: string
  leverage: string
  entryPrice: string
  closePrice: string
  duration: string
  pnl: string
  pnlValue: string // '+' | '-'
  roi: string
  roiValue: string // '+' | '-'
  fees: string
}

export interface MyStrategiesPageData {
  stats: StatItem[]
  strategies: StrategyItem[]
  openPositions: OpenPositionItem[]
  positions: PositionItem[]
}
