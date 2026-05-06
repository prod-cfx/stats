import type { SemanticSlotState } from '../../types/semantic-state'
import { isBlockingSemanticOpenSlot } from '../semantic-open-slot-blocking'

describe('isBlockingSemanticOpenSlot', () => {
  it('only treats open execution-affecting slots as blocking', () => {
    expect(isBlockingSemanticOpenSlot(createSlot({ status: 'open', affectsExecution: true }))).toBe(true)
    expect(isBlockingSemanticOpenSlot(createSlot({ status: 'open', affectsExecution: false }))).toBe(false)
    expect(isBlockingSemanticOpenSlot(createSlot({ status: 'locked', affectsExecution: true }))).toBe(false)
    expect(isBlockingSemanticOpenSlot(null)).toBe(false)
  })
})

function createSlot(overrides: Partial<SemanticSlotState>): SemanticSlotState {
  return {
    slotKey: 'display.hint',
    fieldPath: 'display.hint',
    status: 'open',
    priority: 'behavior',
    questionHint: '展示提示。',
    affectsExecution: true,
    ...overrides,
  }
}
