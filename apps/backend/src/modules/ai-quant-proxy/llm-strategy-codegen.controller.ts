/* eslint-disable ts/consistent-type-imports -- NestJS 装饰器需要运行时导入以保留类型元数据 */
import { Body, Controller, Get, Headers, HttpCode, HttpStatus, Param, Post } from '@nestjs/common'
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger'
import { Auth } from '@/modules/auth/decorators/access-control.decorator'
import { CurrentUser } from '@/modules/auth/decorators/current-user.decorator'
import { AiQuantProxyService } from './ai-quant-proxy.service'
import { CodegenSessionResponseDto } from './dto/codegen-session.response.dto'
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
  @ApiOperation({ summary: 'Create an AI Quant codegen session through the backend proxy' })
  @ApiResponse({ status: 201, type: CodegenSessionResponseDto })
  async startSession(
    @CurrentUser('id') userId: string,
    @Headers('authorization') authorization: string | undefined,
    @Body() dto: LlmCodegenStartRequestDto,
  ): Promise<CodegenSessionResponseDto> {
    return this.service.startCodegen(userId, authorization, {
      initialMessage: dto.initialMessage,
      guideConfig: dto.guideConfig,
    })
  }

  @Get('sessions/:id')
  @ApiOperation({ summary: 'Get an AI Quant codegen session through the backend proxy' })
  @ApiResponse({ status: 200, type: CodegenSessionResponseDto })
  async getSession(
    @CurrentUser('id') userId: string,
    @Headers('authorization') authorization: string | undefined,
    @Param('id') id: string,
  ): Promise<CodegenSessionResponseDto> {
    return this.service.getCodegenSession(userId, authorization, id)
  }

  @Post('sessions/:id/messages')
  @HttpCode(HttpStatus.ACCEPTED)
  @ApiOperation({ summary: 'Continue an AI Quant codegen session through the backend proxy' })
  @ApiResponse({ status: 202, type: CodegenSessionResponseDto })
  async continueSession(
    @CurrentUser('id') userId: string,
    @Headers('authorization') authorization: string | undefined,
    @Param('id') id: string,
    @Body() dto: LlmCodegenContinueRequestDto,
  ): Promise<CodegenSessionResponseDto> {
    return this.service.continueCodegen(userId, authorization, id, {
      message: dto.message,
      clarificationAnswers: dto.clarificationAnswers,
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
