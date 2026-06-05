import { ErrorCode } from '@ai/shared'
import { HttpStatus, Injectable, Logger } from '@nestjs/common'
import { DomainException } from '@/common/exceptions/domain.exception'
import { normalizeBacktestCapabilityConfig } from '../backtest-capability-config'
// eslint-disable-next-line ts/consistent-type-imports -- Nest DI 需要运行时引用
import { BacktestCapabilitiesRepository } from '../repositories/backtest-capabilities.repository'

export interface BacktestCapabilitiesDto {
  allowedBaseTimeframes: string[]
}

const BACKTEST_CAPABILITIES_LOOKUP_TIMEOUT_MS = 1_500

@Injectable()
export class BacktestCapabilitiesService {
  private readonly logger = new Logger(BacktestCapabilitiesService.name)
  private lastSuccessfulCapabilities: BacktestCapabilitiesDto | null = null

  constructor(
    private readonly repository: BacktestCapabilitiesRepository,
  ) {}

  async getCapabilities(requestId?: string): Promise<BacktestCapabilitiesDto> {
    const startedAt = Date.now()
    try {
      const config = await this.withLookupTimeout(this.repository.findActiveConfig())
      if (!config) {
        throw this.createUnavailableError('missing_active_config')
      }

      const result = normalizeBacktestCapabilityConfig(config)
      if (!result) {
        throw this.createUnavailableError('invalid_active_config')
      }

      const response: BacktestCapabilitiesDto = {
        allowedBaseTimeframes: result.allowedBaseTimeframes,
      }

      this.logger.log(
        `event=backtesting_capabilities_loaded stage=capability requestId=${requestId ?? 'N/A'} durationMs=${Date.now() - startedAt}`,
      )
      this.lastSuccessfulCapabilities = response
      return response
    } catch (error) {
      if (this.lastSuccessfulCapabilities) {
        this.logger.warn(
          `event=backtesting_capabilities_fallback stage=capability requestId=${requestId ?? 'N/A'} reason=${this.describeError(error)} durationMs=${Date.now() - startedAt}`,
        )
        return this.lastSuccessfulCapabilities
      }

      this.logger.error(
        `event=backtesting_capabilities_failed stage=capability requestId=${requestId ?? 'N/A'} reason=${this.describeError(error)} durationMs=${Date.now() - startedAt}`,
      )
      throw error
    }
  }

  private createUnavailableError(reason: 'missing_active_config' | 'invalid_active_config'): DomainException {
    return new DomainException('backtesting.capabilities_unavailable', {
      code: ErrorCode.SERVICE_TEMPORARILY_UNAVAILABLE,
      status: HttpStatus.SERVICE_UNAVAILABLE,
      args: { reason },
    })
  }

  private describeError(error: unknown): string {
    if (error instanceof Error) {
      return error.message
    }
    return String(error)
  }

  private withLookupTimeout<T>(promise: Promise<T>): Promise<T> {
    let timer: ReturnType<typeof setTimeout> | undefined
    const timeout = new Promise<never>((_, reject) => {
      timer = setTimeout(() => reject(new Error('capabilities lookup timed out')), BACKTEST_CAPABILITIES_LOOKUP_TIMEOUT_MS)
      timer.unref?.()
    })

    return Promise.race([promise, timeout]).finally(() => {
      if (timer) clearTimeout(timer)
    })
  }
}
