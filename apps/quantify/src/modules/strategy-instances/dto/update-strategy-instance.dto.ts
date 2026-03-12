import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'
import { StrategyInstanceMode, StrategyInstanceStatus } from '@prisma/client'
import { IsEnum, IsJSON, IsOptional, IsString } from 'class-validator'

export class UpdateStrategyInstanceDto {
  @ApiProperty({ description: '瀹炰緥鍚嶇О', required: false })
  @IsString()
  @IsOptional()
  name?: string

  @ApiProperty({ description: '瀹炰緥鎻忚堪', required: false })
  @IsString()
  @IsOptional()
  description?: string

  @ApiProperty({ description: 'LLM 妯″瀷', required: false })
  @IsString()
  @IsOptional()
  llmModel?: string

  @ApiProperty({
    description: '瀹炰緥鐘舵€?,
    enum: StrategyInstanceStatus,
    required: false,
  })
  @IsEnum(StrategyInstanceStatus)
  @IsOptional()
  status?: StrategyInstanceStatus

  @ApiProperty({
    description: '杩愯妯″紡锛欱ACKTEST=鍘嗗彶鍥炴祴锛孭APER=绾镐笂浜ゆ槗锛孴ESTNET=娴嬭瘯缃戜氦鏄擄紝LIVE=瀹炵洏浜ゆ槗銆傛敞鎰忥細杩愯涓殑瀹炰緥鏃犳硶鍒囨崲妯″紡锛孡IVE妯″紡涓嶈兘鍒囨崲鍒癇ACKTEST妯″紡锛屽凡鍋滄鐨勫疄渚嬩笉鑳藉垏鎹㈡ā寮?,
    enum: StrategyInstanceMode,
    required: false,
    example: 'PAPER',
  })
  @IsEnum(StrategyInstanceMode)
  @IsOptional()
  mode?: StrategyInstanceMode

  @ApiProperty({ description: '瀹炰緥鍙傛暟锛圝SON 鏍煎紡锛?, required: false })
  @IsJSON()
  @IsOptional()
  params?: Record<string, unknown>

  @ApiProperty({ description: '鍏冩暟鎹紙JSON 鏍煎紡锛?, required: false })
  @IsJSON()
  @IsOptional()
  metadata?: Record<string, unknown>

  @ApiPropertyOptional({ description: '鏇存柊浜烘爣璇?, example: 'system-operator' })
  @IsString()
  @IsOptional()
  updatedBy?: string
}
