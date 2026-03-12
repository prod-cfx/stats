import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'
import { IsArray, IsNotEmpty, IsObject, IsOptional, IsString } from 'class-validator'

export class ContinueCodegenSessionDto {
  @ApiProperty({ description: '涓氬姟鐢ㄦ埛 ID' })
  @IsString()
  @IsNotEmpty()
  userId!: string

  @ApiProperty({ description: '鐢ㄦ埛鏈疆杈撳叆' })
  @IsString()
  @IsNotEmpty()
  message!: string

  @ApiPropertyOptional({ description: '澧為噺鏇存柊鐨勬爣鐨勫垪琛?, type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  symbols?: string[]

  @ApiPropertyOptional({ description: '澧為噺鏇存柊鐨勫懆鏈熷垪琛?, type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  timeframes?: string[]

  @ApiPropertyOptional({ description: '澧為噺鏇存柊鐨勫叆鍦鸿鍒?, type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  entryRules?: string[]

  @ApiPropertyOptional({ description: '澧為噺鏇存柊鐨勫嚭鍦鸿鍒?, type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  exitRules?: string[]

  @ApiPropertyOptional({ description: '澧為噺鏇存柊椋庢帶瑙勫垯', type: 'object', additionalProperties: true })
  @IsOptional()
  @IsObject()
  riskRules?: Record<string, unknown>
}
