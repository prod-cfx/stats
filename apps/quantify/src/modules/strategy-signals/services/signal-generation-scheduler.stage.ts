import type { Logger } from '@nestjs/common'
import type { SchedulerRegistry } from '@nestjs/schedule'
import type { StrategySignalsRuntimeConfig } from '../types/strategy-signals-config.type'
import { CronJob } from 'cron'

export class SignalGenerationSchedulerStage {
  constructor(
    private readonly schedulerRegistry: Pick<SchedulerRegistry, 'addCronJob' | 'deleteCronJob'>,
    private readonly logger: Pick<Logger, 'warn' | 'error' | 'log'>,
  ) {}

  registerCronJob(
    cronJobName: string,
    cronExpression: string,
    existingJob: CronJob | undefined,
    onTick: () => Promise<void>,
  ): CronJob {
    if (existingJob) {
      existingJob.stop()
      this.schedulerRegistry.deleteCronJob(cronJobName)
    }

    const cronJob = new CronJob(cronExpression, async () => {
      try {
        await onTick()
      } catch (error) {
        const detail = error instanceof Error ? (error.stack ?? error.message) : String(error)
        this.logger.error(`Signal generation cron tick failed: ${detail}`)
      }
    })

    this.schedulerRegistry.addCronJob(cronJobName, cronJob)
    cronJob.start()
    this.logger.log(`Strategy signal generator scheduled with cron ${cronExpression}`)
    return cronJob
  }

  async runGenerationCycle(
    config: StrategySignalsRuntimeConfig,
    isRunning: boolean,
    setRunning: (value: boolean) => void,
    generateSignals: () => Promise<void>,
  ) {
    if (!config.enabled) return

    if (isRunning) {
      this.logger.warn(
        'Signal generator is still running from the previous cycle, skipping this tick',
      )
      return
    }

    setRunning(true)
    try {
      await generateSignals()
    } finally {
      setRunning(false)
    }
  }
}
