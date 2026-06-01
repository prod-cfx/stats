export const BACKTEST_QUEUE = 'backtest'
export const BACKTEST_QUEUE_JOB_RUN = 'backtest.run'

export const DEFAULT_BACKTEST_JOB_TIMEOUT_MS = 180_000
export const DEFAULT_BACKTEST_QUEUE_TIMEOUT_MS = 300_000
export const DEFAULT_BACKTEST_WORKER_CONCURRENCY = 1

export interface BacktestQueueJobData {
  jobId: string
}
