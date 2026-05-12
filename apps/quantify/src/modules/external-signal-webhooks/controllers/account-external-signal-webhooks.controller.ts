import { Transactional } from '@nestjs-cls/transactional'
import { Body, Controller, Get, Headers, Param, Post } from '@nestjs/common'
import { ApiHeader, ApiOkResponse, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger'
import { AccountStrategyCallerIdentityService } from '@/modules/account-strategy-view/services/account-strategy-caller-identity.service'
import {
  CreateExternalSignalWebhookSubscriptionDto,
  ExternalSignalWebhookSubscriptionResponseDto,
  ExternalSignalWebhookSubscriptionSecretResponseDto,
} from '../dto/external-signal-webhook-subscription.dto'
import { ExternalSignalWebhooksService } from '../services/external-signal-webhooks.service'

@ApiTags('account/external-signal-webhooks')
@Controller('account/ai-quant/strategies/:strategyInstanceId/external-signal-subscriptions')
export class AccountExternalSignalWebhooksController {
  constructor(
    private readonly service: ExternalSignalWebhooksService,
    private readonly callerIdentityService: AccountStrategyCallerIdentityService,
  ) {}

  @Get()
  @ApiOperation({ summary: '列出当前用户策略实例的外部信号 webhook 订阅' })
  @ApiHeader({ name: 'authorization', required: false })
  @ApiHeader({ name: 'x-user-id', required: false })
  @ApiOkResponse({ type: ExternalSignalWebhookSubscriptionResponseDto, isArray: true })
  async list(
    @Param('strategyInstanceId') strategyInstanceId: string,
    @Headers('authorization') authorization?: string,
    @Headers('x-user-id') forwardedUserId?: string,
  ): Promise<ExternalSignalWebhookSubscriptionResponseDto[]> {
    const userId = await this.callerIdentityService.resolveVerifiedCallerUserIdFromAuthorization(authorization, forwardedUserId)
    return this.service.listSubscriptions(userId, strategyInstanceId)
  }

  @Transactional()
  @Post()
  @ApiOperation({ summary: '创建当前用户策略实例的外部信号 webhook 订阅' })
  @ApiHeader({ name: 'authorization', required: false })
  @ApiHeader({ name: 'x-user-id', required: false })
  @ApiResponse({ status: 201, type: ExternalSignalWebhookSubscriptionSecretResponseDto })
  async create(
    @Param('strategyInstanceId') strategyInstanceId: string,
    @Body() dto: CreateExternalSignalWebhookSubscriptionDto,
    @Headers('authorization') authorization?: string,
    @Headers('x-user-id') forwardedUserId?: string,
  ): Promise<ExternalSignalWebhookSubscriptionSecretResponseDto> {
    const userId = await this.callerIdentityService.resolveVerifiedCallerUserIdFromAuthorization(authorization, forwardedUserId)
    return this.service.createSubscription(userId, strategyInstanceId, dto)
  }
}
