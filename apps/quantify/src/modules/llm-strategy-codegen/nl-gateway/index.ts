export { NlGatewayModule } from './nl-gateway.module'
export {
  CURRENT_SEMANTIC_VERSION,
  compareSemanticVersion,
  isAtomExecutableForStrategy,
} from './version-gate/version-gate'
export type { StrategyVersionInfo, VersionedAtomContract } from './version-gate/version-gate.types'
