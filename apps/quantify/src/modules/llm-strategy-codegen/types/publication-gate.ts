export interface PublicationGateCheck {
  key: string
  blocking: boolean
  status: 'passed' | 'failed' | 'unprovable'
  expected: unknown
  actual: unknown
  message: string
}

export interface PublicationGateReport {
  status: 'PASSED' | 'FAILED'
  checks: PublicationGateCheck[]
}
