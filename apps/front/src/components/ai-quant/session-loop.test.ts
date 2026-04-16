import { describe, expect, it } from '@jest/globals'
import {
  buildAutoAdvanceMessage,
  buildLockedChecklistFromGraph,
  buildLockedChecklistFromSpecDesc,
  isAssistantDraftLikeMessage,
  isShortConfirmationMessage,
  resolveChecklistPayload,
  shouldAutoAdvanceOnConfirmation,
} from './session-loop'

const baseParams = {
  symbol: 'BTCUSDT',
  buyWindowMin: 3,
  buyDropPct: 1,
  sellWindowMin: 15,
  sellRisePct: 2,
  positionPct: 10,
}

const graph = {
  version: 1,
  status: 'confirmed',
  trigger: [
    { id: 'entry_1', operator: '短均线上穿长均线' },
    { id: 'exit_1', operator: '短均线下穿长均线' },
  ],
  risk: [],
  execution: [],
} as any

describe('ai-quant session-loop', () => {
  it('locks checklist from graph when confirmGenerate=true even without sessionId', () => {
    const payload = resolveChecklistPayload({
      usePresetRules: false,
      confirmGenerate: true,
      message: '确认',
      sessionId: null,
      graph,
      params: baseParams,
    })

    expect(payload.entryRules).toEqual(['短均线上穿长均线'])
    expect(payload.exitRules).toEqual(['短均线下穿长均线'])
    expect(payload.symbols).toEqual(['BTCUSDT'])
    expect(payload.timeframes).toEqual(['3m', '15m'])
    expect(payload.riskRules).toEqual({ positionPct: 10, maxDrawdownPct: 20 })
  })

  it('uses preset checklist when preset mode is enabled', () => {
    const payload = resolveChecklistPayload({
      usePresetRules: true,
      confirmGenerate: true,
      message: '确认',
      sessionId: null,
      graph,
      params: baseParams,
    })

    expect(payload.entryRules).toEqual(['3m 内下跌 1%'])
    expect(payload.exitRules).toEqual(['15m 内上涨 2%'])
    expect(payload.symbols).toEqual(['BTCUSDT'])
  })

  it('falls back to graph checklist when message is strategy modification intent', () => {
    const payload = resolveChecklistPayload({
      usePresetRules: false,
      confirmGenerate: false,
      message: '把出场条件修改为更激进',
      sessionId: null,
      graph,
      params: baseParams,
    })

    expect(payload.entryRules).toEqual(['短均线上穿长均线'])
    expect(payload.exitRules).toEqual(['短均线下穿长均线'])
    expect(payload.symbols).toBeUndefined()
  })

  it('buildLockedChecklistFromGraph always includes symbol/timeframe/risk', () => {
    const payload = buildLockedChecklistFromGraph(null, baseParams)
    expect(payload.symbols).toEqual(['BTCUSDT'])
    expect(payload.timeframes).toEqual(['3m', '15m'])
    expect(payload.riskRules).toEqual({ positionPct: 10, maxDrawdownPct: 20 })
  })

  it('preserves directional bollinger entry semantics when rebuilding checklist from graph ids', () => {
    const directionalGraph = {
      version: 2,
      status: 'confirmed',
      trigger: [
        { id: 'trigger-entry-upper-1', operator: '价格向上突破布林带上轨' },
        { id: 'trigger-entry-lower-2', operator: '价格向下突破布林带下轨' },
        { id: 'trigger-exit-middle-1', operator: '价格回到布林带中轨（MA20）' },
      ],
      risk: [],
      actions: [],
      meta: {
        exchange: 'okx',
        symbol: 'BTCUSDT',
        timeframe: '15m',
        positionPct: 10,
      },
    } as any

    const payload = buildLockedChecklistFromGraph(directionalGraph, baseParams)
    expect(payload.entryRules).toEqual([
      '价格向上突破布林带上轨时做空',
      '价格向下突破布林带下轨时做多',
    ])
    expect(payload.exitRules).toEqual(['价格回到布林带中轨（MA20）'])
  })

  it('prefers specDesc canonical rules when confirmGenerate rebuilds checklist', () => {
    const payload = resolveChecklistPayload({
      usePresetRules: false,
      confirmGenerate: true,
      message: '确认',
      sessionId: 'session-1',
      graph,
      specDesc: {
        rules: [
          {
            phase: 'entry',
            condition: { key: 'bollinger.upper_break' },
          },
          {
            phase: 'entry',
            condition: { key: 'bollinger.lower_break' },
          },
          {
            phase: 'exit',
            condition: { key: 'bollinger.middle_revert' },
          },
        ],
        market: {
          symbols: ['BTCUSDT'],
          timeframes: ['15m'],
        },
        lockedParams: {
          exchange: 'okx',
          positionPct: 10,
          stopLossPct: 5,
        },
      },
      params: baseParams,
      paramValues: {
        exchange: 'okx',
        positionPct: 10,
        stopLossPct: 5,
      },
    } as any)

    expect(payload.entryRules).toEqual([
      '价格向上突破布林带上轨时做空',
      '价格向下突破布林带下轨时做多',
    ])
    expect(payload.exitRules).toEqual(['价格回到布林带中轨（MA20）'])
    expect(payload.symbols).toEqual(['BTCUSDT'])
    expect(payload.timeframes).toEqual(['15m'])
  })

  it('builds locked checklist directly from specDesc canonical rules', () => {
    const payload = buildLockedChecklistFromSpecDesc({
      rules: [
        { phase: 'entry', condition: { key: 'bollinger.upper_break' } },
        { phase: 'entry', condition: { key: 'bollinger.lower_break' } },
        { phase: 'exit', condition: { key: 'bollinger.middle_revert' } },
      ],
      market: {
        symbols: ['BTCUSDT'],
        timeframes: ['15m'],
      },
      lockedParams: {
        exchange: 'okx',
        positionPct: 10,
      },
    }, baseParams)

    expect(payload.entryRules).toEqual([
      '价格向上突破布林带上轨时做空',
      '价格向下突破布林带下轨时做多',
    ])
    expect(payload.exitRules).toEqual(['价格回到布林带中轨（MA20）'])
    expect(payload.symbols).toEqual(['BTCUSDT'])
    expect(payload.timeframes).toEqual(['15m'])
  })

  it('recognizes short confirmation messages', () => {
    expect(isShortConfirmationMessage('这样可以')).toBe(true)
    expect(isShortConfirmationMessage('可以了')).toBe(true)
    expect(isShortConfirmationMessage('就这样')).toBe(true)
    expect(isShortConfirmationMessage('继续')).toBe(true)
    expect(isShortConfirmationMessage('继续 ')).toBe(true)
    expect(isShortConfirmationMessage('确认正确')).toBe(true)
    expect(isShortConfirmationMessage('确认！')).toBe(true)
    expect(isShortConfirmationMessage('正确')).toBe(true)
    expect(isShortConfirmationMessage('可以。')).toBe(true)
    expect(isShortConfirmationMessage('按你说的来')).toBe(true)
    expect(isShortConfirmationMessage('这样可以吗')).toBe(false)
    expect(isShortConfirmationMessage('默认没问题吗')).toBe(false)
    expect(isShortConfirmationMessage('我想加一个止损')).toBe(false)
  })

  it('recognizes assistant draft-like messages', () => {
    expect(isAssistantDraftLikeMessage('策略逻辑如下：入场条件...出场条件...')).toBe(true)
    expect(isAssistantDraftLikeMessage('请确认逻辑图，确认后我再生成策略代码。')).toBe(true)
    expect(isAssistantDraftLikeMessage('你好')).toBe(false)
  })

  it('auto-advances on short confirmation with draft context', () => {
    expect(shouldAutoAdvanceOnConfirmation({
      userMessage: '可以',
      lastAssistantMessage: '策略逻辑如下：入场条件...',
      hasLogicGraph: false,
    })).toBe(true)
    expect(shouldAutoAdvanceOnConfirmation({
      userMessage: '可以',
      lastAssistantMessage: null,
      hasLogicGraph: true,
    })).toBe(true)
    expect(shouldAutoAdvanceOnConfirmation({
      userMessage: '继续',
      lastAssistantMessage: '你好',
      hasLogicGraph: false,
    })).toBe(false)
    expect(shouldAutoAdvanceOnConfirmation({
      userMessage: '确认正确',
      lastAssistantMessage: '请确认这版逻辑是否正确，我就可以据此生成主线流程图。',
      hasLogicGraph: false,
    })).toBe(true)
  })

  it('builds auto-advance message with assistant draft', () => {
    const prompt = buildAutoAdvanceMessage('策略逻辑如下：入场...')
    expect(prompt).toContain('不要继续追问')
    expect(prompt).toContain('上一条草案')
  })

  it('derives symbols/timeframes/riskRules from dynamic paramValues when provided', () => {
    const payload = resolveChecklistPayload({
      usePresetRules: false,
      confirmGenerate: true,
      message: '确认',
      sessionId: null,
      graph,
      params: baseParams,
      paramValues: {
        symbols: ['ETHUSDT'],
        timeframes: ['5m', '30m'],
        riskRules: {
          positionPct: 25,
          maxDrawdownPct: 12,
        },
      },
    } as any)

    expect(payload.symbols).toEqual(['ETHUSDT'])
    expect(payload.timeframes).toEqual(['5m', '30m'])
    expect(payload.riskRules).toEqual({ positionPct: 25, maxDrawdownPct: 12 })
  })

  it('keeps grid and marketType values in locked checklist when confirming generated logic', () => {
    const payload = resolveChecklistPayload({
      usePresetRules: false,
      confirmGenerate: true,
      message: '确认',
      sessionId: null,
      graph,
      params: baseParams,
      paramValues: {
        symbol: 'BTCUSDT',
        marketType: 'perp',
        gridLower: 60000,
        gridUpper: 80000,
        gridCount: 20,
        gridStepPct: 1.67,
        positionPct: 10,
      },
    } as any)

    expect(payload.symbols).toEqual(['BTCUSDT'])
    expect(payload.riskRules).toEqual({
      positionPct: 10,
      maxDrawdownPct: 20,
      marketType: 'perp',
      gridLower: 60000,
      gridUpper: 80000,
      gridCount: 20,
      gridStepPct: 1.67,
    })
  })

  it('returns explicit error object when schema required keys are missing in paramValues', () => {
    const payload = resolveChecklistPayload({
      usePresetRules: false,
      confirmGenerate: true,
      message: '确认',
      sessionId: null,
      graph,
      params: baseParams,
      paramSchema: {
        type: 'object',
        required: ['symbols', 'riskRules'],
      },
      paramValues: {
        symbols: ['BTCUSDT'],
      },
    } as any)

    expect(payload).toEqual({
      error: {
        code: 'MISSING_REQUIRED_PARAMS',
        missingKeys: ['riskRules'],
      },
    })
  })

  it('treats missing paramValues object as missing required keys', () => {
    const payload = resolveChecklistPayload({
      usePresetRules: false,
      confirmGenerate: true,
      message: '确认',
      sessionId: null,
      graph,
      params: baseParams,
      paramSchema: {
        type: 'object',
        required: ['symbols', 'timeframes'],
      },
      paramValues: undefined,
    } as any)

    expect(payload).toEqual({
      error: {
        code: 'MISSING_REQUIRED_PARAMS',
        missingKeys: ['symbols', 'timeframes'],
      },
    })
  })

  it('blocks generate path when schema validation has non-required errors', () => {
    const payload = resolveChecklistPayload({
      usePresetRules: false,
      confirmGenerate: true,
      message: '确认',
      sessionId: null,
      graph,
      params: baseParams,
      paramSchema: {
        type: 'object',
        required: ['exchange'],
        properties: {
          exchange: {
            type: 'string',
            enum: ['binance', 'okx'],
          },
          positionPct: {
            type: 'number',
            minimum: 1,
            maximum: 100,
          },
        },
      },
      paramValues: {
        exchange: 'kraken',
        positionPct: 120,
      },
    } as any)

    expect(payload).toEqual({
      error: {
        code: 'INVALID_PARAM_VALUES',
        missingKeys: [],
        fieldErrors: {
          exchange: 'enum',
          positionPct: 'maximum',
        },
      },
    })
  })

  it('does not block normal chat path when confirmGenerate=false and preset is disabled', () => {
    const payload = resolveChecklistPayload({
      usePresetRules: false,
      confirmGenerate: false,
      message: '请解释一下当前策略思路',
      sessionId: null,
      graph,
      params: baseParams,
      paramSchema: {
        type: 'object',
        required: ['riskRules'],
      },
      paramValues: {},
    } as any)

    expect(payload).toEqual({})
  })
})
