import type { SemanticContextSlotState, SemanticSlotState } from '../../types/semantic-state'
import { ErrorCode } from '@ai/shared'
import {
  EXECUTION_MODEL_SOURCED_FIELDS,
  assertExecutionModelFieldsSourced,
  assertSymbolWellFormed,
  buildSymbol,
} from '../execution-model-source-invariant'
import { ExecutionModelFieldUnsourcedException } from '../../exceptions/execution-model-field-unsourced.exception'
import { ExecutionModelSymbolMalformedException } from '../../exceptions/execution-model-symbol-malformed.exception'

function buildSlot(value: string, source: 'user_explicit' | 'inferred' | 'derived'): SemanticSlotState {
  return {
    slotKey: 'context',
    fieldPath: 'symbol',
    value,
    status: 'locked',
    priority: 'core',
    questionHint: '',
    affectsExecution: true,
    evidence: { text: '', source },
  }
}

function buildContextSlots(overrides: Partial<SemanticContextSlotState>): SemanticContextSlotState {
  return {
    exchange: buildSlot('okx', 'user_explicit'),
    symbol: buildSlot('BTCUSDT', 'user_explicit'),
    marketType: buildSlot('perp', 'user_explicit'),
    timeframe: buildSlot('15m', 'user_explicit'),
    ...overrides,
  }
}

