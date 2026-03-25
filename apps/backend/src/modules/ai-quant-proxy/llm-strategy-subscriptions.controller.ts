import type { AiQuantProxyService } from './ai-quant-proxy.service'
import type { LlmSubscriptionCreateRequestDto } from './dto/llm-subscription-create.request.dto'
import type { LlmSubscriptionListQueryDto } from './dto/llm-subscription-list.query.dto'
import type { LlmSubscriptionUpdateRequestDto } from './dto/llm-subscription-update.request.dto'
import { Body, Controller, Delete, Get, Inject, Param, Patch, Post, Query } from '@nestjs/common'
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger'
import { Auth } from '@/modules/auth/decorators/access-control.decorator'
import { CurrentUser } from '@/modules/auth/decorators/current-user.decorator'
import { AiQuantProxyService as AiQuantProxyServiceToken } from './ai-quant-proxy.service'

@ApiTags('llm-strategy-subscriptions')
@ApiBearerAuth('bearer')
@Auth()
@Controller('llm-strategy-subscriptions')
export class LlmStrategySubscriptionsController {
  constructor(
    @Inject(AiQuantProxyServiceToken)
    private readonly service: AiQuantProxyService,
  ) {}

  @Post()
  async create(
    @CurrentUser('id') userId: string,
    @Body() dto: LlmSubscriptionCreateRequestDto,
  ): Promise<unknown> {
    return this.service.createLlmSubscription(userId, {
      llmStrategyInstanceId: dto.llmStrategyInstanceId,
      customParams: dto.customParams,
      exchangeAccountId: dto.exchangeAccountId,
    })
  }

  @Get()
  async list(
    @CurrentUser('id') userId: string,
    @Query() query: LlmSubscriptionListQueryDto,
  ): Promise<unknown> {
    return this.service.listLlmSubscriptions(userId, {
      page: query.page,
      limit: query.limit,
      status: query.status,
    })
  }

  @Get(':subscriptionId')
  async detail(
    @CurrentUser('id') userId: string,
    @Param('subscriptionId') subscriptionId: string,
  ): Promise<unknown> {
    return this.service.getLlmSubscriptionDetail(userId, subscriptionId)
  }

  @Patch(':subscriptionId')
  async update(
    @CurrentUser('id') userId: string,
    @Param('subscriptionId') subscriptionId: string,
    @Body() dto: LlmSubscriptionUpdateRequestDto,
  ): Promise<unknown> {
    return this.service.updateLlmSubscription(userId, subscriptionId, {
      status: dto.status,
      customParams: dto.customParams,
      exchangeAccountId: dto.exchangeAccountId,
    })
  }

  @Delete(':subscriptionId')
  async delete(
    @CurrentUser('id') userId: string,
    @Param('subscriptionId') subscriptionId: string,
  ): Promise<unknown> {
    return this.service.cancelLlmSubscription(userId, subscriptionId)
  }
}
