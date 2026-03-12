import type { MarketTimeframe } from '@ai/shared'
import type { StrategyDataRequirements, StrategyExecutionConfig, StrategyLegDefinition, StrategyLegRole } from '../types/strategy-template.types'
import { MARKET_TIMEFRAMES } from '@ai/shared'
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'
import { Type } from 'class-transformer'

import {
  IsArray,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator'
import {
  STRATEGY_LEG_ROLES,
} from '../types/strategy-template.types'
import { IsSafeFieldNameArray } from '../validators/safe-field-name.validator'

/**
 * 绛栫暐鑵垮畾涔?DTO
 */
export class StrategyLegDefinitionDto implements StrategyLegDefinition {
  @ApiProperty({ description: '鍦ㄧ瓥鐣ユā鏉垮唴鍞竴鐨?leg ID锛屼緥濡?btc銆乪th', example: 'btc' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  id!: string

  @ApiProperty({ description: '浜ゆ槗瀵逛唬鐮?, example: 'BTCUSDT' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  symbol!: string

  @ApiProperty({ description: 'leg 瑙掕壊', enum: STRATEGY_LEG_ROLES })
  @IsString()
  @IsIn(STRATEGY_LEG_ROLES)
  role!: StrategyLegRole

  @ApiPropertyOptional({ description: '璇?leg 鐨勮ˉ鍏呰鏄?, maxLength: 200 })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  description?: string
}

/**
 * 绛栫暐鎵ц閰嶇疆 DTO
 */
export class StrategyExecutionConfigDto implements StrategyExecutionConfig {
  @ApiProperty({ description: '淇″彿瑙﹀彂鍛ㄦ湡', enum: MARKET_TIMEFRAMES, example: '1h' })
  @IsString()
  @IsIn(MARKET_TIMEFRAMES as unknown as string[])
  timeframe!: MarketTimeframe

  @ApiPropertyOptional({ description: '鍐峰嵈鏃堕棿锛堝垎閽燂級', example: 15, minimum: 1, maximum: 1440 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(1440)
  cooldownMinutes?: number
}

export class CreateStrategyTemplateDto {
  @ApiPropertyOptional({
    description: '鎿嶄綔鑰?ID锛堝彲淇＄幆澧冨唴鐢辫皟鐢ㄦ柟鏄惧紡浼犲叆锛?,
    example: 'system-operator',
  })
  @IsOptional()
  @IsString()
  createdBy?: string

  @ApiProperty({ description: '绛栫暐鍚嶇О', maxLength: 100 })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name!: string

  @ApiProperty({ description: '绛栫暐鎻忚堪', maxLength: 500 })
  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  description!: string

  @ApiProperty({
    description: '绛栫暐鐨?leg 瀹氫箟鍒楄〃锛岃嚦灏戦渶瑕佷竴涓?primary leg',
    type: [StrategyLegDefinitionDto],
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => StrategyLegDefinitionDto)
  legs!: StrategyLegDefinition[]

  @ApiProperty({
    description: '绛栫暐鎵ц閰嶇疆',
    type: StrategyExecutionConfigDto,
  })
  @ValidateNested()
  @Type(() => StrategyExecutionConfigDto)
  execution!: StrategyExecutionConfig

  @ApiProperty({
    description: '鏁版嵁闇€姹傞厤缃紝key 涓?leg id锛寁alue 涓洪渶瑕佺殑鏃堕棿鍛ㄦ湡鏁扮粍',
    type: 'object',
    additionalProperties: { type: 'array', items: { type: 'string' } },
    example: { btc: ['15m', '1h', '4h'], eth: ['1h'] },
  })
  @IsObject()
  dataRequirements!: StrategyDataRequirements

  @ApiProperty({ description: 'LLM 妯″瀷鍚嶇О', example: 'gpt-4.1-mini' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  llmModel!: string

  @ApiProperty({ description: 'Prompt 妯℃澘锛屾敮鎸佸崰浣嶇', maxLength: 20000 })
  @IsString()
  @IsNotEmpty()
  @MaxLength(20000)
  promptTemplate!: string

  @ApiProperty({ description: '绛栫暐鑴氭湰浠ｇ爜锛岀敤浜庡鐞嗗鑵挎暟鎹苟鐢熸垚 AI prompt 鍙橀噺', maxLength: 100000 })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100000)
  script!: string

  @ApiProperty({ description: '绛栫暐鍙傛暟 schema锛孞SON Schema 缁撴瀯', type: 'object', additionalProperties: true })
  @IsObject()
  paramsSchema!: Record<string, unknown>

  @ApiPropertyOptional({ description: '鍙傛暟榛樿鍊?, type: 'object', additionalProperties: true })
  @IsOptional()
  @IsObject()
  defaultParams?: Record<string, unknown>

  @ApiPropertyOptional({
    description: '@deprecated 浣跨敤 dataRequirements 鏇夸唬銆傜瓥鐣ヤ緷璧栫殑瀛楁鍒楄〃',
    type: [String],
    example: ['price_close', 'ma_20', 'rsi_14'],
    deprecated: true,
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @IsSafeFieldNameArray()
  requiredFields?: string[]

  @ApiPropertyOptional({ description: '棰濆鍏冧俊鎭?, type: 'object', additionalProperties: true })
  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>
}
