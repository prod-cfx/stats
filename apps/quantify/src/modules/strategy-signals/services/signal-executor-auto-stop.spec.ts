import { DEFAULT_STRATEGY_SIGNALS_CONFIG } from '../types/strategy-signals-config.type'
import { SignalExecutorService } from './signal-executor.service'

describe('signalExecutorService auto stop', () => {
  it('auto-stops strategy instance after 3 consecutive failures', async () => {
    const schedulerRegistry = { addCronJob: jest.fn(), deleteCronJob: jest.fn() }
    const executorRepository = {
      findSubscribedAccounts: jest.fn().mockResolvedValue([{ id: 'acct-1', userId: 'user-1' }]),
      incrementStrategyExecutionFailure: jest.fn().mockResolvedValue({
        strategyInstanceId: 'inst-1',
        consecutiveExecutionFailures: 3,
      }),
      resetStrategyExecutionFailure: jest.fn(),
      markStrategyAutoStopped: jest.fn(),
    }

    const strategyInstancesService = {
      updateInstance: jest.fn().mockResolvedValue(undefined),
    }

    const tradingSignalRepository = {
      findById: jest.fn().mockResolvedValue({
        id: 'sig-1',
        strategyId: 'tpl-1',
        strategyInstanceId: 'inst-1',
        symbol: { id: 'sym-1' },
      }),
      updateStatus: jest.fn().mockResolvedValue(undefined),
    }

    const service = new SignalExecutorService(
      executorRepository as any,
      { get: jest.fn().mockReturnValue({ ...DEFAULT_STRATEGY_SIGNALS_CONFIG, execution: { ...DEFAULT_STRATEGY_SIGNALS_CONFIG.execution, enabled: true } }) } as any,
      schedulerRegistry as any,
      { placeOrder: jest.fn() } as any,
      { applyLedgerDelta: jest.fn() } as any,
      strategyInstancesService as any,
      { recordTrade: jest.fn() } as any,
      tradingSignalRepository as any,
      { markStage: jest.fn(), markExecuted: jest.fn(), markFailed: jest.fn(), markSkipped: jest.fn() } as any,
      { recordExecutionSummary: jest.fn() } as any,
      {} as any,
    )

    ;(service as any).processAccount = jest.fn().mockResolvedValue('failed')

    await service.executeSignalForSubscribedUsers('sig-1', {
      ...DEFAULT_STRATEGY_SIGNALS_CONFIG,
      execution: {
        ...DEFAULT_STRATEGY_SIGNALS_CONFIG.execution,
        enabled: true,
      },
    } as any)

    expect(executorRepository.incrementStrategyExecutionFailure).toHaveBeenCalledWith('inst-1')
    expect(strategyInstancesService.updateInstance).toHaveBeenCalledWith(
      'inst-1',
      expect.objectContaining({ status: 'stopped' }),
      'system:auto-stop',
    )
    expect(executorRepository.markStrategyAutoStopped).toHaveBeenCalledWith(
      'inst-1',
      'CONSECUTIVE_EXECUTION_FAILURES',
    )
  })
})
