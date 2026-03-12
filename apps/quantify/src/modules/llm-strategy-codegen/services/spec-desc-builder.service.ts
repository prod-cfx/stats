import type { CodegenChecklist } from './checklist-gate.service'

import { Injectable } from '@nestjs/common'

@Injectable()
export class SpecDescBuilderService {
  build(checklist: CodegenChecklist, scriptCode: string): Record<string, unknown> {
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
      summary: `绛栫暐鍖呭惈 ${entryRules.length} 鏉″叆鍦鸿鍒欍€?{exitRules.length} 鏉″嚭鍦鸿鍒檂,
      embedding: null,
    }
  }
}