describe('executionModelSourceInvariant (#1459 闸 4)', () => {
  describe('assertExecutionModelFieldsSourced', () => {
    it('全部字段 source=user_explicit 时返回 value 映射', () => {
      const result = assertExecutionModelFieldsSourced(buildContextSlots({}))
      expect(result).toEqual({
        symbol: 'BTCUSDT',
        venue: 'okx',
        primaryTimeframe: '15m',
        instrumentType: 'perp',
      })
    })

    it.each([
      ['symbol', 'symbol'],
      ['exchange', 'venue'],
      ['timeframe', 'primaryTimeframe'],
      ['marketType', 'instrumentType'],
    ])('缺 contextSlots.%s 时抛 EXECUTION_MODEL_FIELD_UNSOURCED (field=%s, reason=missing)', (slotKey, executionField) => {
      const ctx = buildContextSlots({ [slotKey as keyof SemanticContextSlotState]: null })
      let captured: ExecutionModelFieldUnsourcedException | null = null
      try {
        assertExecutionModelFieldsSourced(ctx)
      } catch (error) {
        captured = error as ExecutionModelFieldUnsourcedException
      }
      expect(captured).toBeInstanceOf(ExecutionModelFieldUnsourcedException)
      expect(captured?.code).toBe(ErrorCode.EXECUTION_MODEL_FIELD_UNSOURCED)
      expect(captured?.args).toEqual({ field: executionField, reason: 'missing', actualSource: null })
    })

    it('source=inferred 时抛 reason=inferred', () => {
      const ctx = buildContextSlots({ exchange: buildSlot('okx', 'inferred') })
      let captured: ExecutionModelFieldUnsourcedException | null = null
      try {
        assertExecutionModelFieldsSourced(ctx)
      } catch (error) {
        captured = error as ExecutionModelFieldUnsourcedException
      }
      expect(captured).toBeInstanceOf(ExecutionModelFieldUnsourcedException)
      expect(captured?.args).toEqual({ field: 'venue', reason: 'inferred', actualSource: 'inferred' })
    })

    it('status !== locked 视为 missing', () => {
      const slot = buildSlot('BTCUSDT', 'user_explicit')
      slot.status = 'open'
      const ctx = buildContextSlots({ symbol: slot })
      expect(() => assertExecutionModelFieldsSourced(ctx)).toThrow(ExecutionModelFieldUnsourcedException)
    })

    it('evidence 缺失视为 inferred（fail-closed）', () => {
      const slot: SemanticSlotState = {
        slotKey: 'context',
        fieldPath: 'symbol',
        value: 'BTCUSDT',
        status: 'locked',
        priority: 'core',
        questionHint: '',
        affectsExecution: true,
      }
      const ctx = buildContextSlots({ symbol: slot })
      let captured: ExecutionModelFieldUnsourcedException | null = null
      try {
        assertExecutionModelFieldsSourced(ctx)
      } catch (error) {
        captured = error as ExecutionModelFieldUnsourcedException
      }
      expect(captured?.args).toEqual({ field: 'symbol', reason: 'inferred', actualSource: null })
    })

    it('白名单覆盖 symbol / venue / primaryTimeframe / instrumentType 四字段', () => {
      const fields = EXECUTION_MODEL_SOURCED_FIELDS.map(entry => entry.executionModelField)
      expect(fields.sort()).toEqual(['instrumentType', 'primaryTimeframe', 'symbol', 'venue'])
    })
  })

  describe('assertSymbolWellFormed', () => {
    it('BTCUSDT / ETHUSDT 通过', () => {
      expect(() => assertSymbolWellFormed('BTCUSDT')).not.toThrow()
      expect(() => assertSymbolWellFormed('ETHUSDT')).not.toThrow()
    })

    it('BTC-USDT-SWAP 通过（OKX perp 标识符）', () => {
      expect(() => assertSymbolWellFormed('BTC-USDT-SWAP')).not.toThrow()
    })

    it('剥离 :SPOT / :PERP venue 后缀', () => {
      expect(() => assertSymbolWellFormed('BTCUSDT:PERP')).not.toThrow()
      expect(() => assertSymbolWellFormed('BTCUSDT:SPOT')).not.toThrow()
    })

    it('双 USDT 拼接被识别为 duplicated_quote', () => {
      expect(() => assertSymbolWellFormed('BTCUSDTUSDT')).toThrow(ExecutionModelSymbolMalformedException)
      try {
        assertSymbolWellFormed('BTCUSDTUSDT')
      } catch (error) {
        expect((error as ExecutionModelSymbolMalformedException).args).toEqual({
          symbol: 'BTCUSDTUSDT',
          reason: 'duplicated_quote',
        })
      }
    })

    it('ETHUSDTUSDT 双 quote 拒绝', () => {
      expect(() => assertSymbolWellFormed('ETHUSDTUSDT')).toThrow(ExecutionModelSymbolMalformedException)
    })

    it('FOOUSDUSDT 双 quote（USD + USDT）拒绝', () => {
      expect(() => assertSymbolWellFormed('FOOUSDUSDT')).toThrow(ExecutionModelSymbolMalformedException)
    })

    it('空串拒绝', () => {
      expect(() => assertSymbolWellFormed('')).toThrow(ExecutionModelSymbolMalformedException)
      expect(() => assertSymbolWellFormed('   ')).toThrow(ExecutionModelSymbolMalformedException)
    })

    it('超长（>20）拒绝', () => {
      expect(() => assertSymbolWellFormed('A'.repeat(21))).toThrow(ExecutionModelSymbolMalformedException)
    })

    it('非法字符拒绝', () => {
      expect(() => assertSymbolWellFormed('BTC/USDT')).toThrow(ExecutionModelSymbolMalformedException)
      expect(() => assertSymbolWellFormed('BTC USDT')).toThrow(ExecutionModelSymbolMalformedException)
      expect(() => assertSymbolWellFormed('BTC.USDT')).toThrow(ExecutionModelSymbolMalformedException)
    })
  })

  describe('buildSymbol（单一入口）', () => {
    it('contextSlots.symbol user_explicit 时返回标准化 symbol', () => {
      const symbol = buildSymbol({ contextSlots: buildContextSlots({}) })
      expect(symbol).toBe('BTCUSDT')
    })

    it('小写输入被标准化为大写', () => {
      const ctx = buildContextSlots({ symbol: buildSlot('btcusdt', 'user_explicit') })
      expect(buildSymbol({ contextSlots: ctx })).toBe('BTCUSDT')
    })

    it('contextSlots.symbol 为 null 抛 UNSOURCED', () => {
      const ctx = buildContextSlots({ symbol: null })
      expect(() => buildSymbol({ contextSlots: ctx })).toThrow(ExecutionModelFieldUnsourcedException)
    })

    it('contextSlots.symbol source=inferred 默认放行（兼容 fixture），enforceUserExplicit=true 拒绝', () => {
      const ctx = buildContextSlots({ symbol: buildSlot('BTCUSDT', 'inferred') })
      expect(buildSymbol({ contextSlots: ctx })).toBe('BTCUSDT')
      expect(() => buildSymbol({ contextSlots: ctx, enforceUserExplicit: true })).toThrow(ExecutionModelFieldUnsourcedException)
    })

    it('contextSlots.symbol 缺 evidence 时默认放行；enforceUserExplicit=true 视为 inferred 拒绝', () => {
      const slotNoEvidence: SemanticSlotState = {
        slotKey: 'symbol',
        fieldPath: 'contextSlots.symbol',
        value: 'BTCUSDT',
        status: 'locked',
        priority: 'core',
        questionHint: '',
        affectsExecution: true,
      }
      const ctx = buildContextSlots({ symbol: slotNoEvidence })
      expect(buildSymbol({ contextSlots: ctx })).toBe('BTCUSDT')
      expect(() => buildSymbol({ contextSlots: ctx, enforceUserExplicit: true })).toThrow(ExecutionModelFieldUnsourcedException)
    })

    it('contextSlots.symbol 为 BTCUSDTUSDT user_explicit 仍被形态正则拒绝（始终强制）', () => {
      const ctx = buildContextSlots({ symbol: buildSlot('BTCUSDTUSDT', 'user_explicit') })
      expect(() => buildSymbol({ contextSlots: ctx })).toThrow(ExecutionModelSymbolMalformedException)
    })

    it('cmpakxase 场景重放：contextSlots.symbol=BTCUSDTUSDT → 形态正则 reject (闸内不绕过 fixture)', () => {
      // 模拟 Issue #1455 实测会话 cmpakxase060bqnqsdebk3l48 的 contextSlots：
      // 上游误拼出 BTCUSDTUSDT。buildSymbol 是 IR build 的单一 symbol 入口，必须当场 reject。
      const ctx = buildContextSlots({ symbol: buildSlot('BTCUSDTUSDT', 'user_explicit') })
      let captured: ExecutionModelSymbolMalformedException | null = null
      try {
        buildSymbol({ contextSlots: ctx })
      } catch (error) {
        captured = error as ExecutionModelSymbolMalformedException
      }
      expect(captured).toBeInstanceOf(ExecutionModelSymbolMalformedException)
      expect(captured?.code).toBe(ErrorCode.EXECUTION_MODEL_SYMBOL_MALFORMED)
      expect(captured?.args.reason).toBe('duplicated_quote')
    })
  })
})
