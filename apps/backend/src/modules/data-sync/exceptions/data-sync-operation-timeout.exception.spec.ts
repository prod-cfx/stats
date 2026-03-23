import { ErrorCode } from '@ai/shared'
import { HttpStatus } from '@nestjs/common'
import { DataSyncOperationTimeoutException } from './data-sync-operation-timeout.exception'

describe('dataSyncOperationTimeoutException', () => {
  it('should set correct code and status', () => {
    const ex = new DataSyncOperationTimeoutException({
      operation: 'binance-ws-subscribe',
      timeoutMs: 5000,
    })

    expect(ex.code).toBe(ErrorCode.DATA_SYNC_OPERATION_TIMEOUT)
    expect(ex.getStatus()).toBe(HttpStatus.GATEWAY_TIMEOUT)
    expect(ex.args).toEqual({ operation: 'binance-ws-subscribe', timeoutMs: 5000 })
  })
})
