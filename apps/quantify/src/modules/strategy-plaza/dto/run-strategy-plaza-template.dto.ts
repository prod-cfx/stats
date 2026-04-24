import { ApiProperty } from '@nestjs/swagger'
import { IsString, MinLength } from 'class-validator'

export class RunStrategyPlazaTemplateDto {
  @ApiProperty({ description: '幂等运行请求 ID' })
  @IsString()
  @MinLength(8)
  runRequestId!: string
}
