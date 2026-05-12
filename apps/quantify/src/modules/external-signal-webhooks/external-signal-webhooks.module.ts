import { Module } from '@nestjs/common'
import { ThrottlerModule } from '@nestjs/throttler'
import { ConfigCryptoService } from '@/common/services/config-crypto.service'
import { AccountStrategyCallerIdentityService } from '@/modules/account-strategy-view/services/account-strategy-caller-identity.service'
import { AccountExternalSignalWebhookRotationController } from './controllers/account-external-signal-webhook-rotation.controller'
import { AccountExternalSignalWebhooksController } from './controllers/account-external-signal-webhooks.controller'
import { PublicExternalSignalWebhookController } from './controllers/public-external-signal-webhook.controller'
import { ExternalSignalWebhooksRepository } from './repositories/external-signal-webhooks.repository'
import { ExternalSignalWebhookSignatureService } from './services/external-signal-webhook-signature.service'
import { ExternalSignalWebhooksService } from './services/external-signal-webhooks.service'

@Module({
  imports: [ThrottlerModule.forRoot()],
  controllers: [
    AccountExternalSignalWebhooksController,
    AccountExternalSignalWebhookRotationController,
    PublicExternalSignalWebhookController,
  ],
  providers: [
    AccountStrategyCallerIdentityService,
    ConfigCryptoService,
    ExternalSignalWebhooksRepository,
    ExternalSignalWebhookSignatureService,
    ExternalSignalWebhooksService,
  ],
})
export class ExternalSignalWebhooksModule {}
