export interface SemanticPresentationRenderInput {
  params: Record<string, unknown>
}

export interface SemanticPresentationMetadata {
  key: string
  publicName: string
  aliases: readonly string[]
  positiveExamples: readonly string[]
  negativeExamples: readonly string[]
  displayRenderer: (input: SemanticPresentationRenderInput) => string
  clarificationRenderer: (slotKey: string, params: Record<string, unknown>) => string
}
