export interface CodegenSemanticPatch {
  contextSlots?: Record<string, string | number | boolean | null>
  triggers?: Array<{
    key: string
    phase: 'entry' | 'exit' | 'risk' | 'gate'
    sideScope?: 'long' | 'short' | 'both'
    params?: Record<string, unknown>
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
    mode: string
    value: number
    positionMode: string
  } | null
  clarificationIntent?: {
    targetSlotKeys: string[]
    blockerReason: string
  } | null
}
