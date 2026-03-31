import { Injectable, Logger } from '@nestjs/common'
// eslint-disable-next-line ts/consistent-type-imports -- Nest DI 需要运行时引用
import { BacktestCapabilitiesRepository } from '../repositories/backtest-capabilities.repository'

export interface BacktestCapabilitiesConfigRecord {
  allowedSymbols?: unknown
  allowedBaseTimeframes?: unknown
}

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
      const result = !config
        ? {
            allowedSymbols: [],
            allowedBaseTimeframes: [],
          }
        : {
            allowedSymbols: this.normalizeStringArray(config.allowedSymbols),
            allowedBaseTimeframes: this.normalizeStringArray(config.allowedBaseTimeframes),
          }

      this.logger.log(
        `event=backtesting_capabilities_loaded requestId=${requestId ?? 'N/A'} durationMs=${Date.now() - startedAt}`,
      )
      return result
    } catch (error) {
      this.logger.error(
        `event=backtesting_capabilities_failed requestId=${requestId ?? 'N/A'} reason=${this.describeError(error)} durationMs=${Date.now() - startedAt}`,
      )
      throw error
    }
  }

  private normalizeStringArray(raw: unknown): string[] {
    if (!Array.isArray(raw)) {
      return []
    }

    const normalized: string[] = []
    for (const item of raw) {
      if (typeof item !== 'string') {
        return []
      }

      const value = item.trim()
      if (!value) {
        return []
      }
      normalized.push(value)
    }
    return normalized
  }

  private describeError(error: unknown): string {
    if (error instanceof Error) {
      return error.message
    }
    return String(error)
  }
}
