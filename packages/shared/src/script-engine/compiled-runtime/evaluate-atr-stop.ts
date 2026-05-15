import type { Bar } from '../helpers/technical-indicators'

/**
 * 对 bars 全段一次性算出 Wilder 平滑 ATR 序列。
 *
 * 返回数组与 bars 同长，未到平滑窗口（index < period）位置为 null。
 *
 * 注意：曾经实现是把 [endIndex-period, endIndex] 这种 period+1 长度的窗口喂给
 * helpers/technical-indicators.atr，但 atr() 在 `trueRanges.length === period`
 * 时只走"种子均值"分支（不进入 Wilder 平滑循环），返回的实际是简单 TR 均值，
 * 与 Chandelier Exit / TradingView ATR 不一致。这里改为单次扫描全序列、
 * 用 Wilder 平滑递推（seed = mean(first period TRs), then atr_i = (atr_{i-1}*(period-1)+TR_i)/period），
 * 时间复杂度 O(bars.length)，且数值与 helpers.atr 在末尾 bar 上一致。
 */
function computeWilderAtrSeries(
  bars: readonly Bar[],
  period: number,
): Array<number | null> {
  const series: Array<number | null> = new Array(bars.length).fill(null)
  if (bars.length < period + 1) return series

  const trueRanges: number[] = new Array(bars.length).fill(0)
  for (let i = 1; i < bars.length; i += 1) {
    const high = bars[i]!.high
    const low = bars[i]!.low
    const prevClose = bars[i - 1]!.close
    if (!Number.isFinite(high) || !Number.isFinite(low) || !Number.isFinite(prevClose)) {
      trueRanges[i] = Number.NaN
      continue
    }
    trueRanges[i] = Math.max(
      high - low,
      Math.abs(high - prevClose),
      Math.abs(low - prevClose),
    )
  }

  // seed = mean(TR[1..period])（与 helpers.atr 一致：TR 从 index 1 起算，seed 取头 period 个）
  let sumSeed = 0
  let seedValid = true
  for (let i = 1; i <= period; i += 1) {
    const tr = trueRanges[i]!
    if (!Number.isFinite(tr)) { seedValid = false; break }
    sumSeed += tr
  }
  if (!seedValid) return series
  let smoothed = sumSeed / period
  series[period] = smoothed

  // Wilder 平滑：atr_i = (atr_{i-1} * (period-1) + TR_i) / period
  for (let i = period + 1; i < bars.length; i += 1) {
    const tr = trueRanges[i]!
    if (!Number.isFinite(tr)) {
      series[i] = null
      continue
    }
    smoothed = (smoothed * (period - 1) + tr) / period
    series[i] = smoothed
  }
  return series
}

export interface AtrTrailingStopInput {
  /** 持仓方向：>0 long，<0 short，=0 无仓 */
  qty: number
  /** 当前价格（一般为最新收盘价或 baseTimeframeBar.close） */
  currentPrice: number
  /** 仓位入场价（用作回放起点的下限保护） */
  entryPrice: number
  /** 已持仓 K 线根数；用于反推入场点在 bars 中的位置 */
  barsHeld: number
  /** 倍数 */
  multiplier: number
  /** ATR 周期，默认 14 */
  period: number
  /** 当前可见 bar 历史，最新 bar 在末尾 */
  bars: readonly Bar[]
}

export interface AtrTrailingStopResult {
  /** 触发出场 */
  breached: boolean
  /** 当前 trail 后的 stop 价位（用于诊断 / 测试） */
  stopPrice: number | null
  /** 用于计算的当期 ATR */
  atrValue: number | null
}

