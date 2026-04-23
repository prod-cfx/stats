import { ApiProperty } from '@nestjs/swagger'
import {
  AiQuantConversationBacktestConfigResponseDto,
} from './ai-quant-conversation.response.dto'

export class AiQuantConversationBacktestDraftConfigRequestDto {
  @ApiProperty({ type: AiQuantConversationBacktestConfigResponseDto })
  backtestDraftConfig!: AiQuantConversationBacktestConfigResponseDto
}
