import type { AiQuantProxyService } from './ai-quant-proxy.service'
import { Body, Controller, Delete, Get, Headers, Inject, Param, Post, Query } from '@nestjs/common'
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger'
import { Auth } from '@/modules/auth/decorators/access-control.decorator'
import { CurrentUser } from '@/modules/auth/decorators/current-user.decorator'
import { AiQuantProxyService as AiQuantProxyServiceToken } from './ai-quant-proxy.service'
import { AccountAiQuantActionRequestDto } from './dto/account-ai-quant-action.request.dto'
import { AccountAiQuantDeployRequestDto } from './dto/account-ai-quant-deploy.request.dto'
import { AccountAiQuantListQueryDto } from './dto/account-ai-quant-list-query.dto'
import { AccountAiQuantUpdateExecutionLeverageRequestDto } from './dto/account-ai-quant-update-execution-leverage.request.dto'

@ApiTags('account-ai-quant')
@ApiBearerAuth('bearer')
@Auth()
@Controller('account/ai-quant/strategies')
export class AccountAiQuantStrategiesController {
  // Keep DTOs as runtime values so Nest can emit metadata for validation/binding.
  private static readonly dtoRefs = [
    AccountAiQuantActionRequestDto,
    AccountAiQuantDeployRequestDto,
    AccountAiQuantListQueryDto,
    AccountAiQuantUpdateExecutionLeverageRequestDto,
  ]

  constructor(
    @Inject(AiQuantProxyServiceToken)
    private readonly service: AiQuantProxyService,
  ) {}

  @Get()
  async list(
    @CurrentUser('id') userId: string,
    @Headers('authorization') authorization: string | undefined,
    @Query() query: AccountAiQuantListQueryDto,
  ): Promise<unknown> {
    return this.service.listAccountStrategies(userId, authorization, {
      page: query.page,
      limit: query.limit,
      status: query.status,
      subscribedOnly: query.subscribedOnly,
      excludeDraft: query.excludeDraft,
    })
  }

  @Get(':id')
  async detail(
    @CurrentUser('id') userId: string,
    @Headers('authorization') authorization: string | undefined,
    @Param('id') id: string,
  ): Promise<unknown> {
    return this.service.getAccountStrategyDetail(userId, authorization, id)
  }

  @Post(':id/actions')
  async action(
    @CurrentUser('id') userId: string,
    @Headers('authorization') authorization: string | undefined,
    @Param('id') id: string,
    @Body() dto: AccountAiQuantActionRequestDto,
  ): Promise<unknown> {
    return this.service.performAccountStrategyAction(userId, authorization, id, {
      action: dto.action,
    })
  }

  @Post('deploy')
  async deploy(
    @CurrentUser('id') userId: string,
    @Headers('authorization') authorization: string | undefined,
    @Body() dto: AccountAiQuantDeployRequestDto,
  ): Promise<unknown> {
    return this.service.deployAccountStrategy(userId, authorization, {
      name: dto.name,
      deployRequestId: dto.deployRequestId,
      publishedSnapshotId: dto.publishedSnapshotId,
      strategyInstanceId: dto.strategyInstanceId,
      exchangeAccountId: dto.exchangeAccountId,
      exchangeAccountName: dto.exchangeAccountName,
      leverage: dto.leverage,
    })
  }

  @Post(':id/execution/leverage')
  async updateExecutionLeverage(
    @CurrentUser('id') userId: string,
    @Headers('authorization') authorization: string | undefined,
    @Param('id') id: string,
    @Body() dto: AccountAiQuantUpdateExecutionLeverageRequestDto,
  ): Promise<unknown> {
    return this.service.updateAccountStrategyExecutionLeverage(userId, authorization, id, {
      leverage: dto.leverage,
    })
  }

  @Delete(':id')
  async remove(
    @CurrentUser('id') userId: string,
    @Headers('authorization') authorization: string | undefined,
    @Param('id') id: string,
  ): Promise<void> {
    return this.service.deleteAccountStrategy(userId, authorization, id)
  }
}
