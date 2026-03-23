export const FORBIDDEN_TOKENS = [
  'eval(',
  'Function(',
  'import ',
  'require(',
  'process.',
  '__dirname',
  '__filename',
  'globalThis',
] as const

export const ALLOWED_HELPER_PREFIXES = [
  'helpers.finance.',
  'helpers.array.',
  'helpers.ta.',
  'helpers.signal.',
] as const

export const REQUIRED_CHECKLIST_FIELDS = [
  'entryRules',
  'exitRules',
] as const

export type ChecklistField = typeof REQUIRED_CHECKLIST_FIELDS[number]

export interface ConstraintPackSnapshot {
  allowedHelperPrefixes: readonly string[]
  forbiddenTokens: readonly string[]
  runtime: 'current_script_engine'
  allowHelpersOnly: boolean
  guidePrompt?: CodegenGuidePromptConfigSnapshot
  recommendationStyle?: 'ma' | 'drop-rise'
  conversationHistory?: string[]
}

export interface CodegenGuidePromptConfigSnapshot {
  symbolExample?: string
  timeframeExample?: string
  entryRuleExample?: string
  exitRuleExample?: string
  riskRuleExample?: string
}

export function createDefaultConstraintPack(
  guidePrompt?: CodegenGuidePromptConfigSnapshot,
): ConstraintPackSnapshot {
  return {
    allowedHelperPrefixes: ALLOWED_HELPER_PREFIXES,
    forbiddenTokens: FORBIDDEN_TOKENS,
    runtime: 'current_script_engine',
    allowHelpersOnly: true,
    guidePrompt,
    conversationHistory: [],
  }
}
