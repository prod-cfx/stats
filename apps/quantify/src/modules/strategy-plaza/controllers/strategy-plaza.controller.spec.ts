jest.mock('../services/strategy-plaza-edit-session.service', () => ({
  StrategyPlazaEditSessionService: class StrategyPlazaEditSessionService {},
}))

jest.mock('../services/strategy-plaza-run.service', () => ({
  StrategyPlazaRunService: class StrategyPlazaRunService {},
}))

import { Test } from '@nestjs/testing'
import { HTTP_CODE_METADATA } from '@nestjs/common/constants'
import { CallerIdentityService } from '@/modules/llm-strategy-codegen/services/caller-identity.service'
import { RunStrategyPlazaTemplateDto } from '../dto/run-strategy-plaza-template.dto'
import { StrategyPlazaEditSessionService } from '../services/strategy-plaza-edit-session.service'
import { OfficialStrategyPlazaTemplateService } from '../services/official-strategy-plaza-template.service'
import { StrategyPlazaRunService } from '../services/strategy-plaza-run.service'
import { StrategyPlazaController } from './strategy-plaza.controller'

describe('StrategyPlazaController', () => {
  const template = {
    id: 'ma-cross',
    name: 'MA Cross',
    description: 'Trend following sample',
    logicDescription: 'Fast MA crosses slow MA',
    tags: ['trend'],
    riskLevel: 'medium',
    scenario: 'trend',
    exchange: 'okx',
    environment: 'demo',
    status: 'live',
    displayOrder: 1,
    runConfig: {
      exchange: 'okx',
      marketType: 'perp',
      symbol: 'BTC-USDT-SWAP',
      timeframe: '15m',
      positionPct: 10,
      leverage: 2,
      publishedSnapshotId: 'snapshot-1',
      deploymentExecutionConfig: { leverage: 2 },
    },
    editSeed: {
      initialMessage: 'Build a MA cross strategy',
      guideConfig: { symbolExample: 'BTC-USDT-SWAP', timeframeExample: '15m' },
    },
    displayMetrics: {
      label: 'official_sample_backtest',
      returnPct: 12,
      winRatePct: 55,
      maxDrawdownPct: 8,
      tradeCount: 43,
    },
    officialBacktest: {
      generatedAt: '2026-06-06T13:06:23.170Z',
      backtestFrom: 1775008800000,
      backtestTo: 1777167900000,
      source: 'https://www.okx.com/api/v5/market/history-candles',
      dataSource: {
        exchange: 'okx',
        marketType: 'swap',
        endpoint: 'https://www.okx.com/api/v5/market/history-candles',
        fixedEndTs: 1777168800000,
        pagination: { parameter: 'after', pageLimit: 300, pageCount: 8 },
      },
      candleCount: 2400,
      metrics: { returnPct: 12, winRatePct: 55, maxDrawdownPct: 8, tradeCount: 43 },
      equityCurve: [{ ts: 1775008800000, equity: 10000 }, { ts: 1777167900000, equity: 11200 }],
      confidence: { level: 'high', reasons: ['样本回测满足官方基础准入条件。'] },
      disclaimer: '历史回测不代表未来收益。该结果基于固定历史窗口和官方参数，不等同于实盘表现。',
    },
    signals: [
      { time: '2026-06-07T00:00:00.000Z', side: 'buy', price: 100, pnlPercent: 1 },
      { time: '2026-06-08T00:00:00.000Z', side: 'sell', price: 110, pnlPercent: 2 },
    ],
  } as const

  async function buildController(overrides?: {
    templates?: Partial<OfficialStrategyPlazaTemplateService>
    run?: Partial<StrategyPlazaRunService>
    editSession?: Partial<StrategyPlazaEditSessionService>
    caller?: Partial<CallerIdentityService>
  }) {
    const templates = {
      list: jest.fn().mockReturnValue([template]),
      getRequired: jest.fn().mockReturnValue(template),
      ...overrides?.templates,
    }
    const run = {
      runTemplate: jest.fn().mockResolvedValue({ id: 'strategy-1', status: 'running' }),
      ...overrides?.run,
    }
    const editSession = {
      startEditSession: jest.fn().mockResolvedValue({
        sessionId: 'session-1',
        templateId: 'ma-cross',
        initialMessage: 'Build a MA cross strategy',
      }),
      ...overrides?.editSession,
    }
    const caller = {
      resolveCallerUserIdFromAuthorization: jest.fn().mockResolvedValue('user-1'),
      ...overrides?.caller,
    }

    const moduleRef = await Test.createTestingModule({
      controllers: [StrategyPlazaController],
      providers: [
        { provide: OfficialStrategyPlazaTemplateService, useValue: templates },
        { provide: StrategyPlazaRunService, useValue: run },
        { provide: StrategyPlazaEditSessionService, useValue: editSession },
        { provide: CallerIdentityService, useValue: caller },
      ],
    }).compile()

    return {
      caller,
      controller: moduleRef.get(StrategyPlazaController),
      editSession,
      run,
      templates,
    }
  }

  it('lists public official templates without auth', async () => {
    const { caller, controller, templates } = await buildController()

    const result = await controller.list()

    expect(templates.list).toHaveBeenCalledWith()
    expect(caller.resolveCallerUserIdFromAuthorization).not.toHaveBeenCalled()
    expect(result).toEqual([
      expect.objectContaining({
        id: 'ma-cross',
        marketType: 'perp',
        symbol: 'BTC-USDT-SWAP',
        displayMetrics: { ...template.displayMetrics },
      }),
    ])
  })

  it('returns public official template detail without auth', async () => {
    const { caller, controller, templates } = await buildController()

    const result = await controller.detail('ma-cross')

    expect(templates.getRequired).toHaveBeenCalledWith('ma-cross')
    expect(caller.resolveCallerUserIdFromAuthorization).not.toHaveBeenCalled()
    expect(result).toEqual(expect.objectContaining({ id: 'ma-cross', timeframe: '15m' }))
  })

  it('exposes official backtest data on public template detail', async () => {
    const { controller } = await buildController()

    const result = await controller.detail('ma-cross')

    expect(result.officialBacktest).toMatchObject({
      metrics: expect.objectContaining({ tradeCount: expect.any(Number) }),
      confidence: expect.objectContaining({ level: expect.stringMatching(/^(high|medium|low)$/) }),
      disclaimer: expect.stringContaining('历史回测不代表未来收益'),
    })
    expect(result.officialBacktest.equityCurve.length).toBeGreaterThan(1)
  })

  it('limits public official template signals without auth', async () => {
    const { caller, controller, templates } = await buildController()

    const result = await controller.signals('ma-cross', '1')

    expect(templates.getRequired).toHaveBeenCalledWith('ma-cross')
    expect(caller.resolveCallerUserIdFromAuthorization).not.toHaveBeenCalled()
    expect(result).toEqual([template.signals[0]])
  })

  it('runs a template using caller identity from auth', async () => {
    const { caller, controller, run } = await buildController()
    const dto: RunStrategyPlazaTemplateDto = {
      runRequestId: 'run-123456',
      mode: 'LIVE',
      exchangeAccountId: 'acct-okx-live',
    }

    const result = await controller.run('ma-cross', dto, 'Bearer token', 'user-forwarded')

    expect(caller.resolveCallerUserIdFromAuthorization).toHaveBeenCalledWith('Bearer token', 'user-forwarded')
    expect(run.runTemplate).toHaveBeenCalledWith({
      userId: 'user-1',
      templateId: 'ma-cross',
      runRequestId: 'run-123456',
      mode: 'LIVE',
      exchangeAccountId: 'acct-okx-live',
    })
    expect(result).toEqual({ id: 'strategy-1', status: 'running' })
  })

  it('documents mutating endpoints as 200 responses', () => {
    expect(Reflect.getMetadata(HTTP_CODE_METADATA, StrategyPlazaController.prototype.run)).toBe(200)
    expect(Reflect.getMetadata(HTTP_CODE_METADATA, StrategyPlazaController.prototype.editSession)).toBe(200)
  })

  it('starts an edit session using caller identity from auth', async () => {
    const { caller, controller, editSession } = await buildController()

    const result = await controller.editSession('ma-cross', 'Bearer token', 'user-forwarded', 'en')

    expect(caller.resolveCallerUserIdFromAuthorization).toHaveBeenCalledWith('Bearer token', 'user-forwarded')
    expect(editSession.startEditSession).toHaveBeenCalledWith({
      userId: 'user-1',
      templateId: 'ma-cross',
      locale: 'en',
    })
    expect(result).toEqual({
      sessionId: 'session-1',
      templateId: 'ma-cross',
      initialMessage: 'Build a MA cross strategy',
    })
  })
})
