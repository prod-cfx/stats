/**
 * Shared display tokens — 跨 atom 共享 enum 的渲染数据（Issue #1279 PR3c）
 *
 * ## 范围
 * 仅放被 ≥2 个 atom 复用、且语义在所有调用 atom 都一致的 enum 显示文本。
 * 单一 atom 私有的 enum（如 `pattern.candle.*` 只用于 `price.candle_pattern`）
 * 直接 inline 进该 atom 的 `display.paramRenderers` —— 不在本表。
 *
 * ## 红线（critic Hard Gate）
 *
 *   1. **纯数据 `export const` 常量**：禁止任何函数包装 / NestJS DI / Service 注入。
 *      该文件被 atom contract `display.paramRenderers` 通过 `SHARED_ENUM_DISPLAY.<key>[value][locale]`
 *      直接索引消费，不允许提供 `getToken(key)` / `renderToken(key, vars)` 形态的运行期查表 API
 *      —— 否则等于把 `display-token-table.ts` 改名搬过来。
 *
 *   2. **位置固定**：放在 `atom-contracts/`（与 `atom-contract-registry.ts` 同目录），
 *      表示其语义属于 atom contract 数据层。禁止放到 nl-gateway / services / utils 等其它目录，
 *      也禁止挪到独立 NestJS module。
 *
 *   3. **使用方式**：renderer 必须以 `SHARED_ENUM_DISPLAY.boundaryRole.upper.zh` 形式直接读取
 *      `as const` 字面量字段；禁止 `SHARED_ENUM_DISPLAY[dynamicKey]?.[value]?.[locale] ?? fallback`
 *      这种运行期查表 + fallback 形态（fail-loud：找不到字段即 TS 编译失败）。
 *
 * ## 入选标准（决定一个 enum 是否进本表）
 *
 *   - 至少 2 个 atom 的 `paramSlots` 使用该 enum 值（grep 验证）
 *   - 显示文本在所有调用 atom 处语义等价（不允许"同名异义"）
 *
 * 不满足 → 进 atom 私有 display.paramRenderers 内联常量。
 */

import type { LocaleMap } from './atom-contract-display.types'

/** boundaryRole — 布林带 / 指标边界 / 区间位置共用 */
const BOUNDARY_ROLE = {
  lower: { zh: '下轨', en: 'lower band' },
  middle: { zh: '中轨', en: 'middle band' },
  upper: { zh: '上轨', en: 'upper band' },
  boundary: { zh: '边界', en: 'boundary' },
} as const satisfies Readonly<Record<string, LocaleMap>>

/** operator — 阈值比较方向，volume / atr / indicator threshold 共用 */
const OPERATOR = {
  GT: { zh: '大于', en: 'greater than' },
  GTE: { zh: '不低于', en: 'at or above' },
  LT: { zh: '小于', en: 'less than' },
  LTE: { zh: '不高于', en: 'at or below' },
} as const satisfies Readonly<Record<string, LocaleMap>>

/** side — long / short / both，仓位守卫、scope.leg、gate.regime、加减仓共用 */
const SIDE = {
  long: { zh: '多头', en: 'long' },
  short: { zh: '空头', en: 'short' },
  both: { zh: '任意方向', en: 'either direction' },
} as const satisfies Readonly<Record<string, LocaleMap>>

/** indicator — 均线算法名，cross_over / cross_under / threshold / boundary_touch 共用 */
const INDICATOR_ALGO = {
  ema: { zh: 'EMA', en: 'EMA' },
  sma: { zh: 'SMA', en: 'SMA' },
  ma: { zh: 'MA', en: 'MA' },
} as const satisfies Readonly<Record<string, LocaleMap>>

/** direction — 看涨 / 看跌，K 线形态 / 图形形态 / 指标背离 / 流动性扫荡共用 */
const DIRECTION_BIAS = {
  bullish: { zh: '看涨', en: 'bullish' },
  bearish: { zh: '看跌', en: 'bearish' },
} as const satisfies Readonly<Record<string, LocaleMap>>

/** reference — 极值参考位，前高/前低/日内高/日内低，previous_extrema + liquidity.sweep + breakout 共用 */
const EXTREMA_REFERENCE = {
  prev_low: { zh: '前低', en: 'prior low' },
  prev_high: { zh: '前高', en: 'prior high' },
  session_low: { zh: '日内低', en: 'session low' },
  session_high: { zh: '日内高', en: 'session high' },
} as const satisfies Readonly<Record<string, LocaleMap>>

/**
 * 顶层共享 enum 显示表
 *
 * renderer 直接 `SHARED_ENUM_DISPLAY.<category>.<value>.<locale>` 读取，
 * 字段访问错误立即 TS 编译失败（fail-loud）。
 */
export const SHARED_ENUM_DISPLAY = {
  boundaryRole: BOUNDARY_ROLE,
  operator: OPERATOR,
  side: SIDE,
  indicatorAlgo: INDICATOR_ALGO,
  directionBias: DIRECTION_BIAS,
  extremaReference: EXTREMA_REFERENCE,
} as const

export type SharedEnumCategory = keyof typeof SHARED_ENUM_DISPLAY
