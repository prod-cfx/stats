import type { AiSignalPayload, MarketTimeframe as AppMarketTimeframe, StrategyDecisionV1 } from '@ai/shared'
import type { MultiLegStrategyContext, LegTimeframeData } from '@ai/shared/script-engine/helpers/context-builder'
import type { Logger } from '@nestjs/common'
import type { StrategySignalsRuntimeConfig } from '../types/strategy-signals-config.type'
import type { AiService } from '@/modules/ai/ai.service'
import type { StrategyExecutionConfig, StrategyLegDefinition } from '@/modules/strategy-templates/types/strategy-template.types'
import type { StrategyInstance, StrategyTemplate, Symbol } from '@/prisma/prisma.types'
import { fillPromptTemplate, parseAiSignalResponse } from '@ai/shared'
import { createScriptEngine, validateScriptOutput } from '@ai/shared/node'
import { buildStrategyContext } from '@ai/shared/script-engine/helpers/context-builder'
import {
  buildSemanticRuntimeState,
  type SemanticRuntimeState,
} from '@/modules/strategy-runtime/semantic-runtime-state.util'
import { resolveStrategyOutput, strategyDecisionToSignalPayload } from '@/modules/strategy-runtime/strategy-protocol.util'
import { compileStrategyScriptForVm } from '@/modules/strategy-runtime/strategy-script-compiler.util'
import { ScriptDebugUtil } from '../utils/script-debug.util'
import { RuntimeSignalIntentAdapter } from './runtime-signal-intent.adapter'

const DEFAULT_RAW_RESPONSE_LIMIT = 4000
const MAX_SCRIPT_TIMEOUT_MS = 5000
const PUBLISHED_SNAPSHOT_LOCKED_PARAMS_MARKER = '__publishedSnapshotLockedParams'

export type GeneratedSignalPayload =
  | { type: 'signal'; payload: AiSignalPayload & { rawResponse: string } }
  | { type: 'none'; reason: string }

export interface MultiLegRuntimeSignalLeg {
  legId: string
  legScopeId: string
  totalLegs: number
  legSizing: {
    mode: 'fixed_pct' | 'fixed_quote' | 'fixed_ratio' | 'fixed_base'
    value: number
    asset?: string
    pairedLegId?: string
  }
  payload: AiSignalPayload & { rawResponse: string }
}

export type PublishedRuntimeSignalOutcome =
  | { kind: 'signal'; payload: AiSignalPayload & { rawResponse: string } }
  | { kind: 'multi_leg'; legs: MultiLegRuntimeSignalLeg[] }
  | { kind: 'noop'; reasonCode: 'SNAPSHOT_RUNTIME_EXECUTION_NO_SIGNAL'; reason: string }
  | { kind: 'missing_required_truth'; reasonCode: string; fields: string[] }
  | { kind: 'unexpected_error'; reasonCode: string; reason: string }

/**
 * #1186 PR4a — Compiled leg scope shape for multi-leg dispatch fan-out.
 * Mirrors `CompiledOrchestrationLegScope` (packages/shared) + asset/`fixed_base`
 * extension from canonical-strategy-spec-v2 PR2.
 */
export interface MultiLegFanOutScope {
  id: string
  legId: string
  direction: 'long' | 'short'
  legSizing?: {
    mode: 'fixed_pct' | 'fixed_quote' | 'fixed_ratio' | 'fixed_base'
    value: number
    asset?: string
    pairedLegId?: string
  }
}

export interface PublishedStrategyRuntimeContextInput {
  bars: Array<{
    open: number
    high: number
    low: number
    close: number
    volume: number
    timestamp: number
  }>
  symbol: string
  timeframe: AppMarketTimeframe | string
  indicators: Record<string, number>
  currentPrice: number
  timestamp: number
  params: Record<string, unknown> | null
  compiledDecisionState?: { barIndex: number; lastTriggeredByProgram: Record<string, number> }
  semanticRuntimeState?: SemanticRuntimeState
  position?: {
    qty: number
    avgEntryPrice?: number
    entryPrice?: number
    positionSide?: string
  } | null
  /**
   * Phase 5 S7 follow-up (#1058) — live signal 注入 LlmStrategyInstance.drawdownPct（0..100 浮点正数）；
   * undefined 表"无可用数据" → evaluator 在 enforce 模式 fail-closed double block。
   * 公式与 backtest adapter 同源（与 account-strategy-view.service.ts:1970 一致）。
   */
  accountDrawdownPct?: number
}

export class SignalGenerationDecisionStage {
  private readonly runtimeSignalIntentAdapter = new RuntimeSignalIntentAdapter()

  constructor(
    private readonly aiService: AiService,
    private readonly logger: Logger,
  ) {}

