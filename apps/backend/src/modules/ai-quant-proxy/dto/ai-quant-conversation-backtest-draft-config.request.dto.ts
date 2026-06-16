import { ApiProperty } from '@nestjs/swagger'
import { IsDefined, IsObject } from 'class-validator'
import {
  AiQuantConversationBacktestConfigResponseDto,
} from './ai-quant-conversation.response.dto'

export class AiQuantConversationBacktestDraftConfigRequestDto {
  @ApiProperty({ type: AiQuantConversationBacktestConfigResponseDto })
  @IsDefined()
  @IsObject()
  backtestDraftConfig!: AiQuantConversationBacktestConfigResponseDto
}
