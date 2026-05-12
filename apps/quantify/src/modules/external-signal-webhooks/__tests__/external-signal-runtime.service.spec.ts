import { ExternalSignalRuntimeService, type ExternalSignalReceivedPayload } from '../services/external-signal-runtime.service'

interface RuntimeRepoMock {
  findAcceptedEventForRuntime: jest.Mock
  findSymbolByCode: jest.Mock
  findTradingSignalById: jest.Mock
  createExternalSignalTradingSignal: jest.Mock
}

function createService(overrides: Partial<RuntimeRepoMock> = {}) {
  const repo: RuntimeRepoMock = {
    findAcceptedEventForRuntime: jest.fn(),
    findSymbolByCode: jest.fn(),
    findTradingSignalById: jest.fn(),
    createExternalSignalTradingSignal: jest.fn(),
    ...overrides,
  }
  const signalExecutor = {
    executeSignalForSubscribedUsers: jest.fn().mockResolvedValue(undefined),
  }
  const txEvents = {
    withAfterCommit: jest.fn(async (handler: () => Promise<void>) => handler()),
  }

  const service = new ExternalSignalRuntimeService(
    repo as unknown as ConstructorParameters<typeof ExternalSignalRuntimeService>[0],
    signalExecutor as unknown as ConstructorParameters<typeof ExternalSignalRuntimeService>[1],
    txEvents as unknown as ConstructorParameters<typeof ExternalSignalRuntimeService>[2],
  )

  return { repo, service, signalExecutor, txEvents }
}

function payload(overrides: Partial<ExternalSignalReceivedPayload> = {}): ExternalSignalReceivedPayload {
  return {
    eventId: 'evt-1',
    subscriptionId: 'sub-1',
    strategyInstanceId: 'inst-1',
    userId: 'user-1',
    provider: 'tradingview',
    signalId: 'sig-1',
    receivedAt: '2026-05-12T12:00:00.000Z',
    ...overrides,
  }
}

function acceptedEvent(overrides: Record<string, unknown> = {}) {
  return {
    id: 'evt-1',
    subscriptionId: 'sub-1',
    strategyInstanceId: 'inst-1',
    provider: 'tradingview',
    signalId: 'sig-1',
    dedupeKey: 'dedupe-1',
    payload: {
      signalId: 'sig-1',
      symbol: 'BTCUSDT',
      side: 'long',
      signalType: 'ENTRY',
      price: 65000,
      positionSizeRatio: 0.1,
      reasoning: 'external webhook signal',
    },
    signatureStatus: 'ACCEPTED',
    receivedAt: new Date('2026-05-12T12:00:00.000Z'),
    subscription: {
      id: 'sub-1',
      userId: 'user-1',
      strategyInstanceId: 'inst-1',
      signalId: 'sig-1',
      status: 'ACTIVE',
    },
    strategyInstance: {
      id: 'inst-1',
      strategyTemplateId: 'template-1',
      status: 'running',
      mode: 'LIVE',
      strategyTemplate: {
        id: 'template-1',
        status: 'live',
      },
    },
    ...overrides,
  }
}

describe('ExternalSignalRuntimeService', () => {
  it('materializes an accepted webhook event into a trading signal and executes through SignalExecutorService', async () => {
    const { repo, service, signalExecutor, txEvents } = createService()
    repo.findAcceptedEventForRuntime.mockResolvedValue(acceptedEvent())
    repo.findSymbolByCode.mockResolvedValue({ id: 'symbol-1', code: 'BTCUSDT' })
    repo.findTradingSignalById.mockResolvedValue(null)
    repo.createExternalSignalTradingSignal.mockResolvedValue({ id: 'external-webhook:evt-1' })

    await expect(service.handleReceived(payload())).resolves.toEqual({
      executed: true,
      signalId: 'external-webhook:evt-1',
    })

    expect(repo.createExternalSignalTradingSignal).toHaveBeenCalledWith(expect.objectContaining({
      id: 'external-webhook:evt-1',
      sourceType: 'SYSTEM',
      signalType: 'ENTRY',
      direction: 'BUY',
      positionSizeRatio: 0.1,
      strategy: { connect: { id: 'template-1' } },
      strategyInstance: { connect: { id: 'inst-1' } },
      symbol: { connect: { id: 'symbol-1' } },
    }))
    expect(txEvents.withAfterCommit).toHaveBeenCalledTimes(1)
    expect(signalExecutor.executeSignalForSubscribedUsers).toHaveBeenCalledWith('external-webhook:evt-1')
  })

  it('does not execute twice when the deterministic trading signal already exists', async () => {
    const { repo, service, signalExecutor } = createService()
    repo.findAcceptedEventForRuntime.mockResolvedValue(acceptedEvent())
    repo.findSymbolByCode.mockResolvedValue({ id: 'symbol-1', code: 'BTCUSDT' })
    repo.findTradingSignalById.mockResolvedValue({ id: 'external-webhook:evt-1' })

    await expect(service.handleReceived(payload())).resolves.toEqual({
      executed: false,
      signalId: 'external-webhook:evt-1',
      skippedReason: 'DUPLICATE_SIGNAL',
    })

    expect(repo.createExternalSignalTradingSignal).not.toHaveBeenCalled()
    expect(signalExecutor.executeSignalForSubscribedUsers).not.toHaveBeenCalled()
  })

  it('skips stale envelopes that do not match the persisted event', async () => {
    const { repo, service, signalExecutor } = createService()
    repo.findAcceptedEventForRuntime.mockResolvedValue(acceptedEvent({ signalId: 'different-signal' }))

    await expect(service.handleReceived(payload())).resolves.toEqual({
      executed: false,
      skippedReason: 'ENVELOPE_EVENT_MISMATCH',
    })

    expect(repo.createExternalSignalTradingSignal).not.toHaveBeenCalled()
    expect(signalExecutor.executeSignalForSubscribedUsers).not.toHaveBeenCalled()
  })
})
