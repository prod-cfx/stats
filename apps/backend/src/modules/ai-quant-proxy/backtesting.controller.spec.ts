import { ArgumentMetadata, ValidationPipe } from '@nestjs/common'
import { BacktestingProxyController } from './backtesting.controller'
import { BacktestingCreateJobRequestDto } from './dto/backtesting-create-job.dto'
import { BacktestingSymbolSupportRequestDto } from './dto/backtesting-symbol-support.dto'

describe('backtestingProxyController', () => {
  function createController() {
    const service = {
      getBacktestCapabilities: jest.fn().mockResolvedValue({ allowedBaseTimeframes: ['1h'] }),
      checkBacktestSymbolSupport: jest.fn().mockResolvedValue({ status: 'supported' }),
      createBacktestJob: jest.fn().mockResolvedValue({ id: 'job-1', status: 'queued' }),
      getBacktestJob: jest.fn().mockResolvedValue({ id: 'job-1', status: 'queued' }),
      getBacktestJobResult: jest.fn().mockResolvedValue({ id: 'job-1', status: 'succeeded' }),
    }

    const controller = new BacktestingProxyController(service as any)
    return { controller, service }
  }

  async function transformSymbolSupportBody(value: Record<string, unknown>) {
    const pipe = new ValidationPipe({
      whitelist: true,
      transform: true,
    })

    return pipe.transform(value, {
      type: 'body',
      metatype: BacktestingSymbolSupportRequestDto,
      data: '',
    } satisfies ArgumentMetadata)
  }

  async function transformCreateJobBody(value: Record<string, unknown>) {
    const pipe = new ValidationPipe({
      whitelist: true,
      transform: true,
    })

    return pipe.transform(value, {
      type: 'body',
      metatype: BacktestingCreateJobRequestDto,
      data: '',
    } satisfies ArgumentMetadata)
  }

  it('keeps marketType and baseTimeframe after backend whitelist validation', async () => {
    await expect(transformSymbolSupportBody({
      exchange: 'okx',
      marketType: 'spot',
      symbol: 'ORDIUSDT',
      baseTimeframe: '1h',
    })).resolves.toMatchObject({
      exchange: 'okx',
      marketType: 'spot',
      symbol: 'ORDIUSDT',
      baseTimeframe: '1h',
    })
  })

  it('forwards the validated backtest symbol support payload without dropping snapshot-bound fields', async () => {
    const { controller, service } = createController()
    const body = await transformSymbolSupportBody({
      exchange: 'okx',
      marketType: 'spot',
      symbol: 'ORDIUSDT',
      baseTimeframe: '1h',
    })

    await controller.checkSymbolSupport('user-1', 'Bearer token-1', 'req-1', body)

    expect(service.checkBacktestSymbolSupport).toHaveBeenCalledWith('user-1', 'Bearer token-1', {
      exchange: 'okx',
      marketType: 'spot',
      symbol: 'ORDIUSDT',
      baseTimeframe: '1h',
    }, 'req-1')
  })

  it('forwards the validated createJob payload without dropping snapshot-bound fields', async () => {
    const { controller, service } = createController()
    const body = await transformCreateJobBody({
      symbols: ['ORDIUSDT'],
      baseTimeframe: '1h',
      stateTimeframes: ['1h'],
      initialCash: 10000,
      execution: {
        slippageBps: 5,
        feeBps: 2,
        priceSource: 'close',
      },
      strategy: {
        id: 'strategy-1',
        protocolVersion: 'v1',
        publishedSnapshotId: 'snapshot-1',
        params: {
          marketType: 'spot',
          symbol: 'ORDIUSDT',
        },
      },
      dataRange: {
        fromTs: 1,
        toTs: 2,
      },
      requestedRangeInput: {
        preset: '7D',
      },
      allowPartial: false,
      conversationId: 'conversation-1',
    })

    await controller.createJob('user-1', 'Bearer token-1', 'req-1', body)

    expect(service.createBacktestJob).toHaveBeenCalledWith('user-1', 'Bearer token-1', expect.objectContaining({
      symbols: ['ORDIUSDT'],
      baseTimeframe: '1h',
      stateTimeframes: ['1h'],
      initialCash: 10000,
      execution: expect.objectContaining({
        slippageBps: 5,
        feeBps: 2,
        priceSource: 'close',
      }),
      strategy: expect.objectContaining({
        id: 'strategy-1',
        protocolVersion: 'v1',
        publishedSnapshotId: 'snapshot-1',
        params: {
          marketType: 'spot',
          symbol: 'ORDIUSDT',
        },
      }),
      dataRange: expect.objectContaining({
        fromTs: 1,
        toTs: 2,
      }),
      requestedRangeInput: expect.objectContaining({
        preset: '7D',
      }),
      allowPartial: false,
      conversationId: 'conversation-1',
    }), 'req-1')
  })
})
