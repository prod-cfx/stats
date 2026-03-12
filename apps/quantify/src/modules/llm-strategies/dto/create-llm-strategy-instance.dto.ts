import type { LlmStrategyInstanceMode } from '@prisma/client'
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'
import {
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator'

export class CreateLlmStrategyInstanceDto {
  @ApiProperty({ description: '鎵€灞濴LM绛栫暐ID' })
  @IsString()
  @IsNotEmpty()
  strategyId!: string

  @ApiProperty({ description: '瀹炰緥鍚嶇О锛堝湪鍚屼竴绛栫暐涓嬪敮涓€锛?, maxLength: 100 })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name!: string

  @ApiProperty({ description: '杩愯妯″紡', enum: ['LIVE', 'PAPER', 'BACKTEST'] })
  @IsEnum(['LIVE', 'PAPER', 'BACKTEST'])
  mode!: LlmStrategyInstanceMode

  @ApiProperty({ description: '浣跨敤鐨凩LM妯″瀷鍚嶇О', maxLength: 100 })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  llmModel!: string

  @ApiPropertyOptional({ description: '璋冨害cron琛ㄨ揪寮?, maxLength: 100 })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  scheduleCron?: string

  @ApiPropertyOptional({ description: '姣忔杩愯鏈€澶у伐鍏疯皟鐢ㄦ鏁?, minimum: 1, maximum: 100 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100)
  maxToolCallsPerRun?: number

  @ApiPropertyOptional({ description: '姣忓皬鏃舵渶澶ц繍琛屾鏁?, minimum: 1, maximum: 60 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(60)
  maxRunsPerHour?: number

  @ApiPropertyOptional({ description: '鍐峰嵈鏃堕棿锛堢锛?, minimum: 0, maximum: 86400 })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(86400)
  cooldownSeconds?: number

  @ApiPropertyOptional({
    description: '閰嶇疆瑕嗙洊鍙傛暟',
    type: 'object',
    additionalProperties: true,
  })
  @IsOptional()
  @IsObject()
  configOverrides?: Record<string, unknown>

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
