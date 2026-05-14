import { ATOM_CONTRACT_REGISTRY } from '../../atom-contracts/atom-contract-registry'
import { SemanticAtomRegistryService } from '../../services/semantic-atom-registry.service'

export const BASE_INTERNAL_IDENTIFIERS = [
  'generic_boundary',
] as const

// #1364 AC-4: orchestration bucket（scope.*, program.*, gate.*, portfolioRisk.*）
// 在 display token 中作为领域可见术语出现（例如 "当前仅支持 scope.symbol / scope.leg ..."），
// 属于公开复印的合法引用，不应被 leak guard 当作"内部泄漏"。
function isOrchestrationAtomKey(key: string): boolean {
  const entry = (ATOM_CONTRACT_REGISTRY as Record<string, { bucket?: string }>)[key]
  return entry?.bucket === 'orchestration'
}

export const PUBLIC_RESPONSE_INTERNAL_IDENTIFIERS = [
  'condition.kind',
  // condition.key 已从路径扫描中移除：canonical rule key（如 ma.golden_cross）
  // 需要经由 toPublicRule 暴露给前端。atom key 值（如 indicator.cross_over）仍由
  // atomRegistry 驱动的值扫描（collectFinding）拦截，path-scan 层面的防护在此
  // surface 是过度保守的。
  'condition.expression',
  'risk.condition_expression',
  'price.previous_extrema.kind',
  'price.previous_extrema.lookback',
  'price.previous_extrema.memoryKey',
] as const

export function buildInternalIdentifierKeys(
  atomRegistry: SemanticAtomRegistryService,
  additionalInternalKeys: readonly string[] = [],
): readonly string[] {
  return [...new Set([
    ...atomRegistry.list().map(atom => atom.key).filter(key => !isOrchestrationAtomKey(key)),
    ...BASE_INTERNAL_IDENTIFIERS,
    ...additionalInternalKeys,
  ])].sort((left, right) => right.length - left.length)
}

export function buildInternalIdentifierPattern(keys: readonly string[]): RegExp {
  return new RegExp(
    `(^|[^A-Za-z0-9_])(${keys.map(escapeRegExp).join('|')})(?=$|[^A-Za-z0-9_])`,
    'u',
  )
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&')
}
