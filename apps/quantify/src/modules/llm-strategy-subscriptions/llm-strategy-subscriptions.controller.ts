/* eslint-disable ts/consistent-type-imports -- NestJS 瑁呴グ鍣ㄩ渶瑕佽繍琛屾椂瀵煎叆浠ヤ繚鐣欑被鍨嬪厓鏁版嵁 */
import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common'
import {
  ApiExtraModels,
  ApiOkResponse,
  ApiOperation,
  ApiResponse,
  ApiTags,
  getSchemaPath,
} from '@nestjs/swagger'

import { BasePaginationResponseDto } from '@/common/dto/base.pagination.response.dto'
import { CreateLlmSubscriptionDto } from './dto/create-llm-subscription.dto'
import { LlmSubscriptionListQueryDto } from './dto/llm-subscription-list-query.dto'
import { LlmSubscriptionResponseDto } from './dto/llm-subscription-response.dto'
import { LlmSubscriptionUserQueryDto } from './dto/llm-subscription-user.query.dto'
import { UpdateLlmSubscriptionDto } from './dto/update-llm-subscription.dto'
import { LlmStrategySubscriptionsService } from './llm-strategy-subscriptions.service'

@ApiTags('llm-strategy-subscriptions')
@ApiExtraModels(BasePaginationResponseDto, LlmSubscriptionResponseDto)
@Controller('llm-strategy-subscriptions')
export class LlmStrategySubscriptionsController {
  constructor(private readonly service: LlmStrategySubscriptionsService) {}

  @Post()
  @ApiOperation({ summary: '璁㈤槄 LLM 绛栫暐瀹炰緥' })
  @ApiResponse({ status: 201, type: LlmSubscriptionResponseDto })
  async subscribe(@Body() dto: CreateLlmSubscriptionDto): Promise<LlmSubscriptionResponseDto> {
    return this.service.subscribe(dto.userId, dto)
  }

  @Get()
  @ApiOperation({ summary: '鑾峰彇涓氬姟鐢ㄦ埛鐨?LLM 绛栫暐璁㈤槄鍒楄〃' })
  @ApiOkResponse({
    schema: {
      allOf: [
        { $ref: getSchemaPath(BasePaginationResponseDto) },
        {
          properties: {
            items: {
              type: 'array',
              items: { $ref: getSchemaPath(LlmSubscriptionResponseDto) },
            },
          },
        },
      ],
    },
  })
  async listMySubscriptions(
    @Query() query: LlmSubscriptionListQueryDto,
  ): Promise<BasePaginationResponseDto<LlmSubscriptionResponseDto>> {
    return this.service.listMySubscriptions(query.userId, query)
  }

  @Get(':subscriptionId')
  @ApiOperation({ summary: '鑾峰彇 LLM 璁㈤槄璇︽儏' })
  @ApiResponse({ status: 200, type: LlmSubscriptionResponseDto })
  async detail(
    @Param('subscriptionId') subscriptionId: string,
    @Query() query: LlmSubscriptionUserQueryDto,
  ): Promise<LlmSubscriptionResponseDto> {
    return this.service.getSubscriptionDetail(query.userId, subscriptionId)
  }

  @Patch(':subscriptionId')
  @ApiOperation({ summary: '鏇存柊 LLM 璁㈤槄锛堝弬鏁?鐘舵€侊級' })
  @ApiResponse({ status: 200, type: LlmSubscriptionResponseDto })
  async update(
    @Param('subscriptionId') subscriptionId: string,
    @Body() dto: UpdateLlmSubscriptionDto,
  ): Promise<LlmSubscriptionResponseDto> {
    return this.service.updateSubscription(dto.userId, subscriptionId, dto)
  }

  @Delete(':subscriptionId')
  @ApiOperation({ summary: '鍙栨秷 LLM 璁㈤槄' })
  @ApiResponse({ status: 200, description: '鍙栨秷璁㈤槄鎴愬姛' })
  async cancel(
    @Param('subscriptionId') subscriptionId: string,
    @Query() query: LlmSubscriptionUserQueryDto,
  ): Promise<void> {
    return this.service.cancelSubscription(query.userId, subscriptionId)
  }
}
