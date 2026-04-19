import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'
import { IsNotEmpty, IsObject, IsOptional, IsString } from 'class-validator'

export class AccountAiQuantDeployRequestDto {
  @ApiProperty()
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
