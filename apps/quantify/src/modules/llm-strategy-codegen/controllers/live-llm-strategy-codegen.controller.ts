/* eslint-disable ts/consistent-type-imports -- NestJS 装饰器需要运行时导入以保留类型元数据 */
import { Body, Controller, HttpCode, Param, Post } from '@nestjs/common'
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger'

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
  async testEngine(@Body() dto: TestLlmCodegenEngineDto): Promise<LlmCodegenEngineTestResponseDto> {
    return this.service.testEngine(dto)
  }
}
