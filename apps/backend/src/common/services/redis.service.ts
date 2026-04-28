import type { LoggerService, OnApplicationShutdown } from '@nestjs/common'
import { ErrorCode } from '@ai/shared'
import { HttpStatus, Inject, Injectable } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import Redis from 'ioredis'
import { WINSTON_MODULE_NEST_PROVIDER } from 'nest-winston'
import { DomainException } from '@/common/exceptions/domain.exception'

@Injectable()
export class RedisService implements OnApplicationShutdown {
  private readonly client: Redis

  constructor(
    @Inject(ConfigService) private readonly configService: ConfigService,
    @Inject(WINSTON_MODULE_NEST_PROVIDER) private readonly logger: LoggerService,
  ) {
    this.logger.debug?.('[RedisService] constructor: creating client...')
    try {
      if (this.configService.get<boolean>('USE_MOCK_DATA', false)) {
        this.logger.warn('[RedisService] USE_MOCK_DATA is true, using mock redis client')
        this.client = this.createMockClient()
      } else {
        this.client = this.createClient()
      }
      this.logger.debug?.('[RedisService] constructor: client created successfully')
      this.registerEvents()
    } catch (error) {
      this.logger.error?.('[RedisService] constructor: failed to create client, falling back to mock client', error as Error)
      this.client = this.createMockClient()
    }
  }

  private createMockClient(): Redis {
    // Return a dummy object that looks like Redis but does nothing
    return {
      on: () => {},
      status: 'ready',
      quit: async () => {},
      disconnect: () => {},
      get: async () => null,
      set: async () => 'OK',
      del: async () => 0,
    } as unknown as Redis
  }

  private createClient(): Redis {
    const url = this.configService.get<string>('redis.url')
    if (url) {
      this.logger.debug?.('[RedisService] createClient: using URL connection (url present)')
      return new Redis(url)
    }

    throw new DomainException('redis.connection_error', {
      code: ErrorCode.REDIS_CONNECTION_ERROR,
      status: HttpStatus.INTERNAL_SERVER_ERROR,
      args: { reason: 'Redis configuration is incomplete. Please set REDIS_URL.' },
    })
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

