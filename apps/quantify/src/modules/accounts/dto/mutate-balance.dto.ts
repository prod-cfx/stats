import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'
import { IsOptional, IsString, Matches, MaxLength } from 'class-validator'

export class MutateBalanceDto {
  @ApiProperty({
    description: '业务用户 ID',
    example: 'usr_123',
  })
  @IsString()
  @MaxLength(128)
  userId!: string

  @ApiProperty({
    description: '金额（正数）',
    example: '500.00',
  })
  @Matches(/^\d+(\.\d+)?$/, { message: 'amount 必须是正数' })
  amount!: string

  @ApiPropertyOptional({
    description: '外部引用 ID（幂等校验）',
    example: 'deposit-20251118-01',
  })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  referenceId?: string

  @ApiPropertyOptional({
    description: '备注描述',
    example: '用户充值',
  })
  @IsOptional()
  @IsString()
  @MaxLength(256)
  description?: string
}


