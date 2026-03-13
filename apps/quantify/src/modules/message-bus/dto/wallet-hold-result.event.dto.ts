import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'
import { IsBoolean, IsOptional, IsString } from 'class-validator'

export class WalletHoldResultDto {
  @ApiProperty({ description: '提现请求ID' })
  @IsString()
  requestId!: string

  @ApiProperty({ description: '是否成功' })
  @IsBoolean()
  ok!: boolean

  @ApiPropertyOptional({ description: '冻结记录ID' })
  @IsString()
  @IsOptional()
  holdId?: string

  @ApiPropertyOptional({ description: '失败原因' })
  @IsString()
  @IsOptional()
  reason?: string
}
