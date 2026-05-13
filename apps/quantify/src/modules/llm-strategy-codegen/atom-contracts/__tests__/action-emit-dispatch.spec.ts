/**
 * Issue #1313 PR5c 决策守门：action-level atom emit shape 落地状态 + dispatcher 路由。
 *
 * 锁住 PR5c 关键决策：
 *   1. 6 个 action atom（`action.open_long` / `action.close_long` /
 *      `action.open_short` / `action.close_short` / `action.add_position` /
 *      `action.reverse_position`）的 `capabilityStatus === 'pr3e-action'` +
 *      `emit.actionShape` 已挂载且与 `compileActions` legacy 行为等价。
 *   2. REGISTRY 拿到的 actionShape === ACTION_ATOM_EMITS 源同一引用
 *      （守门 completePr1bRegistry 合并链路，防止未来误改 spread 顺序丢失 override）。
 *   3. dispatcher（compileActions）byte-equal 行为（含 reverse_position 双 action 展开）
 *      由 atom-coverage-ir-end-to-end.contract.spec.ts snapshot 兜底；本 spec 仅做
 *      契约状态守门 + per-atom shape spot-check。
 */

import type { CanonicalRuleAction, CanonicalRuleV2, CanonicalStrategySpecV2 } from '../../types/canonical-strategy-spec-v2'
import type { ActionDef } from '../../types/canonical-strategy-ir'
import type { IrCompileHelpers, RuleLevelEmitContext } from '../atom-contract-emit.types'
import { ATOM_CONTRACT_REGISTRY } from '../atom-contract-registry'
import { ACTION_ATOM_EMITS } from '../atom-contract-action-emits'

const ACTION_ATOM_KEYS = [
  'action.open_long',
  'action.close_long',
  'action.open_short',
  'action.close_short',
  'action.add_position',
  'action.reverse_position',
] as const

// mirror service 私有 `resolveActionQuantity`（canonical-spec-v2-ir-compiler.service.ts
//   L3585-L3625）；本 spec 独立 mock 调用方需要的 helper，避免拉起整个 NestJS DI。
//   `compileActions` 走 REGISTRY 调度路径只调用 `resolveActionQuantity`，其它 helper
//   走 `{} as never` 占位即可（per-atom shape 不消费）。
const mockResolveActionQuantity: IrCompileHelpers['resolveActionQuantity'] = (action, defaultSizing, fallbackPositionPct) => {
  const sizing = action.sizing ?? defaultSizing
  if (!sizing) {
    return { mode: 'pct_equity', value: fallbackPositionPct }
  }
  if (sizing.mode === 'RATIO') {
    return {
      mode: 'pct_equity',
      value: sizing.value <= 1 ? Number((sizing.value * 100).toFixed(4)) : sizing.value,
    }
  }
  return { mode: 'fixed_quote', value: sizing.value }
}

const baseHelpers = { resolveActionQuantity: mockResolveActionQuantity } as unknown as IrCompileHelpers
const baseContext = { compileContext: {} as never, helpers: baseHelpers, seed: 'rule_0' } as unknown as RuleLevelEmitContext

const baseRule = { id: 'rule_0', actions: [] } as unknown as CanonicalRuleV2
const baseSpec = { sizing: { mode: 'RATIO' as const, value: 0.5 } } as unknown as CanonicalStrategySpecV2

function invokeShape(
  key: typeof ACTION_ATOM_KEYS[number],
  action: CanonicalRuleAction,
  spec: CanonicalStrategySpecV2 = baseSpec,
  fallback = 10,
): readonly ActionDef[] {
  const emit = ATOM_CONTRACT_REGISTRY[key].emit
  return emit.actionShape!(
    { kind: 'atom', key },
    action as unknown as Readonly<Record<string, unknown>>,
    baseRule as unknown as Readonly<Record<string, unknown>>,
    spec as unknown as Readonly<Record<string, unknown>>,
    fallback,
    baseContext,
  ) as unknown as readonly ActionDef[]
}

