import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'
import { IsISO8601, IsNumber, IsOptional, IsString, Min } from 'class-validator'

export class WithdrawRequestedDto {
  @ApiProperty({ description: '提现请求ID（幂等/关联）' })
  @IsString()
  requestId!: string

  @ApiProperty({ description: '用户ID' })
  @IsString()
  userId!: string

  @ApiPropertyOptional({ description: '钱包ID' })
  @IsString()
  @IsOptional()
  walletId?: string

  @ApiPropertyOptional({ description: '资产类型ID' })
  @IsString()
  @IsOptional()
  assetTypeId?: string

  @ApiPropertyOptional({ description: '资产类型编码' })
  @IsString()
  @IsOptional()
  assetTypeCode?: string

  @ApiProperty({ description: '提现金额' })
  @IsNumber()
  @Min(0)
  amount!: number

  @ApiPropertyOptional({ description: '原因/备注' })
  @IsString()
  @IsOptional()
  reason?: string

  @ApiPropertyOptional({ description: '额外元数据（Json 字符串化后入库）' })
  @IsOptional()
  metadata?: any

  @ApiProperty({ description: '唯一幂等ID（建议=请求ID）' })
  @IsString()
  uniqueId!: string

  @ApiPropertyOptional({ description: '事件时间（ISO）' })
  @IsISO8601()
  @IsOptional()
  timestamp?: string

  @ApiPropertyOptional({ description: '来源/渠道标识' })
  @IsString()
  @IsOptional()
  source?: string
}
