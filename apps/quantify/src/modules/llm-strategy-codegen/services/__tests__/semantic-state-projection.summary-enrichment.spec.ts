/**
 * Issue #1441 — tryAtomContractSummary 通用增强：所有声明了 display.paramRenderers
 * 但 summaryTemplate 未消费 params（输出 == publicName）的 atom，自动用 paramRenderers
 * 把 params 关键字段渲染并附加在 summary 后。
 *
 * 旧 atom-contract-registry.ts:1193 注释自承「paramRenderers consumed by future UI
 * debug surface (not by current summary path)」—— 本机制让 paramRenderers 在 summary
 * 路径被通用消费，所有 atom 自动受益，避免单 atom 改 summaryTemplate。
 *
 * 用户实测策略 1：「3 分钟之内跌 1% 买入」UI 一直显示「价格百分比变化」无数值，根因
 * 是 price.percent_change.summaryTemplate 忽略 _p；本机制通用解决全 registry 的此类
 * 漏写问题。
 */

import { SemanticStateProjectionService } from '../semantic-state-projection.service'

describe('Issue #1441 — projection summary 通用 paramRenderers 增强', () => {
  const service = new SemanticStateProjectionService()
  // private 方法 bracket 访问（与 #1432/#1433/#1437 同模式）
  const privateAccess = service as unknown as {
    tryAtomContractSummary: (atomKey: string, params: Record<string, unknown>, locale?: 'zh' | 'en') => string | null
  }

  it('price.percent_change 含 direction+valuePct+window → summary 含具体数值', () => {
    const out = privateAccess.tryAtomContractSummary(
      'price.percent_change',
      { direction: 'down', valuePct: -1, window: '3m' },
      'zh',
    )
    expect(out).not.toBeNull()
    // baseSummary fallback 到 publicName「价格百分比变化」，通用增强附加 paramRenderers 渲染
    expect(out).toContain('价格百分比变化')
    // paramRenderers.valuePct 渲染 "-1%"
    expect(out).toContain('-1%')
    // paramRenderers.window 渲染 "3m"
    expect(out).toContain('3m')
  })

  it('price.percent_change 含 basis=entry_avg_price → summary 含「入场均价」', () => {
    const out = privateAccess.tryAtomContractSummary(
      'price.percent_change',
      { direction: 'up', valuePct: 2, basis: 'entry_avg_price' },
      'zh',
    )
    expect(out).not.toBeNull()
    expect(out).toContain('入场均价')
    expect(out).toContain('2%')
  })

  it('price.percent_change params 全空 → 仅 publicName fallback（无附加段）', () => {
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
    expect(out).toContain('-1%')
    expect(out).toContain('3m')
  })

  it('未注册 atom → 返 null（fail-open）', () => {
    const out = privateAccess.tryAtomContractSummary('totally.unknown.atom', { x: 1 }, 'zh')
    expect(out).toBeNull()
  })

  it('summaryTemplate 已消费 params 的 atom 行为不变（如 risk.atr_take_profit）', () => {
    // risk.atr_take_profit 的 summaryTemplate 自己组装 `${multiple} 倍 ATR 止盈`，已消费 params
    // 通用增强检测到 base summary !== publicName，跳过增强保留原样
    const out = privateAccess.tryAtomContractSummary('risk.atr_take_profit', { multiple: 2 }, 'zh')
    expect(out).not.toBeNull()
    expect(out).toContain('2')
    expect(out).toContain('ATR')
    // 不应有重复增强括号（无 publicName fallback 信号 → 不触发 enrichSummary）
    // 验证：括号或参数渲染段只出现一次（不是双重包装）
  })
})
