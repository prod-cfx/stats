import type { SemanticAtomContract, SemanticTriggerState } from '../../types/semantic-state'

import { SemanticTriggerCombinationContractService } from '../semantic-trigger-combination-contract.service'

describe('SemanticTriggerCombinationContractService', () => {
  const service = new SemanticTriggerCombinationContractService()

  it('resolves an ungrouped entry trigger as an implicit singleton group', () => {
    const result = service.resolveExecutableGroups([
      trigger({ id: 'ema20-cross', key: 'ema.cross', phase: 'entry' }),
    ])

    expect(result).toEqual([
      {
        groupId: 'implicit:entry:long:open_long:ema20-cross',
        join: 'AND',
        phase: 'entry',
        sideScope: 'long',
        actionKey: 'open_long',
        actionBinding: 'single_action',
        members: [expect.objectContaining({ id: 'ema20-cross', key: 'ema.cross' })],
      },
    ])
  })

  it('resolves a trigger with a normal trigger atom contract but no groupId as an implicit singleton group', () => {
    const result = service.resolveExecutableGroups([
      trigger({
        id: 'ema20-cross',
        key: 'ema.cross',
        contracts: [{
          id: 'normal-trigger-contract',
          kind: 'trigger',
          capabilities: [],
          requires: [],
          params: { threshold: 20 },
        }],
      }),
    ])

    expect(result).toEqual([
      expect.objectContaining({
        groupId: 'implicit:entry:long:open_long:ema20-cross',
        join: 'AND',
        members: [expect.objectContaining({ id: 'ema20-cross', key: 'ema.cross' })],
      }),
    ])
  })

  it('resolves an explicit AND entry contract group with EMA20/60/144 as one open long action', () => {
    const result = service.resolveExecutableGroups([
      trigger({
        id: 'ema20-above',
        key: 'price.above.ema20',
        contracts: [combinationContract({ groupId: 'entry-ema-stack', role: 'fast' })],
      }),
      trigger({
        id: 'ema60-above',
        key: 'price.above.ema60',
        contracts: [combinationContract({ groupId: 'entry-ema-stack', join: 'AND', role: 'middle' })],
      }),
      trigger({
        id: 'ema144-above',
        key: 'price.above.ema144',
        contracts: [combinationContract({ groupId: 'entry-ema-stack', join: 'AND', role: 'slow' })],
      }),
    ])

    expect(result).toEqual([
      {
        groupId: 'entry-ema-stack',
        join: 'AND',
        phase: 'entry',
        sideScope: 'long',
        actionKey: 'open_long',
        actionBinding: 'single_action',
        members: [
          expect.objectContaining({ id: 'ema20-above', key: 'price.above.ema20' }),
          expect.objectContaining({ id: 'ema60-above', key: 'price.above.ema60' }),
          expect.objectContaining({ id: 'ema144-above', key: 'price.above.ema144' }),
        ],
        rolesByTriggerId: {
          'ema20-above': 'fast',
          'ema60-above': 'middle',
          'ema144-above': 'slow',
        },
      },
    ])
    expect(result[0]?.members.map(member => member.id)).toEqual(['ema20-above', 'ema60-above', 'ema144-above'])
  })

  it('resolves an explicit OR exit contract group as one close long action', () => {
    const result = service.resolveExecutableGroups([
      trigger({
        id: 'take-profit',
        key: 'profit.target',
        phase: 'exit',
        contracts: [combinationContract({ groupId: 'exit-any', join: 'OR' })],
      }),
      trigger({
        id: 'rsi-overbought',
        key: 'rsi.overbought',
        phase: 'exit',
        contracts: [combinationContract({ groupId: 'exit-any', join: 'OR' })],
      }),
    ])

    expect(result).toEqual([
      {
        groupId: 'exit-any',
        join: 'OR',
        phase: 'exit',
        sideScope: 'long',
        actionKey: 'close_long',
        actionBinding: 'single_action',
        members: [
          expect.objectContaining({ id: 'take-profit', key: 'profit.target' }),
          expect.objectContaining({ id: 'rsi-overbought', key: 'rsi.overbought' }),
        ],
      },
    ])
    expect(result[0]?.members.map(member => member.id)).toEqual(['take-profit', 'rsi-overbought'])
  })

  it('throws when explicit contracts conflict on join or actionKey inside the same group', () => {
    expect(() => service.resolveExecutableGroups([
      trigger({
        id: 'ema20-above',
        contracts: [combinationContract({ groupId: 'conflicting-entry', join: 'AND', actionKey: 'open_long' })],
      }),
      trigger({
        id: 'ema60-above',
        contracts: [combinationContract({ groupId: 'conflicting-entry', join: 'OR', actionKey: 'open_short' })],
      }),
    ])).toThrow(/conflicting-entry.*join/u)

    expect(() => service.resolveExecutableGroups([
      trigger({
        id: 'ema20-above',
        contracts: [combinationContract({ groupId: 'conflicting-action', actionKey: 'open_long' })],
      }),
      trigger({
        id: 'ema60-above',
        contracts: [combinationContract({ groupId: 'conflicting-action', actionKey: 'open_short' })],
      }),
    ])).toThrow(/conflicting-action.*actionKey/u)
  })

  it('throws when an explicit contract join value is invalid', () => {
    expect(() => service.resolveExecutableGroups([
      trigger({
        id: 'ema20-above',
        contracts: [combinationContract({ groupId: 'invalid-join-group', join: 'ALL' })],
      }),
    ])).toThrow(/ema20-above.*invalid-join-group.*join/u)
  })

  it('throws when an explicit contract sideScope value is invalid', () => {
    expect(() => service.resolveExecutableGroups([
      trigger({
        id: 'ema20-above',
        contracts: [combinationContract({ groupId: 'invalid-side-group', sideScope: 'LONG' })],
      }),
    ])).toThrow(/ema20-above.*invalid-side-group.*sideScope/u)
  })

  it('resolves legacy marker fallback groupId and join', () => {
    const result = service.resolveExecutableGroups([
      trigger({
        id: 'legacy-fast',
        params: { semanticGroupId: 'legacy-stack', logic: 'OR' },
      }),
      trigger({
        id: 'legacy-slow',
        params: { semanticGroupId: 'legacy-stack', conditionOperator: 'OR' },
      }),
    ])

    expect(result).toEqual([
      expect.objectContaining({
        groupId: 'legacy-stack',
        join: 'OR',
        phase: 'entry',
        sideScope: 'long',
        actionKey: 'open_long',
        actionBinding: 'single_action',
        members: [
          expect.objectContaining({ id: 'legacy-fast', key: 'price.cross' }),
          expect.objectContaining({ id: 'legacy-slow', key: 'price.cross' }),
        ],
      }),
    ])
    expect(result[0]?.members.map(member => member.id)).toEqual(['legacy-fast', 'legacy-slow'])
  })

  it('ignores non-trigger contracts even when they carry a groupId', () => {
    const result = service.resolveExecutableGroups([
      trigger({
        id: 'action-contract-owner',
        contracts: [{
          ...combinationContract({ groupId: 'action-owned-group', join: 'OR' }),
          kind: 'action',
        }],
      }),
    ])

    expect(result).toEqual([
      expect.objectContaining({
        groupId: 'implicit:entry:long:open_long:action-contract-owner',
        join: 'AND',
      }),
    ])
  })
})

function trigger(overrides: Partial<SemanticTriggerState>): SemanticTriggerState {
  return {
    id: 'trigger-1',
    key: 'price.cross',
    phase: 'entry',
    params: {},
    status: 'locked',
    source: 'user_explicit',
    openSlots: [],
    ...overrides,
  }
}

function combinationContract(params: Record<string, unknown>): SemanticAtomContract {
  return {
    id: `contract-${String(params.groupId)}`,
    kind: 'trigger',
    capabilities: [],
    requires: [],
    params,
  }
}
