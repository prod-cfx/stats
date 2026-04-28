import { SignalGenerationCandidateStage } from '../signal-generation-candidate.stage'

describe('signalGenerationCandidateStage', () => {
  it('groups enabled indicator configs by symbol/timeframe and filters incomplete groups', async () => {
    const repository = {
      findEnabledIndicatorConfigs: jest.fn().mockResolvedValue([
        {
          id: 'cfg-1',
          name: 'rsi',
          symbolId: 'symbol-1',
          timeframe: 'ONE_HOUR',
          symbol: { id: 'symbol-1', code: 'BTCUSDT:SPOT' },
        },
        {
          id: 'cfg-2',
          name: 'ema',
          symbolId: 'symbol-1',
          timeframe: 'ONE_HOUR',
          symbol: { id: 'symbol-1', code: 'BTCUSDT:SPOT' },
        },
        {
          id: 'cfg-3',
          name: 'rsi',
          symbolId: 'symbol-2',
          timeframe: 'ONE_HOUR',
          symbol: { id: 'symbol-2', code: 'ETHUSDT:SPOT' },
        },
      ]),
    }
    const stage = new SignalGenerationCandidateStage(repository as any, {} as any)

    const groups = await stage.findCandidateGroups({ id: 'strategy-1' } as any, ['rsi', 'ema'])

    expect(repository.findEnabledIndicatorConfigs).toHaveBeenCalledWith(['rsi', 'ema'])
    expect(groups).toHaveLength(1)
    expect(groups[0]?.symbol.code).toBe('BTCUSDT:SPOT')
    expect(groups[0]?.fields.get('rsi')?.id).toBe('cfg-1')
    expect(groups[0]?.fields.get('ema')?.id).toBe('cfg-2')
  })

  it('loads multi-leg data with market-aware symbol lookup for perp runtime', async () => {
    const repository = {
      findSymbolsByCode: jest.fn().mockResolvedValue([]),
      findSymbolsByCodeForMarket: jest.fn().mockResolvedValue([
        {
          id: 'symbol-perp-1',
          code: 'BTCUSDT:PERP',
        },
      ]),
    }
    const marketDataReadGateway = {
      getRecentBarsBySymbolId: jest.fn().mockResolvedValue([
        {
          time: new Date('2026-04-20T09:00:00.000Z'),
          timestamp: 1776675600000,
          open: 100,
          high: 105,
          low: 95,
          close: 102,
          volume: 10,
        },
      ]),
    }
    const stage = new SignalGenerationCandidateStage(
      repository as any,
      marketDataReadGateway as any,
    )

    await stage.loadMultiLegDataBatch(
      [{ id: 'primary', symbol: 'BTCUSDT', role: 'primary' }],
      { primary: ['15m'] },
      'perp',
    )

    expect(repository.findSymbolsByCodeForMarket).toHaveBeenCalledWith(['BTCUSDT'], 'perp')
    expect(repository.findSymbolsByCode).not.toHaveBeenCalled()
    expect(marketDataReadGateway.getRecentBarsBySymbolId).toHaveBeenCalledWith(
      'symbol-perp-1',
      '15m',
      expect.any(Number),
    )
  })
})
