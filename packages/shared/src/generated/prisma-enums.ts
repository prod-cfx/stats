// @generated — DO NOT EDIT
// Generated from Prisma Schema files by scripts/generate-prisma-enums.ts

export const PrincipalType = {
  USER: 'USER',
  ADMIN: 'ADMIN',
} as const
export type PrincipalType = (typeof PrincipalType)[keyof typeof PrincipalType]

export const AdminMenuType = {
  DIRECTORY: 'DIRECTORY',
  MENU: 'MENU',
  FEATURE: 'FEATURE',
} as const
export type AdminMenuType = (typeof AdminMenuType)[keyof typeof AdminMenuType]

export const LiquidationHeatmapSource = {
  COINGLASS: 'COINGLASS',
} as const
export type LiquidationHeatmapSource = (typeof LiquidationHeatmapSource)[keyof typeof LiquidationHeatmapSource]

export const LiquidationHeatmapModelType = {
  MODEL1: 'MODEL1',
  MODEL2: 'MODEL2',
  MODEL3: 'MODEL3',
} as const
export type LiquidationHeatmapModelType = (typeof LiquidationHeatmapModelType)[keyof typeof LiquidationHeatmapModelType]

export const BackendMarketTimeframe = {
  m1: 'm1',
  m3: 'm3',
  m5: 'm5',
  m15: 'm15',
  m30: 'm30',
  h1: 'h1',
  h4: 'h4',
  h6: 'h6',
  h8: 'h8',
  h12: 'h12',
  d1: 'd1',
  w1: 'w1',
} as const
export type BackendMarketTimeframe = (typeof BackendMarketTimeframe)[keyof typeof BackendMarketTimeframe]

export const VenueType = {
  CEX: 'CEX',
  DEX: 'DEX',
} as const
export type VenueType = (typeof VenueType)[keyof typeof VenueType]

export const BackendInstrumentType = {
  SPOT: 'SPOT',
  PERPETUAL: 'PERPETUAL',
  FUTURE: 'FUTURE',
} as const
export type BackendInstrumentType = (typeof BackendInstrumentType)[keyof typeof BackendInstrumentType]

export const UserCredentialType = {
  email: 'email',
} as const
export type UserCredentialType = (typeof UserCredentialType)[keyof typeof UserCredentialType]

export const VerificationCodePurpose = {
  EMAIL_VERIFICATION: 'EMAIL_VERIFICATION',
  PASSWORD_RESET: 'PASSWORD_RESET',
} as const
export type VerificationCodePurpose = (typeof VerificationCodePurpose)[keyof typeof VerificationCodePurpose]

export const WhaleNotificationRuleType = {
  ADDRESS: 'ADDRESS',
  SYMBOL: 'SYMBOL',
} as const
export type WhaleNotificationRuleType = (typeof WhaleNotificationRuleType)[keyof typeof WhaleNotificationRuleType]

export const WhaleNotificationChannel = {
  WEB: 'WEB',
  EMAIL: 'EMAIL',
  TELEGRAM: 'TELEGRAM',
} as const
export type WhaleNotificationChannel = (typeof WhaleNotificationChannel)[keyof typeof WhaleNotificationChannel]

export const WhaleNotificationDeliveryStatus = {
  PENDING: 'PENDING',
  SENT: 'SENT',
  FAILED: 'FAILED',
  SKIPPED_COOLDOWN: 'SKIPPED_COOLDOWN',
} as const
export type WhaleNotificationDeliveryStatus = (typeof WhaleNotificationDeliveryStatus)[keyof typeof WhaleNotificationDeliveryStatus]

export const GridRuntimeStatus = {
  CREATED: 'CREATED',
  INITIALIZING: 'INITIALIZING',
  RUNNING: 'RUNNING',
  PAUSING: 'PAUSING',
  PAUSED: 'PAUSED',
  STOPPING: 'STOPPING',
  STOPPED: 'STOPPED',
  RECONCILE_REQUIRED: 'RECONCILE_REQUIRED',
  ERROR: 'ERROR',
  TERMINATED: 'TERMINATED',
} as const
export type GridRuntimeStatus = (typeof GridRuntimeStatus)[keyof typeof GridRuntimeStatus]

