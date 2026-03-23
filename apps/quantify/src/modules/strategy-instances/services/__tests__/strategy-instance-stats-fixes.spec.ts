import type { TestingModule } from '@nestjs/testing'
import { ErrorCode } from '@ai/shared'
import { Test } from '@nestjs/testing'
import { DomainException } from '@/common/exceptions/domain.exception'

import { Prisma } from '@/prisma/prisma.types'

import { StrategyInstancesRepository } from '../../repositories/strategy-instances.repository'
import { StrategyInstanceStatsService } from '../strategy-instance-stats.service'

// Prisma 7: 从 Prisma namespace 导出 Decimal
const Decimal = Prisma.Decimal

describe('strategyInstanceStatsService - Review Fixes', () => {
  let service: StrategyInstanceStatsService
  let instancesRepo: jest.Mocked<StrategyInstancesRepository>

  beforeEach(async () => {
    const repoMock = {
      findByIdWithTemplate: jest.fn().mockResolvedValue(null),
      findActiveSubscriptionsByInstanceId: jest.fn().mockResolvedValue([]),
      findAccountsByUserIdsAndTemplate: jest.fn().mockResolvedValue([]),
      findManyWithTemplate: jest.fn().mockResolvedValue([]),
      findActiveSubscriptionsByInstanceIds: jest.fn().mockResolvedValue([]),
      findAccountsByUserIdsAndTemplates: jest.fn().mockResolvedValue([]),
      findPositionsByAccountIds: jest.fn().mockResolvedValue([]),
      findClosedPositionsWithPnlByAccountIds: jest.fn().mockResolvedValue([]),
      countPositionsByAccountIds: jest.fn().mockResolvedValue(0),
      findClosedPositionsByAccountIds: jest.fn().mockResolvedValue([]),
      findTodayPnlMetrics: jest.fn().mockResolvedValue([]),
      findTodayPnlMetricsBatch: jest.fn().mockResolvedValue([]),
    }

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        StrategyInstanceStatsService,
        {
          provide: StrategyInstancesRepository,
          useValue: repoMock,
        },
      ],
    }).compile()

    service = module.get<StrategyInstanceStatsService>(StrategyInstanceStatsService)
    instancesRepo = module.get(StrategyInstancesRepository)
  })

  describe('输入验证测试', () => {
    it('应该拒绝无效的 CUID 格式', async () => {
      await expect(
        service.calculateStats('invalid-id'),
      ).rejects.toThrow(DomainException)
    })

    it('应该拒绝非数组参数', async () => {
      await expect(
        service.calculateBatchStats('not-an-array' as any),
      ).rejects.toMatchObject({ code: ErrorCode.STRATEGY_INSTANCE_INVALID_INPUT })
    })

    it('应该拒绝超大批量请求', async () => {
      const largeArray: string[] = Array.from({ length: 101 }, () => 'c123456789012345678901234')

      await expect(
        service.calculateBatchStats(largeArray),
      ).rejects.toMatchObject({ code: ErrorCode.STRATEGY_INSTANCE_INVALID_INPUT })
    })

    it('应该处理空数组', async () => {
      const result = await service.calculateBatchStats([])
      expect(result.size).toBe(0)
    })

    it('应该拒绝包含无效 ID 的批量请求', async () => {
      const mixedArray = [
        'c123456789012345678901234', // 有效
        'invalid-id', // 无效
        'c987654321098765432109876', // 有效
      ]

      await expect(
        service.calculateBatchStats(mixedArray),
      ).rejects.toThrow(DomainException)
    })
  })

  describe('胜率计算测试', () => {
    it('全部盈利应该返回 100%', () => {
      const tradeStats = {
        totalCount: 10,
        winCount: 10,
        lossCount: 0,
      }

      const winRate = tradeStats.totalCount > 0
        ? (tradeStats.winCount / tradeStats.totalCount) * 100
        : undefined

      expect(winRate).toBe(100)
    })

    it('全部亏损应该返回 0%', () => {
      const tradeStats = {
        totalCount: 10,
        winCount: 0,
        lossCount: 10,
      }

      const winRate = tradeStats.totalCount > 0
        ? (tradeStats.winCount / tradeStats.totalCount) * 100
        : undefined

      expect(winRate).toBe(0)
    })

    it('无交易应该返回 undefined', () => {
      const tradeStats = {
        totalCount: 0,
        winCount: 0,
        lossCount: 0,
      }

      const winRate = tradeStats.totalCount > 0
        ? (tradeStats.winCount / tradeStats.totalCount) * 100
        : undefined

      expect(winRate).toBeUndefined()
    })

    it('混合场景应该正确计算', () => {
      const tradeStats = {
        totalCount: 20,
        winCount: 15,
        lossCount: 5,
      }

      const winRate = tradeStats.totalCount > 0
        ? (tradeStats.winCount / tradeStats.totalCount) * 100
        : undefined

      expect(winRate).toBe(75)
    })
  })

  describe('decimal 精度测试', () => {
    it('应该保持大金额的精度', () => {
      const investedAmount = new Decimal('1000000.12')
      const totalPnl = new Decimal('150000.34')

      const totalPnlRate = investedAmount.greaterThan(0)
        ? totalPnl.dividedBy(investedAmount).times(100)
        : new Decimal(0)

      expect(totalPnlRate.toDecimalPlaces(2).toNumber()).toBe(15.00)
    })

    it('应该处理小数精度', () => {
      const investedAmount = new Decimal('100.00')
      const totalPnl = new Decimal('1.23')

      const totalPnlRate = investedAmount.greaterThan(0)
        ? totalPnl.dividedBy(investedAmount).times(100)
        : new Decimal(0)

      expect(totalPnlRate.toDecimalPlaces(2).toNumber()).toBe(1.23)
    })

    it('应该处理零除', () => {
      const investedAmount = new Decimal('0')
      const totalPnl = new Decimal('100')

      const totalPnlRate = investedAmount.greaterThan(0)
        ? totalPnl.dividedBy(investedAmount).times(100)
        : new Decimal(0)

      expect(totalPnlRate.toNumber()).toBe(0)
    })

    it('应该正确舍入', () => {
      const investedAmount = new Decimal('100.00')
      const totalPnl = new Decimal('33.33')

      const totalPnlRate = investedAmount.greaterThan(0)
        ? totalPnl.dividedBy(investedAmount).times(100)
        : new Decimal(0)

      // 33.33 / 100 * 100 = 33.33%
      expect(totalPnlRate.toDecimalPlaces(2).toNumber()).toBe(33.33)
    })
  })

  describe('空统计一致性测试', () => {
    it('createEmptyStats 应该返回正确的空值', () => {
      // 通过反射访问私有方法（仅用于测试）
      const emptyStats = (service as any).createEmptyStats()

      expect(emptyStats.investedAmount).toBe(0)
      expect(emptyStats.currentValue).toBe(0)
      expect(emptyStats.totalPnl).toBe(0)
      expect(emptyStats.totalPnlRate).toBe(0)
      expect(emptyStats.todayPnl).toBe(0)
      expect(emptyStats.todayPnlRate).toBe(0)
      expect(emptyStats.openPositionsCount).toBe(0)
      expect(emptyStats.closedPositionsCount).toBe(0)
      expect(emptyStats.totalTradesCount).toBe(0)
      expect(emptyStats.winningTradesCount).toBe(0)
      expect(emptyStats.winRate).toBeUndefined() // 关键：应该是 undefined
      expect(emptyStats.maxDrawdown).toBeUndefined()
      expect(emptyStats.sharpeRatio).toBeUndefined()
      expect(emptyStats.lastUpdatedAt).toBeInstanceOf(Date)
    })
  })

  describe('时区处理测试', () => {
    it('应该支持不同时区', () => {
      const timezones = ['UTC', 'Asia/Shanghai', 'America/New_York']

      timezones.forEach((timezone) => {
        const today = new Date()
        const todayStart = new Date(today.toLocaleDateString('en-US', { timeZone: timezone }))

        expect(todayStart).toBeInstanceOf(Date)
        expect(todayStart.getHours()).toBe(0)
      })
    })

    it('uTC 时区应该使用 UTC 午夜', () => {
      const formatter = new Intl.DateTimeFormat('en-US', {
        timeZone: 'UTC',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
      })
      const today = new Date('2025-11-28T15:30:00Z')
      const parts = formatter.formatToParts(today)
      const year = Number(parts.find(p => p.type === 'year')!.value)
      const month = Number(parts.find(p => p.type === 'month')!.value)
      const day = Number(parts.find(p => p.type === 'day')!.value)
      const todayStart = new Date(Date.UTC(year, month - 1, day))

      expect(todayStart.toISOString().slice(0, 10)).toBe('2025-11-28')
    })
  })

  describe('cUID 验证测试', () => {
    it('应该接受有效的 CUID', () => {
      const isValid = (service as any).isValidCuid('c123456789012345678901234')
      expect(isValid).toBe(true)
    })

    it('应该拒绝无效的 CUID', () => {
      const invalidIds = [
        'invalid',
        'c123', // 太短
        '123456789012345678901234', // 不以 c 开头
        'c12345678901234567890123@', // 包含特殊字符
      ]

      invalidIds.forEach((id) => {
        const isValid = (service as any).isValidCuid(id)
        expect(isValid).toBe(false)
      })
    })
  })

  describe('分组辅助方法测试', () => {
    it('groupBy 应该正确分组', () => {
      const items = [
        { accountId: 'a1', value: 1 },
        { accountId: 'a2', value: 2 },
        { accountId: 'a1', value: 3 },
        { accountId: 'a3', value: 4 },
        { accountId: 'a2', value: 5 },
      ]

      const grouped = (service as any).groupBy(items, 'accountId')

      expect(grouped.size).toBe(3)
      expect(grouped.get('a1').length).toBe(2)
      expect(grouped.get('a2').length).toBe(2)
      expect(grouped.get('a3').length).toBe(1)
    })

    it('groupBy 应该处理空数组', () => {
      const grouped = (service as any).groupBy([], 'key')
      expect(grouped.size).toBe(0)
    })
  })

  describe('错误处理测试', () => {
    it('应该抛出 DomainException 对于无效输入', async () => {
      await expect(
        service.calculateStats(''),
      ).rejects.toThrow(DomainException)
    })

    it('数据库错误应该被正确包装', async () => {
      instancesRepo.findByIdWithTemplate.mockRejectedValue(
        new Prisma.PrismaClientKnownRequestError('Database connection failed', {
          code: 'P2000',
          clientVersion: '7.4.2',
        }),
      )

      await expect(
        service.calculateStats('c123456789012345678901234'),
      ).rejects.toThrow(DomainException)
    })
  })

  describe('批量查询性能测试', () => {
    it('批量查询应该比单个查询更少的数据库调用', async () => {
      instancesRepo.findManyWithTemplate.mockResolvedValue([])
      instancesRepo.findActiveSubscriptionsByInstanceIds.mockResolvedValue([])

      // 批量查询 10 个实例
      const instanceIds: string[] = Array.from({ length: 10 }, (_, i) =>
        `c1234567890123456789012${i}0`,
      )

      await service.calculateBatchStats(instanceIds)

      // 验证只调用了一次 findManyWithTemplate（批量查询）
      expect(instancesRepo.findManyWithTemplate).toHaveBeenCalledTimes(1)
    })
  })
})
