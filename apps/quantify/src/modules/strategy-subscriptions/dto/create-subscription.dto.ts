import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'
import { IsNotEmpty, IsObject, IsOptional, IsString } from 'class-validator'

export class CreateSubscriptionDto {
  @ApiProperty({ description: '业务用户 ID' })
  @IsString()
  @IsNotEmpty()
  userId!: string

  @ApiProperty({ description: '策略实例 ID' })
  @IsString()
  @IsNotEmpty()
  strategyInstanceId!: string

  @ApiPropertyOptional({ description: '关联的交易所账户 ID' })
  @IsString()
  @IsNotEmpty()
  @IsOptional()
  exchangeAccountId?: string

  @ApiPropertyOptional({ description: '自定义参数 JSON' })
  @IsObject()
  @IsOptional()
  customParams?: Record<string, unknown>
}
