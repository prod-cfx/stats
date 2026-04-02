import { PrismaService } from './prisma.service'

describe('prismaService', () => {
  it('is defined', () => {
    expect(PrismaService).toBeDefined()
  })

  it('attaches query logging only once when extended client is the same instance', () => {
    const queryListener = jest.fn()
    const on = jest.fn((_event: string, handler: unknown) => {
      queryListener.mockImplementation(handler as (...args: unknown[]) => void)
    })
    const logger = {
      error: jest.fn(),
      warn: jest.fn(),
      debug: jest.fn(),
      log: jest.fn(),
    }
    const service: any = Object.assign(Object.create(PrismaService.prototype), {
      configService: { get: jest.fn((key: string, fallback: number) => fallback) },
      envService: { isDev: jest.fn().mockReturnValue(false), isDebugMode: jest.fn().mockReturnValue(false) },
      options: { monitoredTables: [] },
      logger,
      extendedClient: null,
      $on: on,
    })

    service.extendedClient = service as unknown

    ;(service as any).setupQueryLogging()

    expect(on).toHaveBeenCalledTimes(1)
    queryListener({
      duration: 600,
      query: 'select * from "backtest_jobs"',
    })
    expect(logger.error).toHaveBeenCalledTimes(1)
  })

  it('attaches query logging to both clients when extended client is distinct', () => {
    const baseOn = jest.fn()
    const extendedOn = jest.fn()
    const logger = {
      error: jest.fn(),
      warn: jest.fn(),
      debug: jest.fn(),
      log: jest.fn(),
    }
    const service: any = Object.assign(Object.create(PrismaService.prototype), {
      configService: { get: jest.fn((key: string, fallback: number) => fallback) },
      envService: { isDev: jest.fn().mockReturnValue(false), isDebugMode: jest.fn().mockReturnValue(false) },
      options: { monitoredTables: [] },
      logger,
      extendedClient: { $on: extendedOn },
      $on: baseOn,
    })

    ;(service as any).setupQueryLogging()

    expect(baseOn).toHaveBeenCalledTimes(1)
    expect(extendedOn).toHaveBeenCalledTimes(1)
  })
})
