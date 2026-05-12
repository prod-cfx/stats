/**
 * #1230 — LLM Direct 路径 sizing 强制注入测试。
 *
 * 覆盖 `generateSignalWithAi` 中当策略层 params 指定 positionSizeQuote/positionSizeRatio 时：
 * 1. 策略层指定 100 USDT，LLM 输出 100 → pass（返回信号）
 * 2. 策略层指定 100 USDT，LLM 输出 50 → strict 模式 reject（返回 null）
 * 3. 策略层指定 100 USDT，LLM 输出 50 → 非 strict 模式沿用 LLM 50（返回信号）
 * 4. 策略层未指定 → 沿用原逻辑（LLM 自由指定 sizing，正常返回）
 */
import { Logger } from '@nestjs/common'
import type { AiService } from '@/modules/ai/ai.service'
import { DEFAULT_STRATEGY_SIGNALS_CONFIG, type StrategySignalsRuntimeConfig } from '../../types/strategy-signals-config.type'
import { SignalGenerationDecisionStage } from '../signal-generation-decision.stage'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeAiService(responseJson: object): AiService {
  return {
    chat: jest.fn().mockResolvedValue({ content: JSON.stringify(responseJson) }),
  } as unknown as AiService
}

const baseStrategy = {
  id: 'strat-1',
  name: 'Test Strategy',
  description: null,
  promptTemplate: null, // non-codegen → LLM Direct path
  script: null,
  defaultParams: null,
}

const baseInstance = {
  id: 'inst-1',
  llmModel: 'gpt-4o',
  params: null,
}

function makeConfig(requireExplicitSizing: boolean): StrategySignalsRuntimeConfig {
  return {
    ...DEFAULT_STRATEGY_SIGNALS_CONFIG,
    execution: {
      ...DEFAULT_STRATEGY_SIGNALS_CONFIG.execution,
      requireExplicitSizing,
    },
  }
}

const baseSymbol = { code: 'BTCUSDT' }
const baseTimeframe = '1h' as const
const baseIndicators = {}
const referencePrice = 50_000

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('SignalGenerationDecisionStage#generateSignalWithAi — LLM Direct sizing injection (#1230)', () => {
  it('案例1: 策略层指定 positionSizeQuote=100，LLM 输出 100 → 返回信号，positionSizeQuote=100', async () => {
    const llmResponse = {
      direction: 'BUY',
      signalType: 'ENTRY',
      confidence: 80,
      entryPrice: 50_000,
      stopLoss: 48_000,
      takeProfit: 53_000,
      positionSizeQuote: 100,
      reasoning: 'test',
    }
    const aiService = makeAiService(llmResponse)
    const stage = new SignalGenerationDecisionStage(aiService, new Logger('spec'))

    const result = await stage.generateSignalWithAi(
      { ...baseInstance, params: { positionSizeQuote: 100 } },
      baseStrategy,
      baseSymbol,
      baseTimeframe,
      baseIndicators,
      makeConfig(true),
      referencePrice,
    )

    expect(result).not.toBeNull()
    expect(result?.positionSizeQuote).toBe(100)
    expect(aiService.chat).toHaveBeenCalledTimes(1)
    const callArgs = (aiService.chat as jest.Mock).mock.calls[0][0]
    expect(callArgs.messages[0].content).toContain('positionSizeQuote=100')
    expect(callArgs.messages[1].content).toContain('100 USDT per trade')
  })

  it('案例2: 策略层指定 positionSizeQuote=100，LLM 输出 50 → strict 模式拒单（返回 null）', async () => {
    const llmResponse = {
      direction: 'BUY',
      signalType: 'ENTRY',
      confidence: 80,
      entryPrice: 50_000,
      stopLoss: 48_000,
      takeProfit: 53_000,
      positionSizeQuote: 50,
      reasoning: 'test',
    }
    const aiService = makeAiService(llmResponse)
    const stage = new SignalGenerationDecisionStage(aiService, new Logger('spec'))

    const result = await stage.generateSignalWithAi(
      { ...baseInstance, params: { positionSizeQuote: 100 } },
      baseStrategy,
      baseSymbol,
      baseTimeframe,
      baseIndicators,
      makeConfig(true), // strict=true
      referencePrice,
    )

    expect(result).toBeNull()
    // maxAttempts=2，两次都被拒单
    expect(aiService.chat).toHaveBeenCalledTimes(2)
  })

  it('案例3: 策略层指定 positionSizeQuote=100，LLM 输出 50 → 非 strict 模式用 strategy.params 覆盖 LLM', async () => {
    // #1232 Round 1 M1：mismatch 不应静默放行 LLM 输出。非 strict 模式下：
    // 信号仍返回（不破老策略），但 sizing 被强制为 strategy.params 的 100，
    // 防止 LLM 自由发挥导致用户配置静默失效。
    const llmResponse = {
      direction: 'BUY',
      signalType: 'ENTRY',
      confidence: 80,
      entryPrice: 50_000,
      stopLoss: 48_000,
      takeProfit: 53_000,
      positionSizeQuote: 50,
      reasoning: 'test',
    }
    const aiService = makeAiService(llmResponse)
    const stage = new SignalGenerationDecisionStage(aiService, new Logger('spec'))

    const result = await stage.generateSignalWithAi(
      { ...baseInstance, params: { positionSizeQuote: 100 } },
      baseStrategy,
      baseSymbol,
      baseTimeframe,
      baseIndicators,
      makeConfig(false), // strict=false
      referencePrice,
    )

    expect(result).not.toBeNull()
    // 非 strict + mismatch：用 strategy.params 覆盖 LLM 输出
    expect(result?.positionSizeQuote).toBe(100)
    expect(result?.positionSizeRatio).toBeUndefined()
    expect(aiService.chat).toHaveBeenCalledTimes(1)
  })

  it('案例4: 策略层未指定 sizing → 沿用原逻辑，LLM 自由指定，正常返回', async () => {
    const llmResponse = {
      direction: 'BUY',
      signalType: 'ENTRY',
      confidence: 75,
      entryPrice: 50_000,
      stopLoss: 48_000,
      takeProfit: 53_000,
      positionSizeRatio: 0.1,
      reasoning: 'free sizing',
    }
    const aiService = makeAiService(llmResponse)
    const stage = new SignalGenerationDecisionStage(aiService, new Logger('spec'))

    const result = await stage.generateSignalWithAi(
      { ...baseInstance, params: null }, // 无 sizing 约束
      baseStrategy,
      baseSymbol,
      baseTimeframe,
      baseIndicators,
      makeConfig(true), // strict 配置对无约束策略无影响
      referencePrice,
    )

    expect(result).not.toBeNull()
    expect(result?.positionSizeRatio).toBeCloseTo(0.1)
    // prompt 不含硬约束字样
    const callArgs = (aiService.chat as jest.Mock).mock.calls[0][0]
    expect(callArgs.messages[0].content).toContain('system defaults will be used')
    expect(callArgs.messages[0].content).not.toContain('You MUST use exactly')
  })
})
