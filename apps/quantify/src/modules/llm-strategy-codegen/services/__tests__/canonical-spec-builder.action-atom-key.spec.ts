/**
 * Issue #1313 PR5b — CanonicalRuleAction.atomKey 透传契约
 *
 * 验证 canonical-spec-builder 在以下 4 个构造点为 6 个 action atom 派生的 action
 * 挂载触发 atom 的 key：
 *
 *   - buildActionsForSemanticActionKey
 *     · open_long / open_short / close_long / close_short
 *
 *   - buildActionsForSemanticTrigger
 *     · 同上 4 atom（actionKeys.has(X) 命中分支）
 *     · execution.on_start fallback 分支 → 不挂 atomKey
 *
 *   - buildSemanticTriggerGroupActionVariants
 *     · 同上 4 atom（entry/exit 多变体）
 *     · allowDefaultOnStartAction fallback 分支 → 不挂 atomKey
 *
 *   - buildActionsForSemanticLifecycleAction
 *     · action.add_position → ADD_LONG/ADD_SHORT 挂 atomKey='action.add_position'
 *     · action.reverse_position → 展开 2 条均挂 atomKey='action.reverse_position'
 *
 * 边界：
 *   - 启发式 close（textStop / atrTakeProfit / outsideBandRisk）路径不挂 atomKey
 *   - reduce_position（不在 PR5b 6 atom 范围）不挂 atomKey
 *
 * Refs: #1313
 */

import type {
  SemanticActionState,
  SemanticTriggerState,
} from '../../types/semantic-state'
import type { CanonicalStrategySpecV2 } from '../../types/canonical-strategy-spec-v2'
import { CanonicalSpecBuilderService } from '../canonical-spec-builder.service'

// builder.service 内部本地类型，未对外导出 —— 此处用最小 shape mirror
interface SemanticTriggerCombinationGroupLike {
  groupId: string
  phase: 'entry' | 'exit' | 'risk' | 'gate'
  sideScope: 'long' | 'short' | 'both' | 'flat'
  members: SemanticTriggerState[]
  join: 'AND' | 'OR'
  actionKey?: string
}

interface BuilderPrivate {
  buildActionsForSemanticActionKey: (
    actionKey: string,
    sizing: CanonicalStrategySpecV2['sizing'],
  ) => Array<{ type: string, atomKey?: string }>
  buildActionsForSemanticTrigger: (
    trigger: SemanticTriggerState,
    actionKeys: Set<string>,
    sizing: CanonicalStrategySpecV2['sizing'],
  ) => Array<{ type: string, atomKey?: string }>
  buildSemanticTriggerGroupActionVariants: (
    group: SemanticTriggerCombinationGroupLike,
    actions: Array<{ type: string }>,
    actionKeys: Set<string>,
    sizing: CanonicalStrategySpecV2['sizing'],
  ) => Array<{ sideScope: string, actions: Array<{ type: string, atomKey?: string }> }>
  buildActionsForSemanticLifecycleAction: (
    action: SemanticActionState,
    defaultSizing: CanonicalStrategySpecV2['sizing'],
  ) => Array<{ type: string, atomKey?: string }>
}

function asPrivate(builder: CanonicalSpecBuilderService): BuilderPrivate {
  return builder as unknown as BuilderPrivate
}

function makeTrigger(overrides: Partial<SemanticTriggerState>): SemanticTriggerState {
  return {
    id: 'trigger-1',
    key: 'indicator.cross',
    phase: 'entry',
    sideScope: 'long',
    params: {},
    status: 'locked',
    source: 'user_explicit',
    openSlots: [],
    ...overrides,
  }
}

function makeCombinationGroup(overrides: Partial<SemanticTriggerCombinationGroupLike>): SemanticTriggerCombinationGroupLike {
  return {
    groupId: 'group-1',
    phase: 'entry',
    sideScope: 'both',
    members: [],
    join: 'AND',
    ...overrides,
  }
}

