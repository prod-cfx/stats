import type { SemanticExpression, SemanticPositionSizingContract } from './semantic-state'

export type CodegenSemanticTriggerParams = Record<string, unknown> & {
  expression?: SemanticExpression
}

export interface CodegenSemanticPatch {
  contextSlots?: Record<string, string | number | boolean | null>
  triggers?: Array<{
    key: string
    phase: 'entry' | 'exit' | 'risk' | 'gate'
    sideScope?: 'long' | 'short' | 'both'
    params?: CodegenSemanticTriggerParams
  }>
  actions?: Array<{
    key: string
    params?: Record<string, unknown>
  }>
  risk?: Array<{
    key: string
    params: Record<string, unknown>
  }>
  position?: {
    sizing?: SemanticPositionSizingContract | null
    mode?: string
    value?: number
    positionMode: string
  } | null
}
