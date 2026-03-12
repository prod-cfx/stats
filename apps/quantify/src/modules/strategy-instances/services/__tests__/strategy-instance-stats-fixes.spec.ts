import type { TestingModule } from '@nestjs/testing';
import { BadRequestException, InternalServerErrorException } from '@nestjs/common'
import { Test } from '@nestjs/testing'
import { Prisma } from '@prisma/client'

import { PrismaService } from '@/prisma/prisma.service'

import { StrategyInstanceStatsService } from '../strategy-instance-stats.service'

// Prisma 7: 浠?Prisma namespace 瀵煎嚭 Decimal
const Decimal = Prisma.Decimal

describe('strategyInstanceStatsService - Review Fixes', () => {
  let service: StrategyInstanceStatsService
  let prisma: PrismaService

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        StrategyInstanceStatsService,
        {
          provide: PrismaService,
          useValue: {
            getClient: jest.fn()
          }
        }
      ]
    }).compile()

    service = module.get<StrategyInstanceStatsService>(StrategyInstanceStatsService)
    prisma = module.get<PrismaService>(PrismaService)
  })

  describe('杈撳叆楠岃瘉娴嬭瘯', () => {
    it('搴旇鎷掔粷鏃犳晥鐨?CUID 鏍煎紡', async () => {
      await expect(
        service.calculateStats('invalid-id')
      ).rejects.toThrow(BadRequestException)
    })

    it('搴旇鎷掔粷闈炴暟缁勫弬鏁?, async () => {
      await expect(
        service.calculateBatchStats('not-an-array' as any)
      ).rejects.toThrow(BadRequestException)
    })

    it('搴旇鎷掔粷瓒呭ぇ鎵归噺璇锋眰', async () => {
      const largeArray: string[] = Array.from({length: 101}, () => 'c12345678901234567890123')

      await expect(
        service.calculateBatchStats(largeArray)
      ).rejects.toThrow(BadRequestException)

      await expect(
        service.calculateBatchStats(largeArray)
      ).rejects.toThrow(/exceeds maximum/)
    })

    it('搴旇澶勭悊绌烘暟缁?, async () => {
      const result = await service.calculateBatchStats([])
      expect(result.size).toBe(0)
    })

    it('搴旇鎷掔粷鍖呭惈鏃犳晥 ID 鐨勬壒閲忚姹?, async () => {
      const mixedArray = [
        'c12345678901234567890123',  // 鏈夋晥
        'invalid-id',                 // 鏃犳晥
        'c98765432109876543210987'   // 鏈夋晥
      ]

      await expect(
        service.calculateBatchStats(mixedArray)
      ).rejects.toThrow(BadRequestException)
    })
  })

  describe('鑳滅巼璁＄畻娴嬭瘯', () => {
    it('鍏ㄩ儴鐩堝埄搴旇杩斿洖 100%', () => {
      const tradeStats = {
        totalCount: 10,
        winCount: 10,
        lossCount: 0
      }

      const winRate = tradeStats.totalCount > 0
        ? (tradeStats.winCount / tradeStats.totalCount) * 100
        : undefined

      expect(winRate).toBe(100)
    })

    it('鍏ㄩ儴浜忔崯搴旇杩斿洖 0%', () => {
      const tradeStats = {
        totalCount: 10,
        winCount: 0,
        lossCount: 10
      }

      const winRate = tradeStats.totalCount > 0
        ? (tradeStats.winCount / tradeStats.totalCount) * 100
        : undefined

      expect(winRate).toBe(0)
    })

    it('鏃犱氦鏄撳簲璇ヨ繑鍥?undefined', () => {
      const tradeStats = {
        totalCount: 0,
        winCount: 0,
        lossCount: 0
      }

      const winRate = tradeStats.totalCount > 0
        ? (tradeStats.winCount / tradeStats.totalCount) * 100
        : undefined

      expect(winRate).toBeUndefined()
    })

    it('娣峰悎鍦烘櫙搴旇姝ｇ‘璁＄畻', () => {
      const tradeStats = {
        totalCount: 20,
        winCount: 15,
        lossCount: 5
      }

      const winRate = tradeStats.totalCount > 0
        ? (tradeStats.winCount / tradeStats.totalCount) * 100
        : undefined

      expect(winRate).toBe(75)
    })
  })

  describe('decimal 绮惧害娴嬭瘯', () => {
    it('搴旇淇濇寔澶ч噾棰濈殑绮惧害', () => {
      const investedAmount = new Decimal('1000000.12')
      const totalPnl = new Decimal('150000.34')

      const totalPnlRate = investedAmount.greaterThan(0)
        ? totalPnl.dividedBy(investedAmount).times(100)
        : new Decimal(0)

      expect(totalPnlRate.toDecimalPlaces(2).toNumber()).toBe(15.00)
    })

    it('搴旇澶勭悊灏忔暟绮惧害', () => {
      const investedAmount = new Decimal('100.00')
      const totalPnl = new Decimal('1.23')

      const totalPnlRate = investedAmount.greaterThan(0)
        ? totalPnl.dividedBy(investedAmount).times(100)
        : new Decimal(0)

      expect(totalPnlRate.toDecimalPlaces(2).toNumber()).toBe(1.23)
    })

    it('搴旇澶勭悊闆堕櫎', () => {
      const investedAmount = new Decimal('0')
      const totalPnl = new Decimal('100')

      const totalPnlRate = investedAmount.greaterThan(0)
        ? totalPnl.dividedBy(investedAmount).times(100)
        : new Decimal(0)

      expect(totalPnlRate.toNumber()).toBe(0)
    })

    it('搴旇姝ｇ‘鑸嶅叆', () => {
      const investedAmount = new Decimal('100.00')
      const totalPnl = new Decimal('33.33')

      const totalPnlRate = investedAmount.greaterThan(0)
        ? totalPnl.dividedBy(investedAmount).times(100)
        : new Decimal(0)

      // 33.33 / 100 * 100 = 33.33%
      expect(totalPnlRate.toDecimalPlaces(2).toNumber()).toBe(33.33)
    })
  })

  describe('绌虹粺璁′竴鑷存€ф祴璇?, () => {
    it('createEmptyStats 搴旇杩斿洖姝ｇ‘鐨勭┖鍊?, () => {
      // 閫氳繃鍙嶅皠璁块棶绉佹湁鏂规硶锛堜粎鐢ㄤ簬娴嬭瘯锛?
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
      expect(emptyStats.winRate).toBeUndefined()  // 鍏抽敭锛氬簲璇ユ槸 undefined
      expect(emptyStats.maxDrawdown).toBeUndefined()
      expect(emptyStats.sharpeRatio).toBeUndefined()
      expect(emptyStats.lastUpdatedAt).toBeInstanceOf(Date)
    })
  })

  describe('鏃跺尯澶勭悊娴嬭瘯', () => {
    it('搴旇鏀寔涓嶅悓鏃跺尯', () => {
      const timezones = ['UTC', 'Asia/Shanghai', 'America/New_York']

      timezones.forEach(timezone => {
        const today = new Date()
        const todayStart = new Date(today.toLocaleDateString('en-US', { timeZone: timezone }))

        expect(todayStart).toBeInstanceOf(Date)
        expect(todayStart.getHours()).toBe(0)
      })
    })

    it('uTC 鏃跺尯搴旇浣跨敤 UTC 鍗堝', () => {
      const today = new Date('2025-11-28T15:30:00Z')
      const todayStart = new Date(today.toLocaleDateString('en-US', { timeZone: 'UTC' }))

      expect(todayStart.toISOString().slice(0, 10)).toBe('2025-11-28')
    })
  })

  describe('cUID 楠岃瘉娴嬭瘯', () => {
    it('搴旇鎺ュ彈鏈夋晥鐨?CUID', () => {
      const isValid = (service as any).isValidCuid('c12345678901234567890123')
      expect(isValid).toBe(true)
    })

    it('搴旇鎷掔粷鏃犳晥鐨?CUID', () => {
      const invalidIds = [
        'invalid',
        'c123',  // 澶煭
        '12345678901234567890123',  // 涓嶄互 c 寮€澶?
        'C12345678901234567890123',  // 澶у啓 C
        'c1234567890123456789012@',  // 鍖呭惈鐗规畩瀛楃
      ]

      invalidIds.forEach(id => {
        const isValid = (service as any).isValidCuid(id)
        expect(isValid).toBe(false)
      })
    })
  })

  describe('鍒嗙粍杈呭姪鏂规硶娴嬭瘯', () => {
    it('groupBy 搴旇姝ｇ‘鍒嗙粍', () => {
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

    it('groupBy 搴旇澶勭悊绌烘暟缁?, () => {
      const grouped = (service as any).groupBy([], 'key')
      expect(grouped.size).toBe(0)
    })
  })

  describe('閿欒澶勭悊娴嬭瘯', () => {
    it('搴旇鎶涘嚭 BadRequestException 瀵逛簬鏃犳晥杈撳叆', async () => {
      await expect(
        service.calculateStats('')
      ).rejects.toThrow(BadRequestException)
    })

    it('鏁版嵁搴撻敊璇簲璇ヨ姝ｇ‘鍖呰', async () => {
      const mockClient = {
        strategyInstance: {
          findUnique: jest.fn().mockRejectedValue(new Error('Database connection failed'))
        }
      }

      jest.spyOn(prisma, 'getClient').mockReturnValue(mockClient as any)

      await expect(
        service.calculateStats('c12345678901234567890123')
      ).rejects.toThrow(InternalServerErrorException)
    })
  })

  describe('鎵归噺鏌ヨ鎬ц兘娴嬭瘯', () => {
    it('鎵归噺鏌ヨ搴旇姣斿崟涓煡璇㈡洿灏戠殑鏁版嵁搴撹皟鐢?, async () => {
      const mockClient = {
        strategyInstance: {
          findMany: jest.fn().mockResolvedValue([]),
          findUnique: jest.fn().mockResolvedValue(null)
        },
        userStrategySubscription: {
          findMany: jest.fn().mockResolvedValue([])
        }
      }

      jest.spyOn(prisma, 'getClient').mockReturnValue(mockClient as any)

      // 鎵归噺鏌ヨ 10 涓疄渚?
      const instanceIds: string[] = Array.from({length: 10}, (_, i) =>
        `c1234567890123456789012${i}`
      )

      await service.calculateBatchStats(instanceIds)

      // 楠岃瘉鍙皟鐢ㄤ簡涓€娆?findMany锛堟壒閲忔煡璇級
      expect(mockClient.strategyInstance.findMany).toHaveBeenCalledTimes(1)
      // 鑰屼笉鏄?10 娆?findUnique
      expect(mockClient.strategyInstance.findUnique).not.toHaveBeenCalled()
    })
  })
})
