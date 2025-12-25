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
      void this.tick()
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

  private async tick(): Promise<void> {
    if (this.isRunning) return
    this.isRunning = true

    try {
      const configs = await this.orderbookPairConfigService.findEnabledConfigs()
      const grouped = this.groupByAdapterKey(configs)

      // 先确保连接，后同步订阅；即使目标为空也调用，以便做退订清理
      for (const adapter of this.adapters) {
        const target = grouped.get(adapter.key) ?? []
        try {
          await adapter.ensureConnected()
          await adapter.syncTargetConfigs(target)
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

