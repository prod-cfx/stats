import type { StrategySemanticIndicator, StrategySemanticProfile } from '../types/strategy-semantic-profile'

function dedupeIndicators(indicators: StrategySemanticIndicator[]): StrategySemanticIndicator[] {
  const seen = new Set<string>()
  const normalized: StrategySemanticIndicator[] = []

  indicators.forEach((indicator) => {
    const key = `${indicator.kind}:${JSON.stringify(indicator.params)}`
    if (seen.has(key)) return
    seen.add(key)
    normalized.push(indicator)
  })

  return normalized
}

export function normalizeStrategySemanticProfile(
  profile: StrategySemanticProfile,
): StrategySemanticProfile {
  const hasBollingerMiddleRevert = profile.ruleMappings.some(item => item.key === 'bollinger.middle_revert')
    || profile.rules.some(item => item.key === 'bollinger.middle_revert')
  const bollingerPeriods = new Set(
    profile.indicators
      .filter((indicator): indicator is StrategySemanticIndicator & { kind: 'bollingerBands' } => indicator.kind === 'bollingerBands')
      .map(indicator => typeof indicator.params.period === 'number' ? indicator.params.period : 20),
  )

  const indicators = hasBollingerMiddleRevert && bollingerPeriods.size > 0
    ? profile.indicators.filter((indicator) => {
        if (indicator.kind !== 'sma') return true
        const period = typeof indicator.params.period === 'number' ? indicator.params.period : 20
        return !bollingerPeriods.has(period)
      })
    : profile.indicators

  return {
    ...profile,
    indicators: dedupeIndicators(indicators),
  }
}
