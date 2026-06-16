import { ErrorCode } from '@ai/shared'
import { DomainException } from '@/common/exceptions/domain.exception'
import { OpenInterestController } from './open-interest.controller'

describe('OpenInterestController query handling', () => {
  it('passes validated stats date query to the service', async () => {
    const stats = {
      symbol: 'BTC',
      startTime: new Date('2025-12-24T00:00:00Z'),
      endTime: new Date('2025-12-24T23:59:59Z'),
      dataPoints: 1,
      max: 1,
      min: 1,
      avg: 1,
      latest: 1,
      earliest: 1,
      change: 0,
      changePercent: 0,
    }
    const service = { getStats: jest.fn().mockResolvedValue(stats) }
    const controller = new OpenInterestController(service as never)

    await controller.getStats('BTC', {
      startTime: '2025-12-24T00:00:00Z',
      endTime: '2025-12-24T23:59:59Z',
      startDate: new Date('2025-12-24T00:00:00Z'),
      endDate: new Date('2025-12-24T23:59:59Z'),
    })

    expect(service.getStats).toHaveBeenCalledWith(
      'BTC',
      new Date('2025-12-24T00:00:00Z'),
      new Date('2025-12-24T23:59:59Z'),
    )
  })

  it('keeps missing symbol as open interest domain error', async () => {
    const service = { getStats: jest.fn() }
    const controller = new OpenInterestController(service as never)

    await expect(controller.getStats('', {
      startTime: '2025-12-24T00:00:00Z',
      endTime: '2025-12-24T23:59:59Z',
      startDate: new Date('2025-12-24T00:00:00Z'),
      endDate: new Date('2025-12-24T23:59:59Z'),
    })).rejects.toMatchObject({
      name: DomainException.name,
      code: ErrorCode.OPEN_INTEREST_INVALID_PARAMS,
    })
  })
})
