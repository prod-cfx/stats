import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const root = join(__dirname, '..')

function readService(relativePath: string): string {
  return readFileSync(join(root, relativePath), 'utf8')
}

function extractMethodBody(source: string, methodName: string): string {
  const signatureIndex = source.indexOf(methodName)
  expect(signatureIndex).toBeGreaterThanOrEqual(0)
  const bodyStart = source.indexOf('{', signatureIndex)
  expect(bodyStart).toBeGreaterThanOrEqual(0)
  let depth = 0
  for (let index = bodyStart; index < source.length; index += 1) {
    const char = source[index]
    if (char === '{') depth += 1
    if (char === '}') depth -= 1
    if (depth === 0) return source.slice(bodyStart + 1, index)
  }
  throw new Error(`method_body_not_found:${methodName}`)
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

  it('does not call legacy checklist projection or clarification from the conversation mainflow', () => {
    const source = readService('codegen-conversation.service.ts')
    const mainflowBodies = [
      extractMethodBody(source, 'async startSession'),
      extractMethodBody(source, 'async continueSession'),
      extractMethodBody(source, 'private async continueConfirmedSession'),
      extractMethodBody(source, 'private async continueWithStructuredClarificationAnswers'),
      extractMethodBody(source, 'private async continueWithResolvedSemanticOpenSlotAnswer'),
      extractMethodBody(source, 'private async handleSemanticEditDecision'),
    ].join('\n')

    expect(mainflowBodies).not.toMatch(/\bbuildLegacyLogicSnapshotProjectionForCompatibility\s*\(/u)
    expect(mainflowBodies).not.toMatch(/\bprojectSemanticStateToStrategySnapshotForCompatibility\s*\(/u)
    expect(mainflowBodies).not.toMatch(/\bbuildClarificationSummary\s*\(/u)
    expect(mainflowBodies).not.toMatch(/\bresolveClarificationArtifacts\s*\(\s*checklist\b/u)
    expect(mainflowBodies).not.toMatch(/\bwithClarificationSummary\s*\(/u)
    expect(mainflowBodies).not.toMatch(/\bintentNormalizer\s*\.\s*normalize\s*\(\s*checklist\b/u)
    expect(mainflowBodies).not.toMatch(/\bexecutionContext\s*\.\s*resolve\s*\(\s*checklist\b/u)
  })

  it('does not build canonical specs from checklist snapshots in production services', () => {
    const conversationSource = readService('codegen-conversation.service.ts')
    const canonicalSource = readService('canonical-spec-builder.service.ts')
    const conversationMainflowBodies = [
      extractMethodBody(conversationSource, 'async startSession'),
      extractMethodBody(conversationSource, 'async continueSession'),
      extractMethodBody(conversationSource, 'private async continueConfirmedSession'),
      extractMethodBody(conversationSource, 'private async continueWithStructuredClarificationAnswers'),
      extractMethodBody(conversationSource, 'private async continueWithResolvedSemanticOpenSlotAnswer'),
      extractMethodBody(conversationSource, 'private async handleSemanticEditDecision'),
    ].join('\n')

    expect(conversationMainflowBodies).not.toMatch(/\bcanonicalSpecBuilder\s*\.\s*build\s*\(/u)
    expect(canonicalSource).not.toMatch(/\bbuild\s*\(\s*checklist\s*:/u)
    expect(canonicalSource).not.toMatch(/\bbuildStrategyRuleDrafts\s*\(\s*checklist\b/u)
  })
})
