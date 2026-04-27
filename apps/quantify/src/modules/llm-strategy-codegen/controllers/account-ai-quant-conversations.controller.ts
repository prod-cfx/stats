/* eslint-disable ts/consistent-type-imports -- NestJS 装饰器需要运行时导入以保留类型元数据 */
import { Body, Controller, Delete, Get, Headers, Param, Patch, Post, Query } from '@nestjs/common'
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger'
import { AiQuantConversationBacktestDraftConfigRequestDto } from '../dto/ai-quant-conversation-backtest-draft-config.request.dto'
import { AiQuantConversationResponseDto } from '../dto/ai-quant-conversation.response.dto'
import { RecoverAiQuantEditConversationRequestDto } from '../dto/recover-ai-quant-edit-conversation.request.dto'
import { CallerIdentityService } from '../services/caller-identity.service'
import { CodegenConversationService } from '../services/codegen-conversation.service'

@ApiTags('account-ai-quant')
@Controller('account/ai-quant/conversations')
export class AccountAiQuantConversationsController {
  constructor(
    private readonly service: CodegenConversationService,
    private readonly callerIdentityService: CallerIdentityService,
  ) {}

  @Get()
  @ApiOperation({ summary: '列出当前用户的 AI Quant 会话' })
  @ApiResponse({ status: 200, type: [AiQuantConversationResponseDto] })
  async list(
    @Headers('authorization') authorization: string | undefined,
    @Headers('x-user-id') forwardedUserId: string | undefined,
  ): Promise<AiQuantConversationResponseDto[]> {
    const callerUserId = await this.callerIdentityService.resolveCallerUserIdFromAuthorization(authorization, forwardedUserId)
    return this.service.listConversations(callerUserId)
  }

  @Post('edit-session')
  @ApiOperation({ summary: '恢复或创建 AI Quant 修改会话' })
  @ApiResponse({ status: 200, type: AiQuantConversationResponseDto })
  async recoverEditSession(
    @Headers('authorization') authorization: string | undefined,
    @Headers('x-user-id') forwardedUserId: string | undefined,
    @Body() body: RecoverAiQuantEditConversationRequestDto,
  ): Promise<AiQuantConversationResponseDto> {
    const callerUserId = await this.callerIdentityService.resolveCallerUserIdFromAuthorization(authorization, forwardedUserId)
    return this.service.recoverEditConversation(callerUserId, body)
  }

  @Delete(':id')
  @ApiOperation({ summary: '删除当前用户的 AI Quant 会话' })
  async remove(
    @Headers('authorization') authorization: string | undefined,
    @Headers('x-user-id') forwardedUserId: string | undefined,
    @Param('id') id: string,
    @Query('deleteStoppedStrategy') deleteStoppedStrategy?: string,
  ): Promise<void> {
    const callerUserId = await this.callerIdentityService.resolveCallerUserIdFromAuthorization(authorization, forwardedUserId)
    return this.service.deleteConversation(id, callerUserId, {
      deleteStoppedStrategy: deleteStoppedStrategy === 'true',
    })
  }

  @Patch(':id/backtest-draft')
  @ApiOperation({ summary: '更新当前用户会话的回测草稿配置' })
  async updateBacktestDraft(
    @Headers('authorization') authorization: string | undefined,
    @Headers('x-user-id') forwardedUserId: string | undefined,
    @Param('id') id: string,
    @Body() body: AiQuantConversationBacktestDraftConfigRequestDto,
  ): Promise<void> {
    const callerUserId = await this.callerIdentityService.resolveCallerUserIdFromAuthorization(authorization, forwardedUserId)
    return this.service.updateConversationBacktestDraft(id, callerUserId, body.backtestDraftConfig)
  }
}
