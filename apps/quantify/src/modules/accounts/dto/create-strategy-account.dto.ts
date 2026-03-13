import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'
import { IsNotEmpty, IsOptional, IsString, Length, Matches } from 'class-validator'

export class CreateStrategyAccountDto {
  @ApiProperty({
    description: '业务用户 ID',
    example: 'usr_123',
  })
  @IsString()
  @IsNotEmpty()
  userId!: string

  @ApiProperty({
    description: '策略唯一标识',
    example: 'strategy-grid-btc',
  })
  @IsString()
  @IsNotEmpty()
  strategyId!: string

  @ApiPropertyOptional({
    description: '策略名称（用于冗余展示）',
    example: 'BTC 网格策略',
  })
  @IsOptional()
  @IsString()
  @Length(1, 120)
  strategyName?: string

  @ApiPropertyOptional({
    description: '策略版本/发行号',
    example: 'v2025.11',
  })
  @IsOptional()
  @IsString()
  @Length(1, 64)
  strategyVersion?: string

  @ApiProperty({
    description: '计价货币',
    example: 'USDT',
  })
  @IsString()
  @Matches(/^[A-Z0-9]{2,10}$/)
  baseCurrency!: string

  @ApiProperty({
    description: '初始资金',
    example: '1000.00',
  })
  @Matches(/^-?\d+(\.\d+)?$/, { message: 'initialBalance 必须是数字字符串' })
  initialBalance!: string
}

