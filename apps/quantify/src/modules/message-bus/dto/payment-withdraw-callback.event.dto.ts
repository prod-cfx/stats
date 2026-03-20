import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'
import { IsBoolean, IsOptional, IsString } from 'class-validator'

export class WithdrawCallbackReceivedDto {
  @ApiProperty({ description: '提现请求ID' })
  @IsString()
  requestId!: string

  @ApiPropertyOptional({ description: '外部提现ID' })
  @IsString()
  @IsOptional()
  externalWithdrawId?: string

  @ApiProperty({
    description: '提供商回调状态',
    required: false,
    example: 'COMPLETED|FAILED|REJECTED|PROCESSING',
  })
  @IsString()
  @IsOptional()
  providerStatus?: string

  @ApiPropertyOptional({ description: '简化成功标识' })
  @IsBoolean()
  @IsOptional()
  ok?: boolean

  @ApiPropertyOptional({ description: '钱包ID' })
  @IsString()
  @IsOptional()
  walletId?: string

  @ApiPropertyOptional({ description: '资产类型ID' })
  @IsString()
  @IsOptional()
  assetTypeId?: string

  @ApiPropertyOptional({ description: '金额（字符串或数字）' })
  @IsOptional()
  amount?: any

  @ApiPropertyOptional({ description: '幂等唯一ID' })
  @IsString()
  @IsOptional()
  uniqueId?: string

  @ApiPropertyOptional({ description: '原始回调负载' })
  @IsOptional()
  raw?: any
}
