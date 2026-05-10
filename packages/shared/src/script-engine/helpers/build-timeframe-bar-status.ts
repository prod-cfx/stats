import type { CompiledOrchestrationScope, TimeframeBarStatusEntry } from '../compiled-runtime'
import type { StrategyExecutionContextV1 } from '../../strategy-protocol'

/**
 * Phase 5 S3 (#1109): 从 ctx.data 派生 timeframeBarStatus
 *
 * 字段事实（#1107 caller 路径已具备）：
 *   - ctx.legs[0]?.id 默认 'primary'（backtest-runner.service.ts:959 注入）
 *   - ctx.data[legId][tf].bars 是 packages/shared Bar[]（{open,high,low,close,volume,timestamp}）
 *   - bar.timestamp 是毫秒（与 backtest-runner.service.ts:990 ts: bar.closeTime 同源）
 *
 * 缺失策略：
 *   - 任一 required tf 在 ctx.data 缺失或 bars 为空 → 不写入对应 tf 状态，runtime 自然 required_missing
 *   - 全部 tf 缺失 → 返回 undefined，runtime 走 data_unavailable
 *   - projection 中无 timeframe scope → caller 不调用此 helper（plan §4.8.2）
 */
export function buildTimeframeBarStatus(
  ctx: StrategyExecutionContextV1,
  scopes: readonly CompiledOrchestrationScope[],
): Record<string, TimeframeBarStatusEntry> | undefined {
  const tfScopes = scopes.filter((s) => s.scopeKind === 'timeframe')
  if (tfScopes.length === 0) return undefined

  const allTimeframes = new Set<string>()
  for (const s of tfScopes) {
    if (s.scopeKind === 'timeframe') {
      allTimeframes.add(s.primaryTimeframe)
      s.requiredTimeframes.forEach((tf) => allTimeframes.add(tf))
    }
  }

  const legId = ctx.legs?.[0]?.id ?? 'primary'
  const legData = ctx.data?.[legId] ?? {}
  const status: Record<string, TimeframeBarStatusEntry> = {}
  for (const tf of allTimeframes) {
    const bars = legData[tf]?.bars
    if (!Array.isArray(bars) || bars.length === 0) continue
    const last = bars[bars.length - 1]
    if (!last || typeof last.timestamp !== 'number' || !Number.isFinite(last.timestamp)) continue
    status[tf] = { lastClosedBarTs: last.timestamp, lastClosedBarIndex: bars.length - 1 }
  }
  return Object.keys(status).length > 0 ? status : undefined
}
