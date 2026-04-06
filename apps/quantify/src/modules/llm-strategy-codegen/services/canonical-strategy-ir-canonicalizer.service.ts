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

    normalized.market.timeframes = [...normalized.market.timeframes].sort()
    normalized.dataRequirements.requiredTimeframes = [...normalized.dataRequirements.requiredTimeframes].sort()
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
}
