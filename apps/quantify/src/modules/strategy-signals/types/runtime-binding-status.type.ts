export const RUNTIME_BINDING_STATUS = {
  FAILED: 'FAILED',
  PENDING: 'PENDING',
  READY: 'READY',
} as const

export type RuntimeBindingStatus = typeof RUNTIME_BINDING_STATUS[keyof typeof RUNTIME_BINDING_STATUS]
