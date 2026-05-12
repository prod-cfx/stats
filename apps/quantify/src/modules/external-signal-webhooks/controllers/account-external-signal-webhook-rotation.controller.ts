import { Transactional } from '@nestjs-cls/transactional'
import { Controller, Headers, HttpCode, HttpStatus, Param, Post } from '@nestjs/common'
import { ApiHeader, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger'
import { AccountStrategyCallerIdentityService } from '@/modules/account-strategy-view/services/account-strategy-caller-identity.service'
import { ExternalSignalWebhookSubscriptionSecretResponseDto } from '../dto/external-signal-webhook-subscription.dto'
import { ExternalSignalWebhooksService } from '../services/external-signal-webhooks.service'

@ApiTags('account/external-signal-webhooks')
@Controller('account/ai-quant/external-signal-subscriptions')
export class AccountExternalSignalWebhookRotationController {
  constructor(
    private readonly service: ExternalSignalWebhooksService,
    private readonly callerIdentityService: AccountStrategyCallerIdentityService,
  ) {}

  @Transactional()
  @Post(':subscriptionId/rotate')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '轮换当前用户外部信号 webhook 订阅密钥' })
  @ApiHeader({ name: 'authorization', required: false })
  @ApiHeader({ name: 'x-user-id', required: false })
  @ApiOkResponse({ type: ExternalSignalWebhookSubscriptionSecretResponseDto })
  async rotate(
    @Param('subscriptionId') subscriptionId: string,
    @Headers('authorization') authorization?: string,
    @Headers('x-user-id') forwardedUserId?: string,
  ): Promise<ExternalSignalWebhookSubscriptionSecretResponseDto> {
    const userId = await this.callerIdentityService.resolveVerifiedCallerUserIdFromAuthorization(authorization, forwardedUserId)
    return this.service.rotateSubscription(userId, subscriptionId)
  }
}
