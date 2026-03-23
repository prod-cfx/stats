import { Body, Controller, Delete, Get, Inject, Param, Post, Query } from '@nestjs/common'
import { ApiBody, ApiCreatedResponse, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger'

import { CreateExchangeAccountDto } from './dto/create-exchange-account.dto'
// eslint-disable-next-line ts/consistent-type-imports -- Nest 需要运行时类元数据用于 query DTO 校验
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
  @ApiOperation({ summary: '绑定新的交易所账户' })
  @ApiBody({ type: CreateExchangeAccountDto })
  @ApiCreatedResponse({ type: ExchangeAccountResponseDto })
  async create(@Body() dto: CreateExchangeAccountDto): Promise<ExchangeAccountResponseDto> {
    return this.service.create(dto.userId, dto)
  }

  @Get()
  @ApiOperation({ summary: '获取业务用户的交易所账户列表' })
  @ApiOkResponse({ type: [ExchangeAccountResponseDto] })
  async list(@Query() query: ExchangeAccountUserQueryDto): Promise<ExchangeAccountResponseDto[]> {
    return this.service.list(query.userId)
  }

  @Delete(':exchangeId')
  @ApiOperation({ summary: '解绑交易所账户' })
  @ApiOkResponse({ description: '解绑成功' })
  async delete(
    @Query() query: ExchangeAccountUserQueryDto,
    @Param('exchangeId') exchangeId: string,
  ): Promise<void> {
    return this.service.delete(query.userId, exchangeId)
  }
}
