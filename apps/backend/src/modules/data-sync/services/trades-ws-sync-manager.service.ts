/* eslint-disable perfectionist/sort-imports */

import { ErrorCode } from '@ai/shared'
import type { TradesAdapterKey, TradesConfig, TradesWsAdapter } from './trades-ws-adapter'
import type { OnApplicationShutdown, OnModuleInit } from '@nestjs/common'
import { createHash } from 'node:crypto'
import { HttpStatus, Inject, Injectable, Logger } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { DomainException } from '@/common/exceptions/domain.exception'
import { TRADES_WS_ADAPTER_REGISTRY } from '../data-sync.tokens'
// eslint-disable-next-line ts/consistent-type-imports
import { TradesPairConfigService } from '@/modules/trades-config/services/trades-pair-config.service'

/**
 * Trades WebSocket 同步管理器
 * 负责管理所有交易记录的 WebSocket 订阅适配器
 */
@Injectable()
export class TradesWsSyncManager implements OnModuleInit, OnApplicationShutdown {
  private readonly logger = new Logger(TradesWsSyncManager.name)
  private timer: NodeJS.Timeout | null = null
  private isRunning = false
  private readonly activeAdapters = new Map<TradesAdapterKey, boolean>()
  
  /**
   * 配置哈希值，用于检测配置变更
   * 只有配置发生变化时才重新同步订阅
   */
  private configsHash: string = ''

  constructor(
    @Inject(ConfigService)
    private readonly configService: ConfigService,
    @Inject(TRADES_WS_ADAPTER_REGISTRY)
    private readonly adapters: TradesWsAdapter[],
    private readonly tradesPairConfigService: TradesPairConfigService,
  ) {}

  async onModuleInit(): Promise<void> {
    const enabled = this.isEnabled()
    if (!enabled) {
      this.logger.log('Trades WS sync is disabled (set TRADES_WS_ENABLED=true to enable)')
      return
    }

    const intervalMs = this.getSyncIntervalMs()
    this.logger.log(`Trades WS sync enabled, interval=${intervalMs}ms, adapters=${this.adapters.length}`)

    // 立即执行一次
    await this.tick().catch((err) => {
      this.logger.error(`Trades WS sync initial tick failed: ${err instanceof Error ? err.message : String(err)}`)
    })

    this.timer = setInterval(() => {
      void this.tick().catch(err => {
        this.logger.error(
          `Trades WS sync tick failed: ${err instanceof Error ? err.message : String(err)}`,
        )
      })
    }, intervalMs)
  }

  async onApplicationShutdown(): Promise<void> {
    if (this.timer) {
      clearInterval(this.timer)
      this.timer = null
    }

    if (!this.adapters.length) return

    const results = await Promise.allSettled(this.adapters.map(a => a.shutdown()))

    const failed: string[] = []

    results.forEach((result, index) => {
      if (result.status === 'rejected') {
        const adapter = this.adapters[index]
        const reason =
          result.reason instanceof Error ? result.reason.message : String(result.reason)
        failed.push(`${adapter.key}: ${reason}`)
        this.logger.error(
          `Trades WS adapter shutdown failed for key=${adapter.key}: ${reason}`,
        )
      }
    })

    if (failed.length) {
      throw new DomainException(
        'data_sync.trades_ws_sync_manager.shutdown_failed',
        { code: ErrorCode.DATA_SYNC_API_ERROR, status: HttpStatus.INTERNAL_SERVER_ERROR, args: { reason: `Trades WS sync manager shutdown failed for adapters: ${failed.join('; ')}` } },
      )
    }
  }

  private isEnabled(): boolean {
    const raw = this.configService.get<string>('TRADES_WS_ENABLED')
    return typeof raw === 'string' ? raw.toLowerCase() === 'true' : Boolean(raw)
  }

  private getSyncIntervalMs(): number {
    const raw = this.configService.get<string>('TRADES_WS_SYNC_INTERVAL_MS')
    const parsed = raw != null ? Number(raw) : Number.NaN
    const ms = Number.isFinite(parsed) && parsed > 0 ? parsed : 10_000
    return Math.max(1_000, Math.floor(ms))
  }

