import type { MarketId, VenueOrderBook } from '@ai/shared'
import type { OrderbookPairConfig } from '@/prisma/prisma.types'
import type { CreateOrderbookPairConfigDto } from '../dto/create-orderbook-pair-config.dto'
import type { QueryOrderbookPairConfigDto } from '../dto/query-orderbook-pair-config.dto'
import type { UpdateOrderbookPairConfigDto } from '../dto/update-orderbook-pair-config.dto'
import { ErrorCode, toMarketKey } from '@ai/shared'
import { HttpStatus, Injectable } from '@nestjs/common'
import { Prisma } from '@/prisma/prisma.types'
import { DomainException } from '@/common/exceptions/domain.exception'
// eslint-disable-next-line ts/consistent-type-imports
import { RedisService } from '@/common/services/redis.service'
import { OrderBookLevelDto, VenueOrderBookDto } from '../dto/orderbook-snapshot.response.dto'
// Nest 注入需要运行时引用 Repository，保留值导入
// eslint-disable-next-line ts/consistent-type-imports
import { OrderbookPairConfigRepository } from '../repositories/orderbook-pair-config.repository'

@Injectable()
export class OrderbookPairConfigService {
  constructor(
    private readonly repository: OrderbookPairConfigRepository,
    private readonly redisService: RedisService,
  ) {}

  async findAll(filter?: QueryOrderbookPairConfigDto): Promise<OrderbookPairConfig[]> {
    return this.repository.findAll(filter)
  }

  async findById(id: string): Promise<OrderbookPairConfig> {
    const config = await this.repository.findById(id)
    if (!config) {
      throw new DomainException('Orderbook pair config not found', {
        code: ErrorCode.NOT_FOUND,
        status: HttpStatus.NOT_FOUND,
      })
    }
    return config
  }

