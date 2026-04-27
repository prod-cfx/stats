import { clearIntent, getIntent, setIntent } from './intent-storage'

describe('intent-storage', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('supports set/get/clear with ttl', () => {
    setIntent({ type: 'run', strategyId: 'momentum-steady' })
    const got = getIntent(30 * 60 * 1000)
    expect(got?.type).toBe('run')

    clearIntent()
    expect(getIntent(30 * 60 * 1000)).toBeNull()
  })

  it('supports strategy plaza run and edit intents', () => {
    setIntent({ type: 'plaza-run', templateId: 'ma-cross' })
    expect(getIntent(30 * 60 * 1000)).toMatchObject({
      type: 'plaza-run',
      templateId: 'ma-cross',
    })

    setIntent({ type: 'plaza-edit', templateId: 'bollinger-reversion' })
    expect(getIntent(30 * 60 * 1000)).toMatchObject({
      type: 'plaza-edit',
      templateId: 'bollinger-reversion',
    })

    setIntent({ type: 'plaza-chat-session', sessionId: 'session-1' })
    expect(getIntent(30 * 60 * 1000)).toMatchObject({
      type: 'plaza-chat-session',
      sessionId: 'session-1',
    })
  })

  it('persists strategy edit session intent with semantic recovery identifiers', () => {
    setIntent({
      type: 'strategy-edit-session',
      strategyInstanceId: 'strategy-1',
      publishedSnapshotId: 'snapshot-1',
      conversationId: 'conversation-1',
      sessionId: 'session-1',
      source: 'account-detail',
    })

    expect(getIntent(30 * 60 * 1000)).toMatchObject({
      type: 'strategy-edit-session',
      strategyInstanceId: 'strategy-1',
      publishedSnapshotId: 'snapshot-1',
      conversationId: 'conversation-1',
      sessionId: 'session-1',
      source: 'account-detail',
    })
  })
})
