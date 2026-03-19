import { ApiPropertyOptional } from '@nestjs/swagger'
import { IsDateString, IsOptional } from 'class-validator'

export class GenerateDailyReportDto {
  @ApiPropertyOptional({
    description: '统计日期（UTC ISO）',
    example: '2025-11-17',
  })
  @IsOptional()
  @IsDateString()
  date?: string
}



