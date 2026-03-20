import { ChecklistGateService } from '../checklist-gate.service'

describe('checklistGateService', () => {
  const service = new ChecklistGateService()

  it('returns missing fields for incomplete checklist', () => {
    const missing = service.getMissingFields({
      symbols: ['BTCUSDT'],
      timeframes: ['1h'],
    })

    expect(missing).toEqual(expect.arrayContaining(['entryRules', 'exitRules', 'riskRules']))
  })

  it('returns empty when checklist complete', () => {
    const missing = service.getMissingFields({
      symbols: ['BTCUSDT'],
      timeframes: ['1h'],
      entryRules: ['sma20 > sma50'],
      exitRules: ['tp/sl'],
      riskRules: { maxPositionPct: 0.1 },
    })

    expect(missing).toEqual([])
  })
})
