import { ErrorCode } from '@ai/shared/constants/error-codes'
import { DomainException } from '@/common/exceptions/domain.exception'

/**
 * 杩愯鏃朵氦鏄撴墍鎿嶄綔澶辫触锛堝鏌ヨ浣欓/鎸佷粨锛夈€?
 * 涓庡垵濮嬪寲澶辫触锛圱RADING_EXCHANGE_INIT_FAILED锛夊尯鍒嗭紝渚夸簬璋冪敤鏂瑰仛绮剧粏鍖栧鐞嗐€?
 */
export class ExchangeOperationFailedException extends DomainException {
  constructor(params: { operation: string; exchangeId: string; reason: string }) {
    super('Exchange operation failed', {
      code: ErrorCode.TRADING_EXCHANGE_OPERATION_FAILED,
      args: params,
    })
  }
}
