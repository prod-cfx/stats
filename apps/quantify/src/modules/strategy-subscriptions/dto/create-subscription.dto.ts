import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'
import { IsNotEmpty, IsObject, IsOptional, IsString } from 'class-validator'

export class CreateSubscriptionDto {
  @ApiProperty({ description: '涓氬姟鐢ㄦ埛 ID' })
  @IsString()
  @IsNotEmpty()
  userId!: string

  @ApiProperty({ description: '绛栫暐瀹炰緥 ID' })
  @IsString()
  @IsNotEmpty()
  strategyInstanceId!: string

  @ApiPropertyOptional({ description: '鍏宠仈鐨勪氦鏄撴墍璐︽埛 ID' })
  @IsString()
  @IsNotEmpty()
  @IsOptional()
  exchangeAccountId?: string

  @ApiPropertyOptional({ description: '鑷畾涔夊弬鏁?JSON' })
  @IsObject()
  @IsOptional()
  customParams?: Record<string, unknown>
}
