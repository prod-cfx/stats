import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'
import { IsIn, IsNotEmpty, IsObject, IsOptional, IsString, ValidateIf } from 'class-validator'

export class UpdateLlmSubscriptionDto {
  @ApiProperty({ description: '涓氬姟鐢ㄦ埛 ID', example: 'usr_123' })
  @IsString()
  @IsNotEmpty()
  userId!: string

  @ApiPropertyOptional({ description: '璁㈤槄鐘舵€?, enum: ['active', 'paused', 'cancelled'] })
  @IsOptional()
  @IsIn(['active', 'paused', 'cancelled'])
  status?: 'active' | 'paused' | 'cancelled'

  @ApiPropertyOptional({
    description: '鐢ㄦ埛鑷畾涔夊弬鏁帮紙鍙€夛級',
    type: 'object',
    additionalProperties: true,
    nullable: true,
  })
  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsObject()
  customParams?: Record<string, unknown> | null

  @ApiPropertyOptional({ description: '缁戝畾鐨勪氦鏄撴墍璐︽埛 ID锛堝彲閫夛紝鑻ユ彁渚涘垯蹇呴』闈炵┖瀛楃涓诧級', nullable: true })
  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsString()
  exchangeAccountId?: string | null
}
