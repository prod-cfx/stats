import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'
import { IsIn, IsOptional, IsString, MinLength } from 'class-validator'

export class RunStrategyPlazaTemplateDto {
  @ApiProperty({ description: '幂等运行请求 ID' })
  @IsString()
  @MinLength(8)
  runRequestId!: string

  @ApiPropertyOptional({ description: '部署模式；默认 TESTNET，LIVE 需要传主网 OKX 账户 ID', enum: ['TESTNET', 'LIVE'] })
  @IsOptional()
  @IsIn(['TESTNET', 'LIVE'])
  mode?: 'TESTNET' | 'LIVE'

  @ApiPropertyOptional({ description: 'LIVE 部署使用的用户 OKX 主网账户 ID' })
  @IsOptional()
  @IsString()
  exchangeAccountId?: string
}
