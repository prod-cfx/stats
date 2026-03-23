import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common'
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger'
import { CurrentUser } from '@/modules/auth/decorators/current-user.decorator'
import { Auth } from '@/modules/auth/decorators/access-control.decorator'
import { AccountAiQuantActionRequestDto } from './dto/account-ai-quant-action.request.dto'
import { AccountAiQuantDeployRequestDto } from './dto/account-ai-quant-deploy.request.dto'
import { AccountAiQuantListQueryDto } from './dto/account-ai-quant-list.query.dto'
import { AiQuantProxyService } from './ai-quant-proxy.service'

@ApiTags('account-ai-quant')
@ApiBearerAuth('bearer')
@Auth()
@Controller('account/ai-quant/strategies')
export class AccountAiQuantStrategiesController {
  constructor(private readonly service: AiQuantProxyService) {}

  @Get()
  async list(
    @CurrentUser('id') userId: string,
    @Query() query: AccountAiQuantListQueryDto,
  ): Promise<unknown> {
    return this.service.listAccountStrategies(userId, {
      page: query.page,
      limit: query.limit,
      status: query.status,
    })
  }

  @Get(':id')
  async detail(
    @CurrentUser('id') userId: string,
    @Param('id') id: string,
  ): Promise<unknown> {
    return this.service.getAccountStrategyDetail(userId, id)
  }

  @Post(':id/actions')
  async action(
    @CurrentUser('id') userId: string,
    @Param('id') id: string,
    @Body() dto: AccountAiQuantActionRequestDto,
  ): Promise<unknown> {
    return this.service.performAccountStrategyAction(userId, id, {
      action: dto.action,
    })
  }

  @Post('deploy')
  async deploy(
    @CurrentUser('id') userId: string,
    @Body() dto: AccountAiQuantDeployRequestDto,
  ): Promise<unknown> {
    return this.service.deployAccountStrategy(userId, {
      name: dto.name,
      exchange: dto.exchange,
      symbol: dto.symbol,
      timeframe: dto.timeframe,
      positionPct: dto.positionPct,
      exchangeAccountId: dto.exchangeAccountId,
      exchangeAccountName: dto.exchangeAccountName,
    })
  }
}
