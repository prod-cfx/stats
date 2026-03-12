import type { LlmStrategyInstanceMode, LlmStrategyInstanceStatus } from '@prisma/client'
import { ApiPropertyOptional } from '@nestjs/swagger'
import {
  IsEnum,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  ValidateIf,
} from 'class-validator'

export class UpdateLlmStrategyInstanceDto {
  @ApiPropertyOptional({ description: '瀹炰緥鍚嶇О', maxLength: 100 })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  name?: string

  @ApiPropertyOptional({ description: '瀹炰緥鐘舵€?, enum: ['running', 'paused', 'stopped'] })
  @IsOptional()
  @IsEnum(['running', 'paused', 'stopped'])
  status?: LlmStrategyInstanceStatus

  @ApiPropertyOptional({ description: '杩愯妯″紡', enum: ['LIVE', 'PAPER', 'BACKTEST'] })
  @IsOptional()
  @IsEnum(['LIVE', 'PAPER', 'BACKTEST'])
  mode?: LlmStrategyInstanceMode

  @ApiPropertyOptional({ description: '浣跨敤鐨凩LM妯″瀷鍚嶇О', maxLength: 100 })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  llmModel?: string

  @ApiPropertyOptional({ description: '璋冨害cron琛ㄨ揪寮?, maxLength: 100 })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  scheduleCron?: string

  @ApiPropertyOptional({ description: '姣忔杩愯鏈€澶у伐鍏疯皟鐢ㄦ鏁?, minimum: 1, maximum: 100, nullable: true })
  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsInt()
  @Min(1)
  @Max(100)
  maxToolCallsPerRun?: number | null

  @ApiPropertyOptional({ description: '姣忓皬鏃舵渶澶ц繍琛屾鏁?, minimum: 1, maximum: 60, nullable: true })
  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsInt()
  @Min(1)
  @Max(60)
  maxRunsPerHour?: number | null

  @ApiPropertyOptional({ description: '鍐峰嵈鏃堕棿锛堢锛?, minimum: 0, maximum: 86400, nullable: true })
  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsInt()
  @Min(0)
  @Max(86400)
  cooldownSeconds?: number | null

  @ApiPropertyOptional({
    description: '閰嶇疆瑕嗙洊鍙傛暟',
    type: 'object',
    additionalProperties: true,
    nullable: true,
  })
  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsObject()
  configOverrides?: Record<string, unknown> | null

  @ApiPropertyOptional({
    description: '棰濆鍏冩暟鎹?,
    type: 'object',
    additionalProperties: true,
    nullable: true,
  })
  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsObject()
  metadata?: Record<string, unknown> | null

  @ApiPropertyOptional({ description: '鏇存柊浜烘爣璇?, example: 'system-operator' })
  @IsOptional()
  @IsString()
  updatedBy?: string
}
