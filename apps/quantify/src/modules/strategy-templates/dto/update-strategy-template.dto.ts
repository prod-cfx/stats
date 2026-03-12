import type { StrategyDataRequirements, StrategyExecutionConfig, StrategyStatus } from '../types/strategy-template.types'
import { ApiPropertyOptional } from '@nestjs/swagger'
import { Type } from 'class-transformer'

import { IsArray, IsIn, IsObject, IsOptional, IsString, MaxLength, ValidateIf, ValidateNested } from 'class-validator'
import {
  STRATEGY_STATUS_VALUES,
} from '../types/strategy-template.types'
import { IsSafeFieldNameArray } from '../validators/safe-field-name.validator'
import { StrategyExecutionConfigDto, StrategyLegDefinitionDto } from './create-strategy-template.dto'

/**
 * Update DTO 鍏佽鏇存柊妯℃澘鐨勫ぇ閮ㄥ垎瀛楁銆?
 */
export class UpdateStrategyTemplateDto {
  @ApiPropertyOptional({
    description: '鎿嶄綔鑰?ID锛堝彲淇＄幆澧冨唴鐢辫皟鐢ㄦ柟鏄惧紡浼犲叆锛?,
    example: 'system-operator',
  })
  @IsOptional()
  @IsString()
  updatedBy?: string

  @ApiPropertyOptional({ description: '绛栫暐鍚嶇О', maxLength: 100 })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  name?: string

  @ApiPropertyOptional({ description: '绛栫暐鎻忚堪', maxLength: 500 })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string

  @ApiPropertyOptional({ description: 'Leg 瀹氫箟鍒楄〃', type: [StrategyLegDefinitionDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => StrategyLegDefinitionDto)
  legs?: StrategyLegDefinitionDto[]

  @ApiPropertyOptional({ description: '绛栫暐鎵ц閰嶇疆', type: StrategyExecutionConfigDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => StrategyExecutionConfigDto)
  execution?: StrategyExecutionConfig

  @ApiPropertyOptional({
    description: '鏁版嵁闇€姹傞厤缃紝key 涓?leg id锛寁alue 涓洪渶瑕佺殑鏃堕棿鍛ㄦ湡鏁扮粍',
    type: 'object',
    additionalProperties: { type: 'array', items: { type: 'string' } },
    example: { btc: ['15m', '1h', '4h'], eth: ['1h'] },
  })
  @IsOptional()
  @IsObject()
  dataRequirements?: StrategyDataRequirements

  @ApiPropertyOptional({ description: 'LLM 妯″瀷鍚嶇О', maxLength: 100 })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  llmModel?: string

  @ApiPropertyOptional({ description: 'Prompt 妯℃澘', maxLength: 20000 })
  @IsOptional()
  @IsString()
  @MaxLength(20000)
  promptTemplate?: string

  @ApiPropertyOptional({ description: '绛栫暐鑴氭湰浠ｇ爜', maxLength: 100000, nullable: true })
  @IsOptional()
  @ValidateIf(o => o.script !== null)
  @IsString()
  @MaxLength(100000)
  script?: string | null

  @ApiPropertyOptional({ description: '鍙傛暟 schema', type: 'object', additionalProperties: true, nullable: true })
  @IsOptional()
  @ValidateIf(o => o.paramsSchema !== null)
  @IsObject()
  paramsSchema?: Record<string, unknown> | null

  @ApiPropertyOptional({ description: '鍙傛暟榛樿鍊?, type: 'object', additionalProperties: true, nullable: true })
  @IsOptional()
  @ValidateIf(o => o.defaultParams !== null)
  @IsObject()
  defaultParams?: Record<string, unknown> | null

  @ApiPropertyOptional({
    description: '@deprecated 浣跨敤 dataRequirements 鏇夸唬',
    type: [String],
    example: ['price_close', 'ma_20', 'rsi_14'],
    deprecated: true,
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @IsSafeFieldNameArray()
  requiredFields?: string[]

  @ApiPropertyOptional({ description: '绛栫暐鐘舵€?, enum: STRATEGY_STATUS_VALUES })
  @IsOptional()
  @IsIn(STRATEGY_STATUS_VALUES)
  status?: StrategyStatus

  @ApiPropertyOptional({ description: '闄勫姞鍏冧俊鎭?, type: 'object', additionalProperties: true, nullable: true })
  @IsOptional()
  @ValidateIf(o => o.metadata !== null)
  @IsObject()
  metadata?: Record<string, unknown> | null
}
