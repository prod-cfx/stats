import type { CanonicalStrategyIrV1, PredicateDef, RiskGuard, RuleBlock, SeriesDef } from '../types/canonical-strategy-ir'
import { Injectable } from '@nestjs/common'

const PHASE_ORDER: Record<RuleBlock['phase'], number> = {
  entry: 0,
  exit: 1,
  rebalance: 2,
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T
}

@Injectable()
export class CanonicalStrategyIrCanonicalizerService {
  canonicalize(ir: CanonicalStrategyIrV1): CanonicalStrategyIrV1 {
    const normalized = clone(ir)
    const primaryTimeframe = normalized.market.timeframes[0]
    const primaryRequiredTimeframe = normalized.dataRequirements.requiredTimeframes[0]

    normalized.market.timeframes = this.sortTimeframesPreservingPrimary(normalized.market.timeframes, primaryTimeframe)
    normalized.dataRequirements.requiredTimeframes = this.sortTimeframesPreservingPrimary(
      normalized.dataRequirements.requiredTimeframes,
      primaryRequiredTimeframe,
    )
    normalized.signalCatalog.series = this.sortSeries(normalized.signalCatalog.series)
    normalized.signalCatalog.predicates = this.sortPredicates(normalized.signalCatalog.predicates)
    normalized.ruleBlocks = this.sortRuleBlocks(normalized.ruleBlocks)
    normalized.riskPolicy.guards = this.sortGuards(normalized.riskPolicy.guards)

    return normalized
  }

  private sortSeries(series: SeriesDef[]): SeriesDef[] {
    return [...series].sort((left, right) => left.id.localeCompare(right.id))
  }

  private sortPredicates(predicates: PredicateDef[]): PredicateDef[] {
    return [...predicates].sort((left, right) => left.id.localeCompare(right.id))
  }

  private sortRuleBlocks(ruleBlocks: RuleBlock[]): RuleBlock[] {
    return [...ruleBlocks].sort((left, right) => {
      const phaseDelta = PHASE_ORDER[left.phase] - PHASE_ORDER[right.phase]
      if (phaseDelta !== 0) return phaseDelta

      if (left.priority !== right.priority) {
        return right.priority - left.priority
      }

      return left.id.localeCompare(right.id)
    })
  }

  private sortGuards(guards: RiskGuard[]): RiskGuard[] {
    return [...guards].sort((left, right) => left.id.localeCompare(right.id))
  }

  private sortTimeframesPreservingPrimary(timeframes: string[], primary?: string): string[] {
    const unique = [...new Set(timeframes)]
    const ordered = [...unique].sort()
    if (!primary) {
      return ordered
    }

    const rest = ordered.filter(timeframe => timeframe !== primary)
    return unique.includes(primary) ? [primary, ...rest] : ordered
  }
}
