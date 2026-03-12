import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'
import { IsNotEmpty, IsOptional, IsString, Length, Matches } from 'class-validator'

export class CreateStrategyAccountDto {
  @ApiProperty({
    description: '涓氬姟鐢ㄦ埛 ID',
    example: 'usr_123',
  })
  @IsString()
  @IsNotEmpty()
  userId!: string

  @ApiProperty({
    description: '绛栫暐鍞竴鏍囪瘑',
    example: 'strategy-grid-btc',
  })
  @IsString()
  @IsNotEmpty()
  strategyId!: string

  @ApiPropertyOptional({
    description: '绛栫暐鍚嶇О锛堢敤浜庡啑浣欏睍绀猴級',
    example: 'BTC 缃戞牸绛栫暐',
  })
  @IsOptional()
  @IsString()
  @Length(1, 120)
  strategyName?: string

  @ApiPropertyOptional({
    description: '绛栫暐鐗堟湰/鍙戣鍙?,
    example: 'v2025.11',
  })
  @IsOptional()
  @IsString()
  @Length(1, 64)
  strategyVersion?: string

  @ApiProperty({
    description: '璁′环璐у竵',
    example: 'USDT',
  })
  @IsString()
  @Matches(/^[A-Z0-9]{2,10}$/)
  baseCurrency!: string

  @ApiProperty({
    description: '鍒濆璧勯噾',
    example: '1000.00',
  })
  @Matches(/^-?\d+(\.\d+)?$/, { message: 'initialBalance 蹇呴』鏄暟瀛楀瓧绗︿覆' })
  initialBalance!: string
}
