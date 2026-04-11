/* eslint-disable ts/consistent-type-imports -- NestJS 装饰器需要运行时导入以保留类型元数据 */
import { Controller, Delete, Get, Headers, Param } from '@nestjs/common'
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger'
import { AiQuantConversationResponseDto } from '../dto/ai-quant-conversation.response.dto'
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

  @Delete(':id')
  @ApiOperation({ summary: '删除当前用户的 AI Quant 会话' })
  async remove(
    @Headers('authorization') authorization: string | undefined,
    @Headers('x-user-id') forwardedUserId: string | undefined,
    @Param('id') id: string,
  ): Promise<void> {
    const callerUserId = await this.callerIdentityService.resolveCallerUserIdFromAuthorization(authorization, forwardedUserId)
    return this.service.deleteConversation(id, callerUserId)
  }
}
