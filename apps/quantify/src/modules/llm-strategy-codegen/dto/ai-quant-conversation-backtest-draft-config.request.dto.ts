import { ApiProperty } from '@nestjs/swagger'
import {
  AiQuantConversationBacktestConfigDto,
} from './ai-quant-conversation.response.dto'

export class AiQuantConversationBacktestDraftConfigRequestDto {
  @ApiProperty({ type: AiQuantConversationBacktestConfigDto })
  backtestDraftConfig!: AiQuantConversationBacktestConfigDto
}
