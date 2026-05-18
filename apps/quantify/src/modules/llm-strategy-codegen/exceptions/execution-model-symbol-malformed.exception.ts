import { ErrorCode } from '@ai/shared/constants/error-codes'
import { HttpStatus } from '@nestjs/common'

import { DomainException } from '@/common/exceptions/domain.exception'

/**
 * Issue #1459 闸 4：ExecutionModel.symbol 形态拒因。
 *
 * 经 buildSymbol() 构造后的 symbol 必须通过形态正则：
 *   - 长度 1..20
 *   - 仅 [A-Z0-9-_]
 *   - 禁止双 quote currency 拼接（如 BTCUSDTUSDT / ETHUSDTUSDT / BTCUSDUSDT）
 *
 * 该校验通用于所有 venue 与币种，不绑 BTC / ETH 具体 symbol。命中即 fail-closed。
 *
 * 抛出点：services/execution-model-source-invariant.ts buildSymbol()。
 */
export class ExecutionModelSymbolMalformedException extends DomainException {
  constructor(args: {
    symbol: string
    /** 'empty' / 'too_long' / 'illegal_chars' / 'duplicated_quote' */
    reason: 'empty' | 'too_long' | 'illegal_chars' | 'duplicated_quote'
  }) {
    super(
      `codegen.execution_model_symbol_malformed: symbol '${args.symbol}' rejected (${args.reason})`,
      {
        code: ErrorCode.EXECUTION_MODEL_SYMBOL_MALFORMED,
        status: HttpStatus.BAD_REQUEST,
        args: {
          symbol: args.symbol,
          reason: args.reason,
        },
      },
    )
  }
}
