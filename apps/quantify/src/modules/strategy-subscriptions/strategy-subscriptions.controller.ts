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
import { CreateSubscriptionDto } from './dto/create-subscription.dto'
import { SubscriptionListQueryDto } from './dto/subscription-list-query.dto'
import { SubscriptionResponseDto } from './dto/subscription-response.dto'
import { SubscriptionUserQueryDto } from './dto/subscription-user.query.dto'
import { UpdateSubscriptionDto } from './dto/update-subscription.dto'
import { StrategySubscriptionsService } from './strategy-subscriptions.service'

@ApiTags('strategy-subscriptions')
@ApiExtraModels(BasePaginationResponseDto, SubscriptionResponseDto)
@Controller('strategy-subscriptions')
export class StrategySubscriptionsController {
  constructor(private readonly subscriptionsService: StrategySubscriptionsService) {}

  @Post()
  @ApiOperation({ summary: '订阅策略模板' })
  @ApiResponse({ status: 201, type: SubscriptionResponseDto })
  async subscribe(@Body() dto: CreateSubscriptionDto): Promise<SubscriptionResponseDto> {
    return this.subscriptionsService.subscribe(dto.userId, dto)
  }

  @Get()
  @ApiOperation({ summary: '获取业务用户的策略订阅列表' })
  @ApiOkResponse({
    schema: {
      allOf: [
        { $ref: getSchemaPath(BasePaginationResponseDto) },
        {
          properties: {
            items: {
              type: 'array',
              items: { $ref: getSchemaPath(SubscriptionResponseDto) },
            },
          },
        },
      ],
    },
  })
  async listMySubscriptions(
    @Query() query: SubscriptionListQueryDto,
  ): Promise<BasePaginationResponseDto<SubscriptionResponseDto>> {
    return this.subscriptionsService.listMySubscriptions(query.userId!, query)
  }

  @Get(':subscriptionId')
  @ApiOperation({ summary: '获取策略订阅详情' })
  @ApiResponse({ status: 200, type: SubscriptionResponseDto })
  async detail(
    @Param('subscriptionId') subscriptionId: string,
    @Query() query: SubscriptionUserQueryDto,
  ): Promise<SubscriptionResponseDto> {
    return this.subscriptionsService.getSubscriptionDetail(query.userId, subscriptionId)
  }

  @Patch(':subscriptionId')
  @ApiOperation({ summary: '更新订阅（参数/状态）' })
  @ApiResponse({ status: 200, type: SubscriptionResponseDto })
  async update(
    @Param('subscriptionId') subscriptionId: string,
    @Body() dto: UpdateSubscriptionDto,
  ): Promise<SubscriptionResponseDto> {
    return this.subscriptionsService.updateSubscription(dto.userId!, subscriptionId, dto)
  }

  @Delete(':subscriptionId')
  @ApiOperation({ summary: '取消订阅' })
  @ApiResponse({ status: 200, description: '取消订阅成功' })
  async cancel(
    @Param('subscriptionId') subscriptionId: string,
    @Query() query: SubscriptionUserQueryDto,
  ): Promise<void> {
    return this.subscriptionsService.cancelSubscription(query.userId, subscriptionId)
  }
}
