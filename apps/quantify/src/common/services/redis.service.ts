import type { LoggerService, OnApplicationShutdown } from '@nestjs/common'
import { Inject, Injectable } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import Redis from 'ioredis'
import { WINSTON_MODULE_NEST_PROVIDER } from 'nest-winston'
import { defaultEnvAccessor } from '../env/env.accessor'

@Injectable()
export class RedisService implements OnApplicationShutdown {
  private readonly client: Redis
  private readonly offlinePlaceholder: boolean

  constructor(
    @Inject(ConfigService) private readonly configService: ConfigService,
    @Inject(WINSTON_MODULE_NEST_PROVIDER) private readonly logger: LoggerService,
  ) {
    this.logger.debug?.('[RedisService] constructor: creating client...')
    try {
      this.client = this.createClient()
      this.offlinePlaceholder = !this.configService.get<string>('redis.url')
        && defaultEnvAccessor.bool('SKIP_PRISMA_CONNECT', false)
      this.logger.debug?.('[RedisService] constructor: client created successfully')
      this.registerEvents()
    } catch (error) {
      this.logger.error?.('[RedisService] constructor: failed to create client', error as Error)
      throw error
    }
  }

  private createClient(): Redis {
    const url = this.configService.get<string>('redis.url')
    if (url) {
      this.logger.debug?.('[RedisService] createClient: using URL connection (url present)')
      return new Redis(url)
    }

    if (defaultEnvAccessor.bool('SKIP_PRISMA_CONNECT', false)) {
      this.logger.warn?.('[RedisService] offline mode detected, creating lazy Redis client placeholder')
      return new Redis({
        host: '127.0.0.1',
        port: 0,
        lazyConnect: true,
        maxRetriesPerRequest: 0,
        enableOfflineQueue: false,
      })
    }

    throw new Error('Redis configuration is incomplete. Please set REDIS_URL.')
  }

  private registerEvents(): void {
    this.client.on('ready', () => {
      try {
        this.logger.log('[RedisService] Redis connection is ready')
      } catch {}
    })

    this.client.on('error', error => {
      try {
        this.logger.error(
          JSON.stringify({
            event: 'redis_connection_error',
            message: error?.message,
          }),
          error?.stack,
        )
      } catch {}
    })
  }

  getClient(): Redis {
    return this.client
  }

  isReady(): boolean {
    return this.client?.status === 'ready'
  }

  async onApplicationShutdown(): Promise<void> {
    if (this.offlinePlaceholder) {
      this.client.disconnect()
      return
    }

    try {
      await this.client.quit()
    } catch (error) {
      this.logger.error('[RedisService] Failed to quit redis connection gracefully', error as Error)
      try {
        this.client.disconnect()
      } catch {}
    }
  }
}
