/* eslint-disable perfectionist/sort-imports */

import type { OrderbookAdapterKey, OrderbookWsAdapter } from './orderbook-ws-adapter'
import type { OnApplicationShutdown, OnModuleInit } from '@nestjs/common'
import type { OrderbookPairConfig } from '@prisma/client'
import { Inject, Injectable, Logger } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
// Nest 注入需要运行时引用 Service，保留值导入
// eslint-disable-next-line ts/consistent-type-imports
import { OrderbookPairConfigService } from '@/modules/orderbook-config/services/orderbook-pair-config.service'
import { ORDERBOOK_WS_ADAPTER_REGISTRY } from '../data-sync.tokens'
import { toAdapterKey } from './orderbook-ws-adapter'

@Injectable()
export class OrderbookWsSyncManager implements OnModuleInit, OnApplicationShutdown {
  private readonly logger = new Logger(OrderbookWsSyncManager.name)
  private timer: NodeJS.Timeout | null = null
  private isRunning = false
  // 记录当前哪些 adapter 处于「活跃」状态（至少有一个目标配置）
  private readonly activeAdapters = new Map<OrderbookAdapterKey, boolean>()

  constructor(
    @Inject(ConfigService)
    private readonly configService: ConfigService,
    private readonly orderbookPairConfigService: OrderbookPairConfigService,
    @Inject(ORDERBOOK_WS_ADAPTER_REGISTRY)
    private readonly adapters: OrderbookWsAdapter[],
  ) {}

  async onModuleInit(): Promise<void> {
    const enabled = this.isEnabled()
    if (!enabled) {
      this.logger.log('Orderbook WS sync is disabled (set ORDERBOOK_WS_ENABLED=true to enable)')
      return
    }

    const intervalMs = this.getSyncIntervalMs()
    this.logger.log(`Orderbook WS sync enabled, interval=${intervalMs}ms, adapters=${this.adapters.length}`)

    // 立即执行一次，避免等待首个 interval
    await this.tick().catch((err) => {
      this.logger.error(`Orderbook WS sync initial tick failed: ${err instanceof Error ? err.message : String(err)}`)
    })

    this.timer = setInterval(() => {
      void this.tick().catch(err => {
        this.logger.error(
          `Orderbook WS sync tick failed: ${err instanceof Error ? err.message : String(err)}`,
        )
      })
    }, intervalMs)
  }

  async onApplicationShutdown(): Promise<void> {
    if (this.timer) {
      clearInterval(this.timer)
      this.timer = null
    }

    await Promise.allSettled(this.adapters.map(a => a.shutdown()))
  }

  private isEnabled(): boolean {
    const raw = this.configService.get<string>('ORDERBOOK_WS_ENABLED')
    return typeof raw === 'string' ? raw.toLowerCase() === 'true' : Boolean(raw)
  }

  private getSyncIntervalMs(): number {
    const raw = this.configService.get<number>('ORDERBOOK_WS_SYNC_INTERVAL_MS')
    const ms = typeof raw === 'number' && Number.isFinite(raw) ? raw : 5_000
    return Math.max(1_000, Math.floor(ms))
  }

  /**
   * 检查特定 adapter 是否通过环境变量启用
   * 环境变量命名规则: ORDERBOOK_{VENUE}_ENABLED
   * 例如: ORDERBOOK_BITMAX_ENABLED, ORDERBOOK_BINANCE_ENABLED
   * 未配置时默认启用
   */
  private isAdapterEnabled(key: OrderbookAdapterKey): boolean {
    // 从 key 中提取 venue 名称 (格式: VENUE.VENUE_TYPE.INSTRUMENT_TYPE)
    const venue = key.split('.')[0]
    const envKey = `ORDERBOOK_${venue}_ENABLED`
    const raw = this.configService.get<string>(envKey)
    // 未配置时默认为 true
    if (raw === undefined || raw === null) return true
    return typeof raw === 'string' ? raw.toLowerCase() === 'true' : Boolean(raw)
  }

  private async tick(): Promise<void> {
    if (this.isRunning) return
    this.isRunning = true

    try {
      const configs = await this.orderbookPairConfigService.findEnabledConfigs()
      const grouped = this.groupByAdapterKey(configs)

      // 按 adapter 维度增量管理连接：
      // - 有目标配置 → 确保连接 + 同步订阅
      // - 无目标配置且之前有过 → 做一次退订清理后关闭连接
      // - 无目标配置且之前也没有 → 不做任何操作，避免无意义连接
      for (const adapter of this.adapters) {
        const target = grouped.get(adapter.key) ?? []
        const wasActive = this.activeAdapters.get(adapter.key) === true
        // 检查 per-adapter 环境变量开关
        if (!this.isAdapterEnabled(adapter.key)) {
          if (wasActive) {
            await adapter.syncTargetConfigs([])
            await adapter.shutdown()
            this.activeAdapters.set(adapter.key, false)
          }
          continue
        }
        const hasTarget = target.length > 0

        try {
          if (hasTarget) {
            await adapter.ensureConnected()
            await adapter.syncTargetConfigs(target)
            if (!wasActive) this.activeAdapters.set(adapter.key, true)
          } else if (wasActive) {
            // 目标从非空变为空：做一次退订/状态清理，然后关闭连接
            await adapter.syncTargetConfigs([])
            await adapter.shutdown()
            this.activeAdapters.set(adapter.key, false)
          }
        } catch (error) {
          this.logger.error(
            `Orderbook WS adapter sync failed: key=${adapter.key} error=${error instanceof Error ? error.message : String(error)}`,
          )
        }
      }
    } finally {
      this.isRunning = false
    }
  }

  private groupByAdapterKey(configs: OrderbookPairConfig[]): Map<OrderbookAdapterKey, OrderbookPairConfig[]> {
    const map = new Map<OrderbookAdapterKey, OrderbookPairConfig[]>()
    for (const cfg of configs) {
      const key = toAdapterKey(cfg)
      const arr = map.get(key)
      if (arr) arr.push(cfg)
      else map.set(key, [cfg])
    }
    return map
  }
}
