import type {
  CreateOpenInterestDto,
  QueryOpenInterestDto} from './dto/open-interest.dto';
import type { OpenInterestService } from './open-interest.service'
import {
  BadRequestException,
  Body,
  Controller,
  Get,
  HttpStatus,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common'
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger'
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard'
import {
  OpenInterestDto,
  OpenInterestStatsDto,
  QueryOpenInterestResponseDto,
} from './dto/open-interest.dto'

/**
 * 持仓量数据控制器
 */
@ApiTags('持仓量数据')
@Controller('open-interest')
export class OpenInterestController {
  constructor(private readonly openInterestService: OpenInterestService) {}

  @Post()
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
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
    return this.openInterestService.upsert(data)
  }

  @Post('batch')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: '批量创建或更新持仓量数据' })
  @ApiResponse({ status: HttpStatus.CREATED, description: '批量创建成功' })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: '参数验证失败',
  })
  async batchUpsert(@Body() dataList: CreateOpenInterestDto[]) {
    if (!Array.isArray(dataList) || dataList.length === 0) {
      throw new BadRequestException('dataList must be a non-empty array')
    }
    return this.openInterestService.batchUpsert(dataList)
  }

  @Get()
  @ApiOperation({ summary: '查询持仓量数据' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: '查询成功',
    type: QueryOpenInterestResponseDto,
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: '参数验证失败',
  })
  async query(@Query() query: QueryOpenInterestDto) {
    return this.openInterestService.query(query)
  }

  @Get('latest/:exchange/:symbol')
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
    return this.openInterestService.getLatest(exchange, symbol)
  }

  @Get('stats/:symbol')
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
    description: '参数错误或未找到数据',
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

    return this.openInterestService.getStats(symbol, start, end)
  }
}
