import { ChecklistGateService } from '../checklist-gate.service'

describe('checklistGateService', () => {
  const service = new ChecklistGateService()

  it('returns missing fields for incomplete checklist', () => {
    const missing = service.getMissingFields({
      entryRules: ['short > long'],
    })

    expect(missing).toEqual(expect.arrayContaining(['exitRules']))
    expect(missing).not.toContain('entryRules')
  })

  it('returns empty when checklist complete', () => {
    const missing = service.getMissingFields({
      entryRules: ['sma20 > sma50'],
      exitRules: ['tp/sl'],
    })

    expect(missing).toEqual([])
  })
})
