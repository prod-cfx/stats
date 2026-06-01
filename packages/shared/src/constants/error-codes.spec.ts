import { ErrorCode } from './error-codes'

describe('ErrorCode backtest queue codes', () => {
  it('exports worker isolation error codes', () => {
    expect(ErrorCode.BACKTEST_JOB_TIMEOUT).toBe('BACKTEST_JOB_TIMEOUT')
    expect(ErrorCode.BACKTEST_JOB_STALLED).toBe('BACKTEST_JOB_STALLED')
    expect(ErrorCode.BACKTEST_QUEUE_UNAVAILABLE).toBe('BACKTEST_QUEUE_UNAVAILABLE')
    expect(ErrorCode.BACKTEST_WORKER_UNAVAILABLE).toBe('BACKTEST_WORKER_UNAVAILABLE')
    expect(ErrorCode.BACKTEST_MARKET_DATA_TIMEOUT).toBe('BACKTEST_MARKET_DATA_TIMEOUT')
    expect(ErrorCode.BACKTEST_QUEUE_TIMEOUT).toBe('BACKTEST_QUEUE_TIMEOUT')
  })
})
