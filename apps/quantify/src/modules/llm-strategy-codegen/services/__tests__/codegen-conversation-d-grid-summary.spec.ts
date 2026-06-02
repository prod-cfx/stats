/**
 * Issue #1403 子故障 D 回归 spec —— grid + 止损 复合场景。
 *
 * 用户实测路径：
 *   1) 配置完整 grid 策略（区间 / 数量 / 仓位 / context）
 *   2) 加 3% 止损 → 触发 planner 产生 exit rule 进入 state.rules
 *   3) 最后一轮 confirm：summary 只剩出场 rule，grid 整体消失
 *   4) 点确认 → "当前还不能稳定投影到可执行入场规则"
 *
 * 两条独立 root cause：
 *
 * A. semantic-state-projection.buildConversationView 在 rulesSummary 非空时
 *    **整段抛弃** positionSummary + orchestrationSummary。grid 在 positionConstraint /
 *    orchestration 桶，不在 state.rules 表达式树，所以止损 rule 一进 rules，grid 摘要消失。
 *    修复：rules 非空时仍附加桶专属 positionSummary + orchestrationSummary。
 *
 * B. codegen-conversation.evaluateCanonicalCompileability 只数 spec.rules 内的
 *    OPEN_ / ADD_ 系 action，未识别 spec.orderPrograms 路径。grid 走 orchestration
 *    program（program.fixed_grid_gated / dynamic_grid 等）时，rules 没 OPEN_*
 *    但 orderPrograms 已自洽，compileability 误判 entryRuleCount=0。
 *    修复：spec.orderPrograms 非空 → 视为 entry+exit 已被 program 路径承载。
 */

import { SemanticStateProjectionService } from '../semantic-state-projection.service'
import { CodegenConversationService } from '../codegen-conversation.service'
import type { SemanticState } from '../../types/semantic-state'

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

