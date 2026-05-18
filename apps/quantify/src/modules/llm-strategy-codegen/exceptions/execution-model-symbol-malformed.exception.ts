import { ErrorCode } from '@ai/shared/constants/error-codes'
import { HttpStatus } from '@nestjs/common'

import { DomainException } from '@/common/exceptions/domain.exception'

export type ExecutionModelSymbolMalformedReason =
  | 'empty'
  | 'too_long'
  | 'illegal_chars'
  | 'duplicated_quote'
  | 'source_disagreement'

/**
 * Issue #1459 闸 4：ExecutionModel.symbol 形态拒因。
 *
 * 经 buildSymbol() 构造后的 symbol 必须通过形态正则：
 *   - 长度 1..20
 *   - 仅 [A-Z0-9-_]
 *   - 禁止双 quote currency 拼接（如 BTCUSDTUSDT / ETHUSDTUSDT / BTCUSDUSDT）
 *
 * `source_disagreement` 用于 stage 层 contextSlots.symbol 与
 *   canonicalSpec.market.symbol 归一化后不一致的场景（review M1）。
 *
 * 该校验通用于所有 venue 与币种，不绑 BTC / ETH 具体 symbol。命中即 fail-closed。
 */
export class ExecutionModelSymbolMalformedException extends DomainException {
  constructor(args: {
    symbol: string
    reason: ExecutionModelSymbolMalformedReason
    /** source_disagreement 场景下记录两侧值，便于排查 */
    detail?: { contextSymbol?: string; canonicalSymbol?: string }
  }) {
    const reasonText = ({
      empty: '空字符串',
      too_long: '超长',
      illegal_chars: '非法字符',
      duplicated_quote: '双 quote 拼接',
      source_disagreement: '来源不一致',
    } as const)[args.reason]
    super(
      `策略 symbol '${args.symbol}' 形态非法（${reasonText}/${args.reason}）`,
      {
        code: ErrorCode.EXECUTION_MODEL_SYMBOL_MALFORMED,
        status: HttpStatus.BAD_REQUEST,
        args: {
          symbol: args.symbol,
          reason: args.reason,
          ...(args.detail ? { detail: args.detail } : {}),
        },
      },
    )
  }

  get symbol(): string {
    const value = this.args?.symbol
    return typeof value === 'string' ? value : ''
  }

  get reason(): ExecutionModelSymbolMalformedReason {
    return this.args?.reason as ExecutionModelSymbolMalformedReason
  }

  get detail(): { contextSymbol?: string; canonicalSymbol?: string } | null {
    const value = this.args?.detail
    return value && typeof value === 'object' ? value as { contextSymbol?: string; canonicalSymbol?: string } : null
  }
}
