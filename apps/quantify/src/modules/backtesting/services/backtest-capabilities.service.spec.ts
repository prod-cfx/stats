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

  it('rethrows repository errors for upstream handling', async () => {
    repository.findActiveConfig.mockRejectedValue(new Error('db down'))

    await expect(service.getCapabilities('req-2')).rejects.toThrow('db down')
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
