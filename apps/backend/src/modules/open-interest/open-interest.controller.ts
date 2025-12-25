import {
  BadRequestException,
  Body,
  Controller,
  Get,
  HttpStatus,
  NotFoundException,
  Param,
  ParseArrayPipe,
  Post,
  Query,
} from '@nestjs/common'
import {
  ApiBearerAuth,
  ApiBody,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger'
import {
  CreateAny,
  ReadAny,
  RequireAuth,
} from '@/modules/auth/decorators/access-control.decorator'
import { AppResource } from '@/modules/auth/rbac/permissions'
import {
  CreateOpenInterestDto,
  OpenInterestDto,
  OpenInterestStatsDto,
  QueryOpenInterestDto,
  QueryOpenInterestResponseDto,
} from './dto/open-interest.dto'
// Nest 注入需要运行时引用 OpenInterestService，保留值导入
// eslint-disable-next-line ts/consistent-type-imports
import { OpenInterestService } from './open-interest.service'

/**
 * 持仓量数据控制器
 */
@ApiTags('持仓量数据')
@Controller('open-interest')
export class OpenInterestController {
  constructor(private readonly openInterestService: OpenInterestService) {}

  @Post()
  @ApiBearerAuth()
  @RequireAuth()
  @CreateAny(AppResource.MARKET_SYMBOL)
  @ApiOperation({ summary: '创建或更新持仓量数据' })
  @ApiResponse({
    status: HttpStatus.CREATED,
    description: '创建成功',
    type: OpenInterestDto,
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: '参数验证失败',
  })
  async upsert(@Body() data: CreateOpenInterestDto) {
    const entity = await this.openInterestService.upsert(data)
    return this.toDto(entity)
  }

  @Post('batch')
  @ApiBearerAuth()
  @RequireAuth()
  @CreateAny(AppResource.MARKET_SYMBOL)
  @ApiOperation({ summary: '批量创建或更新持仓量数据' })
  @ApiBody({ type: CreateOpenInterestDto, isArray: true })
  @ApiResponse({ 
    status: HttpStatus.CREATED, 
    description: '批量创建成功',
    type: OpenInterestDto,
    isArray: true,
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: '参数验证失败',
  })
  async batchUpsert(
    @Body(
      new ParseArrayPipe({
        items: CreateOpenInterestDto,
      }),
    )
    dataList: CreateOpenInterestDto[],
  ) {
    if (!Array.isArray(dataList) || dataList.length === 0) {
      throw new BadRequestException('dataList must be a non-empty array')
    }

    const entities = await this.openInterestService.batchUpsert(dataList)
    return entities.map(entity => this.toDto(entity))
  }

  @Get()
  @ApiBearerAuth()
  @RequireAuth()
  @ReadAny(AppResource.MARKET_SYMBOL)
  @ApiOperation({ summary: '查询持仓量数据' })
  @ApiQuery({ name: 'exchange', required: false, type: String, description: '交易所名称', example: 'All' })
  @ApiQuery({ name: 'symbol', required: false, type: String, description: '币种符号', example: 'BTC' })
  @ApiQuery({ name: 'startTime', required: false, type: String, description: '开始时间', example: '2025-12-24T00:00:00Z' })
  @ApiQuery({ name: 'endTime', required: false, type: String, description: '结束时间', example: '2025-12-24T23:59:59Z' })
  @ApiQuery({ name: 'page', required: false, type: Number, description: '页码（从1开始）', example: 1 })
  @ApiQuery({ name: 'limit', required: false, type: Number, description: '每页数量', example: 100 })
  @ApiResponse({
    status: HttpStatus.OK,
    description: '查询成功',
    type: QueryOpenInterestResponseDto,
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: '参数验证失败',
  })
  async query(@Query() queryDto: QueryOpenInterestDto) {
    const result = await this.openInterestService.query(queryDto)
    return {
      data: result.data.map(entity => this.toDto(entity)),
      total: result.total,
      limit: result.limit,
      offset: result.offset,
    }
  }

  @Get('latest/:exchange/:symbol')
  @ApiBearerAuth()
  @RequireAuth()
  @ReadAny(AppResource.MARKET_SYMBOL)
  @ApiOperation({ summary: '获取最新的持仓量数据' })
  @ApiParam({ name: 'exchange', description: '交易所名称', example: 'All' })
  @ApiParam({ name: 'symbol', description: '币种符号', example: 'BTC' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: '查询成功',
    type: OpenInterestDto,
  })
  @ApiResponse({ status: HttpStatus.NOT_FOUND, description: '未找到数据' })
  async getLatest(
    @Param('exchange') exchange: string,
    @Param('symbol') symbol: string,
  ) {
    if (!exchange || !symbol) {
      throw new BadRequestException('exchange and symbol are required')
    }
    const entity = await this.openInterestService.getLatest(exchange, symbol)

    if (!entity) {
      throw new NotFoundException(
        `Open interest not found for ${exchange}:${symbol}`,
      )
    }

    return this.toDto(entity)
  }

  @Get('stats/:symbol')
  @ApiBearerAuth()
  @RequireAuth()
  @ReadAny(AppResource.MARKET_SYMBOL)
  @ApiOperation({ summary: '获取持仓量统计数据' })
  @ApiParam({ name: 'symbol', description: '币种符号', example: 'BTC' })
  @ApiQuery({
    name: 'startTime',
    description: '开始时间',
    example: '2025-12-24T00:00:00Z',
    required: true,
  })
  @ApiQuery({
    name: 'endTime',
    description: '结束时间',
    example: '2025-12-24T23:59:59Z',
    required: true,
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: '统计成功',
    type: OpenInterestStatsDto,
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: '参数错误',
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: '未找到数据',
  })
  async getStats(
    @Param('symbol') symbol: string,
    @Query('startTime') startTime: string,
    @Query('endTime') endTime: string,
  ) {
    if (!symbol || !startTime || !endTime) {
      throw new BadRequestException(
        'symbol, startTime, and endTime are required',
      )
    }

    // 验证日期格式
    const start = new Date(startTime)
    const end = new Date(endTime)

    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
      throw new BadRequestException('Invalid date format')
    }

    if (start >= end) {
      throw new BadRequestException('startTime must be before endTime')
    }

    const stats = await this.openInterestService.getStats(symbol, start, end)

    if (!stats) {
      throw new NotFoundException(
        `Open interest stats not found for ${symbol} in range`,
      )
    }

    return stats
  }

  private toDto(entity: any): OpenInterestDto {
    return {
      exchange: entity.exchange,
      symbol: entity.symbol,
      open_interest_usd: Number(entity.openInterestUsd),
      open_interest_quantity: Number(entity.openInterestQuantity),
      open_interest_by_stable_coin_margin:
        entity.openInterestByStableCoinMargin != null
          ? Number(entity.openInterestByStableCoinMargin)
          : undefined,
      open_interest_by_coin_margin:
        entity.openInterestByCoinMargin != null
          ? Number(entity.openInterestByCoinMargin)
          : undefined,
      open_interest_quantity_by_coin_margin:
        entity.openInterestQuantityByCoinMargin != null
          ? Number(entity.openInterestQuantityByCoinMargin)
          : undefined,
      open_interest_quantity_by_stable_coin_margin:
        entity.openInterestQuantityByStableCoinMargin != null
          ? Number(entity.openInterestQuantityByStableCoinMargin)
          : undefined,
      open_interest_change_percent_5m:
        entity.openInterestChangePercent5m != null
          ? Number(entity.openInterestChangePercent5m)
          : undefined,
      open_interest_change_percent_15m:
        entity.openInterestChangePercent15m != null
          ? Number(entity.openInterestChangePercent15m)
          : undefined,
      open_interest_change_percent_30m:
        entity.openInterestChangePercent30m != null
          ? Number(entity.openInterestChangePercent30m)
          : undefined,
      open_interest_change_percent_1h:
        entity.openInterestChangePercent1h != null
          ? Number(entity.openInterestChangePercent1h)
          : undefined,
      open_interest_change_percent_4h:
        entity.openInterestChangePercent4h != null
          ? Number(entity.openInterestChangePercent4h)
          : undefined,
      open_interest_change_percent_24h:
        entity.openInterestChangePercent24h != null
          ? Number(entity.openInterestChangePercent24h)
          : undefined,
      data_timestamp:
        entity.dataTimestamp instanceof Date
          ? entity.dataTimestamp.toISOString()
          : entity.dataTimestamp,
    }
  }
}
