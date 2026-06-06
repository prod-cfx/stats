import type { AiQuantProxyService } from './ai-quant-proxy.service'
import type { BasePaginationResponseDto as BasePaginationResponseDtoType } from '@/common/dto/base-pagination.response.dto'
import type { LlmSubscriptionCreateRequestDto } from './dto/llm-subscription-create.request.dto'
import type { LlmSubscriptionListQueryDto } from './dto/llm-subscription-list-query.dto'
import type { LlmSubscriptionUpdateRequestDto } from './dto/llm-subscription-update.request.dto'
import { Body, Controller, Delete, Get, Inject, Param, Patch, Post, Query } from '@nestjs/common'
import { ApiBearerAuth, ApiExtraModels, ApiNoContentResponse, ApiOkResponse, ApiOperation, ApiTags, getSchemaPath } from '@nestjs/swagger'
import { BasePaginationResponseDto } from '@/common/dto/base-pagination.response.dto'
import { Auth } from '@/modules/auth/decorators/access-control.decorator'
import { CurrentUser } from '@/modules/auth/decorators/current-user.decorator'
import { AiQuantProxyService as AiQuantProxyServiceToken } from './ai-quant-proxy.service'
import { LlmSubscriptionResponseDto } from './dto/llm-subscription.response.dto'

@ApiTags('llm-strategy-subscriptions')
@ApiBearerAuth('bearer')
@ApiExtraModels(BasePaginationResponseDto, LlmSubscriptionResponseDto)
@Auth()
@Controller('llm-strategy-subscriptions')
export class LlmStrategySubscriptionsController {
  constructor(
    @Inject(AiQuantProxyServiceToken)
    private readonly service: AiQuantProxyService,
  ) {}

  @Post()
  @ApiOperation({ summary: 'Create an LLM strategy subscription through the backend proxy.' })
  @ApiOkResponse({ schema: { $ref: getSchemaPath(LlmSubscriptionResponseDto) } })
  async create(
    @CurrentUser('id') userId: string,
    @Body() dto: LlmSubscriptionCreateRequestDto,
  ): Promise<LlmSubscriptionResponseDto> {
    return this.service.createLlmSubscription(userId, {
      llmStrategyInstanceId: dto.llmStrategyInstanceId,
      customParams: dto.customParams,
      exchangeAccountId: dto.exchangeAccountId,
    })
  }

  @Get()
  @ApiOperation({ summary: 'List the authenticated user LLM strategy subscriptions through the backend proxy.' })
  @ApiOkResponse({
    schema: {
      allOf: [
        { $ref: getSchemaPath(BasePaginationResponseDto) },
        {
          properties: {
            items: { type: 'array', items: { $ref: getSchemaPath(LlmSubscriptionResponseDto) } },
          },
        },
      ],
    },
  })
  async list(
    @CurrentUser('id') userId: string,
    @Query() query: LlmSubscriptionListQueryDto,
  ): Promise<BasePaginationResponseDtoType<LlmSubscriptionResponseDto>> {
    return this.service.listLlmSubscriptions(userId, {
      page: query.page,
      limit: query.limit,
      status: query.status,
    })
  }

  @Get(':subscriptionId')
  @ApiOperation({ summary: 'Get an LLM strategy subscription detail through the backend proxy.' })
  @ApiOkResponse({ schema: { $ref: getSchemaPath(LlmSubscriptionResponseDto) } })
  async detail(
    @CurrentUser('id') userId: string,
    @Param('subscriptionId') subscriptionId: string,
  ): Promise<LlmSubscriptionResponseDto> {
    return this.service.getLlmSubscriptionDetail(userId, subscriptionId)
  }

  @Patch(':subscriptionId')
  @ApiOperation({ summary: 'Update an LLM strategy subscription through the backend proxy.' })
  @ApiOkResponse({ schema: { $ref: getSchemaPath(LlmSubscriptionResponseDto) } })
  async update(
    @CurrentUser('id') userId: string,
    @Param('subscriptionId') subscriptionId: string,
    @Body() dto: LlmSubscriptionUpdateRequestDto,
  ): Promise<LlmSubscriptionResponseDto> {
    return this.service.updateLlmSubscription(userId, subscriptionId, {
      status: dto.status,
      customParams: dto.customParams,
      exchangeAccountId: dto.exchangeAccountId,
    })
  }

  @Delete(':subscriptionId')
  @ApiOperation({ summary: 'Cancel an LLM strategy subscription through the backend proxy.' })
  @ApiNoContentResponse({ description: 'Subscription cancelled; no response body.' })
  async delete(
    @CurrentUser('id') userId: string,
    @Param('subscriptionId') subscriptionId: string,
  ): Promise<void> {
    return this.service.cancelLlmSubscription(userId, subscriptionId)
  }
}
