/**
 * #1279 #1329 #1331 W2：resolveSlotLabel 两级 fallback 优先级 unit 断言。
 *
 * #1331 M2 撤回 ParamSlotSchema.label dead field 后，resolveSlotLabel 只剩两级：
 *   1. SLOT_LABEL_FALLBACK[fullSlotKey]  —— PRESENTATIONS-only legacy 残留
 *   2. '缺失信息'                          —— 兜底通用文案（不暴露内部 key）
 */
import { resolveSlotLabel } from '../legacy-presentation-data'

describe('#1331 W2：resolveSlotLabel 两级 fallback', () => {
  it('SLOT_LABEL_FALLBACK 命中：fullSlotKey 在 fallback map 中 → 返回 fallback 文案', () => {
    // 'risk.stop_loss_pct.valuePct' 是 SLOT_LABEL_FALLBACK 已知 key
    const label = resolveSlotLabel('risk.stop_loss_pct', 'risk.stop_loss_pct.valuePct')
    expect(label).toBe('止损比例')
  })

  it('SLOT_LABEL_FALLBACK 命中：atomKey 不影响 fallback 查询（fullSlotKey 才是查询 key）', () => {
    // atomKey 错位也应命中，因为 resolveSlotLabel 现在不再依赖 atomKey
    const label = resolveSlotLabel('any.other.atom', 'position.dca_schedule.max_count')
    expect(label).toBe('最多补仓次数')
  })

  it('未命中：fullSlotKey 不在 fallback map 中 → 返回 "缺失信息" 兜底', () => {
    const label = resolveSlotLabel('gate.regime', 'gate.regime.unknown_slot_key_xyz')
    expect(label).toBe('缺失信息')
  })

  it('未命中：空 fullSlotKey → 返回兜底', () => {
    const label = resolveSlotLabel('any.atom', '')
    expect(label).toBe('缺失信息')
  })
})
