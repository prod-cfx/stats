import { Body, Controller, Delete, Get, Headers, Inject, Param, Patch } from '@nestjs/common'
import { ApiBearerAuth, ApiBody, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger'
import { Auth } from '@/modules/auth/decorators/access-control.decorator'
import { CurrentUser } from '@/modules/auth/decorators/current-user.decorator'
import { AiQuantProxyService } from './ai-quant-proxy.service'
import { AiQuantConversationBacktestDraftConfigRequestDto } from './dto/ai-quant-conversation-backtest-draft-config.request.dto'
import { AiQuantConversationResponseDto } from './dto/ai-quant-conversation.response.dto'

@ApiTags('account-ai-quant')
@ApiBearerAuth('bearer')
@Auth()
@Controller('account/ai-quant/conversations')
export class AccountAiQuantConversationsController {
  constructor(
    @Inject(AiQuantProxyService)
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

  @Delete(':id')
  async remove(
    @CurrentUser('id') userId: string,
    @Headers('authorization') authorization: string | undefined,
    @Param('id') id: string,
  ): Promise<void> {
    return this.service.deleteAiQuantConversation(userId, authorization, id)
  }

  @Patch(':id/backtest-draft')
  @ApiBody({ type: AiQuantConversationBacktestDraftConfigRequestDto })
  async updateBacktestDraft(
    @CurrentUser('id') userId: string,
    @Headers('authorization') authorization: string | undefined,
    @Param('id') id: string,
    @Body() body: AiQuantConversationBacktestDraftConfigRequestDto,
  ): Promise<void> {
    return this.service.updateAiQuantConversationBacktestDraft(
      userId,
      authorization,
      id,
      body as unknown as Record<string, unknown>,
    )
  }
}
