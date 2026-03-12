import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'
import { IsArray, IsNotEmpty, IsObject, IsOptional, IsString } from 'class-validator'

export class StartCodegenSessionDto {
  @ApiProperty({ description: '涓氬姟鐢ㄦ埛 ID' })
  @IsString()
  @IsNotEmpty()
  userId!: string

  @ApiPropertyOptional({ description: '瀵圭瓥鐣ョ洰鏍囩殑绗竴杞弿杩? })
  @IsOptional()
  @IsString()
  initialMessage?: string

  @ApiPropertyOptional({ description: '鏍囩殑鍒楄〃', type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  symbols?: string[]

  @ApiPropertyOptional({ description: '鍛ㄦ湡鍒楄〃', type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  timeframes?: string[]

  @ApiPropertyOptional({ description: '鍏ュ満瑙勫垯鍒楄〃', type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  entryRules?: string[]

  @ApiPropertyOptional({ description: '鍑哄満瑙勫垯鍒楄〃', type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  exitRules?: string[]

  @ApiPropertyOptional({ description: '椋庢帶瑙勫垯', type: 'object', additionalProperties: true })
  @IsOptional()
  @IsObject()
  riskRules?: Record<string, unknown>
}
