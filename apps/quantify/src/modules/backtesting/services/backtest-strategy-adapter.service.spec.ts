import type { DomainException } from '@/common/exceptions/domain.exception'
import { BacktestStrategyAdapterService } from './backtest-strategy-adapter.service'

describe('backtestStrategyAdapterService', () => {
  const service = new BacktestStrategyAdapterService()

  it('builds runner strategy fn from valid StrategyAdapterV1 script', async () => {
    const strategy = await service.build({
      id: 's1',
      protocolVersion: 'v1',
      scriptCode: `const strategy: StrategyAdapterV1 = {
  protocolVersion: 'v1',
  onBar() {
    return { action: 'NOOP' }
  },
}
strategy`,
      params: { risk: 0.1 },
    })

    expect(strategy.id).toBe('s1')
    expect(strategy.params).toEqual({ risk: 0.1 })
    await expect(strategy.fn({} as any)).resolves.toEqual({ action: 'NOOP' })
  })

  it('fails when protocolVersion is not v1', async () => {
    await expect(service.build({
      id: 's1',
      protocolVersion: 'v2' as any,
      scriptCode: 'const strategy = { protocolVersion: "v1", onBar: () => ({ action: "NOOP" }) }\nstrategy',
      params: {},
    })).rejects.toMatchObject({
      message: 'backtest.strategy_protocol_invalid',
    } as Partial<DomainException>)
  })

  it('fails when scriptCode is empty', async () => {
    await expect(service.build({
      id: 's1',
      protocolVersion: 'v1',
      scriptCode: '   ',
      params: {},
    })).rejects.toMatchObject({
      message: 'backtest.strategy_script_invalid',
    } as Partial<DomainException>)
  })

  it('fails when script TypeScript compile fails', async () => {
    await expect(service.build({
      id: 's1',
      protocolVersion: 'v1',
      scriptCode: `const strategy: StrategyAdapterV1 = {
  protocolVersion: 'v1',
  onBar() {
    return { action: 'OPEN_LONG' }
  },
}
strategy(`,
      params: {},
    })).rejects.toMatchObject({
      message: 'backtest.strategy_compile_failed',
    } as Partial<DomainException>)
  })

  it('fails when script export is not StrategyAdapterV1', async () => {
    await expect(service.build({
      id: 's1',
      protocolVersion: 'v1',
      scriptCode: '({ invalid: true })',
      params: {},
    })).rejects.toMatchObject({
      message: 'backtest.strategy_adapter_invalid',
    } as Partial<DomainException>)
  })

  it('fails when script executes with runtime error', async () => {
    await expect(service.build({
      id: 's1',
      protocolVersion: 'v1',
      scriptCode: 'throw new Error("boom")',
      params: {},
    })).rejects.toMatchObject({
      message: 'backtest.strategy_execute_failed',
    } as Partial<DomainException>)
  })
})
