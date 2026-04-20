import { buildStartSessionBootstrap } from '../codegen-conversation-start-session.helper'

describe('buildStartSessionBootstrap', () => {
  it('prefers clarification prompt and appends normalized history', () => {
    const result = buildStartSessionBootstrap({
      initialMessage: ' 帮我做个策略 ',
      plannerStatus: 'DRAFTING',
      clarificationState: {
        status: 'NEEDS_CLARIFICATION',
        items: [{
          key: 'market.symbol',
          reason: 'missing_symbol',
          field: 'symbol',
          blocking: true,
          question: '交易对是什么？',
          status: 'pending',
        }],
        summary: '缺交易对',
      },
      clarificationPrompt: '请先补充交易对',
      plan: {
        related: true,
        logicReady: false,
        assistantPrompt: 'planner prompt',
      },
      compileability: null,
    }, () => 'compile prompt')

    expect(result.status).toBe('DRAFTING')
    expect(result.assistantPrompt).toBe('请先补充交易对')
    expect(result.initialHistory).toEqual(['U: 帮我做个策略', 'A: 请先补充交易对'])
  })

  it('uses checklist gate confirmation prompt when compileable', () => {
    const result = buildStartSessionBootstrap({
      initialMessage: '确认一下',
      plannerStatus: 'CHECKLIST_GATE',
      clarificationState: {
        status: 'CLEAR',
        items: [],
      },
      clarificationPrompt: null,
      plan: {
        related: true,
        logicReady: true,
        assistantPrompt: '逻辑已整理',
      },
      compileability: {
        canCompile: true,
        entryRuleCount: 1,
        exitRuleCount: 1,
        reasons: [],
      },
    }, () => 'compile prompt')

    expect(result.status).toBe('CHECKLIST_GATE')
    expect(result.shouldEnterConfirmationGate).toBe(true)
    expect(result.assistantPrompt).toContain('逻辑图已更新。请确认逻辑图')
  })

  it('falls back to compileability prompt when checklist gate cannot compile', () => {
    const result = buildStartSessionBootstrap({
      initialMessage: '确认一下',
      plannerStatus: 'CHECKLIST_GATE',
      clarificationState: {
        status: 'CLEAR',
        items: [],
      },
      clarificationPrompt: null,
      plan: {
        related: true,
        logicReady: true,
        assistantPrompt: '逻辑已整理',
      },
      compileability: {
        canCompile: false,
        entryRuleCount: 1,
        exitRuleCount: 0,
        reasons: ['missing exit'],
      },
    }, report => `compile failed: ${report.reasons.join(',')}`)

    expect(result.status).toBe('DRAFTING')
    expect(result.shouldEnterConfirmationGate).toBe(false)
    expect(result.assistantPrompt).toBe('compile failed: missing exit')
  })
})
