/**
 * Issue #1443 D 方案 — tryAtomContractSummary 通用 enrich 基于 paramSlots 元数据。
 *
 * 旧设计基于 atom.display.paramRenderers（contract 注释自承"debug 字段，非 user-facing"
 * 见 atom-contract-registry.ts:1193）—— direction enum 等 fallback 到原始 value（"down"），
 * UI 显示技术化文案。
 *
 * 新通用机制：基于 paramSlots.kind + 内置 PROJECTION_PARAM_VALUE_LABELS 表派生人话：
 *   - kind=percent → ${abs(value)}%
 *   - kind=number → ${value}
 *   - kind=duration → ${value}（"3m"/"15m"）
 *   - kind=enum → 查内置标签表（direction/basis/side/orderType/confirmationMode 等）；
 *                 表内无则**跳过**（不显示原始 enum value 如 'down'/'current_price'）
 *   - 值 === default → 跳过（技术兜底）
 *
 * 不动任何 atom contract；新 atom 自动通用。扩 enum 标签只需扩内置表。
 */

import { SemanticStateProjectionService } from '../semantic-state-projection.service'

describe('Issue #1443 — projection summary 基于 paramSlots 元数据的通用 enrich', () => {
  const service = new SemanticStateProjectionService()
  const privateAccess = service as unknown as {
    tryAtomContractSummary: (atomKey: string, params: Record<string, unknown>, locale?: 'zh' | 'en') => string | null
  }

  it('price.percent_change valuePct + direction=down + window → 「下跌」+ 「1%」+ 「3m」', () => {
    const out = privateAccess.tryAtomContractSummary(
      'price.percent_change',
      { direction: 'down', valuePct: -1, window: '3m' },
      'zh',
    )
    expect(out).not.toBeNull()
    expect(out).toContain('价格百分比变化')
    // direction='down' 查内置表 → '下跌'（不是 'down'）
    expect(out).toContain('下跌')
    expect(out).not.toContain('down')
    // valuePct=-1 percent kind → '1%'（取 abs，方向已在 direction）
    expect(out).toContain('1%')
    expect(out).not.toContain('-1%')
    // window duration → '3m'
    expect(out).toContain('3m')
  })

  it('price.percent_change basis=entry_avg_price → 「相对入场均价」', () => {
    const out = privateAccess.tryAtomContractSummary(
      'price.percent_change',
      { direction: 'up', valuePct: 2, basis: 'entry_avg_price' },
      'zh',
    )
    expect(out).not.toBeNull()
    expect(out).toContain('上涨')
    expect(out).toContain('2%')
    expect(out).toContain('相对入场均价')
    expect(out).not.toContain('entry_avg_price')
  })

  it('basis=current_price → 「相对当前价」（不是 「current_price」）', () => {
    const out = privateAccess.tryAtomContractSummary(
      'price.percent_change',
      { direction: 'down', valuePct: -1, basis: 'current_price' },
      'zh',
    )
    expect(out).not.toBeNull()
    expect(out).toContain('相对当前价')
    expect(out).not.toContain('current_price')
  })

  it('params 全空 → 仅 publicName fallback（无附加段）', () => {
    const out = privateAccess.tryAtomContractSummary('price.percent_change', {}, 'zh')
    expect(out).toBe('价格百分比变化')
  })

  it('en locale 也走通用增强', () => {
    const out = privateAccess.tryAtomContractSummary(
      'price.percent_change',
      { direction: 'down', valuePct: -1, window: '3m' },
      'en',
    )
    expect(out).not.toBeNull()
    expect(out).toContain('falls')
    expect(out).toContain('1%')
    expect(out).toContain('3m')
  })

  it('未注册 atom → 返 null（fail-open）', () => {
    const out = privateAccess.tryAtomContractSummary('totally.unknown.atom', { x: 1 }, 'zh')
    expect(out).toBeNull()
  })

  it('summaryTemplate 已消费 params 的 atom 行为不变（如 risk.atr_take_profit）', () => {
    // risk.atr_take_profit 的 summaryTemplate 自组「${multiple} 倍 ATR 止盈」 → 不触发 enrich
    const out = privateAccess.tryAtomContractSummary('risk.atr_take_profit', { multiple: 2 }, 'zh')
    expect(out).not.toBeNull()
    expect(out).toContain('2')
    expect(out).toContain('ATR')
  })

  it('execution.on_start 三个 param 全等 default → 全部跳过 → 只剩 publicName 无附加段', () => {
    // timing=on_start (=default), orderType=market (=default), occurrence=once (=default)
    const out = privateAccess.tryAtomContractSummary(
      'execution.on_start',
      { timing: 'on_start', orderType: 'market', occurrence: 'once' },
      'zh',
    )
    expect(out).toBe('启动后执行')
    // 不应包含技术 default 值
    expect(out).not.toContain('on_start')
    expect(out).not.toContain('once')
    expect(out).not.toContain('（市价')
  })

  it('enum value 不在标签表内 → 跳过（不显示原始 enum value）', () => {
    // execution.on_start.timing enum=['on_start']，标签表无 timing 类目
    //   → timing=on_start 是 default 已跳过；即便给非 default 也应跳过
    //   验证: 给一个标签表里没有的 confirmationMode 自定义值 → 不渲染
    const out = privateAccess.tryAtomContractSummary(
      'bollinger.touch_upper',
      { period: 20, stdDev: 2, confirmationMode: 'unknown_future_mode' },
      'zh',
    )
    expect(out).not.toBeNull()
    // 'unknown_future_mode' 不在 PROJECTION_PARAM_VALUE_LABELS.confirmationMode → 跳过
    expect(out).not.toContain('unknown_future_mode')
  })
})
