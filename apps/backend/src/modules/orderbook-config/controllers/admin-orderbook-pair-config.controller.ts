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
import type { MarketId, VenueOrderBook } from '@ai/shared'
import { toMarketKey } from '@ai/shared'
import { BaseResponseDto } from '@/common/dto/base.dto'
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
// eslint-disable-next-line ts/consistent-type-imports
import { QueryOrderbookPairConfigDto } from '../dto/query-orderbook-pair-config.dto'
import { UpdateOrderbookPairConfigDto } from '../dto/update-orderbook-pair-config.dto'
// eslint-disable-next-line ts/consistent-type-imports
import { OrderbookPairConfigService } from '../services/orderbook-pair-config.service'
// eslint-disable-next-line ts/consistent-type-imports
import type { OrderbookPairConfig } from '@prisma/client'

@ApiTags('admin-orderbook-config')
@Controller('admin/orderbook-configs')
@ApiBearerAuth('bearer')
@RequireAuth()
@ApiExtraModels(BaseResponseDto, OrderbookPairConfigResponseDto)
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
  })
  async getCurrentOrderbook(@Param('id') id: string): Promise<VenueOrderBook> {
    const config = await this.service.findById(id)

    // 如果配置被禁用，则视为“当前不再拉取数据”，直接返回 404
    if (!config.enabled) {
      throw new NotFoundException('当前没有该交易对的订单薄数据，请确认数据同步任务是否已开启')
    }

    const marketKey = this.buildMarketKeyFromConfig(config)
    const client = this.redisService.getClient()

    const pattern = `orderbook:*:${marketKey}`
    let cursor = '0'
    let foundKey: string | null = null

    // 按照 pattern 在 Redis 中查找第一个匹配的订单薄 key
    do {
      const [nextCursor, keys] = await client.scan(cursor, 'MATCH', pattern, 'COUNT', 20)
      cursor = nextCursor
      if (keys.length > 0) {
        foundKey = keys[0]!
        break
      }
    } while (cursor !== '0')

    if (!foundKey) {
      throw new NotFoundException('当前没有该交易对的订单薄数据，请确认数据同步任务是否已开启')
    }

    const raw = await client.get(foundKey)
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

    return book
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
}

