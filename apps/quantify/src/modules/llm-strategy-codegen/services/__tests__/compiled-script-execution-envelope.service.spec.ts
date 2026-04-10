import { CompiledScriptExecutionEnvelopeService } from '../compiled-script-execution-envelope.service'

describe('compiledScriptExecutionEnvelopeService', () => {
  const service = new CompiledScriptExecutionEnvelopeService()

  it('builds a long_short envelope when canonical spec opens short positions', () => {
    expect(service.build({
      version: 2,
      market: {
        exchange: 'binance',
        symbol: 'BTCUSDT',
        marketType: 'spot',
        timeframe: '15m',
      },
      indicators: [],
      sizing: { mode: 'RATIO', value: 0.1 },
      executionPolicy: {
        signalTiming: 'BAR_CLOSE',
        fillTiming: 'NEXT_BAR_OPEN',
      },
      dataRequirements: {
        requiredTimeframes: ['15m'],
      },
      rules: [
        {
          id: 'entry-short',
          phase: 'entry',
          sideScope: 'short',
          priority: 200,
          condition: {
            kind: 'atom',
            key: 'ma.death_cross',
            semanticScope: 'market',
            op: 'CROSS_UNDER',
          },
          actions: [{ type: 'OPEN_SHORT', sizing: { mode: 'RATIO', value: 0.1 } }],
        },
      ],
    }).positionMode).toBe('long_short')
  })
})
