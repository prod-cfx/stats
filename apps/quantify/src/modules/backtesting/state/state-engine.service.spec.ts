import { StateEngineService } from './state-engine.service'

describe('stateEngineService', () => {
  it('should update snapshot only on HTF close', () => {
    const engine = new StateEngineService()
    engine.upsert({
      symbol: 'BTCUSDT',
      timeframe: '1h',
      ts: 1000,
      values: { regime: 'trend' },
    })

    const snap = engine.getLatest('BTCUSDT', '1h')
    expect(snap?.values.regime).toBe('trend')
  })
})
