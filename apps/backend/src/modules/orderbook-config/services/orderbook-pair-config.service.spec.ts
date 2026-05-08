import type { TestingModule } from '@nestjs/testing';
import { ErrorCode } from '@ai/shared'
import { HttpStatus } from '@nestjs/common'
import { Test } from '@nestjs/testing'
import { DomainException } from '@/common/exceptions/domain.exception'
import { RedisService } from '@/common/services/redis.service'
import { OrderbookPairConfigRepository } from '../repositories/orderbook-pair-config.repository'
import { OrderbookPairConfigService } from './orderbook-pair-config.service'

describe('orderbookPairConfigService', () => {
  let service: OrderbookPairConfigService
  let repository: OrderbookPairConfigRepository

  const mockConfig = {
    id: 'test-id',
    pairId: 'BTCUSDT.BINANCE.SPOT',
    venue: 'BINANCE',
    symbol: 'BTCUSDT',
    baseAsset: 'BTC',
    quoteAsset: 'USDT',
    venueType: 'CEX',
    instrumentType: 'SPOT',
    enabled: true,
    priority: 100,
    pullIntervalSeconds: null,
    depthLevels: null,
    metadata: null,
    description: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  }

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OrderbookPairConfigService,
        {
          provide: OrderbookPairConfigRepository,
          useValue: {
            findAll: jest.fn(),
            findById: jest.fn(),
            findByPairId: jest.fn(),
            create: jest.fn(),
            update: jest.fn(),
            delete: jest.fn(),
            findEnabledConfigs: jest.fn(),
          },
        },
        {
          provide: RedisService,
          useValue: { getClient: jest.fn(() => ({})) },
        },
      ],
    }).compile()

    service = module.get<OrderbookPairConfigService>(OrderbookPairConfigService)
    repository = module.get<OrderbookPairConfigRepository>(OrderbookPairConfigRepository)
  })

  afterEach(() => {
    jest.clearAllMocks()
  })

  describe('create', () => {
    it('should create config successfully when pairId is unique', async () => {
      const createDto = {
        pairId: 'BTCUSDT.BINANCE.SPOT',
        venue: 'BINANCE',
        symbol: 'BTCUSDT',
        baseAsset: 'BTC',
        quoteAsset: 'USDT',
        venueType: 'CEX' as const,
        instrumentType: 'SPOT' as const,
      }

      jest.spyOn(repository, 'findByPairId').mockResolvedValue(null)
      jest.spyOn(repository, 'create').mockResolvedValue(mockConfig as any)

      const result = await service.create(createDto)

      expect(repository.findByPairId).toHaveBeenCalledWith(createDto.pairId)
      expect(repository.create).toHaveBeenCalledWith(createDto)
      expect(result).toEqual(mockConfig)
    })

    it('should throw error when pairId already exists', async () => {
      const createDto = {
        pairId: 'BTCUSDT.BINANCE.SPOT',
        venue: 'BINANCE',
        symbol: 'BTCUSDT',
        baseAsset: 'BTC',
        quoteAsset: 'USDT',
        venueType: 'CEX' as const,
        instrumentType: 'SPOT' as const,
      }

      jest.spyOn(repository, 'findByPairId').mockResolvedValue(mockConfig as any)

      await expect(service.create(createDto)).rejects.toThrow(DomainException)
      await expect(service.create(createDto)).rejects.toMatchObject({
        code: ErrorCode.CONFLICT,
        status: HttpStatus.CONFLICT,
      })

      expect(repository.findByPairId).toHaveBeenCalledWith(createDto.pairId)
      expect(repository.create).not.toHaveBeenCalled()
    })
  })

  describe('findById', () => {
    it('should return config when found', async () => {
      jest.spyOn(repository, 'findById').mockResolvedValue(mockConfig as any)

      const result = await service.findById('test-id')

      expect(repository.findById).toHaveBeenCalledWith('test-id')
      expect(result).toEqual(mockConfig)
    })

    it('should throw error when config not found', async () => {
      jest.spyOn(repository, 'findById').mockResolvedValue(null)

      await expect(service.findById('non-existent')).rejects.toThrow(DomainException)
      await expect(service.findById('non-existent')).rejects.toMatchObject({
        code: ErrorCode.NOT_FOUND,
        status: HttpStatus.NOT_FOUND,
      })
    })
  })

  describe('update', () => {
    it('should update config successfully', async () => {
      const updateDto = {
        enabled: false,
        priority: 200,
      }

      const updatedConfig = { ...mockConfig, ...updateDto }

      jest.spyOn(repository, 'findById').mockResolvedValue(mockConfig as any)
      jest.spyOn(repository, 'update').mockResolvedValue(updatedConfig as any)

      const result = await service.update('test-id', updateDto)

      expect(repository.findById).toHaveBeenCalledWith('test-id')
      expect(repository.update).toHaveBeenCalledWith('test-id', updateDto)
      expect(result).toEqual(updatedConfig)
    })

    it('should throw error when config not found', async () => {
      jest.spyOn(repository, 'findById').mockResolvedValue(null)

      await expect(service.update('non-existent', {})).rejects.toThrow(DomainException)
      expect(repository.update).not.toHaveBeenCalled()
    })
  })

  describe('delete', () => {
    it('should delete config successfully', async () => {
      jest.spyOn(repository, 'findById').mockResolvedValue(mockConfig as any)
      jest.spyOn(repository, 'delete').mockResolvedValue()

      await service.delete('test-id')

      expect(repository.findById).toHaveBeenCalledWith('test-id')
      expect(repository.delete).toHaveBeenCalledWith('test-id')
    })

    it('should throw error when config not found', async () => {
      jest.spyOn(repository, 'findById').mockResolvedValue(null)

      await expect(service.delete('non-existent')).rejects.toThrow(DomainException)
      expect(repository.delete).not.toHaveBeenCalled()
    })
  })

  describe('findAll', () => {
    it('should return all configs with filter', async () => {
      const configs = [mockConfig]
      const filter = { venue: 'BINANCE', enabledOnly: true }

      jest.spyOn(repository, 'findAll').mockResolvedValue(configs as any)

      const result = await service.findAll(filter)

      expect(repository.findAll).toHaveBeenCalledWith(filter)
      expect(result).toEqual(configs)
    })
  })

  describe('findEnabledConfigs', () => {
    it('should return only enabled configs', async () => {
      const enabledConfigs = [mockConfig]

      jest.spyOn(repository, 'findEnabledConfigs').mockResolvedValue(enabledConfigs as any)

      const result = await service.findEnabledConfigs()

      expect(repository.findEnabledConfigs).toHaveBeenCalled()
      expect(result).toEqual(enabledConfigs)
    })
  })
})

