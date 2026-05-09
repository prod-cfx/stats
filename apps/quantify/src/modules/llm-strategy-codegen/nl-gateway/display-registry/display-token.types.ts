export type DisplayTokenKind = 'atom' | 'param' | 'enum' | 'slot'

export interface DisplayToken {
  token: string
  kind: DisplayTokenKind
  zh: string
}

export type DisplayTokenTemplateValues = Record<string, string | number | null | undefined>
