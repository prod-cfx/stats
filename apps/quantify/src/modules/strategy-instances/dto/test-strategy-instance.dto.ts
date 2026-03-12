import { ApiProperty } from '@nestjs/swagger'
import { Type } from 'class-transformer'
import { IsArray, IsNotEmpty, IsNumber, IsObject, IsOptional, IsString, ValidateNested } from 'class-validator'

/**
 * 鍗曟牴 K 绾挎暟鎹紙涓庢妧鏈寚鏍囨ā鍧楃殑 Bar 缁撴瀯淇濇寔涓€鑷达級
 */
export class TestBarDto {
  @ApiProperty({ description: '寮€鐩樹环' })
  @IsNumber()
  open: number

  @ApiProperty({ description: '鏈€楂樹环' })
  @IsNumber()
  high: number

  @ApiProperty({ description: '鏈€浣庝环' })
  @IsNumber()
  low: number

  @ApiProperty({ description: '鏀剁洏浠? })
  @IsNumber()
  close: number

  @ApiProperty({ description: '鎴愪氦閲? })
  @IsNumber()
  volume: number

  @ApiProperty({ description: '鏃堕棿鎴筹紙姣锛?, required: false })
  @IsOptional()
  @IsNumber()
  timestamp?: number
}

/**
 * 澶氳吙澶氬懆鏈熷満鏅笅锛屽崟涓?leg + timeframe 鐨勬暟鎹粨鏋?
 */
export class TestLegTimeframeDataDto {
  @ApiProperty({ type: () => [TestBarDto], description: 'K 绾挎暟鎹暟缁? })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => TestBarDto)
  bars: TestBarDto[]

  @ApiProperty({
    description: '鎶€鏈寚鏍囧瓧鍏革紝渚嬪 { rsi_14: 45.2, ma_20: 62000 }',
    type: Object,
  })
  @IsObject()
  indicators: Record<string, number>

  @ApiProperty({ description: '褰撳墠浠锋牸锛堥€氬父涓烘渶鏂颁竴鏍?K 绾挎敹鐩樹环锛? })
  @IsNumber()
  currentPrice: number
}

/**
 * 涓诲姩瑙﹀彂瀹炰緥妫€鏌ョ殑鍏ュ弬
 *
 * 鍏煎涓ょ鏂瑰紡锛?
 * - 鍗曡吙妯″紡锛堟棫鏋舵瀯锛夛細鐩存帴浼?bars / indicators / currentPrice
 * - 澶氳吙澶氬懆鏈熸ā寮忥紙鏂版灦鏋勶級锛氭寜 legId + timeframe 缁勭粐鍒?multiLegData 涓?
 */
export class TestStrategyInstanceDto {
  @ApiProperty({
    description: '锛堝彲閫夛級鍗曡吙妯″紡涓嬬殑 K 绾挎暟鎹暟缁?,
    required: false,
    type: () => [TestBarDto],
  })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => TestBarDto)
  bars?: TestBarDto[]

  @ApiProperty({
    description: '锛堝彲閫夛級鍗曡吙妯″紡涓嬬殑浜ゆ槗瀵逛唬鐮侊紝渚嬪 BTCUSDT',
    required: false,
  })
  @IsOptional()
  @IsString()
  symbol?: string

  @ApiProperty({
    description: '锛堝彲閫夛級鍗曡吙妯″紡涓嬬殑鏃堕棿鍛ㄦ湡锛屼緥濡?1h',
    required: false,
  })
  @IsOptional()
  @IsString()
  timeframe?: string

  @ApiProperty({
    description: '锛堝彲閫夛級鍗曡吙妯″紡涓嬬殑鎶€鏈寚鏍囧璞?,
    required: false,
    type: Object,
  })
  @IsOptional()
  @IsObject()
  indicators?: Record<string, number>

  @ApiProperty({
    description: '锛堝彲閫夛級鍗曡吙妯″紡涓嬬殑褰撳墠浠锋牸',
    required: false,
  })
  @IsOptional()
  @IsNumber()
  currentPrice?: number

  @ApiProperty({
    description:
      '锛堝彲閫夛級澶氳吙澶氬懆鏈熸ā寮忕殑鏁版嵁锛宬ey 涓?legId锛寁alue 涓?timeframe -> 鏁版嵁 鐨勬槧灏勩€? +
      '渚嬪锛歿"btc": {"1h": { "bars": [...], "indicators": {...}, "currentPrice": 62000 }}}',
    required: false,
    type: Object,
  })
  @IsOptional()
  @IsObject()
  // 涓哄吋瀹瑰灞傜骇鐨勫姩鎬侀敭缁撴瀯锛屼笉瀵瑰唴閮ㄥ瓧娈靛仛涓ユ牸鏍￠獙锛屼粎瑕佹眰涓哄璞°€?
  // 鍏蜂綋瀛楁鐢辫剼鏈墽琛岄樁娈佃繘琛屾牎楠屽拰鎶ラ敊銆?
  multiLegData?: Record<string, Record<string, unknown>>
}

/**
 * 涓诲姩瑙﹀彂瀹炰緥妫€鏌ョ殑杩斿洖缁撴灉
 */
export class TestStrategyInstanceResultDto {
  @ApiProperty({
    description: '鑴氭湰鎵ц杩斿洖鐨勫師濮嬬粨鏋滐紙閫氬父涓虹敤浜庡～鍏?Prompt 鐨勬暟鎹璞★級',
    type: Object,
  })
  @IsObject()
  @IsNotEmpty()
  scriptResult: Record<string, unknown>

  @ApiProperty({
    description: '灏嗚剼鏈粨鏋滃～鍏呭埌 Prompt 妯℃澘鍚庡緱鍒扮殑鏈€缁?Prompt 鏂囨湰锛屼究浜庤皟璇?,
    required: false,
  })
  @IsOptional()
  @IsString()
  filledPrompt?: string
}
