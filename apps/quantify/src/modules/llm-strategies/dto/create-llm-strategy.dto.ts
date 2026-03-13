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
  @ApiProperty({ description: '策略名称（唯一）', maxLength: 100 })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name!: string

  @ApiProperty({ description: '策略描述', maxLength: 1000 })
  @IsString()
  @IsNotEmpty()
  @MaxLength(1000)
  description!: string

  @ApiPropertyOptional({ description: '系统提示词，定义AI的角色和行为准则', maxLength: 10000 })
  @IsOptional()
  @IsString()
  @MaxLength(10000)
  systemPrompt?: string

  @ApiPropertyOptional({ description: '初始提示词模板，用于首次运行时的提示', maxLength: 10000 })
  @IsOptional()
  @IsString()
  @MaxLength(10000)
  initialPromptTemplate?: string

  @ApiPropertyOptional({
    description: '允许的交易对列表',
    type: [String],
    example: ['BTCUSDT', 'ETHUSDT'],
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  allowedSymbols?: string[]

  @ApiPropertyOptional({
    description: '允许的时间周期',
    type: [String],
    example: ['1m', '5m', '15m', '1h', '4h', '1d'],
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  allowedTimeframes?: string[]

  @ApiPropertyOptional({
    description: '风险配置参数',
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
    description: '额外元数据',
    type: 'object',
    additionalProperties: true,
  })
  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>

  @ApiPropertyOptional({ description: '创建人标识', example: 'system-operator' })
  @IsOptional()
  @IsString()
  createdBy?: string
}
