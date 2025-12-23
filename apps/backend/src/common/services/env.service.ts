import type { AppEnv } from '../env/env.accessor'
import { Inject, Injectable } from '@nestjs/common'
// Nest 注入需要运行时引用 ConfigService，保留值导入
 
import { ConfigService } from '@nestjs/config'
import { defaultEnvAccessor, normalizeAppEnv } from '../env/env.accessor'

@Injectable()
export class EnvService {
  constructor(@Inject(ConfigService) private readonly configService: ConfigService) {}

  private resolveAppEnv(): AppEnv {
    const rawAppEnv = this.configService?.get<string>('APP_ENV') ?? process.env.APP_ENV
    if (rawAppEnv) {
      return normalizeAppEnv(rawAppEnv)
    }

    const rawNodeEnv = this.configService?.get<string>('NODE_ENV') ?? process.env.NODE_ENV
    if (rawNodeEnv) {
      return normalizeAppEnv(rawNodeEnv)
    }

    return defaultEnvAccessor.appEnv()
  }

  isProd(): boolean {
    const env = this.resolveAppEnv()
    return env === 'production' || env === 'staging'
  }

  isDev(): boolean {
    const env = this.resolveAppEnv()
    return env === 'development'
  }

  isTest(): boolean {
    const env = this.resolveAppEnv()
    return env === 'test' || env === 'e2e'
  }

  isE2E(): boolean {
    const env = this.resolveAppEnv()
    return env === 'e2e' || env === 'test'
  }

  isDebugMode(): boolean {
    return this.configService?.get<string>('DEBUG') === 'true'
  }

  getString(key: string, defaultValue?: string): string | undefined {
    return this.configService?.get<string>(key, defaultValue)
  }

  getNumber(key: string, defaultValue?: number): number | undefined {
    const value = this.configService?.get<string>(key)
    if (value === undefined)
      return defaultValue
    const parsed = Number(value)
    return Number.isNaN(parsed) ? defaultValue : parsed
  }

  getBoolean(key: string, defaultValue?: boolean): boolean | undefined {
    const value = this.configService?.get<string>(key)
    if (value === undefined)
      return defaultValue
    return value.toLowerCase() === 'true'
  }
}
