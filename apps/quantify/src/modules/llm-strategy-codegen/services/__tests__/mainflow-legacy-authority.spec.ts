import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const root = join(__dirname, '..')

function readService(relativePath: string): string {
  return readFileSync(join(root, relativePath), 'utf8')
}

describe('AI Quant mainflow legacy authority guardrail', () => {
  it('keeps semantic clarification metadata away from checklist fields and reasons', () => {
    const source = readService('semantic-clarification-metadata.ts')

    expect(source).not.toContain("reason: 'missing_position_pct'")
    expect(source).not.toContain("reason: 'missing_entry_rules'")
    expect(source).not.toContain("reason: 'missing_exit_rules'")
    expect(source).not.toContain("field: 'riskRules.positionPct'")
    expect(source).not.toContain("field: 'entryRules'")
    expect(source).not.toContain("field: 'exitRules'")
  })

  it('does not use semanticState.families as mainflow evidence', () => {
    const source = readService('codegen-conversation.service.ts')

    expect(source).not.toContain('families.length > 0')
    expect(source).not.toContain('state.families.length > 0')
    expect(source).not.toContain('hasSemanticMainFlowEvidence(state: SemanticState): boolean {\n    return state.families.length > 0')
  })

  it('does not use grid family detection as mainline clarification authority', () => {
    const conversationSource = readService('codegen-conversation.service.ts')
    const clarificationSource = readService('strategy-clarification-rules.service.ts')

    expect(conversationSource).not.toContain('families.length > 0')
    expect(clarificationSource).not.toContain('families.length > 0')
    expect(clarificationSource).not.toContain('looksLikeGridStrategy(input)')
  })

  it('does not expose canonical compileability wording as user-facing clarification', () => {
    const source = readService('codegen-conversation.service.ts')

    expect(source).not.toContain("reasons.push('未识别可编译入场规则')")
    expect(source).not.toContain("reasons.push('未识别可编译出场规则')")
    expect(source).not.toContain("reasons.push('missing_compilable_entry_rule')")
    expect(source).not.toContain("reasons.push('missing_compilable_exit_rule')")
    expect(source).not.toContain('buildCanonicalProjectionFailureAssistantPrompt(compileability)')
    expect(source).not.toContain('assistantPrompt: this.buildSemanticProjectionRepairPrompt(compileability)')
  })
})
