import { IndicatorConfigService } from './indicator-config.service'

describe('indicatorConfigService', () => {
  it('does not throw when indicator_configs table is missing (P2021)', async () => {
    const repository = {
      listAllActive: jest.fn().mockRejectedValue({
        code: 'P2021',
        message: 'table does not exist',
      }),
    }

    const service = new IndicatorConfigService(repository as any)
    const warnSpy = jest.spyOn((service as any).logger, 'warn').mockImplementation(() => undefined)
    const logSpy = jest.spyOn((service as any).logger, 'log').mockImplementation(() => undefined)

    await expect(service.reloadAllRuntimeConfigs()).resolves.toBeUndefined()
    expect(repository.listAllActive).toHaveBeenCalledTimes(1)
    expect(warnSpy).toHaveBeenCalled()
    expect(logSpy).toHaveBeenCalledWith('Indicator runtime configs loaded: 0 symbol/timeframe groups')
  })

  it('does not block module init when runtime preload fails unexpectedly', async () => {
    const repository = {
      listAllActive: jest.fn().mockRejectedValue(new Error('db unavailable')),
    }

    const service = new IndicatorConfigService(repository as any)
    const warnSpy = jest.spyOn((service as any).logger, 'warn').mockImplementation(() => undefined)

    await expect(service.onModuleInit()).resolves.toBeUndefined()
    expect(repository.listAllActive).toHaveBeenCalledTimes(1)
    expect(warnSpy).toHaveBeenCalled()
  })
})