  private async tick(): Promise<void> {
    if (this.isRunning) return
    this.isRunning = true

    try {
      const configs = await this.getTradesConfigs()

      // 计算配置哈希，检测变更
      const newHash = this.computeConfigHash(configs)
      if (newHash === this.configsHash) {
        // 配置未变化，跳过本次同步
        return
      }

      this.logger.log(`Config changed, syncing subscriptions (hash: ${newHash.slice(0, 8)}...)`)

      const grouped = this.groupByAdapterKey(configs)
      let allSucceeded = true

      for (const adapter of this.adapters) {
        const target = grouped.get(adapter.key) ?? []
        const hasTarget = target.length > 0
        const wasActive = this.activeAdapters.get(adapter.key) === true

        try {
          if (hasTarget) {
            await adapter.ensureConnected()
            await adapter.syncTargetConfigs(target)
            if (!wasActive) this.activeAdapters.set(adapter.key, true)
          } else if (wasActive) {
            await adapter.syncTargetConfigs([])
            await adapter.shutdown()
            this.activeAdapters.set(adapter.key, false)
          }
        } catch (error) {
          allSucceeded = false
          this.logger.error(
            `Trades WS adapter=${adapter.key} sync failed: ${error instanceof Error ? error.message : String(error)}`,
          )
        }
      }

      // 只有在所有适配器同步成功时才更新哈希；否则保留旧哈希以便下次继续重试
      if (allSucceeded) {
        this.configsHash = newHash
      } else {
        this.logger.warn(
          `Trades WS sync not fully successful, will retry on next tick (hash unchanged: ${this.configsHash?.slice(0, 8) ?? 'none'})`,
        )
      }
    } finally {
      this.isRunning = false
    }
  }

  /**
   * 从数据库获取交易记录订阅配置
   */
  private async getTradesConfigs(): Promise<TradesConfig[]> {
    const dbConfigs = await this.tradesPairConfigService.findEnabledConfigs()
    
    return dbConfigs.map(config => ({
      exchange: config.exchange,
      instrumentType: config.instrumentType as 'SPOT' | 'PERPETUAL' | 'FUTURE',
      symbol: config.symbol,
      baseAsset: config.baseAsset,
      quoteAsset: config.quoteAsset,
      enabled: config.enabled,
      priority: config.priority,
      metadata: config.metadata,
    }))
  }

  private groupByAdapterKey(configs: TradesConfig[]): Map<TradesAdapterKey, TradesConfig[]> {
    const map = new Map<TradesAdapterKey, TradesConfig[]>()
    
    for (const cfg of configs) {
      if (!cfg.enabled) continue
      
      const key = this.toAdapterKey(cfg)
      if (!key) continue

      let list = map.get(key)
      if (!list) {
        list = []
        map.set(key, list)
      }
      list.push(cfg)
    }

    return map
  }

  private toAdapterKey(cfg: TradesConfig): TradesAdapterKey | null {
    const exchange = cfg.exchange.toUpperCase()
    const instrument = cfg.instrumentType

    if (exchange === 'OKX') {
      if (instrument === 'SPOT') return 'okx-spot-trades'
      if (instrument === 'PERPETUAL') return 'okx-perp-trades'
      if (instrument === 'FUTURE') return 'okx-future-trades'
    }

    if (exchange === 'BINANCE') {
      if (instrument === 'SPOT') return 'binance-spot-trades'
      if (instrument === 'PERPETUAL') return 'binance-perp-trades'
      if (instrument === 'FUTURE') return 'binance-future-trades'
    }

    if (exchange === 'HYPERLIQUID') {
      if (instrument === 'PERPETUAL') return 'hyperliquid-perp-trades'
    }

    return null
  }

  /**
   * 计算配置哈希，用于检测配置变更
   * 只比较会影响订阅行为的关键字段：
   * - exchange / instrumentType / symbol：决定使用哪个适配器与频道
   * - baseAsset / quoteAsset / metadata：影响 instId 解析等订阅细节
   * - enabled / priority：决定是否订阅及优先级
   */
  private computeConfigHash(configs: TradesConfig[]): string {
    // 按 symbol 排序，确保哈希稳定
    const sorted = [...configs].sort((a, b) => {
      const keyA = `${a.exchange}.${a.instrumentType}.${a.symbol}`
      const keyB = `${b.exchange}.${b.instrumentType}.${b.symbol}`
      return keyA.localeCompare(keyB)
    })

    // 只提取关键字段用于哈希计算
    const keyData = sorted.map(cfg => ({
      exchange: cfg.exchange,
      instrumentType: cfg.instrumentType,
      symbol: cfg.symbol,
      baseAsset: cfg.baseAsset,
      quoteAsset: cfg.quoteAsset,
      // 为避免 metadata 格式差异，这里直接序列化为字符串（null 统一为 null）
      metadata: cfg.metadata == null ? null : JSON.stringify(cfg.metadata),
      enabled: cfg.enabled,
      priority: cfg.priority,
    }))

    return createHash('md5')
      .update(JSON.stringify(keyData))
      .digest('hex')
  }
}

