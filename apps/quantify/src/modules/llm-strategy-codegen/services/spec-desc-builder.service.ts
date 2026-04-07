import { Injectable } from '@nestjs/common'
import { CanonicalSpecBuilderService } from './canonical-spec-builder.service'

interface SpecDescChecklistSnapshot {
  symbols?: unknown
  timeframes?: unknown
  entryRules?: unknown
  exitRules?: unknown
  riskRules?: unknown
}

@Injectable()
export class SpecDescBuilderService {
  constructor(
    private readonly canonicalSpecBuilder: CanonicalSpecBuilderService = new CanonicalSpecBuilderService(),
  ) {}

  build(checklist: SpecDescChecklistSnapshot, scriptCode: string): Record<string, unknown> {
    const symbols = Array.isArray(checklist.symbols) ? checklist.symbols : []
    const timeframes = Array.isArray(checklist.timeframes) ? checklist.timeframes : []
    const canonicalSpec = this.canonicalSpecBuilder.build(checklist)
    const rules = canonicalSpec.version === 2 ? canonicalSpec.rules : []

    const scriptLower = scriptCode.toLowerCase()
    const features = ['rsi', 'sma', 'ema', 'atr', 'macd', 'bollinger', 'crossover', 'crossunder']
      .filter(feature => scriptLower.includes(feature))

    const styleTags: string[] = []
    if (features.includes('sma') || features.includes('ema')) {
      styleTags.push('trend')
    }
    if (features.includes('rsi') || features.includes('bollinger')) {
      styleTags.push('mean-reversion')
    }

    const phaseCounts = {
      entry: 0,
      exit: 0,
      risk: 0,
      rebalance: 0,
    }

    for (const rule of rules) {
      phaseCounts[rule.phase] += 1
    }

    const totalRules = rules.length

    return {
      version: 2,
      market: {
        symbols,
        timeframes,
        session: '24x7',
      },
      rules,
      ruleSummary: {
        ...phaseCounts,
        total: totalRules,
      },
      features,
      styleTags,
      constraints: {
        runtime: 'current_script_engine',
        allowedHelpersOnly: true,
      },
      summary: `策略规则共 ${totalRules} 条（入场 ${phaseCounts.entry}、出场 ${phaseCounts.exit}、风控 ${phaseCounts.risk}）`,
      embedding: null,
    }
  }
}
