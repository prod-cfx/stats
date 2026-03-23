import type { TriggerPositionSyncDto } from './dto/position-sync.dto'
import type { PositionsQueryDto } from './dto/positions-query.dto'
import type { QuotesUpdateDto } from './dto/quotes-update.dto'
import type { RecordTradeDto } from './dto/record-trade.dto'
import { Transactional } from '@nestjs-cls/transactional'
import {
  Body,
  Controller,
  Get,
  Post,
  Query,
} from '@nestjs/common'
import {
  ApiBody,
  ApiExtraModels,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  getSchemaPath,
} from '@nestjs/swagger'
import { BasePaginationResponseDto } from '@/common/dto/base.pagination.response.dto'
import { StrategyAccountNotFoundException } from '@/modules/accounts/exceptions/strategy-account-not-found.exception'
import { PositionStatus } from '@/prisma/prisma.types'
// DTOs 需要在运行时存在以支持 class-validator 和 Swagger，必须使用普通 import
import { ClosePositionDto, ClosePositionResponseDto } from './dto/close-position.dto'
import { PositionSyncResultDto } from './dto/position-sync.dto'
import { PositionResponseDto } from './dto/position.response.dto'
import { TradeResponseDto } from './dto/trade.response.dto'
// Nest DI 需要运行时引用 service
// eslint-disable-next-line ts/consistent-type-imports -- Nest DI 需要运行时引用
import { PositionSyncService } from './position-sync.service'
// eslint-disable-next-line ts/consistent-type-imports -- Nest DI 需要运行时引用
import { PositionsValuationService } from './positions-valuation.service'
// eslint-disable-next-line ts/consistent-type-imports -- Nest DI 需要运行时引用
import { PositionsService } from './positions.service'

@ApiTags('positions')
@ApiExtraModels(BasePaginationResponseDto, PositionResponseDto, TradeResponseDto, PositionSyncResultDto, ClosePositionResponseDto)
@Controller('positions')
export class PositionsController {
  constructor(
    private readonly positionsService: PositionsService,
    private readonly valuationService: PositionsValuationService,
    private readonly positionSyncService: PositionSyncService,
  ) {}

  @Transactional()
  @Post('fills')
  @ApiOperation({ summary: '记录成交（内部使用）' })
  @ApiOkResponse({ type: TradeResponseDto })
  async recordTrade(@Body() dto: RecordTradeDto) {
    return this.positionsService.recordTrade(dto)
  }

  @Transactional()
  @Post('quotes')
  @ApiOperation({ summary: '推送行情快照并更新未实现盈亏（内部使用）' })
  async applyQuotes(@Body() dto: QuotesUpdateDto) {
    return this.valuationService.applyQuotes(dto)
  }

  @Get('open')
  @ApiOperation({ summary: '查询未平仓仓位' })
  @ApiOkResponse({
    schema: {
      allOf: [
        { $ref: getSchemaPath(BasePaginationResponseDto) },
        {
          properties: {
            items: {
              type: 'array',
              items: { $ref: getSchemaPath(PositionResponseDto) },
            },
          },
        },
      ],
    },
  })
  async listOpenPositions(@Query() query: PositionsQueryDto) {
    return this.positionsService.listPositions(
      { ...query, status: PositionStatus.OPEN, userId: query.userId },
      query.userId,
    )
  }

  @Get('history')
  @ApiOperation({ summary: '查询历史仓位' })
  @ApiOkResponse({
    schema: {
      allOf: [
        { $ref: getSchemaPath(BasePaginationResponseDto) },
        {
          properties: {
            items: {
              type: 'array',
              items: { $ref: getSchemaPath(PositionResponseDto) },
            },
          },
        },
      ],
    },
  })
  async listHistoricalPositions(@Query() query: PositionsQueryDto) {
    return this.positionsService.listPositions(
      { ...query, status: PositionStatus.CLOSED, userId: query.userId },
      query.userId,
    )
  }

  @Transactional()
  @Post('sync')
  @ApiOperation({
    summary: '手动触发仓位同步',
    description: '从交易所获取实际仓位并与本地数据对比同步。',
  })
  @ApiOkResponse({ type: PositionSyncResultDto })
  async triggerPositionSync(@Body() dto: TriggerPositionSyncDto) {
    const account = await this.positionsService.findUserStrategyAccountById(dto.userStrategyAccountId)

    if (!account) {
      throw new StrategyAccountNotFoundException({ accountId: dto.userStrategyAccountId })
    }

    this.ensureOwnership(account.userId, dto.userId, dto.userStrategyAccountId)

    return this.positionSyncService.syncUserPositions(
      account.userId,
      account.id,
      dto.exchangeId,
      dto.marketType,
      'manual',
      dto.userId,
    )
  }

  @Transactional()
  @Post('sync/all')
  @ApiOperation({ summary: '同步所有活跃账户的仓位' })
  @ApiOkResponse({ type: [PositionSyncResultDto] })
  async syncAllPositions() {
    return this.positionSyncService.syncAllActivePositions()
  }

  @Transactional()
  @Post('close')
  @ApiOperation({
    summary: '用户主动平仓',
    description: '用户通过市价单主动平仓（支持全平或部分平仓）',
  })
  @ApiBody({ type: ClosePositionDto })
  @ApiOkResponse({ type: ClosePositionResponseDto })
  async closePosition(@Body() dto: ClosePositionDto) {
    const account = await this.positionsService.findUserStrategyAccountById(dto.userStrategyAccountId)

    if (!account) {
      throw new StrategyAccountNotFoundException({ accountId: dto.userStrategyAccountId })
    }

    this.ensureOwnership(account.userId, dto.userId, dto.userStrategyAccountId)

    return this.positionsService.closePosition(dto)
  }

  private ensureOwnership(accountUserId: string, userId: string, accountId: string) {
    if (accountUserId === userId) return
    throw new StrategyAccountNotFoundException({ accountId })
  }
}
