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
    description: '业务用户 ID',
    example: 'usr_123',
  })
  @IsString()
  @MaxLength(128)
  userId!: string

  @ApiPropertyOptional({
    description: '业务用户邮箱，用于首次绑定时同步 Quantify 用户镜像',
    example: 'user@example.com',
  })
  @IsOptional()
  @IsString()
  @MaxLength(320)
  userEmail?: string

  @ApiProperty({
    description: '交易所标识',
    enum: EXCHANGE_IDS,
  })
  @IsEnum(EXCHANGE_IDS)
  exchangeId!: ExchangeId

  @ApiPropertyOptional({
    description: '账户别名，用户自定义',
    maxLength: 64,
  })
  @IsOptional()
  @IsString()
  @MaxLength(64)
  name?: string

  @ApiPropertyOptional({
    description: '是否使用测试网/模拟盘',
    default: false,
  })
  @IsOptional()
  @IsBoolean()
  isTestnet?: boolean

  @ApiPropertyOptional({
    description: '用于凭据校验的默认市场类型',
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
    description: 'OKX API Passphrase，仅 OKX 需要',
  })
  @ValidateIf(dto => dto.exchangeId === 'okx')
  @IsString()
  passphrase?: string

  // ==================== Hyperliquid 专用字段 ====================
  // Hyperliquid 账户配置同时支持 spot / perp，具体市场能力由交易链路按 marketType 校验
  // 详见：apps/quantify/src/modules/trading/exchanges/README_HYPERLIQUID.md
  // ================================================================

  @ApiPropertyOptional({
    description: 'Hyperliquid 主钱包地址（必须是有效的以太坊地址，0x + 40个十六进制字符）',
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
    description: 'Hyperliquid agent 私钥（必须是有效的以太坊私钥，0x + 64个十六进制字符）',
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
