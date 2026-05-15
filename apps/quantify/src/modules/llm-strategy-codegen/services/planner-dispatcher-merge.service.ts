import { Injectable } from '@nestjs/common'

import type { CodegenSemanticPatch } from '../types/codegen-semantic-patch'

/**
 * Issue #1383：planner 输出常常只包含 trigger/action/risk 桶；positionConstraint /
 * orchestration 桶 atom（如 grid.range_rebalance、position.dca_schedule、
 * program.event_listener）需要 regex/keyword 的 GenericSeedDispatcher 补齐。
 *
 * 本服务把 planner JSON patch 与 dispatcher patch 做 union-merge：
 * - atoms / triggers / actions / risk：identity = (key, phase, stableParamsHash)，
 *   同 identity 时 planner 条目优先（携带 LLM evidence/source）。
 * - contextSlots：浅合并，planner 字段优先。
 * - position：dispatcher 优先（regex 抽取数值更稳），constraints union+dedup。
 * - orchestration.nodes：union dedup（优先 id；无 id 时 (key, stableParamsHash)）。
 *
 * 规则按 bucket 通用化，禁止针对具体 atom 写特例。
 */
@Injectable()
export class PlannerDispatcherMergeService {
  mergePlannerAndDispatcherPatches(
    plannerPatch: CodegenSemanticPatch | null | undefined,
    dispatcherPatch: CodegenSemanticPatch | null | undefined,
  ): CodegenSemanticPatch | null {
    const plannerHas = this.isNonEmpty(plannerPatch)
    const dispatcherHas = this.isNonEmpty(dispatcherPatch)
    if (!plannerHas && !dispatcherHas) return null
    if (plannerHas && !dispatcherHas) return plannerPatch as CodegenSemanticPatch
    if (!plannerHas && dispatcherHas) return dispatcherPatch as CodegenSemanticPatch

    const planner = plannerPatch as CodegenSemanticPatch
    const dispatcher = dispatcherPatch as CodegenSemanticPatch
    const merged: CodegenSemanticPatch = {}

    // contextSlots：planner 优先（NL 理解 symbol/timeframe 更广）。
    const ctxPlanner = planner.contextSlots
    const ctxDispatcher = dispatcher.contextSlots
    if (ctxPlanner || ctxDispatcher) {
      merged.contextSlots = { ...(ctxDispatcher ?? {}), ...(ctxPlanner ?? {}) }
    }

    // atoms / triggers / actions / risk：identity dedup，planner 条目优先。
    const atoms = this.unionDedupByIdentity(planner.atoms, dispatcher.atoms)
    if (atoms) merged.atoms = atoms
    const triggers = this.unionDedupByIdentity(planner.triggers, dispatcher.triggers)
    if (triggers) merged.triggers = triggers
    const actions = this.unionDedupByIdentity(planner.actions, dispatcher.actions)
    if (actions) merged.actions = actions
    const risk = this.unionDedupByIdentity(planner.risk, dispatcher.risk)
    if (risk) merged.risk = risk

    // position：dispatcher 优先（regex 数值更准），constraints union+dedup。
    if (planner.position || dispatcher.position) {
      const base = dispatcher.position ?? planner.position
      if (base) {
        const constraints = this.unionDedupByKeyAndHash(
          planner.position?.constraints,
          dispatcher.position?.constraints,
          dispatcher.position ? 'right' : 'left',
        )
        merged.position = {
          ...base,
          ...(constraints ? { constraints } : (base.constraints ? { constraints: base.constraints } : {})),
        }
      }
      else {
        merged.position = base
      }
    }

    // orchestration.nodes：union dedup。
    const plannerNodes = planner.orchestration?.nodes
    const dispatcherNodes = dispatcher.orchestration?.nodes
    if ((plannerNodes && plannerNodes.length) || (dispatcherNodes && dispatcherNodes.length)) {
      const nodes = this.unionDedupOrchestrationNodes(plannerNodes, dispatcherNodes)
      if (nodes && nodes.length > 0) {
        merged.orchestration = { nodes }
      }
    }

    return merged
  }

  private isNonEmpty(patch: CodegenSemanticPatch | null | undefined): boolean {
    if (!patch) return false
    if (patch.contextSlots && Object.keys(patch.contextSlots).length > 0) return true
    if (patch.atoms && patch.atoms.length > 0) return true
    if (patch.triggers && patch.triggers.length > 0) return true
    if (patch.actions && patch.actions.length > 0) return true
    if (patch.risk && patch.risk.length > 0) return true
    if (patch.position) return true
    if (patch.orchestration?.nodes && patch.orchestration.nodes.length > 0) return true
    return false
  }

