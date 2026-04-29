import { ApiPropertyOptional } from '@nestjs/swagger'
import { IsOptional, IsString } from 'class-validator'

export class GridRuntimeActionDto {
  @ApiPropertyOptional({ description: '操作原因' })
  @IsOptional()
  @IsString()
  reason?: string
}
