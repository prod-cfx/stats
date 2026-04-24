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
    },
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

  it('runs a template using caller identity from auth', async () => {
    const { caller, controller, run } = await buildController()
    const dto: RunStrategyPlazaTemplateDto = { runRequestId: 'run-123456' }

    const result = await controller.run('ma-cross', dto, 'Bearer token', 'user-forwarded')

    expect(caller.resolveCallerUserIdFromAuthorization).toHaveBeenCalledWith('Bearer token', 'user-forwarded')
    expect(run.runTemplate).toHaveBeenCalledWith({
      userId: 'user-1',
      templateId: 'ma-cross',
      runRequestId: 'run-123456',
    })
    expect(result).toEqual({ id: 'strategy-1', status: 'running' })
  })

  it('documents mutating endpoints as 200 responses', () => {
    expect(Reflect.getMetadata(HTTP_CODE_METADATA, StrategyPlazaController.prototype.run)).toBe(200)
    expect(Reflect.getMetadata(HTTP_CODE_METADATA, StrategyPlazaController.prototype.editSession)).toBe(200)
  })

  it('starts an edit session using caller identity from auth', async () => {
    const { caller, controller, editSession } = await buildController()

    const result = await controller.editSession('ma-cross', 'Bearer token', 'user-forwarded')

    expect(caller.resolveCallerUserIdFromAuthorization).toHaveBeenCalledWith('Bearer token', 'user-forwarded')
    expect(editSession.startEditSession).toHaveBeenCalledWith({
      userId: 'user-1',
      templateId: 'ma-cross',
    })
    expect(result).toEqual({
      sessionId: 'session-1',
      templateId: 'ma-cross',
      initialMessage: 'Build a MA cross strategy',
    })
  })
})
