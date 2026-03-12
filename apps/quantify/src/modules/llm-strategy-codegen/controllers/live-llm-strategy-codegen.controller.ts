/* eslint-disable ts/consistent-type-imports -- NestJS 瑁呴グ鍣ㄩ渶瑕佽繍琛屾椂瀵煎叆浠ヤ繚鐣欑被鍨嬪厓鏁版嵁 */
import { Body, Controller, Param, Post } from '@nestjs/common'
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger'

import { CodegenSessionResponseDto } from '../dto/codegen-session.response.dto'
import { ContinueCodegenSessionDto } from '../dto/continue-codegen-session.dto'
import { StartCodegenSessionDto } from '../dto/start-codegen-session.dto'
import { CodegenConversationService } from '../services/codegen-conversation.service'

@ApiTags('llm-strategy-codegen')
@Controller('llm-strategy-codegen')
export class LiveLlmStrategyCodegenController {
  constructor(private readonly service: CodegenConversationService) {}

  @Post('sessions')
  @ApiOperation({ summary: '鍒涘缓绛栫暐浠ｇ爜鐢熸垚浼氳瘽' })
  @ApiResponse({ status: 201, type: CodegenSessionResponseDto })
  async startSession(@Body() dto: StartCodegenSessionDto): Promise<CodegenSessionResponseDto> {
    return this.service.startSession(dto)
  }

  @Post('sessions/:id/messages')
  @ApiOperation({ summary: '缁х画浼氳瘽骞跺湪淇℃伅榻愬叏鏃剁敓鎴愮瓥鐣ヨ剼鏈? })
  @ApiResponse({ status: 200, type: CodegenSessionResponseDto })
  async continueSession(
    @Param('id') id: string,
    @Body() dto: ContinueCodegenSessionDto,
  ): Promise<CodegenSessionResponseDto> {
    return this.service.continueSession(id, dto)
  }
}
