import type { ExchangeConfig } from '@prisma/client'
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
import { CreateExchangeConfigDto } from '../dto/create-exchange-config.dto'
import { ExchangeConfigResponseDto } from '../dto/exchange-config.response.dto'
// eslint-disable-next-line ts/consistent-type-imports
import { QueryExchangeConfigDto } from '../dto/query-exchange-config.dto'
import { UpdateExchangeConfigDto } from '../dto/update-exchange-config.dto'
// eslint-disable-next-line ts/consistent-type-imports
import { ExchangeConfigService } from '../services/exchange-config.service'

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value)
}

@ApiTags('admin-exchange-config')
@Controller('admin/exchange-configs')
@ApiBearerAuth('bearer')
@RequireAuth()
@ApiExtraModels(BaseResponseDto, ExchangeConfigResponseDto)
export class AdminExchangeConfigController {
  constructor(private readonly service: ExchangeConfigService) {}

  @Get()
  @ReadAny(AppResource.EXCHANGE_CONFIG)
  @ApiOperation({ summary: '获取交易所配置列表' })
  @ApiResponse({
    status: 200,
    description: '成功获取配置列表',
    schema: {
      type: 'object',
      properties: {
        data: {
          type: 'array',
          items: { $ref: getSchemaPath(ExchangeConfigResponseDto) },
        },
        message: { type: 'string', example: 'Success' },
      },
    },
  })
  async getAllConfigs(@Query() query: QueryExchangeConfigDto): Promise<ExchangeConfigResponseDto[]> {
    const records = await this.service.findAll(query)
    return records.map(r => this.toResponseDto(r))
  }

  @Get(':id')
  @ReadAny(AppResource.EXCHANGE_CONFIG)
  @ApiOperation({ summary: '获取单个交易所配置' })
  @ApiResponse({
    status: 200,
    description: '成功获取配置',
    schema: {
      type: 'object',
      properties: {
        data: { $ref: getSchemaPath(ExchangeConfigResponseDto) },
        message: { type: 'string', example: 'Success' },
      },
    },
  })
  async getConfig(@Param('id') id: string): Promise<ExchangeConfigResponseDto> {
    const record = await this.service.findById(id)
    return this.toResponseDto(record)
  }

  @Post()
  @CreateAny(AppResource.EXCHANGE_CONFIG)
  @ApiOperation({ summary: '创建交易所配置' })
  @ApiBody({ type: CreateExchangeConfigDto })
  @ApiResponse({
    status: 201,
    description: '成功创建配置',
    schema: {
      type: 'object',
      properties: {
        data: { $ref: getSchemaPath(ExchangeConfigResponseDto) },
        message: { type: 'string', example: 'Success' },
      },
    },
  })
  async createConfig(@Body() dto: CreateExchangeConfigDto): Promise<ExchangeConfigResponseDto> {
    const record = await this.service.create(dto)
    return this.toResponseDto(record)
  }

  @Put(':id')
  @UpdateAny(AppResource.EXCHANGE_CONFIG)
  @ApiOperation({ summary: '更新交易所配置' })
  @ApiBody({ type: UpdateExchangeConfigDto })
  @ApiResponse({
    status: 200,
    description: '成功更新配置',
    schema: {
      type: 'object',
      properties: {
        data: { $ref: getSchemaPath(ExchangeConfigResponseDto) },
        message: { type: 'string', example: 'Success' },
      },
    },
  })
  async updateConfig(
    @Param('id') id: string,
    @Body() dto: UpdateExchangeConfigDto,
  ): Promise<ExchangeConfigResponseDto> {
    const record = await this.service.update(id, dto)
    return this.toResponseDto(record)
  }

  @Delete(':id')
  @DeleteAny(AppResource.EXCHANGE_CONFIG)
  @ApiOperation({ summary: '删除交易所配置' })
  @ApiResponse({
    status: 200,
    description: '成功删除配置',
    schema: {
      type: 'object',
      properties: {
        data: {
          type: 'object',
          properties: { success: { type: 'boolean', example: true } },
        },
        message: { type: 'string', example: 'Success' },
      },
    },
  })
  @HttpCode(200)
  async deleteConfig(@Param('id') id: string): Promise<{ success: boolean }> {
    await this.service.delete(id)
    return { success: true }
  }

  private toResponseDto(record: ExchangeConfig): ExchangeConfigResponseDto {
    return {
      id: record.id,
      code: record.code,
      name: record.name,
      avatarUrl: record.avatarUrl,
      intro: record.intro,
      websiteUrl: record.websiteUrl,
      venueType: record.venueType,
      enabled: record.enabled,
      sort: record.sort,
      metadata: isPlainObject(record.metadata) ? record.metadata : null,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
    }
  }
}

