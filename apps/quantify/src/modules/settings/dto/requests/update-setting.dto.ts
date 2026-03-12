import type { SettingValue } from '@ai/shared'
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'
import { IsBoolean, IsNotEmpty, IsOptional, IsString } from 'class-validator'

export class UpdateSettingDto {
  @ApiProperty({
    description: '閰嶇疆鍊硷紙鍙互鏄瓧绗︿覆銆佹暟瀛椼€佸竷灏斿€兼垨JSON瀵硅薄锛?,
    example: 'New Value',
    oneOf: [
      { type: 'string' },
      { type: 'number' },
      { type: 'boolean' },
      { type: 'object' },
      { type: 'array' },
    ],
  })
  @IsNotEmpty()
    value!: SettingValue

  @ApiPropertyOptional({
    description: '鍊肩被鍨?,
    example: 'string',
    enum: ['string', 'number', 'boolean', 'json'],
  })
  @IsString()
  @IsOptional()
    type?: string

  @ApiPropertyOptional({ description: '閰嶇疆鎻忚堪', example: '鏇存柊鍚庣殑鎻忚堪' })
  @IsString()
  @IsOptional()
    description?: string

  @ApiPropertyOptional({ description: '閰嶇疆鍒嗙被', example: 'general' })
  @IsString()
  @IsOptional()
    category?: string

  @ApiPropertyOptional({ description: '鏄惁绯荤粺閰嶇疆', example: false })
  @IsBoolean()
  @IsOptional()
    isSystem?: boolean
}
