import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'
import {
  IsArray,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator'

export class CreateLlmStrategyDto {
  @ApiProperty({ description: '绛栫暐鍚嶇О锛堝敮涓€锛?, maxLength: 100 })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name!: string

  @ApiProperty({ description: '绛栫暐鎻忚堪', maxLength: 1000 })
  @IsString()
  @IsNotEmpty()
  @MaxLength(1000)
  description!: string

  @ApiPropertyOptional({ description: '绯荤粺鎻愮ず璇嶏紝瀹氫箟AI鐨勮鑹插拰琛屼负鍑嗗垯', maxLength: 10000 })
  @IsOptional()
  @IsString()
  @MaxLength(10000)
  systemPrompt?: string

  @ApiPropertyOptional({ description: '鍒濆鎻愮ず璇嶆ā鏉匡紝鐢ㄤ簬棣栨杩愯鏃剁殑鎻愮ず', maxLength: 10000 })
  @IsOptional()
  @IsString()
  @MaxLength(10000)
  initialPromptTemplate?: string

  @ApiPropertyOptional({
    description: '鍏佽鐨勪氦鏄撳鍒楄〃',
    type: [String],
    example: ['BTCUSDT', 'ETHUSDT'],
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  allowedSymbols?: string[]

  @ApiPropertyOptional({
    description: '鍏佽鐨勬椂闂村懆鏈?,
    type: [String],
    example: ['1m', '5m', '15m', '1h', '4h', '1d'],
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  allowedTimeframes?: string[]

  @ApiPropertyOptional({
    description: '椋庨櫓閰嶇疆鍙傛暟',
    type: 'object',
    additionalProperties: true,
    example: {
      maxPositionSize: 0.1,
      maxLeverage: 3,
      stopLossPercent: 0.02,
    },
  })
  @IsOptional()
  @IsObject()
  riskConfig?: Record<string, unknown>

  @ApiPropertyOptional({
    description: '棰濆鍏冩暟鎹?,
    type: 'object',
    additionalProperties: true,
  })
  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>

  @ApiPropertyOptional({ description: '鍒涘缓浜烘爣璇?, example: 'system-operator' })
  @IsOptional()
  @IsString()
  createdBy?: string
}
