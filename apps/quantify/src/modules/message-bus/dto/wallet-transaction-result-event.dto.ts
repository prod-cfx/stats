import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'
import { IsBoolean, IsOptional, IsString } from 'class-validator'

export class WalletTxnResultDto {
  @ApiProperty({ description: '提现请求ID' })
  @IsString()
  requestId!: string

  @ApiProperty({ description: '处理是否成功' })
  @IsBoolean()
  ok!: boolean

  @ApiPropertyOptional({ description: '交易ID' })
  @IsString()
  @IsOptional()
  transactionId?: string

  @ApiPropertyOptional({ description: '失败原因' })
  @IsString()
  @IsOptional()
  reason?: string
}