  private unionDedupByIdentity<T extends { key: string, phase?: string, params?: Record<string, unknown> }>(
    plannerList: readonly T[] | undefined,
    dispatcherList: readonly T[] | undefined,
  ): T[] | undefined {
    if (!plannerList?.length && !dispatcherList?.length) return undefined
    const seen = new Map<string, T>()
    const order: string[] = []
    // planner 先入队，享有 identity 优先权。
    for (const entry of plannerList ?? []) {
      const id = this.atomIdentity(entry)
      if (!seen.has(id)) {
        seen.set(id, entry)
        order.push(id)
      }
    }
    for (const entry of dispatcherList ?? []) {
      const id = this.atomIdentity(entry)
      if (!seen.has(id)) {
        seen.set(id, entry)
        order.push(id)
      }
    }
    return order.map(id => seen.get(id) as T)
  }

  private unionDedupByKeyAndHash<T extends { key: string, params?: Record<string, unknown> }>(
    plannerList: readonly T[] | undefined,
    dispatcherList: readonly T[] | undefined,
    primary: 'left' | 'right',
  ): T[] | undefined {
    if (!plannerList?.length && !dispatcherList?.length) return undefined
    const first = primary === 'left' ? plannerList : dispatcherList
    const second = primary === 'left' ? dispatcherList : plannerList
    const seen = new Map<string, T>()
    const order: string[] = []
    for (const entry of first ?? []) {
      const id = `${entry.key}::${this.stableParamsHash(entry.params)}`
      if (!seen.has(id)) {
        seen.set(id, entry)
        order.push(id)
      }
    }
    for (const entry of second ?? []) {
      const id = `${entry.key}::${this.stableParamsHash(entry.params)}`
      if (!seen.has(id)) {
        seen.set(id, entry)
        order.push(id)
      }
    }
    return order.map(id => seen.get(id) as T)
  }

  private unionDedupOrchestrationNodes(
    plannerNodes: CodegenSemanticPatch['orchestration'] extends infer O
      ? O extends { nodes?: infer N } ? N : never
      : never,
    dispatcherNodes: CodegenSemanticPatch['orchestration'] extends infer O
      ? O extends { nodes?: infer N } ? N : never
      : never,
  ): NonNullable<CodegenSemanticPatch['orchestration']>['nodes'] {
    type NodeT = NonNullable<CodegenSemanticPatch['orchestration']>['nodes'] extends (infer U)[] | undefined
      ? U
      : never
    const seen = new Map<string, NodeT>()
    const order: string[] = []
    const collect = (list: readonly NodeT[] | undefined): void => {
      for (const node of list ?? []) {
        const id = this.orchestrationIdentity(node)
        if (!seen.has(id)) {
          seen.set(id, node)
          order.push(id)
        }
      }
    }
    collect(plannerNodes as readonly NodeT[] | undefined)
    collect(dispatcherNodes as readonly NodeT[] | undefined)
    return order.map(id => seen.get(id) as NodeT)
  }

  private atomIdentity(entry: { key: string, phase?: string, params?: Record<string, unknown> }): string {
    const phase = entry.phase ?? 'entry'
    return `${entry.key}::${phase}::${this.stableParamsHash(entry.params)}`
  }

  private orchestrationIdentity(node: { id?: string, key?: string, params?: Record<string, unknown> }): string {
    if (node.id && typeof node.id === 'string' && node.id.length > 0) {
      return `id::${node.id}`
    }
    const key = node.key ?? '__nokey__'
    return `${key}::${this.stableParamsHash(node.params)}`
  }

  private stableParamsHash(params: Record<string, unknown> | undefined): string {
    if (!params) return 'null'
    return JSON.stringify(this.stableValue(params))
  }

  private stableValue(value: unknown): unknown {
    if (value === null || typeof value !== 'object') return value
    if (Array.isArray(value)) return value.map(v => this.stableValue(v))
    const obj = value as Record<string, unknown>
    return Object.keys(obj).sort().reduce<Record<string, unknown>>((acc, k) => {
      acc[k] = this.stableValue(obj[k])
      return acc
    }, {})
  }
}
