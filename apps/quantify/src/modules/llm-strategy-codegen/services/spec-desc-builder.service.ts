import type { CanonicalStrategySpec } from '../types/canonical-strategy-spec'
import type { StrategyExecutionContext } from '../types/strategy-execution-context'
import type { StrategyNormalizedIntent } from '../types/strategy-normalized-intent'
import { Injectable } from '@nestjs/common'
import { CanonicalSpecBuilderService } from './canonical-spec-builder.service'
import { CanonicalSpecV2DigestService } from './canonical-spec-v2-digest.service'

interface SpecDescChecklistSnapshot {
  symbols?: unknown
  timeframes?: unknown
  entryRules?: unknown
  exitRules?: unknown
  riskRules?: unknown
}

interface SpecDescBuildExtras {
  normalizedIntent?: StrategyNormalizedIntent | null
  executionContext?: StrategyExecutionContext | null
}

@Injectable()
export class SpecDescBuilderService {
  constructor(
    private readonly canonicalSpecBuilder: CanonicalSpecBuilderService = new CanonicalSpecBuilderService(),
    private readonly digest: CanonicalSpecV2DigestService = new CanonicalSpecV2DigestService(),
  ) {}

  build(
    checklist: SpecDescChecklistSnapshot,
    scriptCode: string,
    extras?: SpecDescBuildExtras,
  ): Record<string, unknown> {
    const canonicalSpec = this.canonicalSpecBuilder.build(checklist)
    return this.buildFromCanonicalSpec(canonicalSpec, scriptCode, extras)
  }

  buildFromCanonicalSpec(
    canonicalSpec: CanonicalStrategySpec,
    scriptCode: string,
    extras?: SpecDescBuildExtras,
  ): Record<string, unknown> {
    const canonicalDigest = this.digest.hash(canonicalSpec)
    const rules = canonicalSpec.version === 2 ? canonicalSpec.rules : []
    const symbols = canonicalSpec.version === 2 && canonicalSpec.market.symbol ? [canonicalSpec.market.symbol] : []
    const timeframes = canonicalSpec.version === 2
      ? canonicalSpec.dataRequirements.requiredTimeframes
      : []

    const normalizedIntent = extras?.normalizedIntent
      ?? (canonicalSpec.version === 2 ? canonicalSpec.metadata?.normalized?.intent ?? null : null)
    const executionContext = extras?.executionContext
      ?? (canonicalSpec.version === 2
        ? {
            exchange: canonicalSpec.market.exchange ?? null,
            symbol: canonicalSpec.market.symbol ?? null,
            marketType: canonicalSpec.market.marketType ?? null,
            timeframe: canonicalSpec.market.defaultTimeframe ?? null,
          }
        : null)
    const features = this.buildScriptFeatures(scriptCode)
    const styleTags = this.buildStyleTags(features)
    const stateHints = normalizedIntent?.stateHints ?? []

    const phaseCounts = {
      entry: 0,
      exit: 0,
      risk: 0,
      rebalance: 0,
    }

    for (const rule of rules) {
      phaseCounts[rule.phase] += 1
    }

    return {
      viewType: 'canonical-semantic-view.v1',
      canonicalDigest,
      version: 2,
      market: {
        symbols,
        timeframes,
        session: '24x7',
      },
      rules,
      confirmation: {
        required: true,
        digest: canonicalDigest,
      },
      ruleSummary: {
        ...phaseCounts,
        total: rules.length,
      },
      features,
      styleTags,
      constraints: {
        runtime: 'current_script_engine',
        allowedHelpersOnly: true,
      },
      ...(executionContext ? { executionContext } : {}),
      summary: timeframes.length > 1
        ? `策略规则共 ${rules.length} 条，覆盖周期 ${timeframes.join(' / ')}`
        : `策略规则共 ${rules.length} 条（入场 ${phaseCounts.entry}、出场 ${phaseCounts.exit}、风控 ${phaseCounts.risk}）`,
      embedding: null,
      normalizedIntent,
      ...(stateHints.length > 0 ? { stateHints } : {}),
      semanticSource: this.resolveSemanticSource(canonicalSpec, normalizedIntent),
    }
  }

  private buildScriptFeatures(scriptCode: string): string[] {
    const scriptLower = scriptCode.toLowerCase()
    return ['rsi', 'sma', 'ema', 'atr', 'macd', 'bollinger', 'crossover', 'crossunder']
      .filter(feature => scriptLower.includes(feature))
  }

  private buildStyleTags(features: string[]): string[] {
    const styleTags: string[] = []
    if (features.includes('sma') || features.includes('ema')) {
      styleTags.push('trend')
    }
    if (features.includes('rsi') || features.includes('bollinger')) {
      styleTags.push('mean-reversion')
    }
    return styleTags
  }

  private resolveSemanticSource(
    canonicalSpec: CanonicalStrategySpec,
    normalizedIntent: StrategyNormalizedIntent | null | undefined,
  ): string {
    if (canonicalSpec.version === 2 && canonicalSpec.metadata?.normalized) {
      return canonicalSpec.metadata.normalized.semanticViewSource
    }
    return normalizedIntent ? 'normalized-canonical-truth' : 'rule-derived'
  }

}
