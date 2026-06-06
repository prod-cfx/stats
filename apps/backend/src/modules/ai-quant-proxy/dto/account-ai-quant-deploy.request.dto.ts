import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'
import { IsNotEmpty, IsObject, IsOptional, IsString } from 'class-validator'

export class AccountAiQuantDeployRequestDto {
  @ApiProperty({ description: '部署后的策略实例名称', example: '我的实盘策略' })
  @IsString()
  @IsNotEmpty()
  name!: string

  @ApiProperty({ description: '部署请求幂等 ID（前端点击一次生成一次）' })
  @IsString()
  @IsNotEmpty()
  deployRequestId!: string

  @ApiProperty({ description: 'Published snapshot that owns the runtime settings' })
  @IsString()
  @IsNotEmpty()
  publishedSnapshotId!: string

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  exchangeAccountId?: string

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  exchangeAccountName?: string

  @ApiPropertyOptional({
    description: 'Deployment execution config passthrough (currently leverage override).',
    type: 'object',
    additionalProperties: true,
  })
  @IsOptional()
  @IsObject()
  deploymentExecutionConfig?: Record<string, unknown>
}
