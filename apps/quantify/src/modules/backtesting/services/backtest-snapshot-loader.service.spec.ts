import { BacktestSnapshotLoaderService } from './backtest-snapshot-loader.service'

describe('backtestSnapshotLoaderService', () => {
  it('loads snapshot-backed strategy via published snapshot id', async () => {
    const snapshotsRepository = {
      findByIdForUser: jest.fn().mockResolvedValue({
        id: 'snapshot-1',
        strategyInstanceId: 'instance-1',
        strategyTemplateId: 'template-1',
        snapshotHash: 'snapshot-hash',
        scriptHash: 'script-hash',
        specHash: 'spec-hash',
        scriptSnapshot: 'const strategy = { protocolVersion: "v1", onBar: () => ({ action: "NOOP" }) }\nstrategy',
        paramsSnapshot: {
          positionPct: 25,
          exchange: 'okx',
        },
        lockedParams: {
          positionPct: 25,
        },
        executionPolicy: { signalTiming: 'BAR_CLOSE', fillTiming: 'NEXT_BAR_OPEN' },
        dataRequirements: { primary: ['15m'] },
        specSnapshot: {
          market: { exchange: 'okx' },
          indicators: [{ kind: 'bollingerBands', params: { period: 20, stdDev: 2 } }],
          riskRules: [
            { id: 'risk-stop-loss', trigger: 'lossPct >= 0.0500', effect: 'FORCE_STOP' },
            { id: 'risk-outside-band-3-bars', trigger: '价格连续3根K线在轨外时考虑提前止损或减仓', effect: 'REDUCE_POSITION' },
          ],
        },
      }),
    }
    const adaptedStrategy = {
      id: 'strategy-1',
      params: {
        positionPct: 25,
        exchange: 'okx',
      },
      fn: jest.fn(),
    }
    const strategyAdapter = {
      build: jest.fn().mockResolvedValue(adaptedStrategy),
    }
    const service = new BacktestSnapshotLoaderService(snapshotsRepository as never, strategyAdapter as never)

    const strategy = await service.load({
      id: 'strategy-1',
      protocolVersion: 'v1',
      publishedSnapshotId: 'snapshot-1',
      userId: 'user-1',
    })

    expect(snapshotsRepository.findByIdForUser).toHaveBeenCalledWith('snapshot-1', 'user-1')
    expect(strategyAdapter.build).toHaveBeenCalledWith({
      id: 'instance-1',
      protocolVersion: 'v1',
      scriptCode: 'const strategy = { protocolVersion: "v1", onBar: () => ({ action: "NOOP" }) }\nstrategy',
      params: {
        positionPct: 25,
        exchange: 'okx',
      },
    })
    expect(strategy).toMatchObject({
      id: 'instance-1',
      strategyInstanceId: 'instance-1',
      strategyTemplateId: 'template-1',
      params: {
        positionPct: 25,
        exchange: 'okx',
      },
      snapshotId: 'snapshot-1',
      snapshotHash: 'snapshot-hash',
      scriptHash: 'script-hash',
      specHash: 'spec-hash',
      bindingSource: 'PUBLISHED_SNAPSHOT_STRICT',
      executionPolicy: { signalTiming: 'BAR_CLOSE', fillTiming: 'NEXT_BAR_OPEN' },
      riskRules: {
        maxFloatingLossPct: 5,
        outsideBand: expect.objectContaining({
          mode: 'BOLLINGER_BANDS',
          action: 'REDUCE',
          consecutiveBars: 3,
          indicator: { kind: 'bollingerBands', period: 20, stdDev: 2 },
        }),
      },
      dataRequirements: { primary: ['15m'] },
      specSnapshot: { market: { exchange: 'okx' } },
    })
  })

  it('throws when published snapshot does not exist', async () => {
    const snapshotsRepository = {
      findByIdForUser: jest.fn().mockResolvedValue(null),
    }
    const strategyAdapter = {
      build: jest.fn(),
    }
    const service = new BacktestSnapshotLoaderService(snapshotsRepository as never, strategyAdapter as never)

    await expect(service.load({
      id: 'strategy-1',
      protocolVersion: 'v1',
      publishedSnapshotId: 'snapshot-missing',
      userId: 'user-1',
    })).rejects.toMatchObject({
      message: 'backtest.snapshot_not_found',
    })
    expect(strategyAdapter.build).not.toHaveBeenCalled()
  })

  it('fails fast when snapshot does not contain strict params', async () => {
    const snapshotsRepository = {
      findByIdForUser: jest.fn().mockResolvedValue({
        id: 'snapshot-1',
        strategyInstanceId: 'instance-1',
        strategyTemplateId: 'template-1',
        snapshotHash: 'snapshot-hash',
        scriptHash: 'script-hash',
        specHash: 'spec-hash',
        scriptSnapshot: 'const strategy = { protocolVersion: "v1", onBar: () => ({ action: "NOOP" }) }\nstrategy',
        paramsSnapshot: null,
        lockedParams: null,
        executionPolicy: { signalTiming: 'BAR_CLOSE', fillTiming: 'NEXT_BAR_OPEN' },
        dataRequirements: { primary: ['15m'] },
        specSnapshot: {
          market: { exchange: 'okx' },
          indicators: [],
          riskRules: [],
        },
      }),
    }
    const strategyAdapter = {
      build: jest.fn(),
    }
    const service = new BacktestSnapshotLoaderService(snapshotsRepository as never, strategyAdapter as never)

    await expect(service.load({
      id: 'strategy-1',
      protocolVersion: 'v1',
      publishedSnapshotId: 'snapshot-1',
      userId: 'user-1',
    })).rejects.toMatchObject({
      message: 'backtest.snapshot_params_missing',
    })
    expect(strategyAdapter.build).not.toHaveBeenCalled()
  })
})
