import type { CanonicalStrategyIrV1, PredicateDef, SeriesDef } from '../types/canonical-strategy-ir'
import { Injectable } from '@nestjs/common'

@Injectable()
export class CanonicalStrategyIrValidatorService {
  validate(ir: CanonicalStrategyIrV1): void {
    if (ir.market.timeframes.length === 0) {
      throw new Error('codegen.ir_market_timeframes_missing')
    }

    const predicateIndex = new Map(ir.signalCatalog.predicates.map(predicate => [predicate.id, predicate]))
    const seriesIndex = new Map(ir.signalCatalog.series.map(series => [series.id, series]))

    if (ir.executionPolicy.timeframeAlignment === 'strict') {
      for (const predicate of ir.signalCatalog.predicates) {
        this.assertPredicateTimeframes(predicate, predicateIndex, seriesIndex)
      }
    }

    for (const ruleBlock of ir.ruleBlocks) {
      if (!predicateIndex.has(ruleBlock.when)) {
        throw new Error('codegen.ir_rule_predicate_missing')
      }
    }

    for (const guard of ir.riskPolicy.guards) {
      if (guard.kind === 'EXPRESSION_GUARD') {
        if (typeof guard.predicateRef !== 'string' || !predicateIndex.has(guard.predicateRef)) {
          throw new Error('codegen.ir_guard_predicate_missing')
        }
      }
      if (
        guard.appliesTo !== undefined
        && guard.appliesTo !== 'long'
        && guard.appliesTo !== 'short'
        && guard.appliesTo !== 'both'
      ) {
        throw new Error('codegen.ir_guard_applies_to_invalid')
      }
    }
  }

  private assertPredicateTimeframes(
    predicate: PredicateDef,
    predicateIndex: Map<string, PredicateDef>,
    seriesIndex: Map<string, SeriesDef>,
  ): void {
    if (predicate.kind === 'AND' || predicate.kind === 'OR' || predicate.kind === 'NOT') {
      return
    }

    const timeframes = this.resolvePredicateTimeframes(predicate, predicateIndex, seriesIndex)
    if (timeframes.size > 1) {
      throw new Error('codegen.ir_timeframe_mismatch')
    }
  }

  private resolvePredicateTimeframes(
    predicate: PredicateDef,
    predicateIndex: Map<string, PredicateDef>,
    seriesIndex: Map<string, SeriesDef>,
  ): Set<string> {
    const collected = new Set<string>()

    for (const arg of predicate.args) {
      const series = seriesIndex.get(arg)
      if (series) {
        const timeframe = this.resolveSeriesTimeframe(series, seriesIndex)
        if (timeframe) collected.add(timeframe)
        continue
      }

      const nestedPredicate = predicateIndex.get(arg)
      if (nestedPredicate) {
        for (const timeframe of this.resolvePredicateTimeframes(nestedPredicate, predicateIndex, seriesIndex)) {
          collected.add(timeframe)
        }
      }
    }

    return collected
  }

  private resolveSeriesTimeframe(series: SeriesDef, seriesIndex: Map<string, SeriesDef>): string | null {
    if (series.timeframe) return series.timeframe
    if (!series.inputs || series.inputs.length === 0) return null

    for (const input of series.inputs) {
      const nested = seriesIndex.get(input)
      if (!nested) continue
      const timeframe = this.resolveSeriesTimeframe(nested, seriesIndex)
      if (timeframe) return timeframe
    }

    return null
  }
}
