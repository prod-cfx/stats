import { Injectable } from '@nestjs/common'
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
  constructor(
    private readonly repository: BacktestCapabilitiesRepository,
  ) {}

  async getCapabilities(): Promise<BacktestCapabilitiesDto> {
    const config = await this.repository.findActiveConfig()
    if (!config) {
      return {
        allowedSymbols: [],
        allowedBaseTimeframes: [],
      }
    }

    return {
      allowedSymbols: this.normalizeStringArray(config.allowedSymbols),
      allowedBaseTimeframes: this.normalizeStringArray(config.allowedBaseTimeframes),
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
}
