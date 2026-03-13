import { ApiPropertyOptional } from '@nestjs/swagger'
import { Type } from 'class-transformer'
import { IsBoolean, IsNotEmpty, IsOptional, IsString } from 'class-validator'

export class AccountDetailQueryDto {
  @ApiPropertyOptional({
    description: '业务用户 ID',
    example: 'usr_123',
  })
  @IsString()
  @IsNotEmpty()
  userId!: string

  @ApiPropertyOptional({
    description: '是否包含最新日度收益',
    example: true,
  })
  @Type(() => Boolean)
  @IsOptional()
  @IsBoolean()
  withDailyStats?: boolean
}


