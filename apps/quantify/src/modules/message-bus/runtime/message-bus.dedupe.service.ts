import type { OnModuleInit } from '@nestjs/common'
import { Injectable, Logger } from '@nestjs/common'
// eslint-disable-next-line ts/consistent-type-imports -- Nest DI 需要运行时引用
import { CacheService } from '@/common/services/cache.service'
import { MESSAGE_DEDUPE_PREFIX } from '../message-bus.types'

@Injectable()
export class MessageBusDedupeService implements OnModuleInit {
  private static _instance: MessageBusDedupeService | undefined
  private readonly logger = new Logger(MessageBusDedupeService.name)

  static getInstance(): MessageBusDedupeService | undefined {
    return this._instance
  }

  constructor(private readonly cache: CacheService) {}

  onModuleInit() {
    MessageBusDedupeService._instance = this
    this.logger.log('Dedupe runtime initialized')
  }

  async setIfNotExists(key: string, ttlSec: number): Promise<boolean> {
    return this.cache.setIfNotExists(key, '1', ttlSec)
  }

  buildKey(raw: string): string {
    return `${MESSAGE_DEDUPE_PREFIX}${raw}`
  }

  async del(key: string): Promise<void> {
    await this.cache.del(key)
  }
}
