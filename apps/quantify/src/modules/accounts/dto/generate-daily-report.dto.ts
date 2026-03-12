import { ApiPropertyOptional } from '@nestjs/swagger'
import { IsDateString, IsOptional } from 'class-validator'

export class GenerateDailyReportDto {
  @ApiPropertyOptional({
    description: '缁熻鏃ユ湡锛圲TC ISO锛?,
    example: '2025-11-17',
  })
  @IsOptional()
  @IsDateString()
  date?: string
}
