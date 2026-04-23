import { BacktestCapabilitiesRepository } from './backtest-capabilities.repository'

describe('backtestCapabilitiesRepository.findActiveConfig', () => {
  it('returns the latest active config by updatedAt desc when data exists', async () => {
    const findFirst = jest.fn().mockResolvedValue({ allowedBaseTimeframes: ['1h'] })
    const txHostMock = {
      tx: {
        backtestCapabilityConfig: { findFirst },
      },
    }
    // @ts-expect-error test double only implements the methods this test needs.
    const repo = new BacktestCapabilitiesRepository(txHostMock)

    const result = await repo.findActiveConfig()

    expect(findFirst).toHaveBeenCalledWith({
      select: {
        allowedBaseTimeframes: true,
      },
      where: { isActive: true },
      orderBy: { updatedAt: 'desc' },
    })
    expect(result).toEqual({ allowedBaseTimeframes: ['1h'] })
  })

  it('returns null when no active config exists', async () => {
    const findFirst = jest.fn().mockResolvedValue(null)
    const txHostMock = {
      tx: {
        backtestCapabilityConfig: { findFirst },
      },
    }
    // @ts-expect-error test double only implements the methods this test needs.
    const repo = new BacktestCapabilitiesRepository(txHostMock)

    const result = await repo.findActiveConfig()

    expect(result).toBeNull()
  })
})