export const GridOrderStatus = {
  PLANNED: 'PLANNED',
  SUBMITTING: 'SUBMITTING',
  OPEN: 'OPEN',
  PARTIALLY_FILLED: 'PARTIALLY_FILLED',
  FILLED: 'FILLED',
  CANCELING: 'CANCELING',
  CANCELED: 'CANCELED',
  REJECTED: 'REJECTED',
  STALE: 'STALE',
} as const
export type GridOrderStatus = (typeof GridOrderStatus)[keyof typeof GridOrderStatus]

export const LlmStrategyStatus = {
  draft: 'draft',
  live: 'live',
  archived: 'archived',
} as const
export type LlmStrategyStatus = (typeof LlmStrategyStatus)[keyof typeof LlmStrategyStatus]

export const LlmStrategyInstanceStatus = {
  running: 'running',
  paused: 'paused',
  stopped: 'stopped',
} as const
export type LlmStrategyInstanceStatus = (typeof LlmStrategyInstanceStatus)[keyof typeof LlmStrategyInstanceStatus]

export const LlmStrategyInstanceMode = {
  LIVE: 'LIVE',
  PAPER: 'PAPER',
  BACKTEST: 'BACKTEST',
} as const
export type LlmStrategyInstanceMode = (typeof LlmStrategyInstanceMode)[keyof typeof LlmStrategyInstanceMode]

export const LlmStrategyRunStatus = {
  success: 'success',
  failed: 'failed',
  skipped: 'skipped',
} as const
export type LlmStrategyRunStatus = (typeof LlmStrategyRunStatus)[keyof typeof LlmStrategyRunStatus]

export const LlmCodegenSessionStatus = {
  DRAFTING: 'DRAFTING',
  CONFIRM_GATE: 'CONFIRM_GATE',
  GENERATING: 'GENERATING',
  VALIDATING_STATIC: 'VALIDATING_STATIC',
  VALIDATING_RUNTIME: 'VALIDATING_RUNTIME',
  VALIDATING_OUTPUT: 'VALIDATING_OUTPUT',
  VALIDATING_CONSISTENCY: 'VALIDATING_CONSISTENCY',
  PUBLISHED: 'PUBLISHED',
  CONSISTENCY_FAILED: 'CONSISTENCY_FAILED',
  REJECTED: 'REJECTED',
} as const
export type LlmCodegenSessionStatus = (typeof LlmCodegenSessionStatus)[keyof typeof LlmCodegenSessionStatus]

export const AiQuantConversationMessageRole = {
  user: 'user',
  assistant: 'assistant',
} as const
export type AiQuantConversationMessageRole = (typeof AiQuantConversationMessageRole)[keyof typeof AiQuantConversationMessageRole]

export const SymbolType = {
  CRYPTO: 'CRYPTO',
  STOCK: 'STOCK',
  FOREX: 'FOREX',
} as const
export type SymbolType = (typeof SymbolType)[keyof typeof SymbolType]

export const SymbolStatus = {
  ACTIVE: 'ACTIVE',
  DISABLED: 'DISABLED',
} as const
export type SymbolStatus = (typeof SymbolStatus)[keyof typeof SymbolStatus]

export const QuantifyInstrumentType = {
  SPOT: 'SPOT',
  PERPETUAL: 'PERPETUAL',
  FUTURE: 'FUTURE',
} as const
export type QuantifyInstrumentType = (typeof QuantifyInstrumentType)[keyof typeof QuantifyInstrumentType]

export const IndicatorType = {
  RET: 'RET',
  MOVING_AVG: 'MOVING_AVG',
  VOLATILITY: 'VOLATILITY',
  VOLUME_RATIO: 'VOLUME_RATIO',
} as const
export type IndicatorType = (typeof IndicatorType)[keyof typeof IndicatorType]

export const QuantifyMarketTimeframe = {
  m1: 'm1',
  m3: 'm3',
  m5: 'm5',
  m15: 'm15',
  m30: 'm30',
  h1: 'h1',
  h4: 'h4',
  h6: 'h6',
  h8: 'h8',
  h12: 'h12',
  d1: 'd1',
  w1: 'w1',
} as const
export type QuantifyMarketTimeframe = (typeof QuantifyMarketTimeframe)[keyof typeof QuantifyMarketTimeframe]

