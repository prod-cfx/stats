import { createScriptEngine, validateScriptOutput } from '@ai/shared/node'
import { buildStrategyContext } from '@ai/shared/script-engine/helpers/context-builder'
import { Injectable } from '@nestjs/common'

export interface RuntimeGuardrailResult {
  runtimePassed: boolean
  outputPassed: boolean
  reason?: string
}

@Injectable()
export class RuntimeGuardrailService {
  async validate(script: string): Promise<RuntimeGuardrailResult> {
    const engine = createScriptEngine()

    const context = buildStrategyContext({
      bars: [
        { open: 100, high: 102, low: 99, close: 101, volume: 1000, timestamp: Date.now() },
        { open: 101, high: 103, low: 100, close: 102, volume: 1200, timestamp: Date.now() },
      ],
      symbol: 'BTCUSDT',
      timeframe: '1h',
      indicators: { RSI_14: 52.2 },
      currentPrice: 102,
      timestamp: Date.now(),
      params: { riskPct: 0.01 },
    })

    let result = await engine.execute(script, {
      context,
      timeout: 5000,
    })

    const errorMessage = result.error?.message ?? ''
    if (!result.success && errorMessage.includes('Illegal return statement')) {
      result = await engine.execute(`(() => { ${script} })()`, {
        context,
        timeout: 5000,
      })
    }

    if (!result.success) {
      return {
        runtimePassed: false,
        outputPassed: false,
        reason: result.error?.message ?? '脚本执行失败',
      }
    }

    const normalizedValue = this.normalizeRuntimeValue(result.value)
    const output = validateScriptOutput(normalizedValue, { allowEmpty: false })
    if (!output.valid) {
      return {
        runtimePassed: true,
        outputPassed: false,
        reason: output.error ?? '脚本输出结构非法',
      }
    }

    return {
      runtimePassed: true,
      outputPassed: true,
    }
  }

  private normalizeRuntimeValue(value: unknown): unknown {
    if (typeof value !== 'string') {
      return value
    }

    const trimmed = value.trim()
    if (!trimmed) {
      return value
    }

    try {
      const parsed = JSON.parse(trimmed)
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
        return value
      }
      return parsed
    } catch {
      return value
    }
  }
}
