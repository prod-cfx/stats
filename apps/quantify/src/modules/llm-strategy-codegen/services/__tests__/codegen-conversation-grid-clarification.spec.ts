/**
 * Issue #1403 子故障 A 回归 spec —— 真用户场景。
 *
 * 用户实测输入「15m 周期，价格区间 79200-80200，采用双向网格」，
 *   UI 仍弹「请确认单笔仓位大小」追问。
 *
 * 真修复（通用方案）：
 *   - 旁路条件 = atom 在 `ATOM_FULFILLS_STRATEGY_PHASE` 自声明 `'sizing'`（即"持续
 *     sizing 源"，含 grid.range_rebalance / position.dca_schedule / position.pyramiding_limit /
 *     program.*_grid 等）
 *   - SemanticExecutableSemanticsService.anyAtomFulfillsPhase(state, 'sizing') 走 5
 *     个位置（trigger / action / risk / positionConstraint / orchestration / rules 树）
 *     的通用 phase 查表，无任何 atom-key 字面量分支
 *   - codegen-conversation.service.ts 与 semantic-state-projection.service.ts 共用
 *     此判定，避免覆盖不一致
 *
 * 本 spec 用 Object.create(prototype) 旁路 DI（与 codegen-conversation-rules-zod-graceful
 * 同模式），直接验证 findNextOpenSemanticSlot + listOpenSemanticSlots 在多种 sizing
 * 源位置下都能正确旁路 position openSlots。
 *
 * 扩展新策略只需 atom 自声明 'sizing'：本 spec 零修改。
 */

import { CodegenConversationService } from '../codegen-conversation.service'
import { SemanticExecutableSemanticsService } from '../semantic-executable-semantics.service'
import type { SemanticState } from '../../types/semantic-state'

function makeService(): CodegenConversationService {
  const service = Object.create(CodegenConversationService.prototype) as CodegenConversationService
  // 注入 executableSemantics 字段（与 constructor 默认值同形）
  ;(service as unknown as { executableSemantics: SemanticExecutableSemanticsService }).executableSemantics
    = new SemanticExecutableSemanticsService()
  return service
}

function emptyState(): SemanticState {
  return {
    version: 1,
    families: [],
    trigger: [],
    action: [],
    risk: [],
    position: null,
    positionConstraint: [],
    orchestration: [],
    orchestrationContracts: [],
    contextSlots: { exchange: null, symbol: null, marketType: null, timeframe: null },
    normalizationNotes: [],
    updatedAt: '2026-05-16T00:00:00.000Z',
  }
}

function positionOpenSlotState(state: SemanticState): SemanticState {
  return {
    ...state,
    position: {
      mode: 'fixed_ratio',
      value: 0,
      sizing: null,
      positionMode: 'long_only',
      status: 'open',
      source: 'derived',
      openSlots: [{
        slotKey: 'position.sizing',
        fieldPath: 'position.sizing',
        status: 'open',
        priority: 'risk',
        questionHint: '请确认单笔仓位大小（例如 10% / 10 USDT / 0.001 BTC）。',
        affectsExecution: true,
      }],
    } as unknown as SemanticState['position'],
  }
}