  async generateSignalWithAi(
    instance: Pick<StrategyInstance, 'llmModel' | 'params' | 'id'>,
    strategy: Pick<StrategyTemplate, 'id' | 'name' | 'description' | 'promptTemplate' | 'script' | 'defaultParams'>,
    symbol: Pick<Symbol, 'code'>,
    timeframe: AppMarketTimeframe,
    indicators: Record<string, number>,
    config: StrategySignalsRuntimeConfig,
    referencePrice?: number,
    manualTrigger = false,
  ): Promise<(AiSignalPayload & { rawResponse: string }) | null> {
    const isStrictCodegen = this.isStrictPublishedCodegenTemplate(strategy)

    let promptData: Record<string, any> = {}

    if (strategy.script) {
      try {
        const engine = createScriptEngine()
        const compiledScript = compileStrategyScriptForVm(strategy.script)
        if (!compiledScript.ok) {
          this.logger.error(
            `TypeScript check failed for strategy ${strategy.id}: ${compiledScript.error ?? 'Unknown error'}`,
          )
          if (isStrictCodegen) {
            return null
          }
          promptData = indicators
        } else {
          const scriptContext = this.buildPublishedStrategyContext({
            bars: [],
            symbol: symbol.code,
            timeframe,
            indicators,
            currentPrice: referencePrice || 0,
            timestamp: Date.now(),
            params: this.buildEffectiveParams(strategy, instance),
            // Phase 5 S7 follow-up (#1058) — codegen 测试入口显式不注入 drawdown，
            // 与 live signal fast path 区分（critic R-1 防 codegen 闭包漂移）
            accountDrawdownPct: undefined,
          })

          let result = await engine.execute(compiledScript.executableCode, {
            context: scriptContext,
            timeout: MAX_SCRIPT_TIMEOUT_MS,
            allowAsync: false,
          })

          if (!result.success && result.error?.message) {
            const errorMsg = result.error.message
            const needsAsync =
              errorMsg.includes('Illegal return statement') ||
              errorMsg.includes('await is only valid in async functions') ||
              errorMsg.includes('Unexpected reserved word')

            if (needsAsync) {
              result = await engine.execute(compiledScript.executableCode, {
                context: scriptContext,
                timeout: MAX_SCRIPT_TIMEOUT_MS,
                allowAsync: true,
              })
            }
          }

          if (!result.success) {
            if (isStrictCodegen) {
              return null
            }
            promptData = indicators
          } else {
            const validation = validateScriptOutput(result.value, { allowEmpty: false })
            if (!validation.valid || !validation.value) {
              if (isStrictCodegen) return null
              promptData = indicators
            } else {
              promptData = validation.value as Record<string, any>
            }
          }
        }
      } catch (error) {
        this.logger.error(
          `Error executing script for strategy ${strategy.id}: ${(error as Error).message}`,
        )
        if (isStrictCodegen) {
          return null
        }
        promptData = indicators
      }
    } else {
      if (isStrictCodegen) {
        return null
      }
      promptData = indicators
    }

    const directSignal = this.buildPublishedCodegenSignalPayload(
      promptData,
      referencePrice,
      strategy,
      instance,
      config,
    )
    if (directSignal) {
      return directSignal.type === 'signal' ? directSignal.payload : null
    }
    if (isStrictCodegen) {
      return null
    }

    const filledPrompt = fillPromptTemplate(strategy.promptTemplate ?? '', promptData)

    // #1230 — 读取策略层 sizing 约束（优先 quote，其次 ratio）
    const instanceParams = instance.params as Record<string, unknown> | null | undefined
    const paramsSizeQuote = this.readNumeric(instanceParams?.positionSizeQuote)
    const paramsSizeRatio = this.readNumeric(instanceParams?.positionSizeRatio)
    const hasParamsSizeQuote = typeof paramsSizeQuote === 'number' && paramsSizeQuote > 0
    const hasParamsSizeRatio = typeof paramsSizeRatio === 'number' && paramsSizeRatio > 0
    const hasStrategyLevelSizing = hasParamsSizeQuote || hasParamsSizeRatio

    let systemPrompt: string
    let sizingExampleFragment: string
    if (hasStrategyLevelSizing) {
      if (hasParamsSizeQuote) {
        systemPrompt =
          'You are a quantitative trading assistant. Analyze the provided market data and respond with a strict JSON object. ' +
          'The JSON must include direction (BUY, SELL, CLOSE_LONG, CLOSE_SHORT), signalType (ENTRY or EXIT), confidence (0-100), ' +
          'entryPrice, stopLoss, takeProfit, and reasoning. ' +
          `You MUST use exactly positionSizeQuote=${paramsSizeQuote} in your response. Do not omit or change this value.`
        sizingExampleFragment = `"positionSizeQuote":${paramsSizeQuote}`
      } else {
        systemPrompt =
          'You are a quantitative trading assistant. Analyze the provided market data and respond with a strict JSON object. ' +
          'The JSON must include direction (BUY, SELL, CLOSE_LONG, CLOSE_SHORT), signalType (ENTRY or EXIT), confidence (0-100), ' +
          'entryPrice, stopLoss, takeProfit, and reasoning. ' +
          `You MUST use exactly positionSizeRatio=${paramsSizeRatio} in your response. Do not omit or change this value.`
        sizingExampleFragment = `"positionSizeRatio":${paramsSizeRatio}`
      }
    } else {
      systemPrompt =
        'You are a quantitative trading assistant. Analyze the provided market data and respond with a strict JSON object. ' +
        'The JSON must include direction (BUY, SELL, CLOSE_LONG, CLOSE_SHORT), signalType (ENTRY or EXIT), confidence (0-100), ' +
        'entryPrice, stopLoss, takeProfit, and reasoning. ' +
        'You can optionally specify position size: either positionSizeQuote (absolute amount in quote currency like USDT) ' +
        'or positionSizeRatio (fraction of account balance, 0-1). If not specified, system defaults will be used.'
      sizingExampleFragment = '"positionSizeRatio":0.15'
    }

    const userPrompt = [
      `Strategy: ${strategy.name}`,
      strategy.description ? `Description: ${strategy.description}` : null,
      `Symbol: ${symbol.code}`,
      `Timeframe: ${timeframe}`,
      hasStrategyLevelSizing
        ? `Position size requirement: ${hasParamsSizeQuote ? `${paramsSizeQuote} USDT per trade (positionSizeQuote)` : `ratio ${paramsSizeRatio} of account balance (positionSizeRatio)`}`
        : null,
      '',
      `Respond with JSON only, for example: {"direction":"BUY","signalType":"ENTRY","confidence":80,"entryPrice":62000,"stopLoss":60000,"takeProfit":65000,${sizingExampleFragment},"reasoning":"text"}`,
    ]
      .filter(Boolean)
      .join('\n')

    let attempt = 0
    while (attempt < config.ai.maxAttempts) {
      attempt += 1
      try {
        const result = await this.aiService.chat({
          model: instance.llmModel!,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: `${filledPrompt ?? strategy.promptTemplate ?? ''}\n\n${userPrompt}` },
          ],
          temperature: config.ai.temperature,
          maxTokens: config.ai.maxTokens,
        })

        const parsed = parseAiSignalResponse(result.content, referencePrice)
        if (!parsed) {
          this.logger.warn(
            `AI response for strategy ${strategy.id} could not be parsed (attempt ${attempt})`,
          )
          continue
        }

        // #1230 — sizing 校验：策略层指定了 sizing 时检查 LLM 响应是否匹配
        // close signal (signalType='EXIT') 走平仓路径，仓位大小由当前持仓决定，
        // 与开仓 sizing 无关，跳过校验，与 signal-executor.service.ts:1064 行
        // 的 close signal 豁免语义保持对称。
        if (hasStrategyLevelSizing && parsed.signalType !== 'EXIT') {
          const llmSizeQuote = this.readNumeric(parsed.positionSizeQuote)
          const llmSizeRatio = this.readNumeric(parsed.positionSizeRatio)
          let sizingMismatch = false

          if (hasParamsSizeQuote) {
            const expected = paramsSizeQuote!
            const actual = typeof llmSizeQuote === 'number' && llmSizeQuote > 0 ? llmSizeQuote : null
            sizingMismatch = actual === null || Math.abs(actual - expected) / expected > 0.001
          } else {
            const expected = paramsSizeRatio!
            const actual = typeof llmSizeRatio === 'number' && llmSizeRatio > 0 ? llmSizeRatio : null
            sizingMismatch = actual === null || Math.abs(actual - expected) / expected > 0.001
          }

          if (sizingMismatch) {
            if (config.execution.requireExplicitSizing) {
              this.logger.warn(
                `[SIZING_MISMATCH] Strategy ${strategy.id} (attempt ${attempt}): ` +
                `expected ${hasParamsSizeQuote ? `positionSizeQuote=${paramsSizeQuote}` : `positionSizeRatio=${paramsSizeRatio}`}, ` +
                `got positionSizeQuote=${parsed.positionSizeQuote} positionSizeRatio=${parsed.positionSizeRatio}. ` +
                `Rejecting signal (requireExplicitSizing=true).`,
              )
              continue
            }
            // #1230 — 非 strict 模式：用 strategy.params 覆盖 LLM 输出，避免 LLM 自由发挥
            // 导致用户配置的 sizing 静默失效。策略层意图始终优先于 LLM 输出。
            this.logger.warn(
              `[SIZING_MISMATCH] Strategy ${strategy.id} (attempt ${attempt}): ` +
              `expected ${hasParamsSizeQuote ? `positionSizeQuote=${paramsSizeQuote}` : `positionSizeRatio=${paramsSizeRatio}`}, ` +
              `got positionSizeQuote=${parsed.positionSizeQuote} positionSizeRatio=${parsed.positionSizeRatio}. ` +
              `Overriding LLM output with strategy.params (requireExplicitSizing=false).`,
            )
            if (hasParamsSizeQuote) {
              parsed.positionSizeQuote = paramsSizeQuote
              parsed.positionSizeRatio = undefined
            } else {
              parsed.positionSizeRatio = paramsSizeRatio
              parsed.positionSizeQuote = undefined
            }
          }
        }

        return {
          ...parsed,
          rawResponse: this.truncateRawResponse(result.content, config),
        }
      } catch (error) {
        this.logger.error(
          `AI request failed for strategy ${strategy.id} (attempt ${attempt}): ${(error as Error).message}`,
        )
      }
    }

    this.logger.warn(`Exceeded AI retry attempts for strategy ${strategy.id}`)
    if (manualTrigger && !isStrictCodegen) {
      return this.buildManualFallbackSignal(referencePrice, strategy.id, symbol.code)
    }
    return null
  }

  buildPublishedCodegenSignalPayload(
    promptData: Record<string, unknown>,
    referencePrice: number | undefined,
    strategy: Pick<StrategyTemplate, 'promptTemplate' | 'defaultParams'>,
    instance: Pick<StrategyInstance, 'params'>,
    config: StrategySignalsRuntimeConfig,
  ): GeneratedSignalPayload | null {
    if (!this.isStrictPublishedCodegenTemplate(strategy)) {
      return null
    }

    const action = typeof promptData.action === 'string' ? promptData.action.trim().toLowerCase() : ''
    if (!action) {
      const normalizedSignal = this.buildPublishedCodegenNormalizedSignal(promptData)
      if (normalizedSignal) {
        return {
          type: 'signal',
          payload: {
            ...normalizedSignal,
            rawResponse: this.truncateRawResponse(JSON.stringify(promptData), config),
          },
        }
      }
      return { type: 'none', reason: 'INVALID_NORMALIZED_SIGNAL' }
    }

    if (action === 'hold' || action === 'wait' || action === 'none') {
      return { type: 'none', reason: 'NO_ACTION' }
    }

    const metadata = this.asRecord(promptData.metadata)
    const entryPrice = this.readNumeric(metadata.entryPrice) ?? referencePrice ?? 0
    if (!(entryPrice > 0)) {
      return { type: 'none', reason: 'MISSING_ENTRY_PRICE' }
    }

    const confidence = this.readNumeric(promptData.confidence) ?? this.readNumeric(metadata.confidence)
    const stopLoss = this.readNumeric(metadata.stopLossPrice) ?? this.readNumeric(promptData.stopLoss)
    const takeProfit = this.readNumeric(metadata.takeProfitPrice) ?? this.readNumeric(promptData.takeProfit)
    if (confidence === undefined || stopLoss === undefined || takeProfit === undefined) {
      return { type: 'none', reason: 'INVALID_NORMALIZED_SIGNAL' }
    }

    const positionSizeQuote = this.readNumeric(promptData.positionSizeQuote)
    const positionSizeRatio = this.readNumeric(promptData.positionSizeRatio)
    const rawResponse = this.truncateRawResponse(JSON.stringify(promptData), config)

    if (action === 'buy') {
      const hasQuoteSize = typeof positionSizeQuote === 'number' && positionSizeQuote > 0
      const hasRatioSize = typeof positionSizeRatio === 'number' && positionSizeRatio > 0
      if (!hasQuoteSize && !hasRatioSize) {
        return { type: 'none', reason: 'INVALID_NORMALIZED_SIGNAL' }
      }
      return {
        type: 'signal',
        payload: {
          signalType: 'ENTRY',
          direction: 'BUY',
          confidence,
          entryPrice,
          stopLoss,
          takeProfit,
          positionSizeQuote: hasQuoteSize ? positionSizeQuote : undefined,
          positionSizeRatio: hasRatioSize ? positionSizeRatio : undefined,
          reasoning: 'AI codegen direct signal: buy',
          rawResponse,
        },
      }
    }

    if (action === 'sell') {
      return {
        type: 'signal',
        payload: {
          signalType: 'EXIT',
          direction: 'CLOSE_LONG',
          confidence,
          entryPrice: referencePrice ?? entryPrice,
          stopLoss,
          takeProfit,
          reasoning: 'AI codegen direct signal: sell',
          rawResponse,
        },
      }
    }

    return { type: 'none', reason: 'UNSUPPORTED_ACTION' }
  }

  buildPublishedCodegenNormalizedSignal(promptData: Record<string, unknown>): AiSignalPayload | null {
    const direction = typeof promptData.direction === 'string' ? promptData.direction : null
    const signalType = typeof promptData.signalType === 'string' ? promptData.signalType : null
    const entryPrice = this.readNumeric(promptData.entryPrice)
    const confidence = this.readNumeric(promptData.confidence)
    const stopLoss = this.readNumeric(promptData.stopLoss)
    const takeProfit = this.readNumeric(promptData.takeProfit)
    const positionSizeQuote = this.readNumeric(promptData.positionSizeQuote)
    const positionSizeRatio = this.readNumeric(promptData.positionSizeRatio)
    const hasQuoteSize = typeof positionSizeQuote === 'number' && positionSizeQuote > 0
    const hasRatioSize = typeof positionSizeRatio === 'number' && positionSizeRatio > 0

    if (
      !direction ||
      !['BUY', 'SELL', 'CLOSE_LONG', 'CLOSE_SHORT'].includes(direction) ||
      !signalType ||
      !['ENTRY', 'EXIT', 'ADJUSTMENT', 'ALERT'].includes(signalType) ||
      !(entryPrice && entryPrice > 0) ||
      confidence === undefined ||
      stopLoss === undefined ||
      takeProfit === undefined ||
      (signalType === 'ENTRY' && !hasQuoteSize && !hasRatioSize)
    ) {
      return null
    }

    return {
      direction: direction as AiSignalPayload['direction'],
      signalType: signalType as AiSignalPayload['signalType'],
      confidence,
      entryPrice,
      stopLoss,
      takeProfit,
      positionSizeQuote: hasQuoteSize ? positionSizeQuote : undefined,
      positionSizeRatio: hasRatioSize ? positionSizeRatio : undefined,
      reasoning:
        (typeof promptData.reasoning === 'string' && promptData.reasoning.trim()) ||
        (typeof promptData.reason === 'string' && promptData.reason.trim()) ||
        'AI codegen direct signal',
    }
  }

  buildStrictPublishedPromptDataFromDecision(
    decision: StrategyDecisionV1,
    referencePrice: number,
    context?: { currentQty?: number; equity?: number; markPrice?: number },
  ): Record<string, unknown> {
    if (decision.action === 'NOOP') {
      return { action: 'hold' }
    }

    const payload = strategyDecisionToSignalPayload(
      decision,
      referencePrice,
      context,
    ) as Record<string, unknown>

    const confidence = this.readNumeric(decision.confidence)
    const stopLoss = this.readNumeric(decision.risk?.stopLoss)
    const takeProfit = this.readNumeric(decision.risk?.takeProfit)

    const strictPromptData: Record<string, unknown> = {
      direction: payload.direction,
      signalType: payload.signalType,
      entryPrice: payload.entryPrice,
    }

    if (confidence !== undefined) strictPromptData.confidence = confidence
    if (stopLoss !== undefined) strictPromptData.stopLoss = stopLoss
    if (takeProfit !== undefined) strictPromptData.takeProfit = takeProfit
    if (typeof decision.reason === 'string' && decision.reason.trim()) {
      strictPromptData.reasoning = decision.reason.trim()
    }

    if (decision.size?.mode === 'QUOTE') {
      strictPromptData.positionSizeQuote = Math.abs(decision.size.value)
    } else if (decision.size?.mode === 'RATIO') {
      strictPromptData.positionSizeRatio = Math.abs(decision.size.value)
    } else if (decision.size?.mode === 'QTY') {
      const entryPrice = this.readNumeric(payload.entryPrice)
      if (entryPrice && entryPrice > 0) {
        strictPromptData.positionSizeQuote = Math.abs(decision.size.value) * entryPrice
      }
    }

    return strictPromptData
  }

  /**
   * #1186 PR4a — Multi-leg dispatch fan-out.
   *
   * Given a base runtime decision + the orchestration leg scopes (each with
   * its own `legSizing`/`direction`), build N per-leg payloads. The base
   * decision provides reasoning, prices, risk fields; each leg overrides
   * direction (long→BUY / short→SELL) and position size from `legSizing`.
   *
   * `fixed_base` axis is currently unsupported (no AiSignalPayload shape for
   * base qty). Per the dispatch failure-mode decision (`docs/decisions/
   * 2026-05-12-multi-leg-dispatch-failure-mode.md`), emit-stage validation
   * failures must reject the entire batch; if any leg fan-out fails, return
   * `missing_required_truth` so the caller halts dispatch.
   */
  buildPublishedRuntimeMultiLegOutcome(
    decision: StrategyDecisionV1,
    legScopes: readonly MultiLegFanOutScope[],
    ctx: {
      exchange: string
      marketType: 'spot' | 'perp'
      symbol: string
      timeframe: string
      referencePrice?: number
    },
    config: StrategySignalsRuntimeConfig,
  ): PublishedRuntimeSignalOutcome {
    if (legScopes.length < 2) {
      return this.missingRequiredTruth('MULTI_LEG_DISPATCH_REQUIRES_TWO_OR_MORE_LEGS', ['legScopes'])
    }

    const reason = typeof decision.reason === 'string' ? decision.reason.trim() : ''
    if (!reason) {
      return this.missingRequiredTruth('MULTI_LEG_DISPATCH_REASONING_MISSING', ['reason'])
    }

    if (typeof ctx.referencePrice !== 'number' || !Number.isFinite(ctx.referencePrice) || ctx.referencePrice <= 0) {
      return this.missingRequiredTruth('MULTI_LEG_DISPATCH_REFERENCE_PRICE_MISSING', ['referencePrice'])
    }

    const optional = this.buildOptionalSignalFields(decision)
    const totalLegs = legScopes.length
    const rawResponse = this.truncateRawResponse(JSON.stringify(decision), config)
    const legs: MultiLegRuntimeSignalLeg[] = []

    for (const scope of legScopes) {
      if (!scope.legSizing) {
        return this.missingRequiredTruth('MULTI_LEG_DISPATCH_LEG_SIZING_MISSING', [`legScopes.${scope.legId}.legSizing`])
      }

      const sizing = scope.legSizing
      if (!Number.isFinite(sizing.value) || sizing.value <= 0) {
        return this.missingRequiredTruth('MULTI_LEG_DISPATCH_LEG_SIZING_VALUE_INVALID', [`legScopes.${scope.legId}.legSizing.value`])
      }

      let positionSizeQuote: number | undefined
      let positionSizeRatio: number | undefined
      if (sizing.mode === 'fixed_quote') {
        positionSizeQuote = sizing.value
      } else if (sizing.mode === 'fixed_ratio') {
        positionSizeRatio = sizing.value
      } else if (sizing.mode === 'fixed_pct') {
        // `fixed_pct` values may arrive as percent (10 → 10%) OR as ratio (0.1 → 10%).
        // Convention: treat values >1 as percent and divide by 100; values ≤1 already ratio.
        // Both [0,1] ratio and (1,100] percent encodings are valid from canonical-spec-v2.
        positionSizeRatio = sizing.value > 1 ? sizing.value / 100 : sizing.value
      } else {
        // 'fixed_base' axis (base-qty): not representable in current AiSignalPayload.
        // Per dispatch failure-mode decision: emit-stage validation failure → reject batch.
        return this.missingRequiredTruth('MULTI_LEG_DISPATCH_LEG_SIZING_MODE_UNSUPPORTED', [`legScopes.${scope.legId}.legSizing.mode`])
      }

      const direction: 'BUY' | 'SELL' = scope.direction === 'long' ? 'BUY' : 'SELL'
      const payload: AiSignalPayload & { rawResponse: string } = {
        direction,
        signalType: 'ENTRY',
        confidence: typeof decision.confidence === 'number' && Number.isFinite(decision.confidence) ? decision.confidence : 50,
        entryPrice: ctx.referencePrice,
        reasoning: `${reason} [leg ${scope.legId}]`,
        rawResponse,
      }
      // Omit stopLoss/takeProfit when absent — 0 is not a valid sentinel value
      // and would be misinterpreted as "no limit" by some downstream consumers.
      if (optional.stopLoss !== undefined) payload.stopLoss = optional.stopLoss
      if (optional.takeProfit !== undefined) payload.takeProfit = optional.takeProfit
      if (positionSizeQuote !== undefined) payload.positionSizeQuote = positionSizeQuote
      if (positionSizeRatio !== undefined) payload.positionSizeRatio = positionSizeRatio

      legs.push({
        legId: scope.legId,
        legScopeId: scope.id,
        totalLegs,
        legSizing: { ...sizing },
        payload,
      })
    }

    return { kind: 'multi_leg', legs }
  }

  private missingRequiredTruth(reasonCode: string, fields: string[]): PublishedRuntimeSignalOutcome {
    return { kind: 'missing_required_truth', reasonCode, fields }
  }

  private buildOptionalSignalFields(decision: StrategyDecisionV1): {
    confidence?: number
    stopLoss?: number
    takeProfit?: number
  } {
    const out: { confidence?: number; stopLoss?: number; takeProfit?: number } = {}
    if (typeof decision.confidence === 'number' && Number.isFinite(decision.confidence) && decision.confidence > 0) {
      out.confidence = decision.confidence
    }
    if (typeof decision.risk?.stopLoss === 'number' && Number.isFinite(decision.risk.stopLoss) && decision.risk.stopLoss > 0) {
      out.stopLoss = decision.risk.stopLoss
    }
    if (typeof decision.risk?.takeProfit === 'number' && Number.isFinite(decision.risk.takeProfit) && decision.risk.takeProfit > 0) {
      out.takeProfit = decision.risk.takeProfit
    }
    return out
  }

  buildPublishedRuntimeSignalOutcomeFromDecision(
    decision: StrategyDecisionV1,
    ctx: {
      exchange: string
      marketType: 'spot' | 'perp'
      symbol: string
      timeframe: string
      referencePrice?: number
    },
    config: StrategySignalsRuntimeConfig,
  ): PublishedRuntimeSignalOutcome {
    const adapted = this.runtimeSignalIntentAdapter.fromDecision(decision, ctx)
    if (adapted.kind === 'signal') {
      return {
        kind: 'signal',
        payload: {
          ...adapted.signal,
          rawResponse: this.truncateRawResponse(JSON.stringify(decision), config),
        },
      }
    }

    if (adapted.kind === 'noop') {
      return {
        kind: 'noop',
        reasonCode: 'SNAPSHOT_RUNTIME_EXECUTION_NO_SIGNAL',
        reason: adapted.reason,
      }
    }

    return adapted
  }

  buildSemanticRuntimeState(stateKeys: readonly string[]): SemanticRuntimeState {
    return buildSemanticRuntimeState(stateKeys)
  }

  buildPublishedStrategyContext(input: PublishedStrategyRuntimeContextInput): ReturnType<typeof buildStrategyContext> & {
    __compiledDecisionState?: { barIndex: number; lastTriggeredByProgram: Record<string, number> }
    semanticRuntimeState?: SemanticRuntimeState
    accountDrawdownPct?: number
  } {
    // Phase 5 S7 follow-up (#1058) — accountDrawdownPct 仅注入有限正数；NaN / Infinity / 负值
    // 一律视为缺失（evaluator 内 Number.isFinite 兜底，但此处也防止上游污染）
    const drawdownPctValue = input.accountDrawdownPct
    const drawdownPctSafe = typeof drawdownPctValue === 'number' && Number.isFinite(drawdownPctValue)
      ? drawdownPctValue
      : undefined

    return {
      ...buildStrategyContext({
        bars: input.bars,
        symbol: input.symbol,
        timeframe: input.timeframe,
        indicators: input.indicators,
        currentPrice: input.currentPrice,
        timestamp: input.timestamp,
        params: input.params ?? {},
      }),
      ...(input.compiledDecisionState ? { __compiledDecisionState: input.compiledDecisionState } : {}),
      ...(input.semanticRuntimeState ? { semanticRuntimeState: input.semanticRuntimeState } : {}),
      ...(input.position ? { position: input.position } : {}),
      ...(drawdownPctSafe !== undefined ? { accountDrawdownPct: drawdownPctSafe } : {}),
    }
  }

  buildManualFallbackSignal(
    referencePrice: number | undefined,
    strategyId: string,
    symbolCode: string,
  ): (AiSignalPayload & { rawResponse: string }) | null {
    if (!referencePrice || !Number.isFinite(referencePrice) || referencePrice <= 0) {
      this.logger.warn(
        `AI failed for strategy ${strategyId} on ${symbolCode}, but manual fallback is unavailable due to invalid reference price`,
      )
      return null
    }

    const entryPrice = Number(referencePrice.toFixed(8))
    const stopLoss = Number((referencePrice * 0.98).toFixed(8))
    const takeProfit = Number((referencePrice * 1.02).toFixed(8))
    const reasoning =
      'AI provider unavailable during manual trigger; generated deterministic fallback signal'

    return {
      signalType: 'ENTRY',
      direction: 'BUY',
      confidence: 1,
      entryPrice,
      stopLoss,
      takeProfit,
      reasoning,
      rawResponse: JSON.stringify({
        fallback: true,
        reason: 'AI_PROVIDER_UNAVAILABLE',
        signalType: 'ENTRY',
        direction: 'BUY',
        confidence: 1,
        entryPrice,
        stopLoss,
        takeProfit,
        reasoning,
      }),
    }
  }

  buildDecisionContext(
    indicators: Record<string, unknown>,
    markPrice: number | undefined,
  ): { currentQty?: number; equity?: number; markPrice?: number } {
    return {
      currentQty: this.readFiniteNumber(indicators.currentQty),
      equity: this.readFiniteNumber(indicators.equity),
      markPrice: this.readFiniteNumber(markPrice),
    }
  }

  requiresExplicitDecisionContext(decision: StrategyDecisionV1): boolean {
    return decision.action === 'ADJUST_POSITION'
  }

  hasExplicitDecisionContext(context: {
    currentQty?: number
    equity?: number
    markPrice?: number
  }): context is { currentQty: number; equity: number; markPrice: number } {
    return (
      typeof context.currentQty === 'number' &&
      Number.isFinite(context.currentQty) &&
      typeof context.equity === 'number' &&
      Number.isFinite(context.equity) &&
      typeof context.markPrice === 'number' &&
      Number.isFinite(context.markPrice)
    )
  }

  buildResolvedStrategyContextForMultiLeg(
    strategy: Pick<StrategyTemplate, 'promptTemplate'>,
    execution: Pick<StrategyExecutionConfig, 'timeframe'>,
    primaryLeg: Pick<StrategyLegDefinition, 'id' | 'symbol'>,
    multiLegData: Record<string, Record<string, LegTimeframeData>>,
    scriptContext: MultiLegStrategyContext,
  ): Record<string, unknown> {
    if (strategy.promptTemplate !== 'AI_CODEGEN_PUBLISHED_TEMPLATE') {
      return scriptContext as unknown as Record<string, unknown>
    }

    const primaryTimeframeData = multiLegData[primaryLeg.id]?.[execution.timeframe]
    if (!primaryTimeframeData?.bars?.length) {
      return scriptContext as unknown as Record<string, unknown>
    }

    return buildStrategyContext({
      bars: primaryTimeframeData.bars,
      symbol: primaryLeg.symbol,
      timeframe: execution.timeframe,
      indicators: primaryTimeframeData.indicators ?? {},
      currentPrice: primaryTimeframeData.currentPrice,
      timestamp: scriptContext.timestamp,
      params: scriptContext.params ?? {},
    })
  }

  logScriptDebug(
    strategy: Pick<StrategyTemplate, 'id' | 'script'>,
    config: StrategySignalsRuntimeConfig,
    result?: { success: boolean; value?: any; error?: any },
  ) {
    const maxScriptLength = config.debug?.maxScriptLength ?? 1000
    const maxValueLength = config.debug?.maxValueLength ?? 200

    this.logger.debug(
      `[Script Debug] Strategy ${strategy.id} script:\n` +
        `${ScriptDebugUtil.formatScriptForLog(strategy.script, maxScriptLength)}\n` +
        `[End Script]`,
    )

    if (result) {
      this.logger.debug(
        `[Script Debug] Strategy ${strategy.id} result: ` +
          `success=${result.success}, ` +
          `valueType=${typeof result.value}, ` +
          `value=${ScriptDebugUtil.formatValueForLog(result.value, maxValueLength)}`,
      )
    }
  }

  async resolveMultiLegScriptPromptData(
    strategy: Pick<StrategyTemplate, 'id' | 'script' | 'promptTemplate'>,
    execution: StrategyExecutionConfig,
    primaryLeg: StrategyLegDefinition,
    multiLegData: Record<string, Record<string, LegTimeframeData>>,
    scriptContext: MultiLegStrategyContext,
  ): Promise<
    | { ok: true; promptData: Record<string, any> }
    | { ok: false; reason: string }
  > {
    const compiledScript = compileStrategyScriptForVm(strategy.script ?? '')
    if (!compiledScript.ok) {
      this.logger.error(
        `TypeScript check failed for multi-leg strategy ${strategy.id}: ${compiledScript.error ?? 'Unknown error'}`,
      )
      return { ok: false, reason: 'TS_TYPECHECK_FAILED' }
    }

    const engine = createScriptEngine()
    let result = await engine.execute(compiledScript.executableCode, {
      context: scriptContext,
      timeout: MAX_SCRIPT_TIMEOUT_MS,
      allowAsync: false,
    })

    if (!result.success && result.error?.message) {
      const errorMsg = result.error.message
      const needsAsync =
        errorMsg.includes('Illegal return statement') ||
        errorMsg.includes('await is only valid in async functions') ||
        errorMsg.includes('Unexpected reserved word')

      if (needsAsync) {
        this.logger.warn(
          `Multi-leg strategy ${strategy.id} script needs async context (${errorMsg}), retrying with allowAsync`,
        )
        result = await engine.execute(compiledScript.executableCode, {
          context: scriptContext,
          timeout: MAX_SCRIPT_TIMEOUT_MS,
          allowAsync: true,
        })
      }
    }

    if (!result.success) {
      this.logger.error(
        `Multi-leg script execution failed for strategy ${strategy.id}: ${result.error?.message || 'Unknown error'}. ` +
          `Cannot generate signal without valid prompt data.`,
      )
      return { ok: false, reason: 'SCRIPT_EXECUTION_FAILED' }
    }

    const rawValue = result.value
    if (!rawValue || typeof rawValue !== 'object' || Array.isArray(rawValue)) {
      this.logger.error(
        `Multi-leg script for strategy ${strategy.id} returned non-object value (type: ${typeof rawValue}). ` +
          `Cannot generate signal without an object of prompt variables.\n` +
          `Actual value: ${ScriptDebugUtil.formatValueForLog(rawValue, 200)}`,
      )
      return { ok: false, reason: 'INVALID_SCRIPT_RESULT' }
    }

    const validation = validateScriptOutput(result.value, { allowEmpty: false })
    if (!validation.valid || !validation.value) {
      return {
        ok: false,
        reason: validation.code === 'EMPTY_OBJECT' ? 'EMPTY_SCRIPT_DATA' : 'INVALID_SCRIPT_RETURN_TYPE',
      }
    }

    const resolved = await resolveStrategyOutput(
      validation.value as Record<string, unknown>,
      this.buildResolvedStrategyContextForMultiLeg(
        strategy,
        execution,
        primaryLeg,
        multiLegData,
        scriptContext,
      ),
    )
    if (resolved.error) {
      this.logger.error(
        `Multi-leg script adapter resolution failed for strategy ${strategy.id}: ${resolved.error}`,
      )
      return { ok: false, reason: 'INVALID_SCRIPT_PROTOCOL' }
    }

    if (resolved.decision) {
      const adapterReferencePrice =
        multiLegData[primaryLeg.id]?.[execution.timeframe]?.currentPrice ?? 0
      const primaryIndicators = multiLegData[primaryLeg.id]?.[execution.timeframe]?.indicators ?? {}
      const decisionContext = this.buildDecisionContext(primaryIndicators, adapterReferencePrice)
      if (
        this.requiresExplicitDecisionContext(resolved.decision) &&
        !this.hasExplicitDecisionContext(decisionContext)
      ) {
        this.logger.error(
          `Multi-leg strategy ${strategy.id} returned ADJUST_POSITION without explicit context (currentQty/equity/markPrice). Rejecting decision.`,
        )
        return { ok: false, reason: 'ADJUST_POSITION_CONTEXT_REQUIRED' }
      }
      return {
        ok: true,
        promptData: this.isStrictPublishedCodegenTemplate(strategy)
          ? this.buildStrictPublishedPromptDataFromDecision(
              resolved.decision,
              adapterReferencePrice,
              decisionContext,
            )
          : (strategyDecisionToSignalPayload(
              resolved.decision,
              adapterReferencePrice,
              decisionContext,
            ) as Record<string, any>),
      }
    }

    return { ok: true, promptData: (resolved.passthrough ?? validation.value) as Record<string, any> }
  }

  truncateRawResponse(content: string | undefined, config: StrategySignalsRuntimeConfig): string {
    if (!content) return ''
    const limit = config.ai.maxRawResponseLength ?? DEFAULT_RAW_RESPONSE_LIMIT
    if (content.length <= limit) return content
    return `${content.slice(0, limit)}...`
  }

  asRecord(value: unknown): Record<string, unknown> {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      return {}
    }
    return value as Record<string, unknown>
  }

  readNumeric(value: unknown): number | undefined {
    const numeric = Number(value)
    return Number.isFinite(numeric) ? numeric : undefined
  }

  isStrictPublishedCodegenTemplate(
    strategy: Pick<StrategyTemplate, 'promptTemplate'>,
  ): boolean {
    return strategy.promptTemplate === 'AI_CODEGEN_PUBLISHED_TEMPLATE'
  }

  private readFiniteNumber(value: unknown): number | undefined {
    return typeof value === 'number' && Number.isFinite(value) ? value : undefined
  }

  buildEffectiveParams(
    strategy: Pick<StrategyTemplate, 'defaultParams' | 'promptTemplate'>,
    instance: Pick<StrategyInstance, 'params'>,
  ): Record<string, unknown> | null {
    const templateParams = strategy.defaultParams as Record<string, unknown> | null | undefined
    const instanceParams = instance.params as Record<string, unknown> | null | undefined

    const isObject = (value: unknown): value is Record<string, unknown> =>
      !!value && typeof value === 'object' && !Array.isArray(value)

    const base = isObject(templateParams) ? templateParams : undefined
    const override = isObject(instanceParams) ? instanceParams : undefined

    if (!base && !override) return null

    const baseHasPublishedSnapshotLock = base?.[PUBLISHED_SNAPSHOT_LOCKED_PARAMS_MARKER] === true
    const sanitizedBase = baseHasPublishedSnapshotLock
      ? Object.fromEntries(Object.entries(base ?? {}).filter(([key]) => key !== PUBLISHED_SNAPSHOT_LOCKED_PARAMS_MARKER))
      : base

    if (baseHasPublishedSnapshotLock) {
      return {
        ...(override ?? {}),
        ...(sanitizedBase ?? {}),
      }
    }

    return {
      ...(sanitizedBase ?? {}),
      ...(override ?? {}),
    }
  }
}
