import { SemanticAtomRegistryService } from '../../services/semantic-atom-registry.service'

export const BASE_INTERNAL_IDENTIFIERS = [
  'generic_boundary',
] as const

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
    ...atomRegistry.list().map(atom => atom.key),
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
