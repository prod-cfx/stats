/**
 * Issue #1456 / 父 Issue #1455 闸 1：clarification slot → 编译 IR 字段映射。
 *
 * 这里是 publication-gate 阻断未澄清 IR 编译的 single source of truth。
 * fail-closed 原则：
 *   - 任何 slot 命中下表 → publication-gate 一律拒绝产出 IR / 脚本，
 *     不允许"先编译后看 gate"。
 *   - 表外 slot 仍要靠 `clarificationState.items[].blocking === true` 拒绝；
 *     此表只是"哪个 slot 会污染哪个 IR 字段"的可读 mapping，方便 reviewer
 *     和后续 metrics 把 block 原因落到具体字段。
 *   - 新增 clarification slot 时**必须**同时往本表添加一行；遗漏视为遗忘 fail-closed。
 *
 * 不绑定具体策略族（EMA / BOLL / 网格...），只描述「slot 类别」与「IR 字段路径」。
 */

import type { StrategyClarificationReason } from './strategy-clarification'

/**
 * IR 字段路径以点分形式书写，方便和 spec/IR 文档对齐：
 *   - EXECUTION_MODEL.venue            ↔ canonicalStrategyIrV1.market.venue
 *   - EXECUTION_MODEL.symbol           ↔ canonicalStrategyIrV1.market.symbol
 *   - EXECUTION_MODEL.timeframes[0]    ↔ canonicalStrategyIrV1.market.timeframes[0]
 *   - EXECUTION_MODEL.instrumentType   ↔ canonicalStrategyIrV1.market.instrumentType
 *   - PORTFOLIO.sizing                 ↔ canonicalStrategyIrV1.portfolio.sizing
 *   - PORTFOLIO.positionMode           ↔ canonicalStrategyIrV1.portfolio.positionMode
 *   - DECISION_PROGRAMS[*].actions.quantity
 *                                      ↔ canonicalStrategyIrV1.ruleBlocks[*].actions[*].quantity
 *   - SIGNAL_CATALOG.predicates[*].kind
 *                                      ↔ canonicalStrategyIrV1.signalCatalog.predicates[*].kind
 */
export interface ClarificationSlotIrMapping {
  /** clarification slot 的 reason 枚举（与 STRATEGY_CLARIFICATION_REASONS 对齐） */
  reason: StrategyClarificationReason
  /** 该 slot 未答会污染的 IR 字段（点分路径） */
  irFields: readonly string[]
  /** 为什么 IR 不能在此 slot 未答时落地 —— 一句话留给 reviewer */
  rationale: string
}

/**
 * 注意：这里只列「会污染编译 IR 字段」的 reason。
 *   像 ambiguous_state_gate / direction_ambiguous 这种纯语义结构歧义，
 *   会在更上游的 semantic clarification gate 处被卡住，不在本闸覆盖范围。
 */
export const CLARIFICATION_SLOT_IR_MAPPING: readonly ClarificationSlotIrMapping[] = [
  {
    reason: 'missing_exchange',
    irFields: ['EXECUTION_MODEL.venue', 'EXECUTION_MODEL.symbol'],
    rationale:
      '交易所未确认时 venue/symbol 默认填 okx 是误导性产出，必须阻断 IR 生成。',
  },
  {
    reason: 'missing_symbol',
    irFields: ['EXECUTION_MODEL.symbol'],
    rationale: 'symbol 未确认时不允许编译 IR，避免下游用默认 BTCUSDT 静默续跑。',
  },
  {
    reason: 'missing_timeframe',
    irFields: ['EXECUTION_MODEL.timeframes', 'DATA_REQUIREMENTS.requiredTimeframes'],
    rationale: 'timeframe 未确认时数据 warmup 与信号计算窗口未定义，IR 不能落地。',
  },
  {
    reason: 'missing_market_type',
    irFields: ['EXECUTION_MODEL.instrumentType'],
    rationale: 'spot/perp 未确认时杠杆与开仓方向语义未定义。',
  },
  {
    reason: 'missing_position_pct',
    irFields: ['PORTFOLIO.sizing', 'DECISION_PROGRAMS[*].actions.quantity'],
    rationale: '仓位百分比未确认时默认 100% 是高风险产出，必须阻断。',
  },
  {
    reason: 'missing_position_mode',
    irFields: ['PORTFOLIO.positionMode'],
    rationale: 'positionMode 未确认时 long_only/short_only/long_short 默认值会扭曲风控边界。',
  },
  {
    reason: 'missing_semantic_position_sizing',
    irFields: ['PORTFOLIO.sizing', 'DECISION_PROGRAMS[*].actions.quantity'],
    rationale: '语义 sizing slot 未答时 action quantity 默认 100% 会触发全仓单。',
  },
  {
    reason: 'missing_semantic_position_mode',
    irFields: ['PORTFOLIO.positionMode'],
    rationale: '语义 positionMode slot 未答时不能落地默认方向。',
  },
  {
    reason: 'missing_semantic_trigger',
    irFields: ['SIGNAL_CATALOG.predicates[*].kind', 'DECISION_PROGRAMS[*].when'],
    rationale:
      'confirmationMode 等 trigger slot 未答时 predicate kind / 进入条件未定义，IR 不能产出。',
  },
  {
    reason: 'missing_semantic_action',
    irFields: ['DECISION_PROGRAMS[*].actions'],
    rationale: 'action 语义 slot 未答时无法生成 OPEN/CLOSE/REDUCE 等运行时动作。',
  },
  {
    reason: 'missing_semantic_risk',
    irFields: ['RISK_POLICY.guards'],
    rationale: 'risk slot 未答时止损止盈守卫缺失，编译出的 IR 风险口径不闭环。',
  },
  {
    reason: 'missing_entry_rules',
    irFields: ['DECISION_PROGRAMS[*].when (entry)'],
    rationale: '入场规则缺失时入场谓词不存在，IR 仅有出场逻辑没有意义。',
  },
  {
    reason: 'missing_exit_rules',
    irFields: ['DECISION_PROGRAMS[*].when (exit)'],
    rationale: '出场规则缺失时仓位永远无法关闭，IR 不能上线。',
  },
  {
    reason: 'grid_params_missing',
    irFields: ['SIGNAL_CATALOG.series[grid]', 'EXECUTION_POLICY (grid)'],
    rationale: '网格区间/步长未确认时 grid program 参数面无法填充。',
  },
] as const

/**
 * 把 clarification reason 反查 IR 字段 —— 用于 publication-gate 阻断时构造
 * 结构化错误体，让前端能告诉用户「哪些 IR 字段被卡」。
 */
export function lookupIrFieldsForClarificationReason(
  reason: StrategyClarificationReason,
): readonly string[] {
  const hit = CLARIFICATION_SLOT_IR_MAPPING.find(item => item.reason === reason)
  return hit ? hit.irFields : []
}
