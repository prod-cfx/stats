import { Body, Controller, Delete, Get, Inject, Param, Post, Query } from '@nestjs/common'
import {
  ApiBody,
  ApiCreatedResponse,
  ApiExtraModels,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  getSchemaPath,
} from '@nestjs/swagger'

import { BaseResponseDto } from '@/common/dto/base.dto'
import { buildBaseResponseSchema } from '@/common/swagger/base-response-schema.helper'
import { CreateExchangeAccountDto } from './dto/create-exchange-account.dto'
// eslint-disable-next-line ts/consistent-type-imports -- Nest 需要运行时类元数据用于 query DTO 校验
import { ExchangeAccountUserQueryDto } from './dto/exchange-account-user-query.dto'
import { ExchangeAccountResponseDto } from './dto/exchange-account.response.dto'
import { ExchangeAccountsService } from './exchange-accounts.service'

@ApiTags('exchange-accounts')
@Controller('exchange-accounts')
@ApiExtraModels(BaseResponseDto, ExchangeAccountResponseDto)
export class ExchangeAccountsController {
  constructor(
    @Inject(ExchangeAccountsService)
    private readonly service: ExchangeAccountsService,
  ) {}

  @Post()
  @ApiOperation({ summary: '绑定新的交易所账户' })
  @ApiBody({ type: CreateExchangeAccountDto })
  @ApiCreatedResponse({
    schema: buildBaseResponseSchema(ExchangeAccountResponseDto),
  })
  async create(@Body() dto: CreateExchangeAccountDto): Promise<ExchangeAccountResponseDto> {
    return this.service.create(dto.userId, dto)
  }

  @Get()
  @ApiOperation({ summary: '获取业务用户的交易所账户列表' })
  @ApiOkResponse({
    schema: {
      type: 'object',
      required: ['data'],
      properties: {
        data: {
          type: 'array',
          items: { $ref: getSchemaPath(ExchangeAccountResponseDto) },
        },
        message: {
          type: 'string',
          example: 'Success',
        },
      },
    },
  })
  async list(@Query() query: ExchangeAccountUserQueryDto): Promise<ExchangeAccountResponseDto[]> {
    return this.service.list(query.userId)
  }

  @Delete(':exchangeId')
  @ApiOperation({ summary: '解绑交易所账户' })
  @ApiOkResponse({
    description: '解绑成功',
    schema: {
      type: 'object',
      required: ['data'],
      properties: {
        data: {
          type: 'null',
        },
        message: {
          type: 'string',
          example: 'Success',
        },
      },
    },
  })
  async delete(
    @Query() query: ExchangeAccountUserQueryDto,
    @Param('exchangeId') exchangeId: string,
  ): Promise<void> {
    return this.service.delete(query.userId, exchangeId)
  }
}
