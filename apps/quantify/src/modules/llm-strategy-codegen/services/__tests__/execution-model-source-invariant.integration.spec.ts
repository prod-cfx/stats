import type { SemanticContextSlotState, SemanticSlotState } from '../../types/semantic-state'
import { ErrorCode } from '@ai/shared'
import { buildSymbol } from '../execution-model-source-invariant'
import { ExecutionModelSymbolMalformedException } from '../../exceptions/execution-model-symbol-malformed.exception'

/**
 * Issue #1459 闸 4 集成重放：cmpakxase060bqnqsdebk3l48 会话 ExecutionModel 构造期
 *   双 USDT 拼接（BTCUSDTUSDT）必须被 buildSymbol 当场 reject，不再绕过下游
 *   normalize 写入 lockedParams.symbol / publishParams.symbol。
 *
 * 这条 invariant 模拟闸 1 / 闸 2 不阻断的前提下（contextSlots 全部 locked），
 * buildSymbol 形态正则在 stage symbol 构造路径单点把守。
 */

function buildSlot(
  slotKey: keyof SemanticContextSlotState,
  value: string,
  source: 'user_explicit' | 'inferred' = 'user_explicit',
): SemanticSlotState {
  return {
    slotKey,
    fieldPath: `contextSlots.${slotKey}`,
    value,
    status: 'locked',
    priority: 'context',
    questionHint: '',
    affectsExecution: true,
    evidence: { text: 'cmpakxase replay', source },
  }
}

describe('executionModelSourceInvariant 集成 (#1459 闸 4) — cmpakxase 重放', () => {
  it('contextSlots.symbol=BTCUSDTUSDT 时 buildSymbol 抛 EXECUTION_MODEL_SYMBOL_MALFORMED', () => {
    const contextSlots: SemanticContextSlotState = {
      exchange: buildSlot('exchange', 'okx'),
      symbol: buildSlot('symbol', 'BTCUSDTUSDT'),
      marketType: buildSlot('marketType', 'perp'),
      timeframe: buildSlot('timeframe', '15m'),
    }

    let captured: ExecutionModelSymbolMalformedException | null = null
    try {
      buildSymbol({ contextSlots })
    } catch (error) {
      captured = error as ExecutionModelSymbolMalformedException
    }
    expect(captured).toBeInstanceOf(ExecutionModelSymbolMalformedException)
    expect(captured?.code).toBe(ErrorCode.EXECUTION_MODEL_SYMBOL_MALFORMED)
    expect(captured?.args).toEqual({ symbol: 'BTCUSDTUSDT', reason: 'duplicated_quote' })
  })

  it('contextSlots.symbol=ETHUSDTUSDT 同样 reject', () => {
    const contextSlots: SemanticContextSlotState = {
      exchange: buildSlot('exchange', 'binance'),
      symbol: buildSlot('symbol', 'ETHUSDTUSDT'),
      marketType: buildSlot('marketType', 'spot'),
      timeframe: buildSlot('timeframe', '1h'),
    }
    expect(() => buildSymbol({ contextSlots })).toThrow(ExecutionModelSymbolMalformedException)
  })

  it('contextSlots.symbol=BTCUSDT 合法路径放行', () => {
    const contextSlots: SemanticContextSlotState = {
      exchange: buildSlot('exchange', 'okx'),
      symbol: buildSlot('symbol', 'BTCUSDT'),
      marketType: buildSlot('marketType', 'perp'),
      timeframe: buildSlot('timeframe', '15m'),
    }
    expect(buildSymbol({ contextSlots })).toBe('BTCUSDT')
  })
})