describe('CanonicalSpecBuilderService — #1313 PR5b 6 atom atomKey 透传', () => {
  let builder: CanonicalSpecBuilderService

  beforeEach(() => {
    builder = new CanonicalSpecBuilderService()
  })

  // -------------------------------------------------------------------------
  // 构造点 1：buildActionsForSemanticActionKey（4 atom 直接 switch）
  // -------------------------------------------------------------------------
  describe('buildActionsForSemanticActionKey', () => {
    const sizing: CanonicalStrategySpecV2['sizing'] = { mode: 'RATIO', value: 0.1 }

    it('open_long → OPEN_LONG 挂 atomKey=action.open_long', () => {
      const actions = asPrivate(builder).buildActionsForSemanticActionKey('open_long', sizing)
      expect(actions).toEqual([{ type: 'OPEN_LONG', sizing, atomKey: 'action.open_long' }])
    })

    it('open_short → OPEN_SHORT 挂 atomKey=action.open_short', () => {
      const actions = asPrivate(builder).buildActionsForSemanticActionKey('open_short', sizing)
      expect(actions).toEqual([{ type: 'OPEN_SHORT', sizing, atomKey: 'action.open_short' }])
    })

    it('close_long → CLOSE_LONG 挂 atomKey=action.close_long', () => {
      const actions = asPrivate(builder).buildActionsForSemanticActionKey('close_long', null)
      expect(actions).toEqual([{ type: 'CLOSE_LONG', atomKey: 'action.close_long' }])
    })

    it('close_short → CLOSE_SHORT 挂 atomKey=action.close_short', () => {
      const actions = asPrivate(builder).buildActionsForSemanticActionKey('close_short', null)
      expect(actions).toEqual([{ type: 'CLOSE_SHORT', atomKey: 'action.close_short' }])
    })

    it('未知 actionKey → 返回空，不挂 atomKey', () => {
      const actions = asPrivate(builder).buildActionsForSemanticActionKey('unknown_key', null)
      expect(actions).toEqual([])
    })
  })

  // -------------------------------------------------------------------------
  // 构造点 2：buildActionsForSemanticTrigger
  // -------------------------------------------------------------------------
  describe('buildActionsForSemanticTrigger', () => {
    const sizing: CanonicalStrategySpecV2['sizing'] = { mode: 'RATIO', value: 0.1 }

    it('entry trigger + actionKeys=open_long → OPEN_LONG 挂 atomKey', () => {
      const trigger = makeTrigger({ phase: 'entry', sideScope: 'long' })
      const actions = asPrivate(builder).buildActionsForSemanticTrigger(trigger, new Set(['open_long']), sizing)
      expect(actions).toEqual([{ type: 'OPEN_LONG', sizing, atomKey: 'action.open_long' }])
    })

    it('entry trigger + actionKeys=open_short → OPEN_SHORT 挂 atomKey', () => {
      const trigger = makeTrigger({ phase: 'entry', sideScope: 'short' })
      const actions = asPrivate(builder).buildActionsForSemanticTrigger(trigger, new Set(['open_short']), sizing)
      expect(actions).toEqual([{ type: 'OPEN_SHORT', sizing, atomKey: 'action.open_short' }])
    })

    it('exit trigger + actionKeys=close_long → CLOSE_LONG 挂 atomKey', () => {
      const trigger = makeTrigger({ phase: 'exit', sideScope: 'long' })
      const actions = asPrivate(builder).buildActionsForSemanticTrigger(trigger, new Set(['close_long']), null)
      expect(actions).toEqual([{ type: 'CLOSE_LONG', atomKey: 'action.close_long' }])
    })

    it('exit trigger + actionKeys=close_short → CLOSE_SHORT 挂 atomKey', () => {
      const trigger = makeTrigger({ phase: 'exit', sideScope: 'short' })
      const actions = asPrivate(builder).buildActionsForSemanticTrigger(trigger, new Set(['close_short']), null)
      expect(actions).toEqual([{ type: 'CLOSE_SHORT', atomKey: 'action.close_short' }])
    })

    it('execution.on_start fallback（actionKeys 不命中）→ 不挂 atomKey', () => {
      const trigger = makeTrigger({ key: 'execution.on_start', phase: 'entry', sideScope: 'long' })
      const actions = asPrivate(builder).buildActionsForSemanticTrigger(trigger, new Set(), sizing)
      expect(actions).toEqual([{ type: 'OPEN_LONG', sizing }])
      expect(actions[0]).not.toHaveProperty('atomKey')
    })
  })

  // -------------------------------------------------------------------------
  // 构造点 3：buildSemanticTriggerGroupActionVariants
  // -------------------------------------------------------------------------
  describe('buildSemanticTriggerGroupActionVariants', () => {
    const sizing: CanonicalStrategySpecV2['sizing'] = { mode: 'RATIO', value: 0.1 }

    it('entry both-side group + actionKeys=open_long+open_short → 两 variant 均挂 atomKey', () => {
      const group = makeCombinationGroup({ phase: 'entry', sideScope: 'both' })
      const variants = asPrivate(builder).buildSemanticTriggerGroupActionVariants(
        group,
        [],
        new Set(['open_long', 'open_short']),
        sizing,
      )

      const longVariant = variants.find(v => v.sideScope === 'long')
      const shortVariant = variants.find(v => v.sideScope === 'short')
      expect(longVariant?.actions).toEqual([{ type: 'OPEN_LONG', sizing, atomKey: 'action.open_long' }])
      expect(shortVariant?.actions).toEqual([{ type: 'OPEN_SHORT', sizing, atomKey: 'action.open_short' }])
    })

    it('exit both-side group + actionKeys=close_long+close_short → 合并 variant 中两 close 均挂 atomKey', () => {
      const group = makeCombinationGroup({ phase: 'exit', sideScope: 'both' })
      const variants = asPrivate(builder).buildSemanticTriggerGroupActionVariants(
        group,
        [],
        new Set(['close_long', 'close_short']),
        null,
      )

      expect(variants).toHaveLength(1)
      expect(variants[0]?.sideScope).toBe('both')
      expect(variants[0]?.actions).toEqual([
        { type: 'CLOSE_LONG', atomKey: 'action.close_long' },
        { type: 'CLOSE_SHORT', atomKey: 'action.close_short' },
      ])
    })
  })

  // -------------------------------------------------------------------------
  // 构造点 4：buildActionsForSemanticLifecycleAction（add_position + reverse_position）
  // -------------------------------------------------------------------------
  describe('buildActionsForSemanticLifecycleAction', () => {
    const defaultSizing: CanonicalStrategySpecV2['sizing'] = { mode: 'RATIO', value: 0.1 }

    it('action.add_position（long）→ ADD_LONG 挂 atomKey=action.add_position', () => {
      const action: SemanticActionState = {
        id: 'add-1',
        key: 'action.add_position',
        status: 'locked',
        source: 'user_explicit',
        params: { sideScope: 'long', addMode: 'signal_confirm', addRatio: 0.5 },
      }
      const actions = asPrivate(builder).buildActionsForSemanticLifecycleAction(action, defaultSizing)
      expect(actions).toHaveLength(1)
      expect(actions[0]).toMatchObject({ type: 'ADD_LONG', atomKey: 'action.add_position' })
    })

    it('action.add_position（short）→ ADD_SHORT 挂 atomKey=action.add_position', () => {
      const action: SemanticActionState = {
        id: 'add-2',
        key: 'action.add_position',
        status: 'locked',
        source: 'user_explicit',
        params: { sideScope: 'short', addMode: 'signal_confirm', addRatio: 0.5 },
      }
      const actions = asPrivate(builder).buildActionsForSemanticLifecycleAction(action, defaultSizing)
      expect(actions).toHaveLength(1)
      expect(actions[0]).toMatchObject({ type: 'ADD_SHORT', atomKey: 'action.add_position' })
    })

    it('action.reverse_position（long→short, explicit sizing）→ 2 条均挂 atomKey=action.reverse_position', () => {
      const action: SemanticActionState = {
        id: 'reverse-1',
        key: 'action.reverse_position',
        status: 'locked',
        source: 'user_explicit',
        params: { fromSide: 'long', toSide: 'short', sizingSource: 'explicit' },
      }
      const actions = asPrivate(builder).buildActionsForSemanticLifecycleAction(action, defaultSizing)
      expect(actions).toHaveLength(2)
      expect(actions[0]).toMatchObject({ type: 'CLOSE_LONG', atomKey: 'action.reverse_position' })
      expect(actions[1]).toMatchObject({ type: 'OPEN_SHORT', atomKey: 'action.reverse_position' })
    })

    it('action.reverse_position（short→long, current_position sizing）→ 2 条均挂 atomKey=action.reverse_position', () => {
      const action: SemanticActionState = {
        id: 'reverse-2',
        key: 'action.reverse_position',
        status: 'locked',
        source: 'user_explicit',
        params: { fromSide: 'short', toSide: 'long', sizingSource: 'current_position' },
      }
      const actions = asPrivate(builder).buildActionsForSemanticLifecycleAction(action, defaultSizing)
      expect(actions).toHaveLength(2)
      expect(actions[0]).toMatchObject({ type: 'CLOSE_SHORT', atomKey: 'action.reverse_position' })
      expect(actions[1]).toMatchObject({ type: 'OPEN_LONG', atomKey: 'action.reverse_position' })
    })

    it('action.reduce_position 不在 PR5b 6 atom 范围 → 不挂 atomKey', () => {
      const action: SemanticActionState = {
        id: 'reduce-1',
        key: 'action.reduce_position',
        status: 'locked',
        source: 'user_explicit',
        params: { sideScope: 'long', reduceBasis: 'ratio', reduceValue: 0.5 },
      }
      const actions = asPrivate(builder).buildActionsForSemanticLifecycleAction(action, defaultSizing)
      expect(actions).toHaveLength(1)
      expect(actions[0]?.type).toBe('REDUCE_LONG')
      expect(actions[0]).not.toHaveProperty('atomKey')
    })
  })
})
