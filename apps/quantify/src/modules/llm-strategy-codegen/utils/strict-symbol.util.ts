import { ErrorCode } from '@ai/shared'
import { HttpStatus } from '@nestjs/common'
import { DomainException } from '@/common/exceptions/domain.exception'

/**
 * Issue #1699 / #1702：codegen → publish 全链 symbol strict 校验共用 quote 后缀集合。
 * 新增 quote 时只改这里一处；与下游 market-symbol-code.util / market-data 模块保持一致语义。
 */
export const KNOWN_QUOTE_SUFFIXES = [
  'USDT',
  'USDC',
  'USD',
  'BUSD',
  'FDUSD',
  'TUSD',
  'DAI',
  'USDE',
  'BTC',
  'ETH',
] as const

export type StrictSymbolMarketType = 'spot' | 'perp'

interface AssertStrictSymbolOptions {
  /** 写入侧上下文标识：codegen 走 sessionId，publish 走 sessionId，便于排障定位 */
  sessionId: string
  marketType: StrictSymbolMarketType
  /** DomainException message key；不同调用方可区分 codegen / publication 两类错误 */
  messageKey?: string
}

/**
 * Stage3 单一真相要求 symbol 必须形如 `BASEQUOTE`（全大写，含已知 quote 后缀，例 BTCUSDT / ETHUSDC / SOLUSD），
 * 可选 `:SPOT/:PERP` 后缀作为 venue 原生标记。
 *
 * Venue 原生格式（如 OKX 的 `BTC-USDT-SWAP`）由 LLM/codegen 在产出 IR 前归一为 `BTCUSDT`，
 * 不允许把 venue-specific 形态直接落库到 codegen session 或 published snapshot。
 *
 * 与 publish 闸门同语义；codegen 写入侧调用此 util 实现 fail-fast 双保险。
 */
export function assertStrictSymbol(
  rawSymbol: unknown,
  options: AssertStrictSymbolOptions,
): string {
  const { sessionId, marketType, messageKey = 'publication.snapshot_symbol_invalid' } = options

  if (typeof rawSymbol !== 'string' || rawSymbol.length === 0) {
    throw new DomainException(messageKey, {
      code: ErrorCode.BACKTEST_SNAPSHOT_SYMBOL_INVALID,
      status: HttpStatus.BAD_REQUEST,
      args: { sessionId, symbol: rawSymbol, marketType, reason: 'empty' },
    })
  }
  if (rawSymbol !== rawSymbol.toUpperCase()) {
    throw new DomainException(messageKey, {
      code: ErrorCode.BACKTEST_SNAPSHOT_SYMBOL_INVALID,
      status: HttpStatus.BAD_REQUEST,
      args: { sessionId, symbol: rawSymbol, marketType, reason: 'not_uppercase' },
    })
  }
  const match = /^(?<basePair>[A-Z0-9]+)(?::(?<suffix>SPOT|PERP))?$/.exec(rawSymbol)
  if (!match || !match.groups) {
    throw new DomainException(messageKey, {
      code: ErrorCode.BACKTEST_SNAPSHOT_SYMBOL_INVALID,
      status: HttpStatus.BAD_REQUEST,
      args: { sessionId, symbol: rawSymbol, marketType, reason: 'shape_mismatch' },
    })
  }
  const { basePair, suffix } = match.groups
  if (suffix && marketType === 'perp' && suffix !== 'PERP') {
    throw new DomainException(messageKey, {
      code: ErrorCode.BACKTEST_SNAPSHOT_SYMBOL_INVALID,
      status: HttpStatus.BAD_REQUEST,
      args: { sessionId, symbol: rawSymbol, marketType, actualSuffix: suffix, reason: 'market_suffix_mismatch' },
    })
  }
  if (suffix && marketType === 'spot' && suffix !== 'SPOT') {
    throw new DomainException(messageKey, {
      code: ErrorCode.BACKTEST_SNAPSHOT_SYMBOL_INVALID,
      status: HttpStatus.BAD_REQUEST,
      args: { sessionId, symbol: rawSymbol, marketType, actualSuffix: suffix, reason: 'market_suffix_mismatch' },
    })
  }
  const hasKnownQuote = KNOWN_QUOTE_SUFFIXES.some(q => basePair.endsWith(q) && basePair.length > q.length)
  if (!hasKnownQuote) {
    throw new DomainException(messageKey, {
      code: ErrorCode.BACKTEST_SNAPSHOT_SYMBOL_INVALID,
      status: HttpStatus.BAD_REQUEST,
      args: {
        sessionId,
        symbol: rawSymbol,
        marketType,
        basePair,
        knownQuotes: [...KNOWN_QUOTE_SUFFIXES],
        reason: 'missing_quote',
      },
    })
  }
  return rawSymbol
}
