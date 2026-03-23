import { ApiPropertyOptional } from '@nestjs/swagger'
import { IsOptional, IsString } from 'class-validator'

export class CodegenGuideConfigDto {
  @ApiPropertyOptional({ description: '标的示例（用于引导文案）', example: 'BTCUSDT' })
  @IsOptional()
  @IsString()
  symbolExample?: string

  @ApiPropertyOptional({ description: '周期示例（用于引导文案）', example: '5m/15m' })
  @IsOptional()
  @IsString()
  timeframeExample?: string

  @ApiPropertyOptional({ description: '入场示例（用于引导文案）', example: '5/20金叉' })
  @IsOptional()
  @IsString()
  entryRuleExample?: string

  @ApiPropertyOptional({ description: '出场示例（用于引导文案）', example: '5/20死叉' })
  @IsOptional()
  @IsString()
  exitRuleExample?: string

  @ApiPropertyOptional({ description: '风控示例（用于引导文案）', example: '仓位10% 止损2% 最大回撤15%' })
  @IsOptional()
  @IsString()
  riskRuleExample?: string
}
