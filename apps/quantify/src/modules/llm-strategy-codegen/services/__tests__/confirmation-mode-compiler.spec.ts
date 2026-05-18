import type { PredicateDef } from '../../types/canonical-strategy-ir'
import {
  BAND_TOUCH_CONFIRMATION_MODE_SLOT,
  compileBandTouchPredicate,
  readBandTouchConfirmationMode,
} from '../confirmation-mode-compiler'

function makeUpsert(predicateMap: Map<string, PredicateDef>) {
  return (
    map: Map<string, PredicateDef>,
    baseId: string,
    kind: PredicateDef['kind'],
    args: string[],
    params?: PredicateDef['params'],
  ): string => {
    const id = baseId.replace(/\W+/g, '_')
    map.set(id, { id, kind, args, ...(params ? { params } : {}) })
    return id
  }
}

const PRICE_REFS = {
  close: 'close_15m',
  high: 'high_15m',
  low: 'low_15m',
} as const

describe('confirmation-mode-compiler', () => {
  describe('BAND_TOUCH_CONFIRMATION_MODE_SLOT', () => {
    it('暴露 confirmationMode 的合法枚举值，供未来同形态原子复用', () => {
      expect(BAND_TOUCH_CONFIRMATION_MODE_SLOT.key).toBe('confirmationMode')
      expect([...BAND_TOUCH_CONFIRMATION_MODE_SLOT.values]).toEqual(['touch', 'close_confirm'])
      expect(BAND_TOUCH_CONFIRMATION_MODE_SLOT.defaultMode).toBeUndefined()
    })
  })

  describe('readBandTouchConfirmationMode', () => {
    it('识别 touch / close_confirm，其它一律视为 undefined', () => {
      expect(readBandTouchConfirmationMode({ confirmationMode: 'touch' })).toBe('touch')
      expect(readBandTouchConfirmationMode({ confirmationMode: 'close_confirm' })).toBe('close_confirm')
      expect(readBandTouchConfirmationMode({ confirmationMode: 'breakout' as unknown as string })).toBeUndefined()
      expect(readBandTouchConfirmationMode({})).toBeUndefined()
      expect(readBandTouchConfirmationMode(undefined)).toBeUndefined()
    })
  })

  describe('compileBandTouchPredicate', () => {
    it('upper × touch → GTE(HIGH, band)', () => {
      const predicateMap = new Map<string, PredicateDef>()
      const id = compileBandTouchPredicate({
        direction: 'upper',
        confirmationMode: 'touch',
        bandRef: 'upper_band',
        priceRefs: PRICE_REFS,
        predicateMap,
        seed: 'rule_upper',
        upsertPredicate: makeUpsert(predicateMap),
      })
      expect(predicateMap.get(id)).toEqual({
        id,
        kind: 'GTE',
        args: ['high_15m', 'upper_band'],
      })
    })

    it('lower × touch → LTE(LOW, band)', () => {
      const predicateMap = new Map<string, PredicateDef>()
      const id = compileBandTouchPredicate({
        direction: 'lower',
        confirmationMode: 'touch',
        bandRef: 'lower_band',
        priceRefs: PRICE_REFS,
        predicateMap,
        seed: 'rule_lower',
        upsertPredicate: makeUpsert(predicateMap),
      })
      expect(predicateMap.get(id)).toEqual({
        id,
        kind: 'LTE',
        args: ['low_15m', 'lower_band'],
      })
    })

    it('upper × close_confirm → GTE(CLOSE, band)', () => {
      const predicateMap = new Map<string, PredicateDef>()
      const id = compileBandTouchPredicate({
        direction: 'upper',
        confirmationMode: 'close_confirm',
        bandRef: 'upper_band',
        priceRefs: PRICE_REFS,
        predicateMap,
        seed: 'rule_upper',
        upsertPredicate: makeUpsert(predicateMap),
      })
      expect(predicateMap.get(id)).toEqual({
        id,
        kind: 'GTE',
        args: ['close_15m', 'upper_band'],
      })
    })

    it('lower × close_confirm → LTE(CLOSE, band)', () => {
      const predicateMap = new Map<string, PredicateDef>()
      const id = compileBandTouchPredicate({
        direction: 'lower',
        confirmationMode: 'close_confirm',
        bandRef: 'lower_band',
        priceRefs: PRICE_REFS,
        predicateMap,
        seed: 'rule_lower',
        upsertPredicate: makeUpsert(predicateMap),
      })
      expect(predicateMap.get(id)).toEqual({
        id,
        kind: 'LTE',
        args: ['close_15m', 'lower_band'],
      })
    })

    it('upper × undefined（无 defaultOp）→ 默认 CROSS_OVER(CLOSE, band)', () => {
      const predicateMap = new Map<string, PredicateDef>()
      const id = compileBandTouchPredicate({
        direction: 'upper',
        confirmationMode: undefined,
        bandRef: 'upper_band',
        priceRefs: PRICE_REFS,
        predicateMap,
        seed: 'rule_upper',
        upsertPredicate: makeUpsert(predicateMap),
      })
      expect(predicateMap.get(id)).toEqual({
        id,
        kind: 'CROSS_OVER',
        args: ['close_15m', 'upper_band'],
      })
    })

    it('lower × undefined（无 defaultOp）→ 默认 CROSS_UNDER(CLOSE, band)', () => {
      const predicateMap = new Map<string, PredicateDef>()
      const id = compileBandTouchPredicate({
        direction: 'lower',
        confirmationMode: undefined,
        bandRef: 'lower_band',
        priceRefs: PRICE_REFS,
        predicateMap,
        seed: 'rule_lower',
        upsertPredicate: makeUpsert(predicateMap),
      })
      expect(predicateMap.get(id)).toEqual({
        id,
        kind: 'CROSS_UNDER',
        args: ['close_15m', 'lower_band'],
      })
    })

    it('undefined + defaultOp=GTE → GTE(CLOSE, band)（保留原 op 显式优先）', () => {
      const predicateMap = new Map<string, PredicateDef>()
      const id = compileBandTouchPredicate({
        direction: 'upper',
        confirmationMode: undefined,
        bandRef: 'upper_band',
        priceRefs: PRICE_REFS,
        defaultOp: 'GTE',
        predicateMap,
        seed: 'rule_upper',
        upsertPredicate: makeUpsert(predicateMap),
      })
      expect(predicateMap.get(id)).toEqual({
        id,
        kind: 'GTE',
        args: ['close_15m', 'upper_band'],
      })
    })

    it('undefined + defaultOp=LT → fallback 到 compare 携带原 op，不破坏 catalog', () => {
      const predicateMap = new Map<string, PredicateDef>()
      const id = compileBandTouchPredicate({
        direction: 'lower',
        confirmationMode: undefined,
        bandRef: 'lower_band',
        priceRefs: PRICE_REFS,
        defaultOp: 'LT',
        predicateMap,
        seed: 'rule_lower',
        upsertPredicate: makeUpsert(predicateMap),
      })
      expect(predicateMap.get(id)).toEqual({
        id,
        kind: 'compare',
        args: ['close_15m', 'lower_band'],
        params: { op: 'LT' },
      })
    })
  })
})
