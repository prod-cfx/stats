import { Body, Controller, Delete, Get, Inject, Param, Post, Query } from '@nestjs/common'
import { ApiBody, ApiCreatedResponse, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger'

import { CreateExchangeAccountDto } from './dto/create-exchange-account.dto'
// eslint-disable-next-line ts/consistent-type-imports -- Nest 闇€瑕佽繍琛屾椂绫诲厓鏁版嵁鐢ㄤ簬 query DTO 鏍￠獙
import { ExchangeAccountUserQueryDto } from './dto/exchange-account-user.query.dto'
import { ExchangeAccountResponseDto } from './dto/exchange-account.response.dto'
import { ExchangeAccountsService } from './exchange-accounts.service'

@ApiTags('exchange-accounts')
@Controller('exchange-accounts')
export class ExchangeAccountsController {
  constructor(
    @Inject(ExchangeAccountsService)
    private readonly service: ExchangeAccountsService,
  ) {}

  @Post()
  @ApiOperation({ summary: '缁戝畾鏂扮殑浜ゆ槗鎵€璐︽埛' })
  @ApiBody({ type: CreateExchangeAccountDto })
  @ApiCreatedResponse({ type: ExchangeAccountResponseDto })
  async create(@Body() dto: CreateExchangeAccountDto): Promise<ExchangeAccountResponseDto> {
    return this.service.create(dto.userId, dto)
  }

  @Get()
  @ApiOperation({ summary: '鑾峰彇涓氬姟鐢ㄦ埛鐨勪氦鏄撴墍璐︽埛鍒楄〃' })
  @ApiOkResponse({ type: [ExchangeAccountResponseDto] })
  async list(@Query() query: ExchangeAccountUserQueryDto): Promise<ExchangeAccountResponseDto[]> {
    return this.service.list(query.userId)
  }

  @Delete(':accountId')
  @ApiOperation({ summary: '瑙ｇ粦浜ゆ槗鎵€璐︽埛' })
  @ApiOkResponse({ description: '瑙ｇ粦鎴愬姛' })
  async delete(
    @Query() query: ExchangeAccountUserQueryDto,
    @Param('accountId') accountId: string,
  ): Promise<void> {
    return this.service.delete(query.userId, accountId)
  }
}