describe('Issue #1403 子故障 D — grid + 止损 summary/compileability 不再回归', () => {
  describe('A. buildConversationView 在 state.rules 非空时仍保留桶维度 grid 摘要', () => {
    const projection = new SemanticStateProjectionService()

    function gridRule(params: Record<string, unknown> = {}): NonNullable<SemanticState['rules']>[number] {
      return {
        id: 'r-grid',
        phase: 'entry',
        sideScope: 'both',
        condition: { kind: 'atom', key: 'execution.on_start', params: {} },
        effects: {
          actions: [],
          risks: [],
          positions: [{
            kind: 'atom',
            key: 'grid.range_rebalance',
            params: {
              rangeLower: 79200,
              rangeUpper: 80200,
              stepPct: 0.5,
              sideMode: 'bidirectional',
              ...params,
            },
          }],
          orchestration: [],
          programs: [],
        },
      }
    }

    function gridState(): SemanticState {
      return {
        ...emptyState(),
        // position 必须 locked 才能渲染 positionSummary（含 positionConstraint）
        position: {
          mode: 'fixed_quote',
          value: 100,
          sizing: { kind: 'quote', value: 100, asset: 'USDT' },
          positionMode: 'long_only',
          status: 'locked',
          source: 'user_explicit',
          openSlots: [],
        } as unknown as SemanticState['position'],
        rules: [gridRule()],
      } as unknown as SemanticState
    }

    it('rules 含 grid.range_rebalance + 止损 exit rule → summary 同时含 grid 与止损', () => {
      const state = {
        ...gridState(),
        rules: [
          gridRule(),
          {
            id: 'r-stop-loss',
            phase: 'exit' as const,
            sideScope: 'both' as const,
            condition: { kind: 'atom' as const, key: 'risk.stop_loss_pct', params: { valuePct: 0.03 } },
            effects: {
              actions: [],
              risks: [{ kind: 'atom' as const, key: 'risk.stop_loss_pct', params: { valuePct: 0.03 } }],
              positions: [],
              orchestration: [],
              programs: [],
            },
          },
        ],
      } as unknown as SemanticState

      const view = projection.buildConversationView(state)
      // 修复前：summary 只含 rules 渲染（出场止损），grid 整体消失
      // 修复后：summary 必须同时含 grid 信号 + 止损 rule 渲染
      expect(view.summary).toMatch(/网格区间再平衡/)
      // 止损 rule 渲染部分仍在
      expect(view.summary).toMatch(/止损|出场|exit/i)
    })

    it('rules tree 中 grid condition/effect 同时存在时摘要不泄漏内部参数且不重复渲染', () => {
      const state = {
        ...gridState(),
        rules: [{
          id: 'r-grid',
          phase: 'entry' as const,
          sideScope: 'both' as const,
          condition: {
            kind: 'atom' as const,
            key: 'grid.range_rebalance',
            params: {
              rangeLower: 79200,
              rangeUpper: 80200,
              centerOffsetPct: 0,
              levels: 0,
              stepPct: 0.1,
              perGridSizing: 10,
              sideMode: 'both',
            },
          },
          effects: {
            actions: [],
            risks: [],
            positions: [{
              kind: 'atom' as const,
              key: 'grid.range_rebalance',
              params: {
                rangeLower: 79200,
                rangeUpper: 80200,
                centerOffsetPct: 0,
                levels: 0,
                stepPct: 0.1,
                perGridSizing: 10,
                sideMode: 'both',
              },
            }],
            orchestration: [],
            programs: [],
          },
        }],
      } as unknown as SemanticState

      const view = projection.buildConversationView(state)

      expect(view.summary).toContain('双向')
      expect(view.summary).toContain('区间 79200-80200')
      expect(view.summary).toContain('每格 0.1%')
      expect(view.summary).toContain('每格 10')
      expect(view.summary).not.toContain('0，0')
      expect(view.summary).not.toContain('→ 网格区间再平衡')
    })

    it('rules tree 已承载 grid 时不重复渲染同一约束 atom', () => {
      const state = {
        ...gridState(),
        position: {
          mode: 'fixed_ratio',
          value: 0.1,
          sizing: { kind: 'ratio', value: 0.1, unit: 'ratio' },
          positionMode: 'long_short',
          status: 'locked',
          source: 'user_explicit',
          openSlots: [],
        },
        rules: [{
          id: 'r-grid',
          phase: 'entry' as const,
          sideScope: 'both' as const,
          condition: {
            kind: 'atom' as const,
            key: 'grid.range_rebalance',
            params: {
              rangeLower: 60000,
              rangeUpper: 80000,
              stepPct: 0.5,
              perGridSizing: 10,
              sideMode: 'both',
            },
          },
          effects: {
            actions: [],
            risks: [],
            positions: [{
              kind: 'atom' as const,
              key: 'grid.range_rebalance',
              params: {
                rangeLower: 60000,
                rangeUpper: 80000,
                stepPct: 0.5,
                perGridSizing: 10,
                sideMode: 'both',
              },
            }],
            orchestration: [],
            programs: [],
          },
        }],
      } as unknown as SemanticState

      const view = projection.buildConversationView(state)
      const gridMentions = view.summary.match(/网格区间再平衡/g) ?? []

      expect(gridMentions).toHaveLength(1)
      expect(view.summary).toContain('区间 60000-80000')
      expect(view.summary).toContain('每格 0.5%')
    })

    it('退出规则里的持仓技术 guard 不渲染到用户摘要，但止损止盈仍保留', () => {
      const state = {
        ...gridState(),
        rules: [
          {
            id: 'r-stop-loss',
            phase: 'exit' as const,
            sideScope: 'both' as const,
            condition: {
              kind: 'and' as const,
              children: [
                { kind: 'atom' as const, key: 'position.has_position', params: { sideScope: 'any' } },
                { kind: 'atom' as const, key: 'risk.stop_loss_pct', params: { valuePct: 5, basis: 'entry_avg_price' } },
              ],
            },
            effects: {
              actions: [],
              risks: [{ kind: 'atom' as const, key: 'risk.stop_loss_pct', params: { valuePct: 5, basis: 'entry_avg_price' } }],
              positions: [],
              orchestration: [],
              programs: [],
            },
          },
          {
            id: 'r-take-profit',
            phase: 'exit' as const,
            sideScope: 'both' as const,
            condition: {
              kind: 'and' as const,
              children: [
                { kind: 'atom' as const, key: 'position.has_position', params: { sideScope: 'any' } },
                { kind: 'atom' as const, key: 'risk.take_profit_pct', params: { valuePct: 10, basis: 'entry_avg_price' } },
              ],
            },
            effects: {
              actions: [],
              risks: [{ kind: 'atom' as const, key: 'risk.take_profit_pct', params: { valuePct: 10, basis: 'entry_avg_price' } }],
              positions: [],
              orchestration: [],
              programs: [],
            },
          },
        ],
      } as unknown as SemanticState

      const view = projection.buildConversationView(state)

      expect(view.summary).not.toContain('已有任意方向仓位')
      expect(view.summary).not.toContain('阻止新开仓')
      expect(view.summary).toContain('止损')
      expect(view.summary).toContain('止盈')
    })
  })

  describe('B. evaluateCanonicalCompileability 在 spec.orderPrograms 非空时视为 entry+exit 自洽', () => {
    const service = Object.create(CodegenConversationService.prototype) as CodegenConversationService
    const evaluate = (spec: {
      rules: Array<{ phase: string, actions: Array<{ type: string }> }>
      orderPrograms?: unknown[]
      orchestration?: { programs?: unknown[] }
    }) =>
      (service as unknown as { evaluateCanonicalCompileability: typeof CodegenConversationService.prototype['evaluateCanonicalCompileability'] })
        .evaluateCanonicalCompileability(spec as never)

    it('rules 为空 + orderPrograms 非空 → canCompile=true（grid orchestration 路径）', () => {
      const report = evaluate({ rules: [], orderPrograms: [{ programKind: 'fixed_grid_gated' } as unknown]})
      expect(report.canCompile).toBe(true)
      expect(report.reasons).toEqual([])
    })

    it('rules 为空 + orchestration.programs 非空 → canCompile=true（canonical v2 grid 路径）', () => {
      const report = evaluate({
        rules: [],
        orchestration: { programs: [{ programKind: 'fixed_grid_gated' }] },
      })

      expect(report.canCompile).toBe(true)
      expect(report.reasons).toEqual([])
    })

    it('rules 为空 + orderPrograms 缺失/空 → canCompile=false（保留旧行为）', () => {
      const report = evaluate({ rules: [] })
      expect(report.canCompile).toBe(false)
      expect(report.reasons).toContain('canonical_projection_missing_entry_program')
      expect(report.reasons).toContain('canonical_projection_missing_exit_program')
    })

    it('只有 entry rule 含 OPEN_LONG + 无 orderPrograms → 仍缺出场，canCompile=false', () => {
      const report = evaluate({
        rules: [{ phase: 'entry', actions: [{ type: 'OPEN_LONG' }] }],
      })
      expect(report.canCompile).toBe(false)
      expect(report.reasons).toContain('canonical_projection_missing_exit_program')
    })

    it('orderPrograms 非空 → 即使只有 entry rule 也允许（orderPrograms 自带 exit 边界）', () => {
      const report = evaluate({
        rules: [{ phase: 'entry', actions: [{ type: 'OPEN_LONG' }] }],
        orderPrograms: [{ programKind: 'dynamic_grid' } as unknown],
      })
      expect(report.canCompile).toBe(true)
    })
  })
})
