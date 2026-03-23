import { ApiProperty } from '@nestjs/swagger'
import { Type } from 'class-transformer'
import { IsArray, IsNotEmpty, IsNumber, IsObject, IsOptional, IsString, ValidateNested } from 'class-validator'

/**
 * 单根 K 线数据（与技术指标模块的 Bar 结构保持一致）
 */
export class TestBarDto {
  @ApiProperty({ description: '开盘价' })
  @IsNumber()
  open: number

  @ApiProperty({ description: '最高价' })
  @IsNumber()
  high: number

  @ApiProperty({ description: '最低价' })
  @IsNumber()
  low: number

  @ApiProperty({ description: '收盘价' })
  @IsNumber()
  close: number

  @ApiProperty({ description: '成交量' })
  @IsNumber()
  volume: number

  @ApiProperty({ description: '时间戳（毫秒）', required: false })
  @IsOptional()
  @IsNumber()
  timestamp?: number
}

/**
 * 多腿多周期场景下，单个 leg + timeframe 的数据结构
 */
export class TestLegTimeframeDataDto {
  @ApiProperty({ type: () => [TestBarDto], description: 'K 线数据数组' })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => TestBarDto)
  bars: TestBarDto[]

  @ApiProperty({
    description: '技术指标字典，例如 { rsi_14: 45.2, ma_20: 62000 }',
    type: Object,
  })
  @IsObject()
  indicators: Record<string, number>

  @ApiProperty({ description: '当前价格（通常为最新一根 K 线收盘价）' })
  @IsNumber()
  currentPrice: number
}

/**
 * 主动触发实例检查的入参
 *
 * 兼容两种方式：
 * - 单腿模式（旧架构）：直接传 bars / indicators / currentPrice
 * - 多腿多周期模式（新架构）：按 legId + timeframe 组织到 multiLegData 中
 */
export class TestStrategyInstanceDto {
  @ApiProperty({
    description: '（可选）单腿模式下的 K 线数据数组',
    required: false,
    type: () => [TestBarDto],
  })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => TestBarDto)
  bars?: TestBarDto[]

  @ApiProperty({
    description: '（可选）单腿模式下的交易对代码，例如 BTCUSDT',
    required: false,
  })
  @IsOptional()
  @IsString()
  symbol?: string

  @ApiProperty({
    description: '（可选）单腿模式下的时间周期，例如 1h',
    required: false,
  })
  @IsOptional()
  @IsString()
  timeframe?: string

  @ApiProperty({
    description: '（可选）单腿模式下的技术指标对象',
    required: false,
    type: Object,
  })
  @IsOptional()
  @IsObject()
  indicators?: Record<string, number>

  @ApiProperty({
    description: '（可选）单腿模式下的当前价格',
    required: false,
  })
  @IsOptional()
  @IsNumber()
  currentPrice?: number

  @ApiProperty({
    description: '（可选）当前持仓数量（用于 ADJUST_POSITION 语义转换）',
    required: false,
  })
  @IsOptional()
  @IsNumber()
  currentQty?: number

  @ApiProperty({
    description: '（可选）当前账户权益（用于 RATIO/ADJUST_POSITION 语义转换）',
    required: false,
  })
  @IsOptional()
  @IsNumber()
  equity?: number

  @ApiProperty({
    description:
      '（可选）多腿多周期模式的数据，key 为 legId，value 为 timeframe -> 数据 的映射。' +
      '例如：{"btc": {"1h": { "bars": [...], "indicators": {...}, "currentPrice": 62000 }}}',
    required: false,
    type: Object,
  })
  @IsOptional()
  @IsObject()
  // 为兼容多层级的动态键结构，不对内部字段做严格校验，仅要求为对象。
  // 具体字段由脚本执行阶段进行校验和报错。
  multiLegData?: Record<string, Record<string, unknown>>
}

/**
 * 主动触发实例检查的返回结果
 */
export class TestStrategyInstanceResultDto {
  @ApiProperty({
    description: '脚本执行返回的原始结果（通常为用于填充 Prompt 的数据对象）',
    type: Object,
  })
  @IsObject()
  @IsNotEmpty()
  scriptResult: Record<string, unknown>

  @ApiProperty({
    description: '将脚本结果填充到 Prompt 模板后得到的最终 Prompt 文本，便于调试',
    required: false,
  })
  @IsOptional()
  @IsString()
  filledPrompt?: string
}
