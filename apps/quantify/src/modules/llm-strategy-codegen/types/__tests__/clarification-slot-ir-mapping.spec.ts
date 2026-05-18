import {
  CLARIFICATION_SLOT_IR_MAPPING,
  lookupIrFieldsForClarificationReason,
} from '../clarification-slot-ir-mapping'

describe('clarificationSlotIrMapping (#1456)', () => {
  it('每一行 mapping 都至少声明一个 IR 字段，否则该 slot 永远查不到下游字段视为漏配', () => {
    for (const row of CLARIFICATION_SLOT_IR_MAPPING) {
      expect(row.reason).toBeTruthy()
      expect(Array.isArray(row.irFields)).toBe(true)
      expect(row.irFields.length).toBeGreaterThan(0)
      expect(row.rationale.length).toBeGreaterThan(0)
    }
  })

  it('reason 在表中唯一（不允许重复声明歧义映射）', () => {
    const reasons = CLARIFICATION_SLOT_IR_MAPPING.map(row => row.reason)
    expect(new Set(reasons).size).toBe(reasons.length)
  })

  it('lookup 命中已声明 reason 返回对应字段；未声明 reason fail-closed 返回空数组', () => {
    expect(lookupIrFieldsForClarificationReason('missing_exchange')).toEqual(
      expect.arrayContaining(['EXECUTION_MODEL.venue', 'EXECUTION_MODEL.symbol']),
    )
    expect(lookupIrFieldsForClarificationReason('missing_semantic_position_sizing')).toEqual(
      expect.arrayContaining(['PORTFOLIO.sizing']),
    )
    // 未在 mapping 的自定义 reason —— 空数组（caller 仍可凭 pendingItems 阻断）
    expect(lookupIrFieldsForClarificationReason('totally_unknown_reason')).toEqual([])
  })

  it('覆盖 Issue #1456 描述的 4 个真实 pending blocking 类别（confirmationMode/position.sizing/exchange）', () => {
    // confirmationMode.entry → missing_semantic_trigger（atom predicate kind）
    expect(lookupIrFieldsForClarificationReason('missing_semantic_trigger')).toEqual(
      expect.arrayContaining(['SIGNAL_CATALOG.predicates[*].kind']),
    )
    // position.sizing → missing_semantic_position_sizing
    expect(lookupIrFieldsForClarificationReason('missing_semantic_position_sizing')).toEqual(
      expect.arrayContaining(['DECISION_PROGRAMS[*].actions.quantity']),
    )
    // exchange → missing_exchange
    expect(lookupIrFieldsForClarificationReason('missing_exchange')).toEqual(
      expect.arrayContaining(['EXECUTION_MODEL.venue']),
    )
  })
})
