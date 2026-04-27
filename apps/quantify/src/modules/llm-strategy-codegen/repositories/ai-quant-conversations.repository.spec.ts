import { AiQuantConversationsRepository } from './ai-quant-conversations.repository'

function createRepository(overrides?: {
  findFirst?: jest.Mock
}) {
  const tx = {
    aiQuantConversation: {
      findFirst: overrides?.findFirst ?? jest.fn(),
    },
  }

  return {
    tx,
    repository: new AiQuantConversationsRepository(
      { tx } as unknown as ConstructorParameters<typeof AiQuantConversationsRepository>[0],
    ),
  }
}

function createConversationRow(overrides?: Partial<{
  id: string
  userId: string
  codegenSessionId: string
  title: string
  archivedAt: Date | null
  createdAt: Date
  updatedAt: Date
  backtestDraftConfig: null
  lastBacktestRef: null
  messages: Array<{ role: 'user' | 'assistant'; content: string }>
}>) {
  return {
    id: 'conversation-1',
    userId: 'user-1',
    codegenSessionId: 'session-1',
    title: 'Conversation',
    archivedAt: null,
    createdAt: new Date('2026-04-20T00:00:00.000Z'),
    updatedAt: new Date('2026-04-21T00:00:00.000Z'),
    backtestDraftConfig: null,
    lastBacktestRef: null,
    messages: [
      { role: 'user' as const, content: 'build a strategy' },
      { role: 'assistant' as const, content: 'done' },
    ],
    ...overrides,
  }
}

describe('aiQuantConversationsRepository lookup helpers', () => {
  it('finds an active conversation by codegen session and user', async () => {
    const findFirst = jest.fn().mockResolvedValue(createConversationRow())
    const { repository, tx } = createRepository({ findFirst })

    const conversation = await repository.findActiveByCodegenSessionIdAndUser('session-1', 'user-1')

    expect(tx.aiQuantConversation.findFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: {
        codegenSessionId: 'session-1',
        userId: 'user-1',
        archivedAt: null,
      },
    }))
    expect(conversation).toEqual(expect.objectContaining({
      id: 'conversation-1',
      userId: 'user-1',
      codegenSessionId: 'session-1',
      messages: [
        { role: 'user', content: 'build a strategy' },
        { role: 'assistant', content: 'done' },
      ],
    }))
  })

  it('finds the newest active conversation by any non-empty codegen session id for a user', async () => {
    const findFirst = jest.fn().mockResolvedValue(createConversationRow({ codegenSessionId: 'session-2' }))
    const { repository, tx } = createRepository({ findFirst })

    const conversation = await repository.findActiveByAnyCodegenSessionIdAndUser(
      [' session-1 ', '', 'session-2', '   '],
      'user-1',
    )

    expect(tx.aiQuantConversation.findFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: {
        codegenSessionId: { in: ['session-1', 'session-2'] },
        userId: 'user-1',
        archivedAt: null,
      },
      orderBy: { updatedAt: 'desc' },
    }))
    expect(conversation?.codegenSessionId).toBe('session-2')
  })

  it('does not query when no codegen session ids remain after normalization', async () => {
    const findFirst = jest.fn()
    const { repository } = createRepository({ findFirst })

    const conversation = await repository.findActiveByAnyCodegenSessionIdAndUser(['', '   '], 'user-1')

    expect(conversation).toBeNull()
    expect(findFirst).not.toHaveBeenCalled()
  })
})
