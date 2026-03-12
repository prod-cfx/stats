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
  @ApiOperation({ summary: '璁㈤槄绛栫暐妯℃澘' })
  @ApiResponse({ status: 201, type: SubscriptionResponseDto })
  async subscribe(@Body() dto: CreateSubscriptionDto): Promise<SubscriptionResponseDto> {
    return this.subscriptionsService.subscribe(dto.userId, dto)
  }

  @Get()
  @ApiOperation({ summary: '鑾峰彇涓氬姟鐢ㄦ埛鐨勭瓥鐣ヨ闃呭垪琛? })
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
  @ApiOperation({ summary: '鑾峰彇绛栫暐璁㈤槄璇︽儏' })
  @ApiResponse({ status: 200, type: SubscriptionResponseDto })
  async detail(
    @Param('subscriptionId') subscriptionId: string,
    @Query() query: SubscriptionUserQueryDto,
  ): Promise<SubscriptionResponseDto> {
    return this.subscriptionsService.getSubscriptionDetail(query.userId, subscriptionId)
  }

  @Patch(':subscriptionId')
  @ApiOperation({ summary: '鏇存柊璁㈤槄锛堝弬鏁?鐘舵€侊級' })
  @ApiResponse({ status: 200, type: SubscriptionResponseDto })
  async update(
    @Param('subscriptionId') subscriptionId: string,
    @Body() dto: UpdateSubscriptionDto,
  ): Promise<SubscriptionResponseDto> {
    return this.subscriptionsService.updateSubscription(dto.userId!, subscriptionId, dto)
  }

  @Delete(':subscriptionId')
  @ApiOperation({ summary: '鍙栨秷璁㈤槄' })
  @ApiResponse({ status: 200, description: '鍙栨秷璁㈤槄鎴愬姛' })
  async cancel(
    @Param('subscriptionId') subscriptionId: string,
    @Query() query: SubscriptionUserQueryDto,
  ): Promise<void> {
    return this.subscriptionsService.cancelSubscription(query.userId, subscriptionId)
  }
}
