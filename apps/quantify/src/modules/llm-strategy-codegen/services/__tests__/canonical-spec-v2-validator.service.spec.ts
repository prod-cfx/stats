import { CanonicalSpecV2ValidatorService } from '../canonical-spec-v2-validator.service'

describe('canonicalSpecV2ValidatorService', () => {
  const validator = new CanonicalSpecV2ValidatorService()

  it('rejects an entry rule that contains both OPEN_LONG and OPEN_SHORT', () => {
    const report = validator.validate({
      version: 2,
      rules: [
        {
          id: 'entry-1',
          phase: 'entry',
          sideScope: 'flat',
          priority: 200,
          condition: { kind: 'atom', key: 'bollinger.upper_break' },
          actions: [
            { type: 'OPEN_LONG', sizing: { mode: 'RATIO', value: 0.1 } },
            { type: 'OPEN_SHORT', sizing: { mode: 'RATIO', value: 0.1 } },
          ],
        },
      ],
    } as never)

    expect(report.status).toBe('INVALID')
    expect(report.errors).toContain('entry_rule_mutually_exclusive_open_actions')
  })

  it('rejects a side-sensitive risk rule without sideScope', () => {
    const report = validator.validate({
      version: 2,
      rules: [
        {
          id: 'risk-1',
          phase: 'risk',
          priority: 50,
          condition: { kind: 'atom', key: 'position_loss_pct', op: 'GTE', value: 0.05 },
          actions: [{ type: 'FORCE_EXIT' }],
        },
      ],
    } as never)

    expect(report.status).toBe('INVALID')
    expect(report.errors).toContain('rule_requires_side_scope')
  })
})
