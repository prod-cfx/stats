export interface SemanticPresentationRenderInput {
  params: Record<string, unknown>
}

export interface SemanticPresentationMetadata {
  key: string
  publicName: string
  aliases: readonly string[]
  positiveExamples: readonly string[]
  negativeExamples: readonly string[]
  goldenUtterances: readonly string[]
  displayRenderer: (input: SemanticPresentationRenderInput) => string
  /**
   * 标记 displayRenderer 是否由注册方显式提供（true）还是 presentation() helper 给出的兜底
   *  `atom.${key}.name` token 渲染（false）。
   *
   * 为 inline-condition 渲染消费者（如 SemanticStateProjectionService.formatDisplayAtomicTriggerCondition）
   *  提供能力探测：默认兜底输出的是 publicName 而非条件文案，调用方应将其视为"未显式声明" → 走 placeholder fallback。
   */
  hasExplicitDisplayRenderer: boolean
  clarificationRenderer: (slotKey: string, params: Record<string, unknown>) => string
}
