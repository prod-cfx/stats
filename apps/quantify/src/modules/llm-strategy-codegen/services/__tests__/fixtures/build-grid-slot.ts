import type { SemanticSlotState } from '../../../types/semantic-state'

/**
 * Issue #1409 — grid.range_rebalance clarification slot fixture
 *
 * resolver 通用通道（atomKey + paramSlotKey）走 GenericSeedDispatcher.extractSingleSlot
 * 抽参。所有 grid 澄清 slot 必须带 atomKey='grid.range_rebalance' + paramSlotKey 元数据
 * 才能进入通用通道。
 */
export function buildGridClarificationSlot(
  paramSlotKey: 'levels' | 'stepPct' | 'rangeLower' | 'rangeUpper' | 'sideMode' | 'breakoutAction',
  overrides: Partial<SemanticSlotState> = {},
): SemanticSlotState {
  const atomKey = 'grid.range_rebalance'
  return {
    slotKey: `${atomKey}.${paramSlotKey}`,
    fieldPath: `triggers[trigger-grid-levels].contracts[contract-grid-levels].capabilities[price.define.level_set].shape`,
    atomKey,
    paramSlotKey,
    status: 'open',
    priority: 'core',
    questionHint: '请确认网格参数。',
    affectsExecution: true,
    ...overrides,
  }
}
