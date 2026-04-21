import { CodegenConversationStateMachine } from '../codegen-conversation-state-machine'

describe('codegenConversationStateMachine', () => {
  const machine = new CodegenConversationStateMachine()

  it('classifies planner-ready clear sessions into confirm gate', () => {
    expect(machine.resolvePlannerStatus({
      logicReady: true,
      clarificationState: { status: 'CLEAR' },
    })).toBe('CONFIRM_GATE')
  })

  it('keeps ambiguous sessions in drafting', () => {
    expect(machine.resolvePlannerStatus({
      logicReady: true,
      clarificationState: { status: 'NEEDS_CLARIFICATION' },
    })).toBe('DRAFTING')
  })

  it('distinguishes terminal / processing / requeueable statuses', () => {
    expect(machine.isTerminalStatus('PUBLISHED')).toBe(true)
    expect(machine.isTerminalStatus('REJECTED')).toBe(true)
    expect(machine.isTerminalStatus('GENERATING')).toBe(false)
    expect(machine.isProcessingStatus('GENERATING')).toBe(true)
    expect(machine.isProcessingStatus('VALIDATING_CONSISTENCY')).toBe(true)
    expect(machine.shouldTryRequeue('VALIDATING_RUNTIME')).toBe(true)
    expect(machine.shouldTryRequeue('GENERATING')).toBe(false)
  })

  it('builds distinct rejected / consistency failed / published updates', () => {
    expect(machine.buildRejectedUpdate({
      rejectReason: 'publish failed',
      latestDraftCode: 'code',
      strategyInstanceId: 'instance-1',
    })).toEqual(expect.objectContaining({
      status: 'REJECTED',
      rejectReason: 'publish failed',
      latestDraftCode: 'code',
      strategyInstanceId: 'instance-1',
    }))

    expect(machine.buildConsistencyFailedUpdate({
      latestDraftCode: 'code',
      latestSpecDesc: { consistencyReport: { status: 'FAILED' } },
      rejectReason: 'semantic mismatch',
      strategyInstanceId: 'instance-2',
    })).toEqual(expect.objectContaining({
      status: 'CONSISTENCY_FAILED',
      latestDraftCode: 'code',
      rejectReason: 'semantic mismatch',
      strategyInstanceId: 'instance-2',
    }))

    expect(machine.buildPublishedUpdate({
      latestDraftCode: 'code',
      latestSpecDesc: {
        consistencyReport: { status: 'PASSED' },
        publishedSnapshotId: 'snapshot-1',
      },
      strategyInstanceId: 'instance-3',
    })).toEqual(expect.objectContaining({
      status: 'PUBLISHED',
      latestDraftCode: 'code',
      rejectReason: null,
      strategyInstanceId: 'instance-3',
    }))
  })

  it('derives clear reject reasons for semantic and compiled publish failures', () => {
    expect(machine.buildConsistencyRejectReason({
      status: 'FAILED',
      checks: [
        {
          key: 'entry',
          level: 'critical',
          status: 'failed',
          expected: 'golden cross',
          actual: 'death cross',
          message: '入场规则与策略摘要不一致',
        },
      ],
      specProfile: {
        indicators: [],
        actions: [],
        ruleMappings: [],
        rules: [],
        sizing: null,
        requiredParams: [],
        fallbackDetected: false,
      },
      scriptProfile: {
        indicators: [],
        actions: [],
        ruleMappings: [],
        rules: [],
        sizing: null,
        requiredParams: [],
        fallbackDetected: false,
      },
      summary: { criticalFailed: 1, warningFailed: 0, unprovable: 0 },
    })).toContain('入场规则与策略摘要不一致')

    expect(machine.buildCompiledPublishRejectReason({
      status: 'FAILED',
      compilerConsistency: {
        graphVsIr: { passed: false },
        irVsScript: { passed: true },
        manifestSelfCheck: { passed: false },
      },
    })).toContain('semantic view 与 IR 摘要不一致')
  })
})
