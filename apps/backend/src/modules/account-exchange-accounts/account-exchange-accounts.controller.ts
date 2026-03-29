import type { AuthenticatedUser } from '@/common/types/authenticated-user.type'
import { Transactional } from '@nestjs-cls/transactional'
import { Body, Controller, Delete, Get, Inject, Param, Post } from '@nestjs/common'
import { ApiBearerAuth, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger'
import { Auth } from '@/modules/auth/decorators/access-control.decorator'
import { CurrentUser } from '@/modules/auth/decorators/current-user.decorator'
import { AccountExchangeAccountsService } from './account-exchange-accounts.service'
import { AccountExchangeAccountResponseDto } from './dto/account-exchange-account.response.dto'
// ValidationPipe(transform: true) 需要运行时可用的 DTO 类，不能使用 type-only import
// eslint-disable-next-line ts/consistent-type-imports
import { CreateAccountExchangeAccountDto } from './dto/create-account-exchange-account.dto'

@ApiTags('account-exchange-accounts')
@ApiBearerAuth('bearer')
@Auth()
@Controller('account/exchange-accounts')
export class AccountExchangeAccountsController {
  constructor(
    @Inject(AccountExchangeAccountsService)
    private readonly service: AccountExchangeAccountsService,
  ) {}

  @Get()
  @ApiOperation({ summary: '获取当前登录用户的交易所绑定状态' })
  @ApiOkResponse({ type: AccountExchangeAccountResponseDto, isArray: true })
  async list(@CurrentUser('id') userId: string): Promise<AccountExchangeAccountResponseDto[]> {
    return this.service.list(userId, { degradeOnTransientFailure: true })
  }

  @Post()
  @Transactional()
  @ApiOperation({ summary: '绑定或更新当前登录用户的交易所账户' })
  @ApiOkResponse({ type: AccountExchangeAccountResponseDto })
  async upsert(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateAccountExchangeAccountDto,
  ): Promise<AccountExchangeAccountResponseDto> {
    return this.service.upsert(user, dto)
  }

  @Delete(':exchangeId')
  @Transactional()
  @ApiOperation({ summary: '解绑当前登录用户的交易所账户' })
  @ApiOkResponse({
    schema: {
      type: 'object',
      properties: {
        data: {
          type: 'object',
          properties: {
            success: { type: 'boolean', example: true },
          },
        },
      },
    },
  })
  async delete(
    @CurrentUser('id') userId: string,
    @Param('exchangeId') exchangeId: string,
  ): Promise<{ success: boolean }> {
    await this.service.delete(userId, exchangeId)
    return { success: true }
  }
}
