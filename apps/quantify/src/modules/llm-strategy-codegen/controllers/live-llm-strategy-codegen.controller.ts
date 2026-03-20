/* eslint-disable ts/consistent-type-imports -- NestJS 装饰器需要运行时导入以保留类型元数据 */
import { timingSafeEqual } from 'node:crypto'
import { ErrorCode } from '@ai/shared'
import { Body, Controller, Headers, HttpCode, HttpStatus, Param, Post } from '@nestjs/common'
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger'
import { DomainException } from '@/common/exceptions/domain.exception'

import { CodegenSessionResponseDto } from '../dto/codegen-session.response.dto'
import { ContinueCodegenSessionDto } from '../dto/continue-codegen-session.dto'
import { LlmCodegenEngineTestResponseDto } from '../dto/llm-codegen-engine-test.response.dto'
import { StartCodegenSessionDto } from '../dto/start-codegen-session.dto'
import { TestLlmCodegenEngineDto } from '../dto/test-llm-codegen-engine.dto'
import { CodegenConversationService } from '../services/codegen-conversation.service'

@ApiTags('llm-strategy-codegen')
@Controller('llm-strategy-codegen')
export class LiveLlmStrategyCodegenController {
  constructor(private readonly service: CodegenConversationService) {}

  @Post('sessions')
  @ApiOperation({ summary: '创建策略代码生成会话' })
  @ApiResponse({ status: 201, type: CodegenSessionResponseDto })
  async startSession(@Body() dto: StartCodegenSessionDto): Promise<CodegenSessionResponseDto> {
    return this.service.startSession(dto)
  }

  @Post('sessions/:id/messages')
  @ApiOperation({ summary: '继续会话并在信息齐全时生成策略脚本' })
  @ApiResponse({ status: 200, type: CodegenSessionResponseDto })
  async continueSession(
    @Param('id') id: string,
    @Body() dto: ContinueCodegenSessionDto,
  ): Promise<CodegenSessionResponseDto> {
    return this.service.continueSession(id, dto)
  }

  @Post('engine/test')
  @HttpCode(200)
  @ApiOperation({ summary: '真实调用 LLM 引擎测试策略脚本生成能力' })
  @ApiResponse({ status: 200, type: LlmCodegenEngineTestResponseDto })
  async testEngine(
    @Headers('x-engine-test-token') engineTestToken: string | undefined,
    @Headers('x-user-id') callerUserId: string | undefined,
    @Body() dto: TestLlmCodegenEngineDto,
  ): Promise<LlmCodegenEngineTestResponseDto> {
    const configuredToken = process.env.APP_SECRET?.trim()
    if (!configuredToken) {
      throw new DomainException('服务端未配置 APP_SECRET，拒绝执行 engine/test', {
        code: ErrorCode.UNAUTHORIZED,
        status: HttpStatus.UNAUTHORIZED,
      })
    }
    if (!this.isValidEngineTestToken(engineTestToken, configuredToken)) {
      throw new DomainException('缺少或无效的 x-engine-test-token 调用凭证', {
        code: ErrorCode.UNAUTHORIZED,
        status: HttpStatus.UNAUTHORIZED,
      })
    }

    const normalizedCallerUserId = callerUserId?.trim()
    if (!normalizedCallerUserId) {
      throw new DomainException('缺少调用者身份，请提供 x-user-id 请求头', {
        code: ErrorCode.UNAUTHORIZED,
        status: HttpStatus.UNAUTHORIZED,
      })
    }
    if (normalizedCallerUserId !== dto.userId) {
      throw new DomainException('调用者身份与请求 userId 不一致', {
        code: ErrorCode.FORBIDDEN,
        status: HttpStatus.FORBIDDEN,
        args: { callerUserId: normalizedCallerUserId, requestUserId: dto.userId },
      })
    }

    return this.service.testEngine(dto)
  }

  private isValidEngineTestToken(providedToken: string | undefined, configuredToken: string): boolean {
    const normalizedToken = providedToken?.trim()
    if (!normalizedToken) {
      return false
    }
    const providedBuffer = Buffer.from(normalizedToken)
    const configuredBuffer = Buffer.from(configuredToken)
    if (providedBuffer.length !== configuredBuffer.length) {
      return false
    }
    return timingSafeEqual(providedBuffer, configuredBuffer)
  }
}
