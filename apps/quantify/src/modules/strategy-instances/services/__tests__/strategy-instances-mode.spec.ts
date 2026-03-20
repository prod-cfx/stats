import type { TestingModule } from '@nestjs/testing'
import type { TestLegTimeframeDataDto } from '../../dto/test-strategy-instance.dto'
import type { StrategyInstanceMode, StrategyInstanceStatus } from '@/prisma/prisma.types'

import { Test } from '@nestjs/testing'
import { EnvService } from '@/common/services/env.service'
import { MarketDataReadGateway } from '@/modules/market-data/services/market-data-read.gateway'
import { TradingSignalRepository } from '@/modules/strategy-signals/repositories/trading-signal.repository'
import { PrismaService } from '@/prisma/prisma.service'
import { InvalidInstanceModeTransitionException } from '../../exceptions'
import { StrategyInstancesRepository } from '../../repositories/strategy-instances.repository'
import { StrategyInstanceStatsService } from '../strategy-instance-stats.service'
import { StrategyInstancesService } from '../strategy-instances.service'

describe('strategyInstancesService - mode management', () => {
  let service: StrategyInstancesService

  const mockPrismaService = {
    getClient: jest.fn(),
  }

  const mockStatsService = {
    calculateStats: jest.fn(),
    calculateBatchStats: jest.fn(),
  }

  const mockRepository = {
    create: jest.fn(),
    findById: jest.fn(),
    findByIdWithDetails: jest.fn(),
    findMany: jest.fn(),
    update: jest.fn(),
    existsByTemplateModelName: jest.fn(),
  }

  const mockTradingSignalRepository = {}
  const mockMarketDataReadGateway = {
    getRecentBars: jest.fn(),
    getLatestBar: jest.fn(),
    getRecentBarsBySymbolId: jest.fn(),
  }

  const mockStrategyTemplate = {
    id: 'template-123',
    name: 'Test Template',
  }

  const mockStrategyInstance = {
    id: 'instance-123',
    strategyTemplateId: 'template-123',
    name: 'Test Instance',
    llmModel: 'gpt-4',
    status: 'draft' as StrategyInstanceStatus,
    mode: 'PAPER' as StrategyInstanceMode,
    params: null,
    metadata: null,
    description: null,
    startedAt: null,
    stoppedAt: null,
    createdBy: null,
    updatedBy: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  }

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        StrategyInstancesService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
        {
          provide: StrategyInstancesRepository,
          useValue: mockRepository,
        },
        {
          provide: StrategyInstanceStatsService,
          useValue: mockStatsService,
        },
        {
          provide: TradingSignalRepository,
          useValue: mockTradingSignalRepository,
        },
        {
          provide: MarketDataReadGateway,
          useValue: mockMarketDataReadGateway,
        },
        {
          provide: EnvService,
          useValue: { isDev: jest.fn().mockReturnValue(false), isProd: jest.fn().mockReturnValue(false), isTest: jest.fn().mockReturnValue(true) },
        },
      ],
    }).compile()

    service = module.get<StrategyInstancesService>(StrategyInstancesService)

    // Reset mocks
    jest.clearAllMocks()
  })

  describe('createInstance', () => {
    beforeEach(() => {
      mockPrismaService.getClient.mockReturnValue({
        strategyTemplate: {
          findUnique: jest.fn().mockResolvedValue(mockStrategyTemplate),
        },
      })
      mockRepository.existsByTemplateModelName.mockResolvedValue(false)
      mockRepository.create.mockResolvedValue(mockStrategyInstance)
      mockRepository.findByIdWithDetails.mockResolvedValue({
        ...mockStrategyInstance,
        strategyTemplate: mockStrategyTemplate,
      })
    })

    it('should create instance with default PAPER mode when mode is not specified', async () => {
      await service.createInstance({
        strategyTemplateId: 'template-123',
        name: 'Test Instance',
        llmModel: 'gpt-4',
      })

      expect(mockRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          strategyTemplateId: 'template-123',
          name: 'Test Instance',
          llmModel: 'gpt-4',
          mode: undefined, // Will use DB default
        })
      )
    })

    it('should create instance with specified mode', async () => {
      await service.createInstance({
        strategyTemplateId: 'template-123',
        name: 'Test Instance',
        llmModel: 'gpt-4',
        mode: 'TESTNET',
      })

      expect(mockRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          mode: 'TESTNET',
        })
      )
    })

    it('should create instance with BACKTEST mode', async () => {
      await service.createInstance({
        strategyTemplateId: 'template-123',
        name: 'Backtest Instance',
        llmModel: 'gpt-4',
        mode: 'BACKTEST',
      })

      expect(mockRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          mode: 'BACKTEST',
        })
      )
    })

    it('should create instance with LIVE mode', async () => {
      await service.createInstance({
        strategyTemplateId: 'template-123',
        name: 'Live Instance',
        llmModel: 'gpt-4',
        mode: 'LIVE',
      })

      expect(mockRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          mode: 'LIVE',
        })
      )
    })
  })

  describe('updateInstance - Mode Transition Validation', () => {
    it('should allow mode change when instance is in draft status', async () => {
      const draftInstance = {
        ...mockStrategyInstance,
        status: 'draft' as StrategyInstanceStatus,
        mode: 'PAPER' as StrategyInstanceMode,
      }

      mockRepository.findById.mockResolvedValue(draftInstance)
      mockRepository.existsByTemplateModelName.mockResolvedValue(false)
      mockRepository.update.mockResolvedValue({
        ...draftInstance,
        mode: 'TESTNET' as StrategyInstanceMode,
      })
      mockRepository.findByIdWithDetails.mockResolvedValue({
        ...draftInstance,
        mode: 'TESTNET' as StrategyInstanceMode,
        strategyTemplate: mockStrategyTemplate,
      })

      await service.updateInstance('instance-123', {
        mode: 'TESTNET',
      })

      expect(mockRepository.update).toHaveBeenCalledWith(
        'instance-123',
        expect.objectContaining({
          mode: 'TESTNET',
        })
      )
    })

    it('should allow restarting a stopped TESTNET instance to running', async () => {
      const stoppedTestnetInstance = {
        ...mockStrategyInstance,
        status: 'stopped' as StrategyInstanceStatus,
        mode: 'TESTNET' as StrategyInstanceMode,
      }

      mockRepository.findById.mockResolvedValue(stoppedTestnetInstance)
      mockRepository.existsByTemplateModelName.mockResolvedValue(false)
      mockRepository.update.mockResolvedValue({
        ...stoppedTestnetInstance,
        status: 'running' as StrategyInstanceStatus,
      })
      mockRepository.findByIdWithDetails.mockResolvedValue({
        ...stoppedTestnetInstance,
        status: 'running' as StrategyInstanceStatus,
        strategyTemplate: mockStrategyTemplate,
      })

      await service.updateInstance('instance-123', {
        status: 'running',
      })

      expect(mockRepository.update).toHaveBeenCalledWith(
        'instance-123',
        expect.objectContaining({
          status: 'running',
        }),
      )
    })

    it('should reject mode change when instance is running', async () => {
      const runningInstance = {
        ...mockStrategyInstance,
        status: 'running' as StrategyInstanceStatus,
        mode: 'PAPER' as StrategyInstanceMode,
      }

      mockRepository.findById.mockResolvedValue(runningInstance)

      await expect(
        service.updateInstance('instance-123', {
          mode: 'LIVE',
        })
      ).rejects.toThrow(InvalidInstanceModeTransitionException)
    })

    it('should reject mode change when instance is stopped', async () => {
      const stoppedInstance = {
        ...mockStrategyInstance,
        status: 'stopped' as StrategyInstanceStatus,
        mode: 'PAPER' as StrategyInstanceMode,
      }

      mockRepository.findById.mockResolvedValue(stoppedInstance)

      await expect(
        service.updateInstance('instance-123', {
          mode: 'TESTNET',
        })
      ).rejects.toThrow(InvalidInstanceModeTransitionException)
    })

    it('should reject transition from LIVE to BACKTEST', async () => {
      const liveInstance = {
        ...mockStrategyInstance,
        status: 'paused' as StrategyInstanceStatus,
        mode: 'LIVE' as StrategyInstanceMode,
      }

      mockRepository.findById.mockResolvedValue(liveInstance)

      await expect(
        service.updateInstance('instance-123', {
          mode: 'BACKTEST',
        })
      ).rejects.toThrow(InvalidInstanceModeTransitionException)
    })

    it('should allow transition from PAPER to TESTNET in draft status', async () => {
      const draftInstance = {
        ...mockStrategyInstance,
        status: 'draft' as StrategyInstanceStatus,
        mode: 'PAPER' as StrategyInstanceMode,
      }

      mockRepository.findById.mockResolvedValue(draftInstance)
      mockRepository.existsByTemplateModelName.mockResolvedValue(false)
      mockRepository.update.mockResolvedValue({
        ...draftInstance,
        mode: 'TESTNET' as StrategyInstanceMode,
      })
      mockRepository.findByIdWithDetails.mockResolvedValue({
        ...draftInstance,
        mode: 'TESTNET' as StrategyInstanceMode,
        strategyTemplate: mockStrategyTemplate,
      })

      await service.updateInstance('instance-123', {
        mode: 'TESTNET',
      })

      expect(mockRepository.update).toHaveBeenCalledWith(
        'instance-123',
        expect.objectContaining({
          mode: 'TESTNET',
        })
      )
    })

    it('should allow transition from TESTNET to LIVE in paused status', async () => {
      const pausedInstance = {
        ...mockStrategyInstance,
        status: 'paused' as StrategyInstanceStatus,
        mode: 'TESTNET' as StrategyInstanceMode,
      }

      mockRepository.findById.mockResolvedValue(pausedInstance)
      mockRepository.existsByTemplateModelName.mockResolvedValue(false)
      mockRepository.update.mockResolvedValue({
        ...pausedInstance,
        mode: 'LIVE' as StrategyInstanceMode,
      })
      mockRepository.findByIdWithDetails.mockResolvedValue({
        ...pausedInstance,
        mode: 'LIVE' as StrategyInstanceMode,
        strategyTemplate: mockStrategyTemplate,
      })

      await service.updateInstance('instance-123', {
        mode: 'LIVE',
      })

      expect(mockRepository.update).toHaveBeenCalledWith(
        'instance-123',
        expect.objectContaining({
          mode: 'LIVE',
        })
      )
    })

    it('should not trigger mode validation if mode is not changed', async () => {
      const draftInstance = {
        ...mockStrategyInstance,
        status: 'draft' as StrategyInstanceStatus,
        mode: 'PAPER' as StrategyInstanceMode,
      }

      mockRepository.findById.mockResolvedValue(draftInstance)
      mockRepository.existsByTemplateModelName.mockResolvedValue(false)
      mockRepository.update.mockResolvedValue({
        ...draftInstance,
        name: 'Updated Name',
      })
      mockRepository.findByIdWithDetails.mockResolvedValue({
        ...draftInstance,
        name: 'Updated Name',
        strategyTemplate: mockStrategyTemplate,
      })

      await service.updateInstance('instance-123', {
        name: 'Updated Name',
      })

      expect(mockRepository.update).toHaveBeenCalled()
    })
  })

  describe('listInstances with mode filter', () => {
    it('should filter instances by mode', async () => {
      mockRepository.findMany.mockResolvedValue({
        items: [mockStrategyInstance],
        total: 1,
      })

      await service.listInstances({
        page: 1,
        limit: 20,
        mode: 'TESTNET',
      })

      expect(mockRepository.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          mode: 'TESTNET',
        })
      )
    })

    it('should return all instances when mode filter is not specified', async () => {
      mockRepository.findMany.mockResolvedValue({
        items: [mockStrategyInstance],
        total: 1,
      })

      await service.listInstances({
        page: 1,
        limit: 20,
      })

      expect(mockRepository.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          mode: undefined,
        })
      )
    })
  })

  describe('buildTestPayload', () => {
    it('loads bars via gateway and keeps timestamps ascending in multiLegData', async () => {
      mockPrismaService.getClient.mockReturnValue({
        strategyInstance: {
          findUnique: jest.fn().mockResolvedValue({
            id: 'instance-123',
            strategyTemplate: {
              execution: { mode: 'MULTI_LEG' },
              dataRequirements: { leg1: ['1h'] },
              legs: [{ id: 'leg1', symbol: 'BTCUSDT' }],
            },
          }),
        },
        symbol: {
          findMany: jest.fn().mockResolvedValue([{ id: 'symbol-1', code: 'BTCUSDT' }]),
        },
      })
      mockMarketDataReadGateway.getRecentBarsBySymbolId.mockResolvedValue([
        { open: 1, high: 2, low: 0.5, close: 1.5, volume: 10, timestamp: 1000 },
        { open: 1.5, high: 2.5, low: 1, close: 2, volume: 12, timestamp: 2000 },
      ])

      const payload = await service.buildTestPayload('instance-123')
      const timeframeData = payload.multiLegData?.leg1?.['1h'] as TestLegTimeframeDataDto | undefined
      const bars = timeframeData?.bars ?? []

      expect(mockMarketDataReadGateway.getRecentBarsBySymbolId).toHaveBeenCalledWith('symbol-1', '1h', 100)
      expect(bars.length).toBeGreaterThan(0)
      expect(bars.at(-1)?.timestamp).toBeGreaterThan(bars[0]!.timestamp)
    })
  })
})