describe('Issue #1313 PR5c action atom emit decision', () => {
  describe.each(ACTION_ATOM_KEYS)('atom %s', (key) => {
    const emit = ATOM_CONTRACT_REGISTRY[key].emit

    it('capabilityStatus 升级为 pr3e-action', () => {
      expect(emit.capabilityStatus).toBe('pr3e-action')
    })

    it('actionShape 已挂载', () => {
      expect(typeof emit.actionShape).toBe('function')
    })

    it('irShape 仍是 NotApplicable brand（PR5c 不改 irShape sentinel；action atom 不走 compileAtom 路径）', () => {
      const irShape = emit.irShape as { __pr1bStub?: true; __notApplicable?: true }
      // 6 个 action atom 在 PR5c 前为 'irshape-not-applicable'，PR5c 仅替换
      //   `capabilityStatus` 与 `actionShape`；createPr1bEmit base 的 irShape sentinel
      //   被保留，与 condition / risk-guard atom 的处理同形（PR5b 已审计）。
      expect(irShape.__notApplicable).toBe(true)
      expect(irShape.__pr1bStub).toBeUndefined()
    })

    it('REGISTRY 拿到的 actionShape === ACTION_ATOM_EMITS 源引用', () => {
      expect(emit.actionShape).toBe(ACTION_ATOM_EMITS[key].actionShape)
    })
  })

  describe('action.open_long shape', () => {
    it('OPEN_LONG → quantity 走 resolveActionQuantity（RATIO 0.5 → pct_equity 50）', () => {
      const result = invokeShape('action.open_long', { type: 'OPEN_LONG', atomKey: 'action.open_long' })
      expect(result).toEqual([{ kind: 'OPEN_LONG', quantity: { mode: 'pct_equity', value: 50 } }])
    })
  })

  describe('action.open_short shape', () => {
    it('OPEN_SHORT → quantity 走 resolveActionQuantity', () => {
      const result = invokeShape('action.open_short', { type: 'OPEN_SHORT', atomKey: 'action.open_short' })
      expect(result).toEqual([{ kind: 'OPEN_SHORT', quantity: { mode: 'pct_equity', value: 50 } }])
    })
  })

  describe('action.close_long shape', () => {
    it('CLOSE_LONG → quantity 固定 position_pct 100', () => {
      const result = invokeShape('action.close_long', { type: 'CLOSE_LONG', atomKey: 'action.close_long' })
      expect(result).toEqual([{ kind: 'CLOSE_LONG', quantity: { mode: 'position_pct', value: 100 } }])
    })
  })

  describe('action.close_short shape', () => {
    it('CLOSE_SHORT → quantity 固定 position_pct 100', () => {
      const result = invokeShape('action.close_short', { type: 'CLOSE_SHORT', atomKey: 'action.close_short' })
      expect(result).toEqual([{ kind: 'CLOSE_SHORT', quantity: { mode: 'position_pct', value: 100 } }])
    })
  })

  describe('action.add_position shape', () => {
    it('ADD_LONG → quantity 走 resolveActionQuantity', () => {
      const result = invokeShape('action.add_position', {
        type: 'ADD_LONG',
        sizing: { mode: 'RATIO', value: 0.3 },
        atomKey: 'action.add_position',
      })
      expect(result).toEqual([{ kind: 'ADD_LONG', quantity: { mode: 'pct_equity', value: 30 } }])
    })

    it('ADD_SHORT → quantity 走 resolveActionQuantity', () => {
      const result = invokeShape('action.add_position', {
        type: 'ADD_SHORT',
        sizing: { mode: 'RATIO', value: 0.2 },
        atomKey: 'action.add_position',
      })
      expect(result).toEqual([{ kind: 'ADD_SHORT', quantity: { mode: 'pct_equity', value: 20 } }])
    })

    it('PR6 fail-loud：action.type 非 ADD_* 时抛错（不再 silent 回落 enum）', () => {
      expect(() => invokeShape('action.add_position', {
        type: 'OPEN_LONG',
        atomKey: 'action.add_position',
      })).toThrow(/PR6.*action\.add_position/)
    })
  })

  describe('action.reverse_position shape (双 action 展开)', () => {
    it('CLOSE_LONG 分支 → position_pct 100', () => {
      const result = invokeShape('action.reverse_position', {
        type: 'CLOSE_LONG',
        atomKey: 'action.reverse_position',
      })
      expect(result).toEqual([{ kind: 'CLOSE_LONG', quantity: { mode: 'position_pct', value: 100 } }])
    })

    it('CLOSE_SHORT 分支 → position_pct 100', () => {
      const result = invokeShape('action.reverse_position', {
        type: 'CLOSE_SHORT',
        atomKey: 'action.reverse_position',
      })
      expect(result).toEqual([{ kind: 'CLOSE_SHORT', quantity: { mode: 'position_pct', value: 100 } }])
    })

    it('OPEN_LONG 分支 → 走 resolveActionQuantity', () => {
      const result = invokeShape('action.reverse_position', {
        type: 'OPEN_LONG',
        sizing: { mode: 'RATIO', value: 1 },
        atomKey: 'action.reverse_position',
      })
      expect(result).toEqual([{ kind: 'OPEN_LONG', quantity: { mode: 'pct_equity', value: 100 } }])
    })

    it('OPEN_SHORT 分支 → 走 resolveActionQuantity', () => {
      const result = invokeShape('action.reverse_position', {
        type: 'OPEN_SHORT',
        sizing: { mode: 'RATIO', value: 0.8 },
        atomKey: 'action.reverse_position',
      })
      expect(result).toEqual([{ kind: 'OPEN_SHORT', quantity: { mode: 'pct_equity', value: 80 } }])
    })

    it('PR6 fail-loud：action.type 非 OPEN/CLOSE 时抛错', () => {
      expect(() => invokeShape('action.reverse_position', {
        type: 'ADD_LONG',
        atomKey: 'action.reverse_position',
      })).toThrow(/PR6.*action\.reverse_position/)
    })
  })

  describe('completePr1bRegistry 合并守门', () => {
    it('action atom 的 irShape 与 condition / risk-guard 同形（NotApplicable sentinel，不带 pr1bStub brand）', () => {
      for (const key of ACTION_ATOM_KEYS) {
        const irShape = ATOM_CONTRACT_REGISTRY[key].emit.irShape as {
          __pr1bStub?: true
          __notApplicable?: true
        }
        expect(irShape.__pr1bStub).toBeUndefined()
        expect(irShape.__notApplicable).toBe(true)
      }
    })
  })
})
