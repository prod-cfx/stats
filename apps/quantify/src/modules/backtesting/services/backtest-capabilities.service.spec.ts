import { ErrorCode } from '@ai/shared'
import { HttpStatus } from '@nestjs/common'
import { DomainException } from '@/common/exceptions/domain.exception'
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

  it('returns only generic capabilities and ignores symbol whitelist fields from active config', async () => {
    repository.findActiveConfig.mockResolvedValue({
      allowedSymbols: [' BTCUSDT ', 1],
      allowedBaseTimeframes: [' 1m ', '5m'],
    })

    await expect(service.getCapabilities('req-1')).resolves.toEqual({
      allowedBaseTimeframes: ['1m', '5m'],
    })
  })

  it('throws service unavailable when active config is missing', async () => {
    repository.findActiveConfig.mockResolvedValue(null)

    await expect(service.getCapabilities()).rejects.toMatchObject({
      code: ErrorCode.SERVICE_TEMPORARILY_UNAVAILABLE,
      status: HttpStatus.SERVICE_UNAVAILABLE,
      args: { reason: 'missing_active_config' },
    })
  })

  it('throws service unavailable when config fields are dirty', async () => {
    repository.findActiveConfig.mockResolvedValue({
      allowedBaseTimeframes: ['1m', ''],
    })

    await expect(service.getCapabilities()).rejects.toMatchObject({
      code: ErrorCode.SERVICE_TEMPORARILY_UNAVAILABLE,
      status: HttpStatus.SERVICE_UNAVAILABLE,
      args: { reason: 'invalid_active_config' },
    })
  })

  it('throws service unavailable when fields are not arrays', async () => {
    repository.findActiveConfig.mockResolvedValue({
      allowedBaseTimeframes: { value: ['1m'] },
    })

    await expect(service.getCapabilities()).rejects.toMatchObject({
      code: ErrorCode.SERVICE_TEMPORARILY_UNAVAILABLE,
      status: HttpStatus.SERVICE_UNAVAILABLE,
      args: { reason: 'invalid_active_config' },
    })
  })

  it('returns the last successful capabilities when repository errors after a successful load', async () => {
    repository.findActiveConfig.mockResolvedValueOnce({
      allowedBaseTimeframes: ['1m', '5m'],
    })
    await expect(service.getCapabilities('req-1')).resolves.toEqual({
      allowedBaseTimeframes: ['1m', '5m'],
    })

    repository.findActiveConfig.mockRejectedValueOnce(new Error('db down'))

    await expect(service.getCapabilities('req-2')).resolves.toEqual({
      allowedBaseTimeframes: ['1m', '5m'],
    })
  })

  it('returns the last successful capabilities when repository lookup is slow', async () => {
    jest.useFakeTimers()
    repository.findActiveConfig.mockResolvedValueOnce({
      allowedBaseTimeframes: ['1m', '5m'],
    })
    await service.getCapabilities('req-1')

    repository.findActiveConfig.mockReturnValueOnce(new Promise(() => {}))
    const request = service.getCapabilities('req-2')

    await jest.advanceTimersByTimeAsync(1_500)

    await expect(request).resolves.toEqual({
      allowedBaseTimeframes: ['1m', '5m'],
    })
    jest.useRealTimers()
  })

  it('preserves domain exceptions from downstream handling', async () => {
    const error = new DomainException('backtesting.capabilities_unavailable', {
      code: ErrorCode.SERVICE_TEMPORARILY_UNAVAILABLE,
      status: HttpStatus.SERVICE_UNAVAILABLE,
      args: { reason: 'downstream' },
    })
    repository.findActiveConfig.mockRejectedValue(error)

    await expect(service.getCapabilities('req-3')).rejects.toBe(error)
  })
})
