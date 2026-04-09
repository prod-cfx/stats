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
})
