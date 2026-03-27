import { BacktestCapabilitiesService } from './backtest-capabilities.service'

describe('backtestCapabilitiesService', () => {
  let repository
  let service

  beforeEach(() => {
    repository = {
      findActiveConfig: jest.fn(),
    }
    service = new BacktestCapabilitiesService(repository)
  })

  it('returns normalized capabilities from active config', async () => {
    repository.findActiveConfig.mockResolvedValue({
      allowedSymbols: [' BTCUSDT ', 'ETHUSDT'],
      allowedBaseTimeframes: [' 1m ', '5m'],
    })

    await expect(service.getCapabilities('req-1')).resolves.toEqual({
      allowedSymbols: ['BTCUSDT', 'ETHUSDT'],
      allowedBaseTimeframes: ['1m', '5m'],
    })
  })

  it('returns empty arrays when active config is missing', async () => {
    repository.findActiveConfig.mockResolvedValue(null)

    await expect(service.getCapabilities()).resolves.toEqual({
      allowedSymbols: [],
      allowedBaseTimeframes: [],
    })
  })

  it('degrades to empty arrays when config fields are dirty', async () => {
    repository.findActiveConfig.mockResolvedValue({
      allowedSymbols: ['BTCUSDT', 1],
      allowedBaseTimeframes: ['1m', ''],
    })

    await expect(service.getCapabilities()).resolves.toEqual({
      allowedSymbols: [],
      allowedBaseTimeframes: [],
    })
  })

  it('degrades to empty arrays when fields are not arrays', async () => {
    repository.findActiveConfig.mockResolvedValue({
      allowedSymbols: 'BTCUSDT',
      allowedBaseTimeframes: { value: ['1m'] },
    })

    await expect(service.getCapabilities()).resolves.toEqual({
      allowedSymbols: [],
      allowedBaseTimeframes: [],
    })
  })

  it('rethrows repository errors for upstream handling', async () => {
    repository.findActiveConfig.mockRejectedValue(new Error('db down'))

    await expect(service.getCapabilities('req-2')).rejects.toThrow('db down')
  })
})
