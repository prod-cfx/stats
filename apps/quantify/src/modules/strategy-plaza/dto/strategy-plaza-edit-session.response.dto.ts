import { ApiProperty } from '@nestjs/swagger'

export class StrategyPlazaEditSessionResponseDto {
  @ApiProperty()
  sessionId!: string

  @ApiProperty()
  templateId!: string

  @ApiProperty()
  initialMessage!: string
}
