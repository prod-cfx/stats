import type { ExchangeId, MarketInstrumentType, TradingVenueType } from '@ai/shared'
import { EXCHANGES, MARKET_INSTRUMENT_TYPES, TRADING_VENUE_TYPES } from '@ai/shared'
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'

export class TradingPairConfigResponseDto {
  @ApiProperty({ description: '交易对唯一 ID，例如 BTCUSDT.BINANCE.SPOT' })
  id!: string

  @ApiProperty({ description: '展示用符号，例如 BTC/USDT' })
  displaySymbol!: string

  @ApiProperty({ description: '内部 symbol，例如 BTCUSDT 或 BTC-USDT' })
  symbol!: string

  @ApiProperty({ description: '基础资产，例如 BTC' })
  baseAsset!: string

  @ApiProperty({ description: '计价资产，例如 USDT' })
  quoteAsset!: string

  @ApiProperty({ description: '交易 venue 类型（DEX / CEX）', enum: TRADING_VENUE_TYPES })
  venueType!: TradingVenueType

  @ApiProperty({ description: '交易品种类型（现货 / 永续 / 期货）', enum: MARKET_INSTRUMENT_TYPES })
  instrumentType!: MarketInstrumentType

  @ApiProperty({ description: '价格精度' })
  pricePrecision!: number

  @ApiProperty({ description: '数量精度' })
  quantityPrecision!: number

  @ApiPropertyOptional({ description: '最小名义价值（quote 金额）' })
  minNotional?: number

  @ApiPropertyOptional({ description: '最小下单数量（base 数量）' })
  minQuantity?: number

  @ApiProperty({ description: '是否启用该交易对' })
  enabled!: boolean

  // CEX 专用字段
  @ApiPropertyOptional({ description: '交易所标识，仅对 CEX 生效', enum: EXCHANGES })
  exchange?: ExchangeId

  @ApiPropertyOptional({ description: '交易所原始 symbol，仅对 CEX 生效' })
  exchangeSymbol?: string

  @ApiPropertyOptional({ description: '最大杠杆倍数，仅对合约 CEX 生效' })
  maxLeverage?: number

  @ApiPropertyOptional({ description: '合约面值，仅对合约 CEX 生效' })
  contractSize?: number

  // DEX 专用字段
  @ApiPropertyOptional({ description: '链 ID，仅对 DEX 生效' })
  chainId?: number

  @ApiPropertyOptional({ description: '基础资产合约地址，仅对 DEX 生效' })
  baseTokenAddress?: string

  @ApiPropertyOptional({ description: '计价资产合约地址，仅对 DEX 生效' })
  quoteTokenAddress?: string

  @ApiPropertyOptional({ description: '路由合约地址，仅对 DEX 生效' })
  routerAddress?: string

  @ApiPropertyOptional({ description: '池子合约地址，仅对 DEX 生效' })
  poolAddress?: string

  @ApiPropertyOptional({ description: 'DEX 名称，例如 UNISWAP_V3，仅对 DEX 生效' })
  dexName?: string
}

