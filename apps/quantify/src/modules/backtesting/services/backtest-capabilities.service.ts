import { ErrorCode } from '@ai/shared'
import { HttpStatus, Injectable, Logger } from '@nestjs/common'
import { DomainException } from '@/common/exceptions/domain.exception'
import { normalizeBacktestCapabilityConfig } from '../backtest-capability-config'
// eslint-disable-next-line ts/consistent-type-imports -- Nest DI 需要运行时引用
import { BacktestCapabilitiesRepository } from '../repositories/backtest-capabilities.repository'

export interface BacktestCapabilitiesDto {
  allowedSymbols: string[]
  allowedBaseTimeframes: string[]
}

@Injectable()
export class BacktestCapabilitiesService {
  private readonly logger = new Logger(BacktestCapabilitiesService.name)

  constructor(
    private readonly repository: BacktestCapabilitiesRepository,
  ) {}

  async getCapabilities(requestId?: string): Promise<BacktestCapabilitiesDto> {
    const startedAt = Date.now()
    try {
      const config = await this.repository.findActiveConfig()
      if (!config) {
        throw this.createUnavailableError('missing_active_config')
      }

      const result = normalizeBacktestCapabilityConfig(config)
      if (!result) {
        throw this.createUnavailableError('invalid_active_config')
      }

      this.logger.log(
        `event=backtesting_capabilities_loaded stage=capability requestId=${requestId ?? 'N/A'} durationMs=${Date.now() - startedAt}`,
      )
      return result
    } catch (error) {
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
}
