import { ApiPropertyOptional } from '@nestjs/swagger'
import { Type } from 'class-transformer'
import { IsOptional, IsString, ValidateNested } from 'class-validator'
import { CodegenGuideConfigDto } from './codegen-guide-config.dto'

export class StartCodegenSessionDto {
  @ApiPropertyOptional({ description: '业务用户 ID（可选，优先使用鉴权主体）' })
  @IsOptional()
  @IsString()
  userId?: string

  @ApiPropertyOptional({ description: '对策略目标的第一轮描述' })
  @IsOptional()
  @IsString()
  initialMessage?: string

  @ApiPropertyOptional({ description: '会话级引导参数配置', type: CodegenGuideConfigDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => CodegenGuideConfigDto)
  guideConfig?: CodegenGuideConfigDto
}
