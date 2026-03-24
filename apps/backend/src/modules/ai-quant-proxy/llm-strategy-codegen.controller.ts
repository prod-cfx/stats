import type { LlmCodegenContinueRequestDto } from './dto/llm-codegen-continue.request.dto'
import type { LlmCodegenStartRequestDto } from './dto/llm-codegen-start.request.dto'
import type { AuthenticatedUser } from '@/common/types/authenticated-user.type'
import { Body, Controller, Param, Post } from '@nestjs/common'
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger'
import { Auth } from '@/modules/auth/decorators/access-control.decorator'
import { CurrentUser } from '@/modules/auth/decorators/current-user.decorator'
import { AiQuantProxyService } from './ai-quant-proxy.service'

@ApiTags('llm-strategy-codegen')
@ApiBearerAuth('bearer')
@Auth()
@Controller('llm-strategy-codegen')
export class LlmStrategyCodegenController {
  constructor(private readonly service: AiQuantProxyService) {}

  @Post('sessions')
  async startSession(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: LlmCodegenStartRequestDto,
  ): Promise<unknown> {
    return this.service.startCodegen(user, {
      initialMessage: dto.initialMessage,
      symbols: dto.symbols,
      timeframes: dto.timeframes,
      entryRules: dto.entryRules,
      exitRules: dto.exitRules,
      riskRules: dto.riskRules,
      guideConfig: dto.guideConfig,
    })
  }

  @Post('sessions/:id/messages')
  async continueSession(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: LlmCodegenContinueRequestDto,
  ): Promise<unknown> {
    return this.service.continueCodegen(user, id, {
      message: dto.message,
      symbols: dto.symbols,
      timeframes: dto.timeframes,
      entryRules: dto.entryRules,
      exitRules: dto.exitRules,
      riskRules: dto.riskRules,
      guideConfig: dto.guideConfig,
      confirmGenerate: dto.confirmGenerate,
      providerCode: dto.providerCode,
      model: dto.model,
      temperature: dto.temperature,
      maxTokens: dto.maxTokens,
    })
  }
}
