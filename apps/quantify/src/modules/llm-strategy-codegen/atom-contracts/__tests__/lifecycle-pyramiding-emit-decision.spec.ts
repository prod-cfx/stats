/**
 * Issue #1313 PR4 决策守门：lifecycle-level atom emit shape 落地状态。
 *
 * 锁住两条 PR4 关键决策：
 *   1. `position.pyramiding_limit` capabilityStatus === 'pr3e-lifecycle'，
 *      `lifecyclePyramidingShape` 已挂载且与 `resolveLifecyclePyramiding`
 *      legacy 行为等价（spot-check：覆盖 allow / maxLayers 各分支）。
 *   2. `position.dca_schedule` 显式决策方案 B：保持 capabilityStatus =
 *      'irshape-not-applicable'，不引入第 5 类 emit shape。
 *
 * IR 字节级等价由 `atom-coverage-ir-end-to-end.contract.spec.ts` snapshot 兜底；
 * 本 spec 仅做契约状态守门，避免后续 PR 误改 capabilityStatus。
 */

import { ATOM_CONTRACT_REGISTRY } from '../atom-contract-registry'
import { LIFECYCLE_ATOM_EMITS } from '../atom-contract-lifecycle-emits'

describe('Issue #1313 PR4 lifecycle pyramiding emit decision', () => {
  const pyramidingEmit = ATOM_CONTRACT_REGISTRY['position.pyramiding_limit'].emit
  const dcaScheduleEmit = ATOM_CONTRACT_REGISTRY['position.dca_schedule'].emit

  describe('position.pyramiding_limit (pr3e-lifecycle 迁移)', () => {
    it('capabilityStatus 升级为 pr3e-lifecycle', () => {
      expect(pyramidingEmit.capabilityStatus).toBe('pr3e-lifecycle')
    })

    it('lifecyclePyramidingShape 已挂载', () => {
      expect(typeof pyramidingEmit.lifecyclePyramidingShape).toBe('function')
    })

    it('irShape 退化为非 brand sentinel（fail-loud；与 NotApplicable / Pr1bStub 分离）', () => {
      const irShape = pyramidingEmit.irShape as {
        __pr1bStub?: true
        __notApplicable?: true
      }
      expect(irShape.__pr1bStub).toBeUndefined()
      expect(irShape.__notApplicable).toBeUndefined()
    })

    it('shape allow=true 当 rules 含 ADD_LONG action（无 metadata）', () => {
      const result = pyramidingEmit.lifecyclePyramidingShape!(
        [
          { actions: [{ type: 'ADD_LONG' }], metadata: {} },
        ],
        { compileContext: {} as never, helpers: {} as never },
      )
      expect(result).toEqual({ allow: true, maxLayers: 1 })
    })

    it('shape allow=true + maxLayers 由 metadata.addPosition.maxLayers floor', () => {
      const result = pyramidingEmit.lifecyclePyramidingShape!(
        [
          { actions: [], metadata: { addPosition: { maxLayers: 3.7 } } },
          { actions: [], metadata: { addPosition: { maxLayers: 2 } } },
        ],
        { compileContext: {} as never, helpers: {} as never },
      )
      expect(result).toEqual({ allow: true, maxLayers: 3 })
    })

    it('shape allow=false + maxLayers=1 当 rules 既无 ADD action 也无 addPosition metadata', () => {
      const result = pyramidingEmit.lifecyclePyramidingShape!(
        [{ actions: [{ type: 'OPEN_LONG' }], metadata: {} }],
        { compileContext: {} as never, helpers: {} as never },
      )
      expect(result).toEqual({ allow: false, maxLayers: 1 })
    })

    it('shape 跳过非法 maxLayers（NaN / <=0 / 非 number）回退 1', () => {
      const result = pyramidingEmit.lifecyclePyramidingShape!(
        [
          { actions: [], metadata: { addPosition: { maxLayers: Number.NaN } } },
          { actions: [], metadata: { addPosition: { maxLayers: 0 } } },
          { actions: [], metadata: { addPosition: { maxLayers: '5' } } },
        ],
        { compileContext: {} as never, helpers: {} as never },
      )
      expect(result).toEqual({ allow: true, maxLayers: 1 })
    })

    it('irShape sentinel 被误调度即抛 PR4 错误（fail-loud 兜底）', () => {
      expect(() => pyramidingEmit.irShape({} as never, {} as never)).toThrow(/PR4.*lifecyclePyramidingShape/)
    })

    // Critic Round 1：addPosition: null 边界。原 service helper 仅 filter !== undefined，
    //   null 会泄漏到下游 `metadata.maxLayers` 访问导致 TypeError；本 PR shape 顺手
    //   收紧为 !== undefined && !== null，回退 maxLayers=1 而非崩溃。锁定新语义。
    it('shape 顺手挡住 addPosition: null（原 helper 会抛 TypeError）', () => {
      const result = pyramidingEmit.lifecyclePyramidingShape!(
        [{ actions: [{ type: 'ADD_LONG' }], metadata: { addPosition: null } }],
        { compileContext: {} as never, helpers: {} as never },
      )
      expect(result).toEqual({ allow: true, maxLayers: 1 })
    })

    // Critic Round 1：锁定 completePr1bRegistry 合并链路 —— REGISTRY 内的 shape 必须
    //   === LIFECYCLE_ATOM_EMITS 源 shape 同一引用。防止未来误改合并优先级把
    //   lifecycleOverride 丢失，让"运行时 if (!shape) throw 兜底"被绕过。
    it('REGISTRY 拿到的 lifecyclePyramidingShape === LIFECYCLE_ATOM_EMITS 源引用', () => {
      expect(pyramidingEmit.lifecyclePyramidingShape).toBe(
        LIFECYCLE_ATOM_EMITS['position.pyramiding_limit'].lifecyclePyramidingShape,
      )
    })
  })

  describe('position.dca_schedule (方案 B：保持 irshape-not-applicable)', () => {
    it('capabilityStatus 保持 irshape-not-applicable（IR 编译期无独立产出）', () => {
      expect(dcaScheduleEmit.capabilityStatus).toBe('irshape-not-applicable')
    })

    it('未引入任何 pr3e-* emit shape 字段', () => {
      expect(dcaScheduleEmit.lifecyclePyramidingShape).toBeUndefined()
      expect(dcaScheduleEmit.riskGuardShape).toBeUndefined()
      expect(dcaScheduleEmit.ruleBlockShape).toBeUndefined()
      expect(dcaScheduleEmit.orchestrationPortfolioRiskShape).toBeUndefined()
    })

    it('irShape 是 NotApplicable brand（与 pyramiding_limit 的 PR4 sentinel 分离）', () => {
      const irShape = dcaScheduleEmit.irShape as { __notApplicable?: true }
      expect(irShape.__notApplicable).toBe(true)
    })
  })
})
