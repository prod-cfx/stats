import type { SemanticSlotState, SemanticState, SemanticTriggerState } from '../../types/semantic-state'
import { SemanticMissingPlaceholderReconcilerService } from '../semantic-missing-placeholder-reconciler.service'

describe('SemanticMissingPlaceholderReconcilerService', () => {
  const service = new SemanticMissingPlaceholderReconcilerService()

  it('removes an open missing entry placeholder when a real entry trigger exists', () => {
    const state = createSemanticState({
      triggers: [
        createMissingPlaceholder('entry'),
        createTrigger({ id: 'trigger-entry', key: 'ma.cross_over', phase: 'entry' }),
      ],
    })

    const nextState = service.reconcile(state)

    expect(nextState).not.toBe(state)
    expect(nextState.triggers).toEqual([
      createTrigger({ id: 'trigger-entry', key: 'ma.cross_over', phase: 'entry' }),
    ])
  })

  it('keeps an open missing entry placeholder when only an entry action exists', () => {
    const state = createSemanticState({
      triggers: [createMissingPlaceholder('entry')],
      actions: [{
        id: 'action-open-long',
        key: 'open_long',
        status: 'locked',
        source: 'user_explicit',
        openSlots: [],
      }],
    })

    const nextState = service.reconcile(state)

    expect(nextState).toBe(state)
    expect(nextState.triggers).toEqual([createMissingPlaceholder('entry')])
  })

  it('removes an open missing exit placeholder when a real exit trigger exists', () => {
    const state = createSemanticState({
      triggers: [
        createMissingPlaceholder('exit'),
        createTrigger({ id: 'trigger-exit', key: 'take_profit.price_cross', phase: 'exit' }),
      ],
    })

    const nextState = service.reconcile(state)

    expect(nextState).not.toBe(state)
    expect(nextState.triggers).toEqual([
      createTrigger({ id: 'trigger-exit', key: 'take_profit.price_cross', phase: 'exit' }),
    ])
  })

  it('keeps missing placeholders when the matching real trigger is still open', () => {
    const openSlot = createOpenSlot()
    const state = createSemanticState({
      triggers: [
        createMissingPlaceholder('entry'),
        createTrigger({
          id: 'trigger-entry-open',
          key: 'ma.cross_over',
          phase: 'entry',
          status: 'open',
          openSlots: [openSlot],
        }),
      ],
    })

    const nextState = service.reconcile(state)

    expect(nextState).toBe(state)
    expect(nextState.triggers).toEqual([
      createMissingPlaceholder('entry'),
      createTrigger({
        id: 'trigger-entry-open',
        key: 'ma.cross_over',
        phase: 'entry',
        status: 'open',
        openSlots: [openSlot],
      }),
    ])
  })
})

function createSemanticState(overrides: Partial<SemanticState> = {}): SemanticState {
  return {
    version: 1,
    families: [],
    triggers: [],
    actions: [],
    risk: [],
    position: null,
    contextSlots: {
      exchange: null,
      symbol: null,
      marketType: null,
      timeframe: null,
    },
    normalizationNotes: [],
    updatedAt: '2026-05-05T00:00:00.000Z',
    ...overrides,
  }
}

function createTrigger(input: {
  id: string
  key: string
  phase: SemanticTriggerState['phase']
  status?: SemanticTriggerState['status']
  openSlots?: SemanticSlotState[]
}): SemanticTriggerState {
  return {
    id: input.id,
    key: input.key,
    phase: input.phase,
    params: {},
    status: input.status ?? 'locked',
    source: 'user_explicit',
    openSlots: input.openSlots ?? [],
  }
}

function createMissingPlaceholder(
  phase: Extract<SemanticTriggerState['phase'], 'entry' | 'exit'>,
): SemanticTriggerState {
  const isEntry = phase === 'entry'
  return {
    id: `semantic-missing-${phase}-atom`,
    key: isEntry ? 'semantic.missing_entry_atom' : 'semantic.missing_exit_atom',
    phase,
    params: {},
    status: 'open',
    source: 'derived',
    openSlots: [{
      slotKey: isEntry ? 'trigger.entry' : 'trigger.exit',
      fieldPath: isEntry ? 'triggers[entry]' : 'triggers[exit]',
      status: 'open',
      priority: 'core',
      questionHint: isEntry ? '请补充入场触发条件。' : '请补充出场触发条件。',
      affectsExecution: true,
    }],
  }
}

function createOpenSlot(): SemanticSlotState {
  return {
    slotKey: 'trigger.entry.condition',
    fieldPath: 'triggers[trigger-entry-open].params.condition',
    status: 'open',
    priority: 'core',
    questionHint: '请补充入场触发条件。',
    affectsExecution: true,
  }
}
