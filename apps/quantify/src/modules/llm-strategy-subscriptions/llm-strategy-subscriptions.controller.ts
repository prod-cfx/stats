/* eslint-disable ts/consistent-type-imports -- NestJS 装饰器需要运行时导入以保留类型元数据 */
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
  @ApiOperation({ summary: '订阅 LLM 策略实例' })
  @ApiResponse({ status: 201, type: LlmSubscriptionResponseDto })
  async subscribe(@Body() dto: CreateLlmSubscriptionDto): Promise<LlmSubscriptionResponseDto> {
    return this.service.subscribe(dto.userId, dto)
  }

  @Get()
  @ApiOperation({ summary: '获取业务用户的 LLM 策略订阅列表' })
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
  @ApiOperation({ summary: '获取 LLM 订阅详情' })
  @ApiResponse({ status: 200, type: LlmSubscriptionResponseDto })
  async detail(
    @Param('subscriptionId') subscriptionId: string,
    @Query() query: LlmSubscriptionUserQueryDto,
  ): Promise<LlmSubscriptionResponseDto> {
    return this.service.getSubscriptionDetail(query.userId, subscriptionId)
  }

  @Patch(':subscriptionId')
  @ApiOperation({ summary: '更新 LLM 订阅（参数、状态）' })
  @ApiResponse({ status: 200, type: LlmSubscriptionResponseDto })
  async update(
    @Param('subscriptionId') subscriptionId: string,
    @Body() dto: UpdateLlmSubscriptionDto,
  ): Promise<LlmSubscriptionResponseDto> {
    return this.service.updateSubscription(dto.userId, subscriptionId, dto)
  }

  @Delete(':subscriptionId')
  @ApiOperation({ summary: '取消 LLM 订阅' })
  @ApiResponse({ status: 200, description: '取消订阅成功' })
  async cancel(
    @Param('subscriptionId') subscriptionId: string,
    @Query() query: LlmSubscriptionUserQueryDto,
  ): Promise<void> {
    return this.service.cancelSubscription(query.userId, subscriptionId)
  }
}
