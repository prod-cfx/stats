import type { CanonicalRuleV2, CanonicalStrategySpecV2 } from '../../types/canonical-strategy-spec-v2'
import { CanonicalSpecV2ValidatorService } from '../canonical-spec-v2-validator.service'

describe('canonicalSpecV2ValidatorService', () => {
  const validator = new CanonicalSpecV2ValidatorService()
  const createSpec = (rules: CanonicalRuleV2[]): CanonicalStrategySpecV2 => ({
    version: 2,
    market: {
      exchange: 'binance',
      symbol: 'BTCUSDT',
      marketType: 'spot',
      timeframe: '15m',
    },
    indicators: [],
    sizing: null,
    executionPolicy: {
      signalTiming: 'BAR_CLOSE',
      fillTiming: 'NEXT_BAR_OPEN',
    },
    dataRequirements: {
      requiredTimeframes: ['15m'],
    },
    rules,
  })

  it('rejects an entry rule that contains both OPEN_LONG and OPEN_SHORT', () => {
    const report = validator.validate(createSpec([
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
    ]))

    expect(report.status).toBe('INVALID')
    expect(report.errors).toContain('entry_rule_mutually_exclusive_open_actions')
  })

  it('rejects a side-sensitive risk rule without sideScope', () => {
    const report = validator.validate(createSpec([
      {
        id: 'risk-1',
        phase: 'risk',
        priority: 50,
        condition: { kind: 'atom', key: 'position_loss_pct', semanticScope: 'position', op: 'GTE', value: 0.05 },
        actions: [{ type: 'FORCE_EXIT' }],
      },
    ]))

    expect(report.status).toBe('INVALID')
    expect(report.errors).toContain('rule_requires_side_scope')
  })

  it('rejects a side-sensitive risk rule with flat sideScope', () => {
    const report = validator.validate(createSpec([
      {
        id: 'risk-2',
        phase: 'risk',
        sideScope: 'flat',
        priority: 40,
        condition: { kind: 'atom', key: 'position_drawdown', semanticScope: 'position', op: 'GTE', value: 0.08 },
        actions: [{ type: 'FORCE_EXIT' }],
      },
    ]))

    expect(report.status).toBe('INVALID')
    expect(report.errors).toContain('rule_requires_side_scope')
  })

  it('accepts a valid side-scoped risk rule', () => {
    const report = validator.validate(createSpec([
      {
        id: 'risk-3',
        phase: 'risk',
        sideScope: 'long',
        priority: 30,
        condition: { kind: 'atom', key: 'position_loss_pct', semanticScope: 'position', op: 'GTE', value: 0.05 },
        actions: [{ type: 'FORCE_EXIT' }],
      },
    ]))

    expect(report.status).toBe('VALID')
    expect(report.errors).toEqual([])
  })
})
