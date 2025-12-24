import { Body, Controller, Delete, Get, HttpCode, Param, Post, Put, Query } from '@nestjs/common'
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

@ApiTags('admin-orderbook-config')
@Controller('admin/orderbook-configs')
@ApiBearerAuth('bearer')
@RequireAuth()
@ApiExtraModels(BaseResponseDto, OrderbookPairConfigResponseDto)
export class AdminOrderbookPairConfigController {
  constructor(private readonly service: OrderbookPairConfigService) {}

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
}
