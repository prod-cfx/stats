import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'
import { IsNotEmpty, IsNumber, IsOptional, IsString, Min } from 'class-validator'

export class AccountStrategyUpdateExecutionLeverageDto {
  @ApiPropertyOptional({ description: '业务用户 ID（可由 x-user-id 注入）' })
  @IsOptional()
  @IsString()
  userId?: string

  @ApiProperty({ description: '新的部署杠杆倍数', example: 3 })
  @IsNumber()
  @Min(1)
  leverage!: number

  @ApiPropertyOptional({ description: '修改原因（审计/展示用）' })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  reason?: string
}
