/* eslint-disable ts/consistent-type-imports -- NestJS 装饰器需要运行时导入以保留类型元数据 */
import { Body, Controller, Get, Headers, Param, Post } from '@nestjs/common'
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger'
import { Auth } from '@/modules/auth/decorators/access-control.decorator'
import { AiQuantProxyService } from './ai-quant-proxy.service'
import { LlmCodegenContinueRequestDto } from './dto/llm-codegen-continue.request.dto'
import { LlmCodegenStartRequestDto } from './dto/llm-codegen-start.request.dto'

@ApiTags('llm-strategy-codegen')
@ApiBearerAuth('bearer')
@Auth()
@Controller('llm-strategy-codegen')
export class LlmStrategyCodegenController {
  constructor(
    private readonly service: AiQuantProxyService,
  ) {}

  @Post('sessions')
  async startSession(
    @Headers('authorization') authorization: string | undefined,
    @Body() dto: LlmCodegenStartRequestDto,
  ): Promise<unknown> {
    return this.service.startCodegen(authorization, {
      initialMessage: dto.initialMessage,
      symbols: dto.symbols,
      timeframes: dto.timeframes,
      entryRules: dto.entryRules,
      exitRules: dto.exitRules,
      riskRules: dto.riskRules,
      guideConfig: dto.guideConfig,
    })
  }

  @Get('sessions/:id')
  async getSession(
    @Headers('authorization') authorization: string | undefined,
    @Param('id') id: string,
  ): Promise<unknown> {
    return this.service.getCodegenSession(authorization, id)
  }

  @Post('sessions/:id/messages')
  async continueSession(
    @Headers('authorization') authorization: string | undefined,
    @Param('id') id: string,
    @Body() dto: LlmCodegenContinueRequestDto,
  ): Promise<unknown> {
    return this.service.continueCodegen(authorization, id, {
      message: dto.message,
      symbols: dto.symbols,
      timeframes: dto.timeframes,
      entryRules: dto.entryRules,
      exitRules: dto.exitRules,
      riskRules: dto.riskRules,
      guideConfig: dto.guideConfig,
      confirmGenerate: dto.confirmGenerate,
      confirmedCanonicalDigest: dto.confirmedCanonicalDigest,
      providerCode: dto.providerCode,
      model: dto.model,
      temperature: dto.temperature,
      maxTokens: dto.maxTokens,
    })
  }
}
