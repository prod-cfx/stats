import type { TriggerPositionSyncDto } from './dto/position-sync.dto'
import type { PositionsQueryDto } from './dto/positions-query.dto'
import type { QuotesUpdateDto } from './dto/quotes-update.dto'
import type { RecordTradeDto } from './dto/record-trade.dto'
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
import { PositionStatus } from '@prisma/client'
import { BasePaginationResponseDto } from '@/common/dto/base.pagination.response.dto'
import { StrategyAccountNotFoundException } from '@/modules/accounts/exceptions/strategy-account-not-found.exception'
// DTOs 闇€瑕佸湪杩愯鏃跺瓨鍦ㄤ互鏀寔 class-validator 鍜?Swagger锛屽繀椤讳娇鐢ㄦ櫘閫?import
import { ClosePositionDto, ClosePositionResponseDto } from './dto/close-position.dto'
import { PositionSyncResultDto } from './dto/position-sync.dto'
import { PositionResponseDto } from './dto/position.response.dto'
import { TradeResponseDto } from './dto/trade.response.dto'
// Nest DI 闇€瑕佽繍琛屾椂寮曠敤 service
// eslint-disable-next-line ts/consistent-type-imports -- Nest DI 闇€瑕佽繍琛屾椂寮曠敤
import { PositionSyncService } from './position-sync.service'
// eslint-disable-next-line ts/consistent-type-imports -- Nest DI 闇€瑕佽繍琛屾椂寮曠敤
import { PositionsValuationService } from './positions-valuation.service'
// eslint-disable-next-line ts/consistent-type-imports -- Nest DI 闇€瑕佽繍琛屾椂寮曠敤
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

  @Post('fills')
  @ApiOperation({ summary: '璁板綍鎴愪氦锛堝唴閮ㄤ娇鐢級' })
  @ApiOkResponse({ type: TradeResponseDto })
  async recordTrade(@Body() dto: RecordTradeDto) {
    return this.positionsService.recordTrade(dto)
  }

  @Post('quotes')
  @ApiOperation({ summary: '鎺ㄩ€佽鎯呭揩鐓у苟鏇存柊鏈疄鐜扮泩浜忥紙鍐呴儴浣跨敤锛? })
  async applyQuotes(@Body() dto: QuotesUpdateDto) {
    return this.valuationService.applyQuotes(dto)
  }

  @Get('open')
  @ApiOperation({ summary: '鏌ヨ鏈钩浠撲粨浣? })
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
  @ApiOperation({ summary: '鏌ヨ鍘嗗彶浠撲綅' })
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

  @Post('sync')
  @ApiOperation({
    summary: '鎵嬪姩瑙﹀彂浠撲綅鍚屾',
    description: '浠庝氦鏄撴墍鑾峰彇瀹為檯浠撲綅骞朵笌鏈湴鏁版嵁瀵规瘮鍚屾銆?,
  })
  @ApiOkResponse({ type: PositionSyncResultDto })
  async triggerPositionSync(@Body() dto: TriggerPositionSyncDto) {
    const account = await this.positionsService.prisma.userStrategyAccount.findUnique({
      where: { id: dto.userStrategyAccountId },
      select: { userId: true, id: true },
    })

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

  @Post('sync/all')
  @ApiOperation({ summary: '鍚屾鎵€鏈夋椿璺冭处鎴风殑浠撲綅' })
  @ApiOkResponse({ type: [PositionSyncResultDto] })
  async syncAllPositions() {
    return this.positionSyncService.syncAllActivePositions()
  }

  @Post('close')
  @ApiOperation({
    summary: '鐢ㄦ埛涓诲姩骞充粨',
    description: '鐢ㄦ埛閫氳繃甯備环鍗曚富鍔ㄥ钩浠擄紙鏀寔鍏ㄥ钩鎴栭儴鍒嗗钩浠擄級',
  })
  @ApiBody({ type: ClosePositionDto })
  @ApiOkResponse({ type: ClosePositionResponseDto })
  async closePosition(@Body() dto: ClosePositionDto) {
    const account = await this.positionsService.prisma.userStrategyAccount.findUnique({
      where: { id: dto.userStrategyAccountId },
      select: { userId: true, id: true },
    })

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
