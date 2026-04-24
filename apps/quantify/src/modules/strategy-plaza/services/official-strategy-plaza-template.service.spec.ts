import { OFFICIAL_STRATEGY_PLAZA_TEMPLATES } from '../constants/official-strategy-plaza-templates'
import { StrategyPlazaTemplateResponseDto } from '../dto/strategy-plaza-template.response.dto'
import { StrategyPlazaTemplateNotFoundException } from '../exceptions/strategy-plaza-template-not-found.exception'
import { OfficialStrategyPlazaTemplateService } from './official-strategy-plaza-template.service'

describe('OfficialStrategyPlazaTemplateService', () => {
  const service = new OfficialStrategyPlazaTemplateService()

  it('returns exactly the six public beta templates in display order', () => {
    const templates = service.list()

    expect(templates.map(item => item.id)).toEqual([
      'ma-cross',
      'bollinger-reversion',
      'grid-range',
      'rsi-reversal',
      'breakout-follow',
      'macd-cross',
    ])
    expect(templates.every(item => item.exchange === 'okx')).toBe(true)
    expect(templates.every(item => item.environment === 'demo')).toBe(true)
    expect(templates.every(item => item.status === 'live')).toBe(true)
  })

  it('exposes fixed run parameters without user override fields', () => {
    const template = service.getRequired('macd-cross')

    expect(template.runConfig).toMatchObject({
      exchange: 'okx',
      symbol: expect.any(String),
      marketType: expect.stringMatching(/^(spot|perp)$/),
      timeframe: expect.any(String),
      positionPct: expect.any(Number),
    })
    const runConfigKeys = Object.keys(template.runConfig)
    expect(runConfigKeys).toEqual(expect.arrayContaining([
      'exchange',
      'marketType',
      'symbol',
      'timeframe',
      'positionPct',
      'leverage',
      'publishedSnapshotId',
      'deploymentExecutionConfig',
    ]))
    expect(runConfigKeys).toHaveLength(8)
    expect(runConfigKeys).not.toEqual(expect.arrayContaining([
      'accountId',
      'exchangeAccountId',
      'parameters',
      'runRequestId',
      'userId',
    ]))
  })

  it('throws when template id is not found', () => {
    expect(() => service.getRequired('missing-template')).toThrow(StrategyPlazaTemplateNotFoundException)
  })

  it('throws when template is hidden', () => {
    const template = OFFICIAL_STRATEGY_PLAZA_TEMPLATES[0]
    const originalStatus = template.status

    try {
      ;(template as { status: 'hidden' }).status = 'hidden'

      expect(() => service.getRequired(template.id)).toThrow(StrategyPlazaTemplateNotFoundException)
    }
    finally {
      ;(template as { status: typeof originalStatus }).status = originalStatus
    }
  })

  it('returns defensive template copies from list and getRequired', () => {
    const listedTemplate = service.list()[0]
    const requiredTemplate = service.getRequired('ma-cross')

    listedTemplate.tags.push('mutated-tag')
    requiredTemplate.runConfig.deploymentExecutionConfig.orderType = 'limit' as 'market'
    requiredTemplate.displayMetrics.returnPct = 999
    requiredTemplate.status = 'hidden'

    const freshTemplate = service.getRequired('ma-cross')

    expect(freshTemplate.tags).not.toContain('mutated-tag')
    expect(freshTemplate.runConfig.deploymentExecutionConfig.orderType).toBe('market')
    expect(freshTemplate.displayMetrics.returnPct).toBeNull()
    expect(freshTemplate.status).toBe('live')
  })

  it('copies nested template values into response DTOs', () => {
    const template = service.getRequired('ma-cross')
    const dto = new StrategyPlazaTemplateResponseDto(template)

    dto.tags.push('dto-mutated-tag')
    dto.displayMetrics.returnPct = 999

    const freshTemplate = service.getRequired('ma-cross')

    expect(freshTemplate.tags).not.toContain('dto-mutated-tag')
    expect(freshTemplate.displayMetrics.returnPct).toBeNull()
  })
})
