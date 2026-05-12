import type { Request } from 'express'
import { Body, Controller, Headers, HttpCode, HttpStatus, Param, Post, Req } from '@nestjs/common'
import { ApiHeader, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger'
import { ExternalSignalWebhookAcceptedResponseDto } from '../dto/external-signal-webhook-subscription.dto'
import { ExternalSignalWebhooksService } from '../services/external-signal-webhooks.service'

interface RawBodyRequest extends Request {
  rawBody?: Buffer
}

@ApiTags('public/external-signal-webhooks')
@Controller('webhook/strategy/:strategyInstanceId/signal')
export class PublicExternalSignalWebhookController {
  constructor(private readonly service: ExternalSignalWebhooksService) {}

  @Post()
  @HttpCode(HttpStatus.ACCEPTED)
  @ApiOperation({ summary: '接收签名外部信号 webhook' })
  @ApiHeader({ name: 'x-external-signal-timestamp', required: true })
  @ApiHeader({ name: 'x-external-signal-signature', required: true })
  @ApiOkResponse({ type: ExternalSignalWebhookAcceptedResponseDto })
  async accept(
    @Param('strategyInstanceId') strategyInstanceId: string,
    @Body() payload: unknown,
    @Headers('x-external-signal-timestamp') timestamp: string | undefined,
    @Headers('x-external-signal-signature') signature: string | undefined,
    @Req() request: RawBodyRequest,
  ): Promise<ExternalSignalWebhookAcceptedResponseDto> {
    return this.service.acceptPublicWebhook({
      strategyInstanceId,
      payload,
      rawBody: request.rawBody ?? Buffer.from(JSON.stringify(payload ?? {}), 'utf8'),
      timestamp,
      signature,
      request,
    })
  }
}
