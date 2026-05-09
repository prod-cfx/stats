export interface InternalKeyLeakGuardFinding {
  key: string
  path: string
  value: string
  suggestion: string
}

export interface InternalKeyLeakGuardScanOptions {
  surface: string
  scanPaths?: boolean
}
