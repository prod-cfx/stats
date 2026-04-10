import type { AiQuantProxyService } from './ai-quant-proxy.service'
import { Controller, Get, Headers, Inject } from '@nestjs/common'
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger'
import { Auth } from '@/modules/auth/decorators/access-control.decorator'
import { CurrentUser } from '@/modules/auth/decorators/current-user.decorator'
import { AiQuantProxyService as AiQuantProxyServiceToken } from './ai-quant-proxy.service'
import { AiQuantConversationResponseDto } from './dto/ai-quant-conversation.response.dto'

@ApiTags('account-ai-quant')
@ApiBearerAuth('bearer')
@Auth()
@Controller('account/ai-quant/conversations')
export class AccountAiQuantConversationsController {
  constructor(
    @Inject(AiQuantProxyServiceToken)
    private readonly service: AiQuantProxyService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'List AI Quant conversations from the backend proxy facade' })
  @ApiResponse({ status: 200, type: [AiQuantConversationResponseDto] })
  async list(
    @CurrentUser('id') userId: string,
    @Headers('authorization') authorization: string | undefined,
  ): Promise<AiQuantConversationResponseDto[]> {
    return this.service.listAiQuantConversations(userId, authorization)
  }
}
