export const AppRole = {
  VISITOR: 'visitor',
  USER: 'user',
  MODERATOR: 'moderator',
  ADMIN: 'admin',
  SUPER_ADMIN: 'super_admin',
} as const
export type AppRole = (typeof AppRole)[keyof typeof AppRole]

export const AppResource = {
  ROLE: 'role',
  SETTINGS: 'settings',
  ADMIN_USER: 'admin_user',
  ADMIN_MENU: 'admin_menu',
  PORTFOLIO_ACCOUNT: 'portfolio_account',
  STRATEGY_TEMPLATE: 'strategy_template',
  STRATEGY_INSTANCE: 'strategy_instance',
  LLM_STRATEGY: 'llm_strategy',
  LLM_STRATEGY_INSTANCE: 'llm_strategy_instance',
  MARKET_SYMBOL: 'market_symbol',
  WHALE_TRACKING: 'whale_tracking',
  PREDICTION_MARKET: 'prediction_market',
  DATA_PULL_TASK: 'data_pull_task',
  ORDERBOOK_CONFIG: 'orderbook_config',
  EXCHANGE_CONFIG: 'exchange_config',
  TRADES_CONFIG: 'trades_config',
  BETA_CODE: 'beta_code',
} as const
export type AppResource = (typeof AppResource)[keyof typeof AppResource]

export const CacheKeyPrefix = {
  SETTINGS: 'settings:',
  STREAM_SESSION: 'stream:',
  USER_ACTIVITY: 'user-activity:',
  LOCK: 'lock:',
} as const
export type CacheKeyPrefix = (typeof CacheKeyPrefix)[keyof typeof CacheKeyPrefix]

export const CacheTTL = {
  ONE_MINUTE: 60,
  FIVE_MINUTES: 300,
  FIFTEEN_MINUTES: 900,
  ONE_HOUR: 3600,
  ONE_DAY: 86400,
} as const
export type CacheTTL = (typeof CacheTTL)[keyof typeof CacheTTL]

export const MarketType = {
  SPOT: 'spot',
  PERP: 'perp',
} as const
export type MarketType = (typeof MarketType)[keyof typeof MarketType]

export const WhaleAlertTradeSide = {
  Long: 'Long',
  Short: 'Short',
} as const
export type WhaleAlertTradeSide = (typeof WhaleAlertTradeSide)[keyof typeof WhaleAlertTradeSide]

export const WhaleAlertSide = WhaleAlertTradeSide
export type WhaleAlertSide = WhaleAlertTradeSide

export const TelegramDesktopIntentKind = {
  LOGIN: 'login',
  BIND: 'bind',
} as const
export type TelegramDesktopIntentKind = (typeof TelegramDesktopIntentKind)[keyof typeof TelegramDesktopIntentKind]

export const TelegramDesktopIntentLanguage = {
  ZH: 'zh',
  EN: 'en',
} as const
export type TelegramDesktopIntentLanguage = (typeof TelegramDesktopIntentLanguage)[keyof typeof TelegramDesktopIntentLanguage]

export const TelegramLoginSource = {
  WEB: 'web',
  DESKTOP: 'desktop',
  WEBAPP: 'webapp',
} as const
export type TelegramLoginSource = (typeof TelegramLoginSource)[keyof typeof TelegramLoginSource]

export const HyperliquidApiType = {
  CLEARINGHOUSE_STATE: 'clearinghouseState',
  SPOT_CLEARINGHOUSE_STATE: 'spotClearinghouseState',
  OPEN_ORDERS: 'openOrders',
  USER_FILLS: 'userFills',
  USER_FILLS_BY_TIME: 'userFillsByTime',
  USER_FUNDING: 'userFunding',
  HISTORICAL_ORDERS: 'historicalOrders',
  USER_NON_FUNDING_LEDGER_UPDATES: 'userNonFundingLedgerUpdates',
} as const
export type HyperliquidApiType = (typeof HyperliquidApiType)[keyof typeof HyperliquidApiType]

export const AccountStrategyAction = {
  RUN: 'run',
  STOP: 'stop',
  LIQUIDATE_AND_STOP: 'liquidate_and_stop',
} as const
export type AccountStrategyAction = (typeof AccountStrategyAction)[keyof typeof AccountStrategyAction]
