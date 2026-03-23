/* eslint-disable ts/consistent-type-imports -- NestJS 装饰器需要运行时导入以保留类型元数据 */
import { timingSafeEqual } from 'node:crypto'
import { ErrorCode } from '@ai/shared'
import { Body, Controller, Get, Headers, HttpCode, HttpStatus, Param, Post } from '@nestjs/common'
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger'
import { DomainException } from '@/common/exceptions/domain.exception'
import { EnvService } from '@/common/services/env.service'

import { CodegenSessionResponseDto } from '../dto/codegen-session.response.dto'
import { ContinueCodegenSessionDto } from '../dto/continue-codegen-session.dto'
import { LlmCodegenEngineTestResponseDto } from '../dto/llm-codegen-engine-test.response.dto'
import { StartCodegenSessionDto } from '../dto/start-codegen-session.dto'
import { TestLlmCodegenEngineDto } from '../dto/test-llm-codegen-engine.dto'
import { CallerIdentityService } from '../services/caller-identity.service'
import { CodegenConversationService } from '../services/codegen-conversation.service'

@ApiTags('llm-strategy-codegen')
@Controller('llm-strategy-codegen')
export class LiveLlmStrategyCodegenController {
  constructor(
    private readonly service: CodegenConversationService,
    private readonly callerIdentityService: CallerIdentityService,
    private readonly env: EnvService,
  ) {}

  @Post('sessions')
  @ApiOperation({ summary: '创建策略代码生成会话' })
  @ApiResponse({ status: 201, type: CodegenSessionResponseDto })
  async startSession(
    @Headers('authorization') authorization: string | undefined,
    @Body() dto: StartCodegenSessionDto,
  ): Promise<CodegenSessionResponseDto> {
    const callerUserId = this.callerIdentityService.resolveCallerUserIdFromAuthorization(authorization)
    return this.service.startSession(dto, callerUserId)
  }

  @Post('sessions/:id/messages')
  @ApiOperation({ summary: '继续会话并在信息齐全时生成策略脚本' })
  @ApiResponse({ status: 200, type: CodegenSessionResponseDto })
  async continueSession(
    @Headers('authorization') authorization: string | undefined,
    @Param('id') id: string,
    @Body() dto: ContinueCodegenSessionDto,
  ): Promise<CodegenSessionResponseDto> {
    const callerUserId = this.callerIdentityService.resolveCallerUserIdFromAuthorization(authorization)
    return this.service.continueSession(id, dto, callerUserId)
  }

  @Get('sessions/:id')
  @ApiOperation({ summary: '查询策略代码生成会话状态' })
  @ApiResponse({ status: 200, type: CodegenSessionResponseDto })
  async getSession(
    @Param('id') id: string,
    @Headers('authorization') authorization: string | undefined,
  ): Promise<CodegenSessionResponseDto> {
    const callerUserId = this.callerIdentityService.resolveCallerUserIdFromAuthorization(authorization)
    return this.service.getSession(id, callerUserId)
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
    const configuredToken = this.env.getString('APP_SECRET')?.trim()
    if (!configuredToken) {
      throw new DomainException('codegen.app_secret_not_configured', {
        code: ErrorCode.UNAUTHORIZED,
        status: HttpStatus.UNAUTHORIZED,
      })
    }
    if (!this.isValidEngineTestToken(engineTestToken, configuredToken)) {
      throw new DomainException('codegen.invalid_engine_test_token', {
        code: ErrorCode.UNAUTHORIZED,
        status: HttpStatus.UNAUTHORIZED,
      })
    }

    const normalizedCallerUserId = callerUserId?.trim()
    if (!normalizedCallerUserId) {
      throw new DomainException('codegen.missing_caller_identity', {
        code: ErrorCode.UNAUTHORIZED,
        status: HttpStatus.UNAUTHORIZED,
      })
    }
    if (normalizedCallerUserId !== dto.userId) {
      throw new DomainException('codegen.caller_user_id_mismatch', {
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

  private safeEqual(a: string, b: string): boolean {
    const left = Buffer.from(a)
    const right = Buffer.from(b)
    if (left.length !== right.length) {
      return false
    }
    return timingSafeEqual(left, right)
  }
}
