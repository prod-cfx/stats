import { BacktestStrategyAdapterService } from '@/modules/backtesting/services/backtest-strategy-adapter.service'
import { STAGE4_ATOM_COVERAGE_MATRIX, STAGE4_DEPLOY_READY_STATUSES } from '@/modules/llm-strategy-codegen/stage4/atom-coverage-matrix'
import type { StrategyExecutionContextV1 } from '@ai/shared'
import { OFFICIAL_STRATEGY_PLAZA_BACKTEST_EVIDENCE } from '../constants/official-strategy-plaza-backtest-evidence.constant'
import { OFFICIAL_STRATEGY_PLAZA_TEMPLATES } from '../constants/official-strategy-plaza-templates'
import { StrategyPlazaTemplateResponseDto } from '../dto/strategy-plaza-template.response.dto'
import { StrategyPlazaTemplateNotFoundException } from '../exceptions/strategy-plaza-template-not-found.exception'
import { buildOfficialStrategySnapshotContent } from '../utils/official-strategy-plaza-snapshot-builder'
import { OfficialStrategyPlazaTemplateService } from './official-strategy-plaza-template.service'

describe('OfficialStrategyPlazaTemplateService', () => {
  const service = new OfficialStrategyPlazaTemplateService()

  it('returns official templates in display order while preserving the legacy public beta set', () => {
    const templates = service.list()

    expect(templates.map(item => item.displayOrder)).toEqual(
      templates.map(item => item.displayOrder).slice().sort((left, right) => left - right),
    )
    expect(templates.map(item => item.id)).toEqual(expect.arrayContaining([
      'ma-cross',
      'bollinger-reversion',
      'grid-range',
      'rsi-reversal',
      'breakout-follow',
      'macd-cross',
    ]))
    expect(templates.every(item => item.exchange === 'okx')).toBe(true)
    expect(templates.every(item => item.environment === 'demo')).toBe(true)
    expect(templates.every(item => item.status === 'live')).toBe(true)
    expect(templates.filter(item => OFFICIAL_STRATEGY_PLAZA_BACKTEST_EVIDENCE.templates.some(evidence => evidence.templateId === item.id)).every(item =>
      item.displayMetrics.returnPct != null
      && item.displayMetrics.winRatePct != null
      && item.displayMetrics.maxDrawdownPct != null,
    )).toBe(true)
    expect(Math.max(...templates.map(item => item.displayMetrics.maxDrawdownPct ?? 0))).toBeLessThanOrEqual(20)
  })

  it('returns live official templates across every Strategy Plaza category', () => {
    const templates = service.list()
    const counts = templates.reduce<Record<string, number>>((acc, template) => {
      acc[template.category] = (acc[template.category] ?? 0) + 1
      return acc
    }, {})

    expect(Object.keys(counts).sort()).toEqual([
      'DCA',
      '反转',
      '衍生品事件',
      '突破',
      '盘口',
      '网格',
      '趋势',
      '风控稳健',
    ].sort())
    for (const count of Object.values(counts)) {
      expect(count).toBeGreaterThanOrEqual(3)
      expect(count).toBeLessThanOrEqual(6)
    }
  })

  it('requires verified backtest evidence for every live official template', () => {
    const evidenceByTemplateId = new Set(
      OFFICIAL_STRATEGY_PLAZA_BACKTEST_EVIDENCE.templates.map(item => item.templateId),
    )
    const missingEvidenceTemplateIds = service.list()
      .filter(template => template.status === 'live')
      .map(template => template.id)
      .filter(templateId => !evidenceByTemplateId.has(templateId))

    expect(missingEvidenceTemplateIds).toEqual([])
  })

  it('uses only rules mainflow atoms that reach backtest and deploy payload', () => {
    const deployReadyAtomKeys = new Set(
      STAGE4_ATOM_COVERAGE_MATRIX
        .filter(row => STAGE4_DEPLOY_READY_STATUSES.includes(row.status))
        .filter(row => row.reachesBacktest && row.reachesDeployPayload)
        .flatMap(row => [row.atomKey, ...row.coveredAtomKeys]),
    )
    const unsupportedAtoms = service.list().flatMap(template =>
      template.expectedAtomKeys
        .filter(atomKey => !deployReadyAtomKeys.has(atomKey))
        .map(atomKey => ({ templateId: template.id, atomKey })),
    )

    expect(unsupportedAtoms).toEqual([])
  })

  it('keeps official golden snapshots on the signal-generator deploy path', () => {
    const snapshots = OFFICIAL_STRATEGY_PLAZA_TEMPLATES.map(template => ({
      templateId: template.id,
      publishedSnapshotId: template.runConfig.publishedSnapshotId,
      content: buildOfficialStrategySnapshotContent(template),
    }))

    expect(snapshots).toHaveLength(OFFICIAL_STRATEGY_PLAZA_TEMPLATES.length)
    expect(snapshots.map(item => item.templateId)).toEqual(OFFICIAL_STRATEGY_PLAZA_TEMPLATES.map(template => template.id))
    expect(snapshots.every(item => item.publishedSnapshotId.endsWith('-snapshot'))).toBe(true)
    expect(snapshots.every(item =>
      item.content.executionEnvelope.runtime === 'signal-generator'
      && item.content.executionEnvelope.source === 'strategy-plaza-official-template',
    )).toBe(true)
    expect(snapshots.map(item => item.content.executionEnvelope.runtime)).not.toContain('grid-runtime')
    expect(snapshots.map(item => item.content.executionEnvelope.runtime)).not.toContain('trading-execution')
    expect(snapshots.every(item => item.content.backtestConfigDefaults.priceSource === 'close')).toBe(true)
    expect(snapshots.every(item => item.content.backtestConfigDefaults.range?.preset === 'CUSTOM')).toBe(true)
  })

  it('builds backtest adapters for all official signal-generator snapshots', async () => {
    const adapter = new BacktestStrategyAdapterService()

    await expect(Promise.all(OFFICIAL_STRATEGY_PLAZA_TEMPLATES.map(async (template) => {
      const content = buildOfficialStrategySnapshotContent(template)
      return adapter.build({
        id: template.id,
        protocolVersion: 'v1',
        scriptCode: content.scriptSnapshot,
        params: content.paramsSnapshot,
        executionEnvelope: content.executionEnvelope,
      })
    }))).resolves.toHaveLength(OFFICIAL_STRATEGY_PLAZA_TEMPLATES.length)
  })

  it('low drawdown regime gate official script opens when EMA20 crosses above EMA50 under the EMA50 regime', async () => {
    const template = service.getRequired('low-drawdown-regime-gate')
    const content = buildOfficialStrategySnapshotContent(template)
    const strategy = await new BacktestStrategyAdapterService().build({
      id: template.id,
      protocolVersion: 'v1',
      scriptCode: content.scriptSnapshot,
      params: content.paramsSnapshot,
      executionEnvelope: content.executionEnvelope,
    })
    const bars = Array.from({ length: 60 }, (_, index) => ({
      timestamp: index + 1,
      time: index + 1,
      open: index === 59 ? 100 : 100,
      high: index === 59 ? 121 : 101,
      low: 99,
      close: index === 59 ? 120 : 100,
      volume: 1,
    }))

    await expect(strategy.fn({
      bars,
      currentPrice: 120,
      position: { side: 'flat', qty: 0 },
      accountDrawdownPct: 0,
    } satisfies StrategyExecutionContextV1)).resolves.toMatchObject({
      action: 'OPEN_LONG',
      size: { mode: 'RATIO', value: 0.1 },
      meta: { templateId: 'low-drawdown-regime-gate' },
    })
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

  it('describes the range buy/sell template without promising a grid bot', () => {
    const template = service.getRequired('grid-range')

    expect(template.name).toBe('区间低买高卖')
    expect(template.tags).toEqual(['区间', '低买高卖', 'OKX 模拟盘'])
    expect(template.description).toContain('低买高卖')
    expect(template.description).not.toContain('网格')
    expect(template.editSeed.initialMessage).toContain('区间低买高卖策略')
    expect(template.editSeed.initialMessage).not.toContain('网格区间策略')
  })

  it('describes the MACD plaza edit seed as long-only entry plus close-long exit', () => {
    const template = service.getRequired('macd-cross')

    expect(template.editSeed.initialMessage).toContain('金叉做多、死叉平多')
    expect(template.editSeed.initialMessage).toContain('不做空')
    expect(template.editSeed.initialMessage).not.toContain('金叉死叉策略')
    expect(template.editSeed.locales?.en?.initialMessage).toContain('long-only')
    expect(template.editSeed.locales?.en?.initialMessage).toContain('does not open short positions')
    expect(template.editSeed.guideConfig?.exitRuleExample).toBe('MACD DIF 下穿 DEA 时平多')
    expect(template.editSeed.locales?.en?.guideConfig?.exitRuleExample).toBe('MACD DIF crosses below DEA to close long')
  })

  it('throws when template id is not found', () => {
    expect(() => service.getRequired('missing-template')).toThrow(StrategyPlazaTemplateNotFoundException)
  })

  it('throws when template is hidden', () => {
    const template = OFFICIAL_STRATEGY_PLAZA_TEMPLATES[0]
    const originalStatus = template.status

    try {
      ;(template as unknown as { status: 'hidden' }).status = 'hidden'

      expect(() => service.getRequired(template.id)).toThrow(StrategyPlazaTemplateNotFoundException)
    }
    finally {
      ;(template as unknown as { status: typeof originalStatus }).status = originalStatus
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
    expect(freshTemplate.displayMetrics.returnPct).toBe(1.78)
    expect(freshTemplate.status).toBe('live')
  })

  it('copies nested template values into response DTOs', () => {
    const template = service.getRequired('ma-cross')
    const dto = new StrategyPlazaTemplateResponseDto(template)

    dto.tags.push('dto-mutated-tag')
    dto.displayMetrics.returnPct = 999

    const freshTemplate = service.getRequired('ma-cross')

    expect(freshTemplate.tags).not.toContain('dto-mutated-tag')
    expect(freshTemplate.displayMetrics.returnPct).toBe(1.78)
  })
})
