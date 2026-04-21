import { Injectable, Logger } from '@nestjs/common'

interface GenerationResultMeta {
  strategyId: string
  symbolCode: string
  success: boolean
  runtimePhase?: 'binding' | 'activation' | 'execution' | 'consumed'
  reason?: string
}

interface ExecutionSummaryMeta {
  signalId: string
  executed: number
  failed: number
  skipped: number
}

@Injectable()
export class SignalTelemetryService {
  private readonly logger = new Logger(SignalTelemetryService.name)

  recordGeneration(meta: GenerationResultMeta) {
    const { strategyId, symbolCode, success, reason, runtimePhase } = meta
    const phaseSuffix = runtimePhase ? ` phase=${runtimePhase}` : ''
    if (success) {
      const reasonSuffix = reason ? ` reason=${reason}` : ''
      this.logger.log(
        `Signal generation success for strategy=${strategyId} symbol=${symbolCode}${phaseSuffix}${reasonSuffix}`,
      )
    }
    else {
      this.logger.warn(
        `Signal generation skipped for strategy=${strategyId} symbol=${symbolCode}${phaseSuffix}: ${reason ?? 'unknown reason'}`,
      )
    }
  }

  recordExecutionSummary(meta: ExecutionSummaryMeta) {
    this.logger.log(
      `Signal execution summary signal=${meta.signalId}: executed=${meta.executed}, failed=${meta.failed}, skipped=${meta.skipped}`,
    )
  }
}
