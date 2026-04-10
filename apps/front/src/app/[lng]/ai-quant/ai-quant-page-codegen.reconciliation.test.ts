import { describe, expect, it } from '@jest/globals'

import { getCodegenSessionReconciliationAction } from './ai-quant-page-codegen-reconciliation'

describe('ai-quant-page-codegen reconciliation', () => {
  it('applies server truth when a reused session is already terminal', () => {
    const action = getCodegenSessionReconciliationAction({
      conversation: {
        clarificationGate: null,
        codegenSpecDesc: null,
        pendingCanonicalDigest: 'sha256:local',
        publishedSnapshotId: null,
      } as any,
      response: {
        id: 'session-1',
        status: 'PUBLISHED',
        canonicalDigest: 'sha256:remote',
        publishedSnapshotId: 'snapshot-2',
      },
    })

    expect(action).toBe('apply-server')
  })

  it('restarts reuse when local and remote canonical digests disagree', () => {
    const action = getCodegenSessionReconciliationAction({
      conversation: {
        clarificationGate: null,
        codegenSpecDesc: null,
        pendingCanonicalDigest: 'sha256:local',
        publishedSnapshotId: null,
      } as any,
      response: {
        id: 'session-1',
        status: 'CHECKLIST_GATE',
        canonicalDigest: 'sha256:remote',
      },
    })

    expect(action).toBe('restart')
  })

  it('applies server truth when the remote session re-enters a blocking clarification state', () => {
    const action = getCodegenSessionReconciliationAction({
      conversation: {
        clarificationGate: null,
        codegenSpecDesc: null,
        pendingCanonicalDigest: 'sha256:canonical-1',
        publishedSnapshotId: null,
      } as any,
      response: {
        id: 'session-1',
        status: 'CHECKLIST_GATE',
        canonicalDigest: 'sha256:canonical-1',
        clarificationGate: {
          blocked: true,
          items: [
            {
              key: 'market.marketType',
              field: 'marketType',
              reason: 'missing_market_type',
              question: 'spot or perp?',
              allowedAnswers: ['spot', 'perp'],
              blocking: true,
              status: 'pending',
            },
          ],
        },
      },
    })

    expect(action).toBe('apply-server')
  })
})
