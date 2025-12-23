export interface MarketTicker {
  symbol: string
  price: string
  icon: string
}

export interface StrategyValue {
  name: string
  value: string
  color: string
}

export interface ChartData {
  strategies: StrategyValue[]
}

export interface LeaderboardItem {
  id: string // Added ID
  rank: number
  modelName: string
  icon: string
  address: string
  nav: string
  pnl: string
  maxDrawdown: string
  status: 'active' | 'finished'
}

export interface CompetitionPageData {
  title: string
  subtitle: string
  tickers: MarketTicker[]
  chart: ChartData
  leaderboard: LeaderboardItem[]
}
