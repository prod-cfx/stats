import type { MarketId, VenueOrderBook } from '@ai/shared'
import { toMarketKey } from '@ai/shared'
// eslint-disable-next-line perfectionist/sort-imports
import type { OrderbookPairConfig } from '@prisma/client'
import { Body, Controller, Delete, Get, HttpCode, NotFoundException, Param, Post, Put, Query } from '@nestjs/common'
import {
  ApiBearerAuth,
  ApiBody,
  ApiExtraModels,
  ApiOperation,
  ApiResponse,
  ApiTags,
  getSchemaPath,
} from '@nestjs/swagger'
import { BaseResponseDto } from '@/common/dto/base.dto'
// NestJS 依赖注入需要 RedisService 的运行时类型，不能使用 `import type`
// eslint-disable-next-line ts/consistent-type-imports
import { RedisService } from '@/common/services/redis.service'
import {
  CreateAny,
  DeleteAny,
  ReadAny,
  RequireAuth,
  UpdateAny,
} from '@/modules/auth/decorators/access-control.decorator'
import { AppResource } from '@/modules/auth/rbac/permissions'
import { CreateOrderbookPairConfigDto } from '../dto/create-orderbook-pair-config.dto'
import { OrderbookPairConfigResponseDto } from '../dto/orderbook-pair-config.response.dto'
import { OrderBookLevelDto, VenueOrderBookDto } from '../dto/orderbook-snapshot.response.dto'
// eslint-disable-next-line ts/consistent-type-imports
import { QueryOrderbookPairConfigDto } from '../dto/query-orderbook-pair-config.dto'
import { UpdateOrderbookPairConfigDto } from '../dto/update-orderbook-pair-config.dto'
// eslint-disable-next-line ts/consistent-type-imports
import { OrderbookPairConfigService } from '../services/orderbook-pair-config.service'

@ApiTags('admin-orderbook-config')
@Controller('admin/orderbook-configs')
@ApiBearerAuth('bearer')
@RequireAuth()
@ApiExtraModels(BaseResponseDto, OrderbookPairConfigResponseDto, VenueOrderBookDto, OrderBookLevelDto)
export class AdminOrderbookPairConfigController {
  constructor(
    private readonly service: OrderbookPairConfigService,
    private readonly redisService: RedisService,
  ) {}

  @Get()
  @ReadAny(AppResource.ORDERBOOK_CONFIG)
  @ApiOperation({ summary: '获取所有订单薄交易对配置' })
  @ApiResponse({
    status: 200,
    description: '成功获取配置列表',
    schema: {
      type: 'object',
      properties: {
        data: {
          type: 'array',
          items: { $ref: getSchemaPath(OrderbookPairConfigResponseDto) },
        },
        message: {
          type: 'string',
          example: 'Success',
        },
      },
    },
  })
  async getAllConfigs(
    @Query() query: QueryOrderbookPairConfigDto,
  ): Promise<OrderbookPairConfigResponseDto[]> {
    const configs = await this.service.findAll(query)
    return configs.map(config => this.toResponseDto(config))
  }

  @Get(':id')
  @ReadAny(AppResource.ORDERBOOK_CONFIG)
  @ApiOperation({ summary: '获取单个订单薄交易对配置' })
  @ApiResponse({
    status: 200,
    description: '成功获取配置',
    schema: {
      type: 'object',
      properties: {
        data: { $ref: getSchemaPath(OrderbookPairConfigResponseDto) },
        message: {
          type: 'string',
          example: 'Success',
        },
      },
    },
  })
  async getConfig(@Param('id') id: string): Promise<OrderbookPairConfigResponseDto> {
    const config = await this.service.findById(id)
    return this.toResponseDto(config)
  }

