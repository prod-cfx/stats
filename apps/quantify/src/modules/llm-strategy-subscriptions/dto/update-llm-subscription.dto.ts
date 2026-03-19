import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'
import { IsIn, IsNotEmpty, IsObject, IsOptional, IsString, ValidateIf } from 'class-validator'

export class UpdateLlmSubscriptionDto {
  @ApiProperty({ description: '业务用户 ID', example: 'usr_123' })
  @IsString()
  @IsNotEmpty()
  userId!: string

  @ApiPropertyOptional({ description: '订阅状态', enum: ['active', 'paused', 'cancelled'] })
  @IsOptional()
  @IsIn(['active', 'paused', 'cancelled'])
  status?: 'active' | 'paused' | 'cancelled'

  @ApiPropertyOptional({
    description: '用户自定义参数（可选）',
    type: 'object',
    additionalProperties: true,
    nullable: true,
  })
  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsObject()
  customParams?: Record<string, unknown> | null

  @ApiPropertyOptional({ description: '绑定的交易所账户 ID（可选，若提供则必须非空字符串）', nullable: true })
  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsString()
  exchangeAccountId?: string | null
}
