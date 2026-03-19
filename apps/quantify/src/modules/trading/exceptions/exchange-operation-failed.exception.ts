import { ErrorCode } from '@ai/shared/constants/error-codes'
import { DomainException } from '@/common/exceptions/domain.exception'

/**
 * 运行时交易所操作失败（如查询余额/持仓）。
 * 与初始化失败（TRADING_EXCHANGE_INIT_FAILED）区分，便于调用方做精细化处理。
 */
export class ExchangeOperationFailedException extends DomainException {
  constructor(params: { operation: string; exchangeId: string; reason: string }) {
    super('Exchange operation failed', {
      code: ErrorCode.TRADING_EXCHANGE_OPERATION_FAILED,
      args: params,
    })
  }
}