  @Get(':id/orderbook')
  @ReadAny(AppResource.ORDERBOOK_CONFIG)
  @ApiOperation({ summary: '查看指定订单薄配置的当前订单薄快照（来自 Redis）' })
  @ApiResponse({
    status: 200,
    description: '成功获取订单薄快照',
    schema: {
      type: 'object',
      properties: {
        data: { $ref: getSchemaPath(VenueOrderBookDto) },
        message: {
          type: 'string',
          example: 'Success',
        },
      },
    },
  })
  async getCurrentOrderbook(@Param('id') id: string): Promise<BaseResponseDto<VenueOrderBookDto>> {
    const config = await this.service.findById(id)

    // 如果配置被禁用，则视为“当前不再拉取数据”，直接返回 404
    if (!config.enabled) {
      throw new NotFoundException('当前没有该交易对的订单薄数据，请确认数据同步任务是否已开启')
    }

    const marketKey = this.buildMarketKeyFromConfig(config)
    const venueId = this.resolveVenueIdFromConfig(config)
    const client = this.redisService.getClient()

    const redisKey = `orderbook:${venueId}:${marketKey}`
    const raw = await client.get(redisKey)
    if (!raw) {
      throw new NotFoundException('订单薄数据已过期或不存在')
    }

    let book: VenueOrderBook
    try {
      book = JSON.parse(raw) as VenueOrderBook
    }
    catch {
      throw new NotFoundException('订单薄数据格式不正确')
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

    return new BaseResponseDto<VenueOrderBookDto>(dto)
  }

  @Post()
  @CreateAny(AppResource.ORDERBOOK_CONFIG)
  @ApiOperation({ summary: '创建订单薄交易对配置' })
  @ApiBody({ type: CreateOrderbookPairConfigDto })
  @ApiResponse({
    status: 201,
    description: '成功创建配置',
    schema: {
      type: 'object',
      properties: {
        data: { $ref: getSchemaPath(OrderbookPairConfigResponseDto) },
        message: {
          type: 'string',
          example: 'Success',
        },
      },
    },
  })
  async createConfig(
    @Body() dto: CreateOrderbookPairConfigDto,
  ): Promise<OrderbookPairConfigResponseDto> {
    const config = await this.service.create(dto)
    return this.toResponseDto(config)
  }

  @Put(':id')
  @UpdateAny(AppResource.ORDERBOOK_CONFIG)
  @ApiOperation({ summary: '更新订单薄交易对配置' })
  @ApiBody({ type: UpdateOrderbookPairConfigDto })
  @ApiResponse({
    status: 200,
    description: '成功更新配置',
    schema: {
      type: 'object',
      properties: {
        data: { $ref: getSchemaPath(OrderbookPairConfigResponseDto) },
        message: {
          type: 'string',
          example: 'Success',
        },
      },
    },
  })
  async updateConfig(
    @Param('id') id: string,
    @Body() dto: UpdateOrderbookPairConfigDto,
  ): Promise<OrderbookPairConfigResponseDto> {
    const config = await this.service.update(id, dto)
    return this.toResponseDto(config)
  }

  @Delete(':id')
  @DeleteAny(AppResource.ORDERBOOK_CONFIG)
  @ApiOperation({ summary: '删除订单薄交易对配置' })
  @ApiResponse({
    status: 200,
    description: '成功删除配置',
    schema: {
      type: 'object',
      properties: {
        data: {
          type: 'object',
          properties: {
            success: {
              type: 'boolean',
              example: true,
            },
          },
        },
        message: {
          type: 'string',
          example: 'Success',
        },
      },
    },
  })
  @HttpCode(200)
  async deleteConfig(@Param('id') id: string): Promise<{ success: boolean }> {
    await this.service.delete(id)
    return { success: true }
  }

  private toResponseDto(config: any): OrderbookPairConfigResponseDto {
    return {
      id: config.id,
      pairId: config.pairId,
      venue: config.venue,
      symbol: config.symbol,
      baseAsset: config.baseAsset,
      quoteAsset: config.quoteAsset,
      venueType: config.venueType,
      instrumentType: config.instrumentType,
      enabled: config.enabled,
      pullIntervalSeconds: config.pullIntervalSeconds,
      depthLevels: config.depthLevels,
      priority: config.priority,
      metadata: config.metadata,
      description: config.description,
      createdAt: config.createdAt,
      updatedAt: config.updatedAt,
    }
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

    // 目前 WS 适配器与快照任务中使用的 venueId 约定：
    // - binance-spot / binance-perp / binance-future
    // - bybit-spot / bybit-perp / bybit-future
    // - okx-spot / okx-perp / okx-future
    if (venueType === 'CEX') {
      if (venue === 'BINANCE') {
        if (instrumentType === 'SPOT') return 'binance-spot'
        if (instrumentType === 'PERPETUAL') return 'binance-perp'
        if (instrumentType === 'FUTURE') return 'binance-future'
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

    // 兜底：按 "<venue>-<instrumentType>" 规则生成，以避免静默命中错误 venue
    // 注意：统一使用 perp（而非 perpetual）、future（保持不变）、spot（保持不变）
    const normalizedType = instrumentType === 'PERPETUAL' ? 'perp' : instrumentType.toLowerCase()
    return `${venue.toLowerCase()}-${normalizedType}`
  }
}

