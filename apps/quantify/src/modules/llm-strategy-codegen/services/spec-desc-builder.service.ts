import { Injectable } from '@nestjs/common'

interface SpecDescChecklistSnapshot {
  symbols?: unknown
  timeframes?: unknown
  entryRules?: unknown
  exitRules?: unknown
  riskRules?: unknown
}

@Injectable()
export class SpecDescBuilderService {
  build(checklist: SpecDescChecklistSnapshot, scriptCode: string): Record<string, unknown> {
    const symbols = Array.isArray(checklist.symbols) ? checklist.symbols : []
    const timeframes = Array.isArray(checklist.timeframes) ? checklist.timeframes : []
    const entryRules = Array.isArray(checklist.entryRules) ? checklist.entryRules : []
    const exitRules = Array.isArray(checklist.exitRules) ? checklist.exitRules : []
    const riskRules = checklist.riskRules && typeof checklist.riskRules === 'object' ? checklist.riskRules : {}

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

    return {
      version: 1,
      market: {
        symbols,
        timeframes,
        session: '24x7',
      },
      entryRules,
      exitRules,
      riskRules,
      features,
      styleTags,
      constraints: {
        runtime: 'current_script_engine',
        allowedHelpersOnly: true,
      },
      summary: `策略包含 ${entryRules.length} 条入场规则、${exitRules.length} 条出场规则`,
      embedding: null,
    }
  }
}
