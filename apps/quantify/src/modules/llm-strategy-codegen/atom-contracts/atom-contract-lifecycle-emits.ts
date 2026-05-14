/**
 * LIFECYCLE_ATOM_EMITS — Issue #1313 PR4 兑现的 lifecycle-level atom emit shape。
 *
 * 当前仅含 `position.pyramiding_limit`：通过 `emit.lifecyclePyramidingShape`
 * 完成 spec-level pyramiding 聚合（{ allow, maxLayers }），行为严格 mirror
 * `canonical-spec-v2-ir-compiler.service.ts#resolveLifecyclePyramiding` 原逻辑
 * （L3631-L3646）。IR compiler 在 spec 编译末段查 REGISTRY 单次调用本 shape，
 * 不再走 service 私有 helper。
 *
 * dispatcher 调用契约：
 *   - 输入 `rules: readonly RuleLikeInput[]`：实际类型是 `CanonicalRuleV2[]`
 *     （由 caller cast 为 RuleLikeInput 占位以避免 atom-contracts → canonical-strategy-ir
 *     反向 import 形成环；shape 在 emit.types `RuleLikeInput` 定义已显式声明）。
 *   - `SpecLevelEmitContext`：携带 compileContext / helpers，本 shape 实现纯函数式，
 *     不读写 ctx；保留参数以维持接口一致，后续 spec-level emit shape（orchestration
 *     portfolio risk 等）需要 helpers 时无需调整签名。
 *
 * 与 `CONDITION_ATOM_EMITS` 同形：仅声明 `capabilityStatus` + 对应 shape 字段 +
 * irShape sentinel；`capability` 三元组与 `evidenceSource` 由 `createPr1bEmit`
 * 继承，与 dispatcher self-baseline snapshot 保持一致。
 */

import type {
  AtomContractEmit,
  AtomContractKey,
  IrShapeBuilder,
  LifecyclePyramidingShape,
} from './atom-contract-types'

/**
 * lifecyclePyramidingIrShape —— pr3e-lifecycle 状态的 `emit.irShape` sentinel。
 *
 * Issue #1343：pr3e-* atom 的 irShape sentinel 必须带 `__notApplicable: true`
 * brand，与 `'irshape-not-applicable'` 状态共用 sentinel 形态。atom-coverage spec
 * (`atom-coverage-full-registration.spec.ts`) 将 pr3e-* 状态归入 isNotApplicableShape
 * 分支，要求 `irShape.__notApplicable === true`。运行时若被 compileAtom 误调度
 * （不应发生，因为 `position.pyramiding_limit` bucket 是 positionConstraint，不参与
 * condition 调度）即抛错 fail-loud。
 */
const lifecyclePyramidingIrShape: IrShapeBuilder = Object.assign(
  (() => {
    throw new Error(
      '[#1313 PR4] position.pyramiding_limit emits via emit.lifecyclePyramidingShape, not emit.irShape (capabilityStatus = pr3e-lifecycle)',
    )
  }) as IrShapeBuilder,
  { __notApplicable: true as const },
)

/**
 * lifecyclePyramidingShape —— mirror
 * `canonical-spec-v2-ir-compiler.service.ts#resolveLifecyclePyramiding` (L3631-L3646)。
 *
 * 行为等价（IR snapshot 守门）：
 *   1. 收集 rules[].metadata.addPosition 非 undefined 子集
 *   2. allow = (rules 中存在 ADD_LONG/ADD_SHORT action) || addPositionMetadata 非空
 *   3. maxLayers = max(1, ...addPositionMetadata.map(m =>
 *        Number.isFinite(m.maxLayers) && m.maxLayers > 0 ? floor(m.maxLayers) : 1))
 *
 * `RuleLikeInput` 是 `Readonly<Record<string, unknown>>` 占位类型（避免反向 import
 * 形成 atom-contracts → canonical-strategy-ir 环）。实际运行时 caller 传入
 * `CanonicalRuleV2[]`，通过 narrow type guard 读取 `metadata.addPosition.maxLayers`
 * 与 `actions[].type`。
 */
const lifecyclePyramidingShape: LifecyclePyramidingShape = (rules) => {
  const addPositionMetadata: Array<{ maxLayers?: unknown }> = []
  let hasAddAction = false

  for (const rule of rules) {
    const metadata = (rule as { metadata?: { addPosition?: { maxLayers?: unknown } } }).metadata
    if (metadata?.addPosition !== undefined && metadata.addPosition !== null) {
      addPositionMetadata.push(metadata.addPosition)
    }
    const actions = (rule as { actions?: ReadonlyArray<{ type?: string }> }).actions
    if (Array.isArray(actions)) {
      for (const action of actions) {
        if (action?.type === 'ADD_LONG' || action?.type === 'ADD_SHORT') {
          hasAddAction = true
          break
        }
      }
    }
  }

  const layerCandidates = addPositionMetadata.map((metadata) => {
    const layers = metadata.maxLayers
    return typeof layers === 'number' && Number.isFinite(layers) && layers > 0
      ? Math.floor(layers)
      : 1
  })

  return {
    allow: hasAddAction || addPositionMetadata.length > 0,
    maxLayers: Math.max(1, ...layerCandidates),
  }
}

/**
 * `LifecycleEmitOverride` —— 与 `ConditionEmitOverride` 同形：仅覆盖
 * `capabilityStatus` + `irShape` + `lifecyclePyramidingShape`；其余字段由
 * `createPr1bEmit` base 继承。
 */
export type LifecycleEmitOverride = Pick<
  AtomContractEmit,
  'capabilityStatus' | 'irShape' | 'lifecyclePyramidingShape'
>

export const LIFECYCLE_ATOM_EMITS = {
  'position.pyramiding_limit': {
    capabilityStatus: 'pr3e-lifecycle',
    irShape: lifecyclePyramidingIrShape,
    lifecyclePyramidingShape,
  },
} satisfies Partial<Record<AtomContractKey, LifecycleEmitOverride>>
