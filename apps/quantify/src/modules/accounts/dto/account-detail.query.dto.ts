import { ApiPropertyOptional } from '@nestjs/swagger'
import { Type } from 'class-transformer'
import { IsBoolean, IsNotEmpty, IsOptional, IsString } from 'class-validator'

export class AccountDetailQueryDto {
  @ApiPropertyOptional({
    description: '涓氬姟鐢ㄦ埛 ID',
    example: 'usr_123',
  })
  @IsString()
  @IsNotEmpty()
  userId!: string

  @ApiPropertyOptional({
    description: '鏄惁鍖呭惈鏈€鏂版棩搴︽敹鐩?,
    example: true,
  })
  @Type(() => Boolean)
  @IsOptional()
  @IsBoolean()
  withDailyStats?: boolean
}