/**
 * 计算 ATR 动态止损（Chandelier 风格的简化版）。
 *
 * 算法（每根 bar 重算，无需持久化 state）：
 * 1. 反推入场 bar 的索引 = bars.length - 1 - barsHeld（最近一根为当前 bar）
 * 2. 从入场 bar 向当前 bar 逐根扫描，对每根计算候选 stop：
 *    - long:  candidate = close - multiplier * atr
 *    - short: candidate = close + multiplier * atr
 * 3. 取 running max（long）或 running min（short）作为最终 trail stop
 * 4. 比较当前 bar 的 low/high 与 stop，越过即触发
 *
 * 这是"无 state"实现：每根 bar 重新回放。
 * Issue #1383 Round 1 C2 起改为单次预计算 Wilder ATR 全段序列 + 查表：
 *   - 预计算 O(bars.length) 一次（见 computeWilderAtrSeries）
 *   - scan 阶段 O(barsHeld) 查表
 * 比旧 O(barsHeld * period) 实现更省。
 *
 * 中段 NaN TR 处理（Round 2 MR2-1）：series 标 null，smoothed 不更新；
 *   下一根有效 TR 会在前一个 smoothed 基础上继续平滑，等价于"压缩时间轴
 *   把 NaN 那根从序列里删掉"。这不是数学正统 Wilder（正统应重新 seed），
 *   但比"产生 NaN smoothed"保守，且生产 bar 数据应不会出现中段 NaN
 *   （helpers.atr 也是同样的保守行为）。
 */
export function evaluateAtrTrailingStop(input: AtrTrailingStopInput): AtrTrailingStopResult {
  const { qty, currentPrice, entryPrice, barsHeld, multiplier, period, bars } = input

  if (qty === 0) return { breached: false, stopPrice: null, atrValue: null }
  if (!Number.isFinite(multiplier) || multiplier <= 0) {
    return { breached: false, stopPrice: null, atrValue: null }
  }
  if (!Number.isInteger(period) || period <= 0) {
    return { breached: false, stopPrice: null, atrValue: null }
  }
  if (!Number.isFinite(currentPrice) || currentPrice <= 0) {
    return { breached: false, stopPrice: null, atrValue: null }
  }
  if (!Number.isFinite(entryPrice) || entryPrice <= 0) {
    return { breached: false, stopPrice: null, atrValue: null }
  }
  if (!Array.isArray(bars) || bars.length < period + 1) {
    return { breached: false, stopPrice: null, atrValue: null }
  }
  if (!Number.isInteger(barsHeld) || barsHeld < 0) {
    return { breached: false, stopPrice: null, atrValue: null }
  }

  // 当前 bar 在末尾；入场 bar 索引 = lastIndex - barsHeld
  const lastIndex = bars.length - 1
  // 上游 bug 兜底：若 barsHeld > lastIndex（理论不应出现），fail-loud 返回无结果
  // 而不是夹到 0 静默扩窗。原因：barsHeld 与 bars.length 漂移意味着数据流上游出错，
  // 继续算会给出错误 trail stop。
  if (barsHeld > lastIndex) {
    return { breached: false, stopPrice: null, atrValue: null }
  }
  const entryIndex = lastIndex - barsHeld

  // 一次性算 Wilder ATR 全序列，scan 阶段 O(barsHeld) 查表
  const atrSeries = computeWilderAtrSeries(bars, period)

  // 累积 trail stop
  let trailStop: number | null = null
  let lastAtr: number | null = null

  // 首次能计算 ATR 的 index 必须 >= period（< period 位置 series 一定为 null，会被跳过）
  for (let i = Math.max(entryIndex, period); i <= lastIndex; i++) {
    const atrVal = atrSeries[i]
    if (atrVal === null || atrVal === undefined || !Number.isFinite(atrVal) || atrVal <= 0) continue
    const close = bars[i]!.close
    if (!Number.isFinite(close)) continue

    const candidate = qty > 0
      ? close - multiplier * atrVal
      : close + multiplier * atrVal

    if (trailStop === null) {
      trailStop = candidate
    }
    else {
      trailStop = qty > 0
        ? Math.max(trailStop, candidate)
        : Math.min(trailStop, candidate)
    }
    lastAtr = atrVal
  }

  if (trailStop === null) {
    return { breached: false, stopPrice: null, atrValue: lastAtr }
  }

  // 触发判定：用当前 bar 的极值（low/high）捕捉盘中穿越。
  // 若 low/high 缺失（NaN/Infinity）：fail-loud 返回 stopPrice 但 breached=false，
  // 而不是退化为 currentPrice 单点判定——后者会错过盘中穿越但 close 反弹的真实穿越场景。
  const lastBar = bars[lastIndex]!
  const low = lastBar.low
  const high = lastBar.high
  if (!Number.isFinite(low) || !Number.isFinite(high)) {
    return { breached: false, stopPrice: trailStop, atrValue: lastAtr }
  }

  const breached = qty > 0
    ? low <= trailStop
    : high >= trailStop

  return { breached, stopPrice: trailStop, atrValue: lastAtr }
}