export const OutboxStatus = {
  PENDING: 'PENDING',
  CLAIMED: 'CLAIMED',
  RETRY: 'RETRY',
  SENT: 'SENT',
  DEAD: 'DEAD',
} as const
export type OutboxStatus = (typeof OutboxStatus)[keyof typeof OutboxStatus]

export const TradeSide = {
  BUY: 'BUY',
  SELL: 'SELL',
} as const
export type TradeSide = (typeof TradeSide)[keyof typeof TradeSide]

export const PositionSide = {
  LONG: 'LONG',
  SHORT: 'SHORT',
} as const
export type PositionSide = (typeof PositionSide)[keyof typeof PositionSide]

export const PositionStatus = {
  OPEN: 'OPEN',
  CLOSED: 'CLOSED',
} as const
export type PositionStatus = (typeof PositionStatus)[keyof typeof PositionStatus]

export const LedgerEntryType = {
  DEPOSIT: 'DEPOSIT',
  WITHDRAW: 'WITHDRAW',
  REALIZED_PNL: 'REALIZED_PNL',
  FEE: 'FEE',
  FUNDING_FEE: 'FUNDING_FEE',
  ADJUSTMENT: 'ADJUSTMENT',
} as const
export type LedgerEntryType = (typeof LedgerEntryType)[keyof typeof LedgerEntryType]

export const SignalSourceType = {
  AI_GENERATED: 'AI_GENERATED',
  MANUAL: 'MANUAL',
  SYSTEM: 'SYSTEM',
} as const
export type SignalSourceType = (typeof SignalSourceType)[keyof typeof SignalSourceType]

export const SignalType = {
  ENTRY: 'ENTRY',
  EXIT: 'EXIT',
  ADJUSTMENT: 'ADJUSTMENT',
  ALERT: 'ALERT',
} as const
export type SignalType = (typeof SignalType)[keyof typeof SignalType]

export const SignalDirection = {
  BUY: 'BUY',
  SELL: 'SELL',
  CLOSE_LONG: 'CLOSE_LONG',
  CLOSE_SHORT: 'CLOSE_SHORT',
} as const
export type SignalDirection = (typeof SignalDirection)[keyof typeof SignalDirection]

export const SignalStatus = {
  PENDING: 'PENDING',
  EXECUTED: 'EXECUTED',
  PARTIAL: 'PARTIAL',
  EXPIRED: 'EXPIRED',
  CANCELLED: 'CANCELLED',
  FAILED: 'FAILED',
} as const
export type SignalStatus = (typeof SignalStatus)[keyof typeof SignalStatus]

export const ExecutionStatus = {
  PENDING: 'PENDING',
  EXECUTED: 'EXECUTED',
  FAILED: 'FAILED',
  SKIPPED: 'SKIPPED',
} as const
export type ExecutionStatus = (typeof ExecutionStatus)[keyof typeof ExecutionStatus]

export const StrategyTemplateStatus = {
  draft: 'draft',
  testing: 'testing',
  live: 'live',
  disabled: 'disabled',
} as const
export type StrategyTemplateStatus = (typeof StrategyTemplateStatus)[keyof typeof StrategyTemplateStatus]

export const StrategyInstanceStatus = {
  draft: 'draft',
  running: 'running',
  paused: 'paused',
  stopped: 'stopped',
} as const
export type StrategyInstanceStatus = (typeof StrategyInstanceStatus)[keyof typeof StrategyInstanceStatus]

export const StrategyInstanceMode = {
  BACKTEST: 'BACKTEST',
  PAPER: 'PAPER',
  TESTNET: 'TESTNET',
  LIVE: 'LIVE',
} as const
export type StrategyInstanceMode = (typeof StrategyInstanceMode)[keyof typeof StrategyInstanceMode]

export const SubscriptionStatus = {
  active: 'active',
  paused: 'paused',
  cancelled: 'cancelled',
} as const
export type SubscriptionStatus = (typeof SubscriptionStatus)[keyof typeof SubscriptionStatus]

export const ExchangeId = {
  binance: 'binance',
  okx: 'okx',
  hyperliquid: 'hyperliquid',
} as const
export type ExchangeId = (typeof ExchangeId)[keyof typeof ExchangeId]
