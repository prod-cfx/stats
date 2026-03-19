export interface StrategySignalsExecutionConfig {
  enabled: boolean
  dryRun: boolean
  maxAccountsPerSignal: number
  defaultQuoteAmount: number
  minBalanceThreshold: number
  maxRiskFraction: number
}

export interface StrategySignalsAiConfig {
  maxAttempts: number
  temperature: number
  maxTokens: number
  maxFailuresBeforeCooldown: number
  failureCooldownMinutes: number
  maxRawResponseLength: number
}

export interface StrategySignalsDebugConfig {
  enabled: boolean
  maxScriptLength: number
  maxValueLength: number
}

export interface StrategySignalsRuntimeConfig {
  enabled: boolean
  cronExpression: string
  cooldownMinutes: number
  batchSize: number
  maxSymbolsPerStrategy: number
  debug: StrategySignalsDebugConfig
  ai: StrategySignalsAiConfig
  execution: StrategySignalsExecutionConfig
}

export const DEFAULT_STRATEGY_SIGNALS_CONFIG: StrategySignalsRuntimeConfig = {
  enabled: false,
  cronExpression: '*/5 * * * *',
  cooldownMinutes: 15,
  batchSize: 10,
  maxSymbolsPerStrategy: 3,
  debug: {
    enabled: false,
    maxScriptLength: 1000,
    maxValueLength: 200,
  },
  ai: {
    maxAttempts: 2,
    temperature: 0.2,
    maxTokens: 400,
    maxFailuresBeforeCooldown: 3,
    failureCooldownMinutes: 30,
    maxRawResponseLength: 4000,
  },
  execution: {
    enabled: false,
    dryRun: true,
    maxAccountsPerSignal: 25,
    defaultQuoteAmount: 100,
    minBalanceThreshold: 50,
    maxRiskFraction: 0.2,
  },
}
