import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'

export class CodegenSessionResponseDto {
  @ApiProperty({ description: '浼氳瘽 ID' })
  id!: string

  @ApiProperty({
    description: '浼氳瘽鐘舵€?,
    enum: ['DRAFTING', 'CHECKLIST_GATE', 'GENERATING', 'VALIDATING_STATIC', 'VALIDATING_RUNTIME', 'VALIDATING_OUTPUT', 'PUBLISHED', 'REJECTED'],
  })
  status!: string

  @ApiPropertyOptional({ description: '缂哄け瀛楁鍒楄〃', type: [String] })
  missingFields?: string[]

  @ApiPropertyOptional({ description: '鏈€缁堢敓鎴愯剼鏈? })
  scriptCode?: string | null

  @ApiPropertyOptional({ description: '缁撴瀯鍖栫瓥鐣ユ弿杩帮紙鐢ㄤ簬鎺ㄨ崘锛?, type: 'object', additionalProperties: true })
  specDesc?: Record<string, unknown> | null

  @ApiPropertyOptional({ description: '鎷掔粷鍘熷洜' })
  rejectReason?: string | null

  @ApiPropertyOptional({ description: '寮曞鎻愮ず' })
  assistantPrompt?: string
}
