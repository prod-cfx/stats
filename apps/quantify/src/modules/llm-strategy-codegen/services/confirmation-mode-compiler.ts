import type { PredicateDef } from '../types/canonical-strategy-ir'

/**
 * Band-touch confirmation 模式（Issue #1460）
 *
 * 用于 bollinger.upper_break / bollinger.lower_break 等"价格突破/触及通道"
 * 类原子。三种语义：
 *   - undefined       —— 维持历史 breakout 形态（CROSS_OVER / CROSS_UNDER），消费 CLOSE
 *   - 'touch'         —— 盘中触及形态，消费 HIGH(upper) / LOW(lower)，GTE / LTE
 *   - 'close_confirm' —— 收盘确认形态，消费 CLOSE，GTE / LTE
 *
 * 当前仅 Bollinger 一族使用；未来 Keltner / Donchian 等同形态原子可直接复用本 helper。
 */

export type BandTouchDirection = 'upper' | 'lower'

export type BandTouchConfirmationMode = 'touch' | 'close_confirm' | undefined

/**
 * 描述 confirmationMode 在 paramSlot 形态下的可选值，供 atom-contract / 语义层
 * 引用时维持一致；本仓库当前没有 paramSlots 字段（ATOM_CONTRACT_REGISTRY 仅承载 enum），
 * 这里以纯常量形式公开供后续扩展引用。
 */
export const BAND_TOUCH_CONFIRMATION_MODE_SLOT = Object.freeze({
  key: 'confirmationMode',
  values: Object.freeze(['touch', 'close_confirm'] as const),
  defaultMode: undefined,
})

/**
 * 从原子参数中解析 confirmationMode，做"防御性宽松"——未知值视为 undefined，
 * 即维持历史 breakout 默认行为，绝不抛错破坏 userspace。
 */
export function readBandTouchConfirmationMode(
  params: Record<string, unknown> | undefined,
): BandTouchConfirmationMode {
  const raw = params?.confirmationMode
  if (raw === 'touch' || raw === 'close_confirm') return raw
  return undefined
}

export interface CompileBandTouchPredicateInput {
  direction: BandTouchDirection
  confirmationMode: BandTouchConfirmationMode
  bandRef: string
  priceRefs: {
    close: string
    high: string
    low: string
  }
  defaultOp?: 'CROSS_OVER' | 'CROSS_UNDER' | 'GTE' | 'LTE' | 'GT' | 'LT' | 'EQ'
  predicateMap: Map<string, PredicateDef>
  seed: string
  upsertPredicate: (
    predicateMap: Map<string, PredicateDef>,
    baseId: string,
    kind: PredicateDef['kind'],
    args: string[],
    params?: PredicateDef['params'],
  ) => string
}

interface ResolvedBandTouch {
  kind: PredicateDef['kind']
  priceRef: string
  params?: PredicateDef['params']
}

/**
 * 根据 direction × confirmationMode 决定本次 BOLL 触及判定使用的：
 *   - PredicateDef.kind  （CROSS_OVER / CROSS_UNDER / GTE / LTE / compare）
 *   - 左操作数 priceRef  （close / high / low）
 *
 * 注意：当 confirmationMode === undefined 但调用方提供了显式 defaultOp（如
 * `atom.op === 'GTE'`），优先使用 defaultOp，等价于 close_confirm 语义。
 * 这保留了既有用例显式传 `op: 'GTE'` 走 close 比较的能力。
 */
function resolveBandTouchPredicate(
  direction: BandTouchDirection,
  confirmationMode: BandTouchConfirmationMode,
  priceRefs: CompileBandTouchPredicateInput['priceRefs'],
  defaultOp: CompileBandTouchPredicateInput['defaultOp'],
): ResolvedBandTouch {
  if (confirmationMode === 'touch') {
    return {
      kind: direction === 'upper' ? 'GTE' : 'LTE',
      priceRef: direction === 'upper' ? priceRefs.high : priceRefs.low,
    }
  }

  if (confirmationMode === 'close_confirm') {
    return {
      kind: direction === 'upper' ? 'GTE' : 'LTE',
      priceRef: priceRefs.close,
    }
  }

  // undefined：尊重调用方显式 defaultOp；否则回到 breakout 形态。
  if (defaultOp === 'GTE' || defaultOp === 'LTE') {
    return { kind: defaultOp, priceRef: priceRefs.close }
  }
  if (defaultOp === 'GT' || defaultOp === 'LT' || defaultOp === 'EQ') {
    // 兜底：以 compare 携带原始 op 不破坏既有 catalog。
    return {
      kind: 'compare',
      priceRef: priceRefs.close,
      params: { op: defaultOp },
    }
  }
  return {
    kind: direction === 'upper' ? 'CROSS_OVER' : 'CROSS_UNDER',
    priceRef: priceRefs.close,
  }
}

export function compileBandTouchPredicate(input: CompileBandTouchPredicateInput): string {
  const { direction, confirmationMode, bandRef, priceRefs, defaultOp, predicateMap, seed, upsertPredicate } = input
  const resolved = resolveBandTouchPredicate(direction, confirmationMode, priceRefs, defaultOp)
  return upsertPredicate(
    predicateMap,
    seed,
    resolved.kind,
    [resolved.priceRef, bandRef],
    resolved.params,
  )
}
