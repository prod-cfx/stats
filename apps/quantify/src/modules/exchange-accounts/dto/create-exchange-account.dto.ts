import type { ExchangeId, MarketType } from '@/modules/trading/core/types'
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'
import {
  IsBoolean,
  IsEnum,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  ValidateIf,
} from 'class-validator'

const EXCHANGE_IDS: ExchangeId[] = ['binance', 'okx', 'hyperliquid']
const MARKET_TYPES: MarketType[] = ['spot', 'perp']

export class CreateExchangeAccountDto {
  @ApiProperty({
    description: '涓氬姟鐢ㄦ埛 ID',
    example: 'usr_123',
  })
  @IsString()
  @MaxLength(128)
  userId!: string

  @ApiProperty({
    description: '浜ゆ槗鎵€鏍囪瘑',
    enum: EXCHANGE_IDS,
  })
  @IsEnum(EXCHANGE_IDS)
  exchangeId!: ExchangeId

  @ApiPropertyOptional({
    description: '璐︽埛鍒悕锛岀敤鎴疯嚜瀹氫箟',
    maxLength: 64,
  })
  @IsOptional()
  @IsString()
  @MaxLength(64)
  name?: string

  @ApiPropertyOptional({
    description: '鏄惁浣跨敤娴嬭瘯缃?妯℃嫙鐩?,
    default: false,
  })
  @IsOptional()
  @IsBoolean()
  isTestnet?: boolean

  @ApiPropertyOptional({
    description: '鐢ㄤ簬鍑嵁鏍￠獙鐨勯粯璁ゅ競鍦虹被鍨?,
    enum: MARKET_TYPES,
    default: 'spot',
  })
  @IsOptional()
  @IsEnum(MARKET_TYPES)
  marketType?: MarketType

  @ApiPropertyOptional({
    description: 'Binance/OKX API Key',
  })
  @ValidateIf(dto => dto.exchangeId === 'binance' || dto.exchangeId === 'okx')
  @IsString()
  apiKey?: string

  @ApiPropertyOptional({
    description: 'Binance/OKX API Secret',
  })
  @ValidateIf(dto => dto.exchangeId === 'binance' || dto.exchangeId === 'okx')
  @IsString()
  apiSecret?: string

  @ApiPropertyOptional({
    description: 'OKX API Passphrase锛屼粎 OKX 闇€瑕?,
  })
  @ValidateIf(dto => dto.exchangeId === 'okx')
  @IsString()
  passphrase?: string

  // ==================== Hyperliquid 涓撶敤瀛楁 ====================
  // 娉ㄦ剰锛欻yperliquid 瀹㈡埛绔綋鍓嶄负楠ㄦ灦瀹炵幇锛屽彲浠ュ垱寤鸿处鎴蜂絾浜ゆ槗鍔熻兘灏氭湭瀹屾垚
  // 璇﹁锛歛pps/backend/src/modules/trading/exchanges/README_HYPERLIQUID.md
  // ================================================================

  @ApiPropertyOptional({
    description: 'Hyperliquid 涓婚挶鍖呭湴鍧€锛堝繀椤绘槸鏈夋晥鐨勪互澶潑鍦板潃锛?x + 40涓崄鍏繘鍒跺瓧绗︼級',
    example: '0x1234567890123456789012345678901234567890',
    pattern: '^0x[0-9a-fA-F]{40}$',
  })
  @ValidateIf(dto => dto.exchangeId === 'hyperliquid')
  @IsString()
  @Matches(/^0x[0-9a-fA-F]{40}$/, {
    message: 'mainWalletAddress must be a valid Ethereum address (0x followed by 40 hex characters)',
  })
  mainWalletAddress?: string

  @ApiPropertyOptional({
    description: 'Hyperliquid agent 绉侀挜锛堝繀椤绘槸鏈夋晥鐨勪互澶潑绉侀挜锛?x + 64涓崄鍏繘鍒跺瓧绗︼級',
    example: '0x0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef',
    pattern: '^0x[0-9a-fA-F]{64}$',
  })
  @ValidateIf(dto => dto.exchangeId === 'hyperliquid')
  @IsString()
  @Matches(/^0x[0-9a-fA-F]{64}$/, {
    message: 'agentPrivateKey must be a valid Ethereum private key (0x followed by 64 hex characters)',
  })
  agentPrivateKey?: string
}