  async create(dto: CreateOrderbookPairConfigDto): Promise<OrderbookPairConfig> {
    // 验证 pairId 与其他字段的一致性
    const expectedPairId = `${dto.symbol.toUpperCase()}.${dto.venue.toUpperCase()}.${dto.instrumentType}`
    if (dto.pairId !== expectedPairId) {
      throw new DomainException(
        `pairId 必须与 symbol/venue/instrumentType 一致。期望: ${expectedPairId}，实际: ${dto.pairId}`,
        {
          code: ErrorCode.BAD_REQUEST,
          status: HttpStatus.BAD_REQUEST,
        },
      )
    }

    // 检查 pairId 是否已存在
    const existing = await this.repository.findByPairId(dto.pairId)
    if (existing) {
      throw new DomainException('Pair ID already exists', {
        code: ErrorCode.CONFLICT,
        status: HttpStatus.CONFLICT,
      })
    }

    try {
      return await this.repository.create(dto)
    }
    catch (error: unknown) {
      // 捕获 Prisma 唯一约束冲突（并发情况下可能通过前置检查）
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        const knownError = error as Prisma.PrismaClientKnownRequestError
        if (knownError.code === 'P2002') {
          const target = (knownError.meta as { target?: unknown })?.target
          if (Array.isArray(target) && target.includes('symbol')) {
            throw new DomainException(
              `该市场配置已存在：${dto.symbol} @ ${dto.venue} (${dto.instrumentType})`,
              {
                code: ErrorCode.CONFLICT,
                status: HttpStatus.CONFLICT,
              },
            )
          }
          throw new DomainException('Pair ID already exists', {
            code: ErrorCode.CONFLICT,
            status: HttpStatus.CONFLICT,
          })
        }
      }
      throw error
    }
  }

  async update(id: string, dto: UpdateOrderbookPairConfigDto): Promise<OrderbookPairConfig> {
    // 确保配置存在
    await this.findById(id)
    return this.repository.update(id, dto)
  }

  async delete(id: string): Promise<void> {
    // 确保配置存在
    const _config = await this.findById(id)
    
    // TODO: 在实际使用时，检查是否有活跃的任务正在使用此配置
    // 示例逻辑：
    // const activeJobs = await this.checkActiveJobsUsingConfig(_config.pairId)
    // if (activeJobs.length > 0) {
    //   throw new DomainException(
    //     'Cannot delete config that is being used by active jobs',
    //     {
    //       code: ErrorCode.CONFLICT,
    //       status: HttpStatus.CONFLICT,
    //       details: { activeJobs: activeJobs.map(j => j.key) }
    //     }
    //   )
    // }
    
    await this.repository.delete(id)
  }

  async findEnabledConfigs(): Promise<OrderbookPairConfig[]> {
    return this.repository.findEnabledConfigs()
  }

  /**
   * 获取指定配置的 Redis 订单薄快照
   * 控制器应只负责路由与鉴权，Redis/解析/DTO 组装下沉到 Service，便于复用与单测。
   */
  async getCurrentOrderbookSnapshot(id: string): Promise<VenueOrderBookDto> {
    const config = await this.findById(id)

    if (!config.enabled) {
      throw new DomainException('当前没有该交易对的订单薄数据，请确认数据同步任务是否已开启', {
        code: ErrorCode.NOT_FOUND,
        status: HttpStatus.NOT_FOUND,
      })
    }

    const marketKey = this.buildMarketKeyFromConfig(config)
    const venueId = this.resolveVenueIdFromConfig(config)
    const client = this.redisService.getClient()
    const redisKey = `orderbook:${venueId}:${marketKey}`
    const raw = await client.get(redisKey)

    if (!raw) {
      throw new DomainException('订单薄数据已过期或不存在', {
        code: ErrorCode.NOT_FOUND,
        status: HttpStatus.NOT_FOUND,
      })
    }

    let book: VenueOrderBook
    try {
      book = JSON.parse(raw) as VenueOrderBook
    }
    catch {
      throw new DomainException('订单薄数据格式不正确', {
        code: ErrorCode.NOT_FOUND,
        status: HttpStatus.NOT_FOUND,
      })
    }

    const dto = new VenueOrderBookDto()
    dto.venueId = book.venueId
    dto.marketKey = book.marketKey
    dto.bids = (book.bids ?? []).map(level => {
      const l = new OrderBookLevelDto()
      l.price = level.price
      l.size = level.size
      return l
    })
    dto.asks = (book.asks ?? []).map(level => {
      const l = new OrderBookLevelDto()
      l.price = level.price
      l.size = level.size
      return l
    })
    dto.exchangeTs = book.exchangeTs ?? null
    dto.receivedTs = book.receivedTs
    dto.version = book.version

    return dto
  }

  private buildMarketKeyFromConfig(config: OrderbookPairConfig): string {
    const market: MarketId = {
      base: config.baseAsset.toUpperCase(),
      quote: config.quoteAsset.toUpperCase(),
      venueType:
        config.instrumentType === 'SPOT'
          ? 'spot'
          : config.instrumentType === 'PERPETUAL'
            ? 'perp'
            : 'future',
    }
    return toMarketKey(market)
  }

  private resolveVenueIdFromConfig(config: OrderbookPairConfig): string {
    const venue = config.venue.toUpperCase()
    const venueType = config.venueType
    const instrumentType = config.instrumentType

    if (venueType === 'CEX') {
      if (venue === 'BINANCE') {
        if (instrumentType === 'SPOT') return 'binance-spot'
        if (instrumentType === 'PERPETUAL') return 'binance-perp'
        if (instrumentType === 'FUTURE') return 'binance-future'
      }
      if (venue === 'BITMAX') {
        if (instrumentType === 'SPOT') return 'bitmax-spot'
        if (instrumentType === 'PERPETUAL') return 'bitmax-perp'
        if (instrumentType === 'FUTURE') return 'bitmax-future'
      }
      if (venue === 'BYBIT') {
        if (instrumentType === 'SPOT') return 'bybit-spot'
        if (instrumentType === 'PERPETUAL') return 'bybit-perp'
        if (instrumentType === 'FUTURE') return 'bybit-future'
      }
      if (venue === 'OKX') {
        if (instrumentType === 'SPOT') return 'okx-spot'
        if (instrumentType === 'PERPETUAL') return 'okx-perp'
        if (instrumentType === 'FUTURE') return 'okx-future'
      }
    }

    const normalizedType = instrumentType === 'PERPETUAL' ? 'perp' : instrumentType.toLowerCase()
    return `${venue.toLowerCase()}-${normalizedType}`
  }

  /**
   * 检查配置是否被活跃任务使用
   * 
   * 注意：此方法需要在实际使用时实现
   * 可能的实现方式：
   * 1. 查询 data_pull_tasks 表，检查是否有 enabled=true 且 lastStatus=RUNNING 的任务
   * 2. 检查任务的 metadata 或配置中是否引用了此 pairId
   * 3. 或者维护一个活跃配置的缓存/注册表
   * 
   * @param pairId 交易对ID
   * @returns 使用此配置的活跃任务列表
   */
  // private async checkActiveJobsUsingConfig(pairId: string): Promise<any[]> {
  //   // TODO: Implement actual logic when DataPullTask tracking is available
  //   return []
  // }
}
