import type { TradesPairConfig } from '@/prisma/prisma.types'
import { Transactional } from '@nestjs-cls/transactional'
import { Body, Controller, Delete, Get, HttpCode, Param, Post, Put, Query, UseGuards } from '@nestjs/common'
import {
  ApiBearerAuth,
  ApiBody,
  ApiExtraModels,
  ApiOperation,
  ApiResponse,
  ApiTags,
  getSchemaPath,
} from '@nestjs/swagger'
import { Throttle } from '@nestjs/throttler'
import { BaseResponseDto } from '@/common/dto/base.dto'
import {
  CreateAny,
  DeleteAny,
  ReadAny,
  RequireAuth,
  UpdateAny,
} from '@/modules/auth/decorators/access-control.decorator'
import { AuthRateLimitGuard } from '@/modules/auth/guards/auth-rate-limit.guard'
import { AppResource } from '@/modules/auth/rbac/permissions'
import { CreateTradesPairConfigDto } from '../dto/create-trades-pair-config.dto'
// eslint-disable-next-line ts/consistent-type-imports
import { QueryTradesPairConfigDto } from '../dto/query-trades-pair-config.dto'
import { TradesPairConfigResponseDto } from '../dto/trades-pair-config.response.dto'
import { UpdateTradesPairConfigDto } from '../dto/update-trades-pair-config.dto'
// eslint-disable-next-line ts/consistent-type-imports
import { TradesPairConfigService } from '../services/trades-pair-config.service'

@ApiTags('admin-trades-config')
@Controller('admin/trades-configs')
@ApiBearerAuth('bearer')
@RequireAuth()
@ApiExtraModels(BaseResponseDto, TradesPairConfigResponseDto)
@UseGuards(AuthRateLimitGuard)
export class AdminTradesPairConfigController {
  constructor(
    private readonly service: TradesPairConfigService,
  ) {}

  @Get()
  @ReadAny(AppResource.TRADES_CONFIG)
  @ApiOperation({ summary: '获取所有交易记录订阅配置' })
  @ApiResponse({
    status: 200,
    description: '成功获取配置列表',
    schema: {
      type: 'object',
      properties: {
        data: {
          type: 'array',
          items: { $ref: getSchemaPath(TradesPairConfigResponseDto) },
        },
        message: {
          type: 'string',
          example: 'Success',
        },
      },
    },
  })
  async getAllConfigs(
    @Query() query: QueryTradesPairConfigDto,
  ): Promise<TradesPairConfigResponseDto[]> {
    const configs = await this.service.findAll(query)
    return configs.map(config => this.toResponseDto(config))
  }

  @Get(':id')
  @ReadAny(AppResource.TRADES_CONFIG)
  @ApiOperation({ summary: '获取单个交易记录订阅配置' })
  @ApiResponse({
    status: 200,
    description: '成功获取配置',
    schema: {
      type: 'object',
      properties: {
        data: { $ref: getSchemaPath(TradesPairConfigResponseDto) },
        message: {
          type: 'string',
          example: 'Success',
        },
      },
    },
  })
  async getConfig(@Param('id') id: string): Promise<TradesPairConfigResponseDto> {
    const config = await this.service.findById(id)
    return this.toResponseDto(config)
  }

  @Post()
  @Transactional()
  @CreateAny(AppResource.TRADES_CONFIG)
  @Throttle({ default: { ttl: 60000, limit: 10 } }) // 每分钟最多10次
  @HttpCode(200)
  @ApiOperation({ summary: '创建交易记录订阅配置' })
  @ApiBody({ type: CreateTradesPairConfigDto })
  @ApiResponse({
    status: 200,
    description: '成功创建配置',
    schema: {
      type: 'object',
      properties: {
        data: { $ref: getSchemaPath(TradesPairConfigResponseDto) },
        message: {
          type: 'string',
          example: 'Success',
        },
      },
    },
  })
  async createConfig(
    @Body() dto: CreateTradesPairConfigDto,
  ): Promise<TradesPairConfigResponseDto> {
    const config = await this.service.create(dto)
    return this.toResponseDto(config)
  }

  @Put(':id')
  @Transactional()
  @UpdateAny(AppResource.TRADES_CONFIG)
  @Throttle({ default: { ttl: 60000, limit: 20 } }) // 每分钟最多20次
  @ApiOperation({ summary: '更新交易记录订阅配置' })
  @ApiBody({ type: UpdateTradesPairConfigDto })
  @ApiResponse({
    status: 200,
    description: '成功更新配置',
    schema: {
      type: 'object',
      properties: {
        data: { $ref: getSchemaPath(TradesPairConfigResponseDto) },
        message: {
          type: 'string',
          example: 'Success',
        },
      },
    },
  })
  async updateConfig(
    @Param('id') id: string,
    @Body() dto: UpdateTradesPairConfigDto,
  ): Promise<TradesPairConfigResponseDto> {
    const config = await this.service.update(id, dto)
    return this.toResponseDto(config)
  }

  @Delete(':id')
  @Transactional()
  @DeleteAny(AppResource.TRADES_CONFIG)
  @Throttle({ default: { ttl: 60000, limit: 10 } }) // 每分钟最多10次
  @HttpCode(204)
  @ApiOperation({ summary: '删除交易记录订阅配置' })
  @ApiResponse({
    status: 204,
    description: '成功删除配置',
  })
  async deleteConfig(@Param('id') id: string): Promise<void> {
    await this.service.delete(id)
  }

  private toResponseDto(config: TradesPairConfig): TradesPairConfigResponseDto {
    return {
      id: config.id,
      pairId: config.pairId,
      exchange: config.exchange,
      symbol: config.symbol,
      baseAsset: config.baseAsset,
      quoteAsset: config.quoteAsset,
      instrumentType: config.instrumentType,
      canonicalInstId: config.canonicalInstId,
      enabled: config.enabled,
      priority: config.priority,
      metadata: config.metadata as Record<string, any> | null,
      description: config.description,
      createdAt: config.createdAt.toISOString(),
      updatedAt: config.updatedAt.toISOString(),
    }
  }
}