describe('CodegenConversationService — sizing 旁路（#1403 子故障 A，通用 phase 自声明）', () => {
  const service = makeService()
  const executableSemantics = new SemanticExecutableSemanticsService()
  const findNextOpen = (state: SemanticState) =>
    (service as unknown as { findNextOpenSemanticSlot: (s: SemanticState) => unknown }).findNextOpenSemanticSlot(state)
  const listOpen = (state: SemanticState) =>
    (service as unknown as { listOpenSemanticSlots: (s: SemanticState) => Array<{ slotKey: string }> }).listOpenSemanticSlots(state)

  describe('anyAtomFulfillsPhase(state, "sizing") — 通用判定', () => {
    it('positionConstraint 桶含 grid.range_rebalance → true（registry 声明 sizing）', () => {
      const state = {
        ...emptyState(),
        positionConstraint: [{
          id: 'pc1',
          key: 'grid.range_rebalance',
          status: 'locked' as const,
          source: 'user_explicit' as const,
          openSlots: [],
          params: {},
        }],
      } as unknown as SemanticState
      expect(executableSemantics.anyAtomFulfillsPhase(state, 'sizing')).toBe(true)
    })

    it('positionConstraint 桶含 position.dca_schedule → true（registry 同声明 sizing，未来 DCA 策略复用同一通道）', () => {
      const state = {
        ...emptyState(),
        positionConstraint: [{
          id: 'pc1',
          key: 'position.dca_schedule',
          status: 'locked' as const,
          source: 'user_explicit' as const,
          openSlots: [],
          params: {},
        }],
      } as unknown as SemanticState
      expect(executableSemantics.anyAtomFulfillsPhase(state, 'sizing')).toBe(true)
    })

    it('orchestration 含 program.dynamic_grid → true（registry 声明 sizing）', () => {
      const state = {
        ...emptyState(),
        orchestration: [{
          id: 'o1',
          kind: 'program' as const,
          key: 'program.dynamic_grid',
          status: 'locked' as const,
          openSlots: [],
          params: {},
        }],
      } as unknown as SemanticState
      expect(executableSemantics.anyAtomFulfillsPhase(state, 'sizing')).toBe(true)
    })

    it('orchestration 含 program.fixed_grid_gated → true', () => {
      const state = {
        ...emptyState(),
        orchestration: [{
          id: 'o1',
          kind: 'program' as const,
          key: 'program.fixed_grid_gated',
          status: 'locked' as const,
          openSlots: [],
          params: {},
        }],
      } as unknown as SemanticState
      expect(executableSemantics.anyAtomFulfillsPhase(state, 'sizing')).toBe(true)
    })

    it('rules 表达式树 effects 含 grid.range_rebalance → true', () => {
      const state = {
        ...emptyState(),
        rules: [{
          id: 'r1',
          phase: 'entry' as const,
          sideScope: 'both' as const,
          condition: { kind: 'atom' as const, key: 'execution.on_start', params: {} },
          effects: [{ kind: 'atom' as const, key: 'grid.range_rebalance', params: {} }],
        }],
      } as unknown as SemanticState
      expect(executableSemantics.anyAtomFulfillsPhase(state, 'sizing')).toBe(true)
    })

    it('反模式守门：families 字符串 "grid.range_rebalance" 不构成 sizing 源（必须是 atom 实例）', () => {
      const state = { ...emptyState(), families: ['grid.range_rebalance'] }
      expect(executableSemantics.anyAtomFulfillsPhase(state, 'sizing')).toBe(false)
    })

    it('反模式守门：未注册 atom key（如 grid.helper.diagnostic）查表返回 [] → false', () => {
      const state = {
        ...emptyState(),
        trigger: [{
          id: 't1',
          key: 'grid.helper.diagnostic',
          phase: 'entry' as const,
          sideScope: 'both' as const,
          params: {},
          status: 'locked' as const,
          source: 'derived' as const,
          openSlots: [],
          contracts: [],
        }] as unknown as SemanticState['trigger'],
      }
      expect(executableSemantics.anyAtomFulfillsPhase(state, 'sizing')).toBe(false)
    })

    it('空 state → false', () => {
      expect(executableSemantics.anyAtomFulfillsPhase(emptyState(), 'sizing')).toBe(false)
    })

    it('普通 entry trigger（price.candle_pattern，不声明 sizing）→ false（依然需要追问 single-trade sizing）', () => {
      const state = {
        ...emptyState(),
        trigger: [{
          id: 't1',
          key: 'price.candle_pattern',
          phase: 'entry' as const,
          sideScope: 'long' as const,
          params: {},
          status: 'locked' as const,
          source: 'user_explicit' as const,
          openSlots: [],
          contracts: [],
        }] as unknown as SemanticState['trigger'],
      }
      expect(executableSemantics.anyAtomFulfillsPhase(state, 'sizing')).toBe(false)
    })
  })

  describe('findNextOpenSemanticSlot 在 sizing 源在场时跳过 position.openSlots', () => {
    it('positionConstraint=grid.range_rebalance + position 有 sizing open slot → 不返回 position 追问', () => {
      const gridState = positionOpenSlotState({
        ...emptyState(),
        positionConstraint: [{
          id: 'pc1',
          key: 'grid.range_rebalance',
          status: 'locked' as const,
          source: 'user_explicit' as const,
          openSlots: [],
          params: {},
        }] as unknown as SemanticState['positionConstraint'],
      })
      const result = findNextOpen(gridState) as { slotKey?: string } | null
      expect(result?.slotKey).not.toBe('position.sizing')
    })

    it('无 sizing 源 + position 有 sizing open slot → 仍返回 position 追问（行为不变）', () => {
      const state = positionOpenSlotState(emptyState())
      const result = findNextOpen(state) as { slotKey?: string } | null
      expect(result?.slotKey).toBe('position.sizing')
    })
  })

  describe('listOpenSemanticSlots 在 sizing 源在场时不列 position open slots', () => {
    it('orchestration=program.dynamic_grid + position 有 sizing open slot → list 不含 position.sizing', () => {
      const gridState = positionOpenSlotState({
        ...emptyState(),
        orchestration: [{
          id: 'o1',
          kind: 'program' as const,
          key: 'program.dynamic_grid',
          status: 'locked' as const,
          openSlots: [],
          params: {},
        }] as unknown as SemanticState['orchestration'],
      })
      const slots = listOpen(gridState)
      expect(slots.find(s => s.slotKey === 'position.sizing')).toBeUndefined()
    })
  })
})
