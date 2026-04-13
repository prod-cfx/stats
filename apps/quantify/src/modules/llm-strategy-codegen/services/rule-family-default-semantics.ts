import type { ChecklistRuleBasis } from '../types/codegen-checklist'

export type PercentageRuleFamily =
  | 'risk.stop_loss_pct'
  | 'risk.take_profit_pct'
  | 'risk.trailing_stop_pct'
  | 'risk.drawdown_pct'
  | 'trigger.percent_change'
  | 'unknown'

export interface RuleFamilySemantics {
  family: PercentageRuleFamily
  defaultBasis: ChecklistRuleBasis['kind'] | null
  requiresUserBasis: boolean
}

export function classifyPercentageRuleFamily(input: {
  phase: 'entry' | 'exit' | 'risk'
  rule: string
}): RuleFamilySemantics {
  const rule = input.rule.trim()
  if (!rule.includes('%')) {
    return {
      family: 'unknown',
      defaultBasis: null,
      requiresUserBasis: false,
    }
  }

  if (/移动止盈|trailing/i.test(rule)) {
    return {
      family: 'risk.trailing_stop_pct',
      defaultBasis: null,
      requiresUserBasis: true,
    }
  }

  if (/回撤/u.test(rule)) {
    return {
      family: 'risk.drawdown_pct',
      defaultBasis: null,
      requiresUserBasis: true,
    }
  }

  if (/止损|亏损/u.test(rule)) {
    return {
      family: 'risk.stop_loss_pct',
      defaultBasis: 'entry_avg_price',
      requiresUserBasis: false,
    }
  }

  if (/止盈|盈利|收益率/u.test(rule)) {
    return {
      family: 'risk.take_profit_pct',
      defaultBasis: 'entry_avg_price',
      requiresUserBasis: false,
    }
  }

  if (/(买入|卖出|开仓|平仓|出场|离场)/u.test(rule)) {
    return {
      family: 'trigger.percent_change',
      defaultBasis: null,
      requiresUserBasis: true,
    }
  }

  return {
    family: 'unknown',
    defaultBasis: null,
    requiresUserBasis: true,
  }
}

export function extractExplicitRiskBasis(rule: string): ChecklistRuleBasis['kind'] | null {
  const normalized = rule.trim().toLowerCase()
  if (!normalized) return null

  if (/持仓浮盈峰值|浮盈峰值|peak position pnl/i.test(normalized)) return 'peak_position_pnl'
  if (/账户净值峰值|净值峰值|资金曲线峰值|peak equity/i.test(normalized)) return 'peak_equity'
  if (/持仓.*(?:收益|盈亏|亏损|利润|浮盈|pnl)|position.*pnl/i.test(normalized)) return 'position_pnl'
  if (/开仓均价|入场价|入场均价|开仓价|买入价|成本价|entry/i.test(normalized)) return 'entry_avg_price'

  return null
}

export function resolveDefaultRiskBasis(
  rule: string,
  explicitBasis: ChecklistRuleBasis['kind'] | null | undefined,
): ChecklistRuleBasis['kind'] | null {
  const normalizedExplicit = typeof explicitBasis === 'string' && explicitBasis.trim()
    ? explicitBasis
    : null
  if (normalizedExplicit) return normalizedExplicit

  const extracted = extractExplicitRiskBasis(rule)
  if (extracted) return extracted

  return classifyPercentageRuleFamily({
    phase: 'risk',
    rule,
  }).defaultBasis
}
