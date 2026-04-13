export interface ChecklistRuleBasis {
  kind:
    | 'prev_close'
    | 'entry_avg_price'
    | 'position_pnl'
    | 'peak_equity'
    | 'peak_position_pnl'
    | 'upper_band'
    | 'lower_band'
    | 'middle_band'
    | 'last_high'
    | 'last_low'
}

export interface ChecklistRuleDraft {
  id: string
  phase: 'entry' | 'exit' | 'risk'
  text: string
  timeframe: string | null
  basis?: ChecklistRuleBasis['kind'] | null
}

export interface ChecklistPayload {
  symbols?: string[]
  timeframes?: string[]
  entryRules?: string[]
  exitRules?: string[]
  riskRules?: Record<string, unknown>
  entryRuleBases?: Record<string, ChecklistRuleBasis['kind']>
  exitRuleBases?: Record<string, ChecklistRuleBasis['kind']>
  entryRuleDrafts?: ChecklistRuleDraft[]
  exitRuleDrafts?: ChecklistRuleDraft[]
  riskRuleDrafts?: ChecklistRuleDraft[]
  market?: {
    exchange?: 'binance' | 'okx' | 'hyperliquid'
    marketType?: 'spot' | 'perp'
    defaultTimeframe?: string | null
  }
}
