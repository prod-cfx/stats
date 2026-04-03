import type { StrategySemanticProfile } from './strategy-semantic-profile'

export interface StrategyConsistencyCheck {
  key: string
  level: 'critical' | 'warning'
  status: 'passed' | 'failed' | 'unprovable'
  expected: unknown
  actual: unknown
  message: string
}

export interface StrategyConsistencyReport {
  status: 'PASSED' | 'FAILED'
  specProfile: StrategySemanticProfile
  scriptProfile: StrategySemanticProfile
  checks: StrategyConsistencyCheck[]
  summary: {
    criticalFailed: number
    warningFailed: number
    unprovable: number
  }
}
