import type { SignalDirection as SignalDirectionType, SignalType as SignalTypeType } from '@ai/shared'
import { SignalDirection, SignalType } from '@ai/shared'
import { createScriptEngine, validateScriptOutput } from '@ai/shared/node'
import { buildStrategyContext } from '@ai/shared/script-engine/helpers/context-builder'
import { Injectable } from '@nestjs/common'
import { resolveStrategyOutput, validateStrategyDecision } from '@/modules/strategy-runtime/strategy-protocol.util'
import { compileStrategyScriptForVm } from '@/modules/strategy-runtime/strategy-script-compiler.util'

export interface RuntimeGuardrailResult {
  runtimePassed: boolean
  outputPassed: boolean
  reason?: string
}

const ALLOWED_DIRECTIONS: readonly SignalDirectionType[] = Object.values(SignalDirection)
const ALLOWED_SIGNAL_TYPES: readonly SignalTypeType[] = Object.values(SignalType)

@Injectable()
export class RuntimeGuardrailService {
  async validate(script: string): Promise<RuntimeGuardrailResult> {
    const engine = createScriptEngine()
    const compiled = compileStrategyScriptForVm(script)
    if (!compiled.ok) {
      return {
        runtimePassed: false,
        outputPassed: false,
        reason: `TypeScript 类型检查失败: ${compiled.error ?? '未知错误'}`,
      }
    }

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

    let result = await engine.execute(compiled.executableCode, {
      context,
      timeout: 5000,
    })

    const errorMessage = result.error?.message ?? ''
    if (!result.success && errorMessage.includes('Illegal return statement')) {
      result = await engine.execute(`(() => { ${compiled.executableCode} })()`, {
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

    const resolved = await resolveStrategyOutput(output.value, context as Record<string, unknown>)
    if (resolved.error) {
      return {
        runtimePassed: true,
        outputPassed: false,
        reason: resolved.error,
      }
    }

    if (resolved.decision) {
      const decisionValidation = validateStrategyDecision(resolved.decision)
      if (!decisionValidation.valid) {
        return {
          runtimePassed: true,
          outputPassed: false,
          reason: decisionValidation.error ?? '策略协议决策不合法',
        }
      }
      return {
        runtimePassed: true,
        outputPassed: true,
      }
    }

    const signalPayloadError = this.validateSignalPayload(resolved.passthrough ?? output.value)
    if (signalPayloadError) {
      return {
        runtimePassed: true,
        outputPassed: false,
        reason: signalPayloadError,
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

  private validateSignalPayload(value: Record<string, unknown>): string | null {
    const direction = this.readNonEmptyString(value.direction)
    if (!direction || !ALLOWED_DIRECTIONS.includes(direction as SignalDirectionType)) {
      return '脚本输出缺少合法的 direction（BUY/SELL/CLOSE_LONG/CLOSE_SHORT）'
    }

    const signalType = this.readNonEmptyString(value.signalType)
    if (!signalType || !ALLOWED_SIGNAL_TYPES.includes(signalType as SignalTypeType)) {
      return '脚本输出缺少合法的 signalType（ENTRY/EXIT/ADJUSTMENT/ALERT）'
    }

    const confidence = this.readFiniteNumber(value.confidence)
    if (confidence === null || confidence < 0 || confidence > 100) {
      return '脚本输出缺少合法的 confidence（0-100）'
    }

    const entryPrice = this.readFiniteNumber(value.entryPrice)
    if (entryPrice === null || entryPrice <= 0) {
      return '脚本输出缺少合法的 entryPrice（> 0）'
    }

    const stopLoss = this.readFiniteNumber(value.stopLoss)
    if (stopLoss === null || stopLoss <= 0) {
      return '脚本输出缺少合法的 stopLoss（> 0）'
    }

    const takeProfit = this.readFiniteNumber(value.takeProfit)
    if (takeProfit === null || takeProfit <= 0) {
      return '脚本输出缺少合法的 takeProfit（> 0）'
    }

    const reasoning = this.readNonEmptyString(value.reasoning)
    if (!reasoning) {
      return '脚本输出缺少合法的 reasoning（非空字符串）'
    }

    let positionSizeQuote: number | undefined
    if (value.positionSizeQuote !== undefined && value.positionSizeQuote !== null) {
      positionSizeQuote = this.readFiniteNumber(value.positionSizeQuote) ?? undefined
      if (positionSizeQuote === undefined) {
        return '脚本输出中的 positionSizeQuote 必须是 number'
      }
      if (positionSizeQuote <= 0) {
        return '脚本输出中的 positionSizeQuote 必须 > 0'
      }
    }

    let positionSizeRatio: number | undefined
    if (value.positionSizeRatio !== undefined && value.positionSizeRatio !== null) {
      positionSizeRatio = this.readFiniteNumber(value.positionSizeRatio) ?? undefined
      if (positionSizeRatio === undefined) {
        return '脚本输出中的 positionSizeRatio 必须是 number'
      }
      if (positionSizeRatio <= 0 || positionSizeRatio > 1) {
        return '脚本输出中的 positionSizeRatio 必须在 (0, 1] 范围内'
      }
    }

    if (positionSizeQuote !== undefined && positionSizeRatio !== undefined) {
      return '脚本输出中 positionSizeQuote 与 positionSizeRatio 只能二选一'
    }

    return null
  }

  private readNonEmptyString(value: unknown): string | null {
    if (typeof value !== 'string') return null
    const normalized = value.trim()
    return normalized || null
  }

  private readFiniteNumber(value: unknown): number | null {
    return typeof value === 'number' && Number.isFinite(value) ? value : null
  }
}
