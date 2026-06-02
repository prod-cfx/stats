import { MODULE_METADATA } from '@nestjs/common/constants'
import { BullRootModule } from '@/common/modules/bull-root.module'
import { AppModule } from '../app.module'
import { BacktestingModule } from './backtesting.module'
import { BacktestingWorkerModule } from './backtesting-worker.module'
import { BacktestJobExecutorService } from './jobs/backtest-job-executor.service'
import { BacktestJobsService } from './jobs/backtest-jobs.service'
import { BacktestWorkerProcessor } from './jobs/backtest-worker.processor'

function readModuleMetadata<T>(moduleType: unknown, key: string): T[] {
  return (Reflect.getMetadata(key, moduleType) ?? []) as T[]
}

describe('BacktestingWorkerModule', () => {
  it('keeps Bull processor out of the API module and registers it only in the worker module', () => {
    expect(readModuleMetadata(BacktestingModule, MODULE_METADATA.PROVIDERS)).not.toContain(BacktestWorkerProcessor)
    expect(readModuleMetadata(BacktestingWorkerModule, MODULE_METADATA.IMPORTS)).toContain(BacktestingModule)
    expect(readModuleMetadata(BacktestingWorkerModule, MODULE_METADATA.PROVIDERS)).toContain(BacktestWorkerProcessor)
  })

  it('configures Bull root for both API and backtest worker runtimes', () => {
    expect(readModuleMetadata(AppModule, MODULE_METADATA.IMPORTS)).toContain(BullRootModule)
    expect(readModuleMetadata(BacktestingWorkerModule, MODULE_METADATA.IMPORTS)).toContain(BullRootModule)
  })

  it('exports worker processor dependencies from the backtesting module', () => {
    const exports = readModuleMetadata(BacktestingModule, MODULE_METADATA.EXPORTS)

    expect(exports).toContain(BacktestJobsService)
    expect(exports).toContain(BacktestJobExecutorService)
  })
})
