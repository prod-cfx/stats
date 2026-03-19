import type { OnModuleInit } from '@nestjs/common'
import { Inject, Injectable, Logger } from '@nestjs/common'
// Nest 注入需要运行时引用 CacheService，保留普通导入
import { CacheService } from '@/common/services/cache.service'
import {
  InvalidSettingJsonException,
  JsonExpectedObjectOrArrayException,
} from '../exceptions'
// Nest 注入需要运行时引用 SettingsRepository，保留普通导入
import { SettingsRepository } from '../repositories/settings.repository'
// ^ reorganized imports
import { mergeMaskedJson } from '../utils/mask.util'

interface SettingRecord {
  key: string
  value: string
  type: string
  description?: string
  category?: string
  isSystem?: boolean
}

@Injectable()
export class SettingsService implements OnModuleInit {
  private readonly logger = new Logger(SettingsService.name)
  private readonly cacheKey = 'system:settings'
  private settingsCache: Map<string, unknown> = new Map()

  constructor(
    @Inject(SettingsRepository)
    private readonly settingsRepository: SettingsRepository,
    @Inject(CacheService)
    private readonly cacheService: CacheService,
  ) {}

  async onModuleInit() {
    await this.loadAllSettings()
    this.logger.log('系统配置已加载到内存')
  }

  // 加载所有配置到内存和缓存
  async loadAllSettings(): Promise<void> {
    const settings = await this.settingsRepository.findAll()

    // 清除当前缓存
    this.settingsCache.clear()

    // 加载到内存
    for (const setting of settings) {
      this.settingsCache.set(setting.key, this.parseValue(setting))
    }

    // 更新缓存
    const cacheData = Object.fromEntries(this.settingsCache)
    await this.cacheService.set(this.cacheKey, cacheData)
  }

  // 解析配置值
  private parseValue(setting: SettingRecord): unknown {
    try {
      switch (setting.type) {
        case 'number':
          return Number(setting.value)
        case 'boolean':
          return setting.value.toLowerCase() === 'true'
        case 'json':
          return JSON.parse(setting.value)
        case 'string':
        default:
          return setting.value
      }
    }
    catch (error) {
      const errorMsg = error instanceof Error ? error.stack : String(error)
      this.logger.error(`解析配置值失败: ${setting.key}`, errorMsg)
      return setting.value // 解析失败返回原始字符串
    }
  }

  // 获取配置值
  async get<T>(key: string, defaultValue?: T): Promise<T | undefined> {
    // 先从内存中获取
    if (this.settingsCache.has(key)) {
      return this.settingsCache.get(key) as T
    }

    // 如果内存中没有，尝试从数据库加载
    const setting = await this.settingsRepository.findByKey(key)
    if (setting) {
      const value = this.parseValue(setting)
      this.settingsCache.set(key, value)
      return value as T
    }

    return defaultValue
  }

  /**
   * 获取 JSON 类型配置并自动解析为对象或数组
   */
  async getJson<T = unknown>(key: string, defaultValue?: T): Promise<T | undefined> {
    return this.get<T>(key, defaultValue)
  }

  /**
   * 获取数字类型配置，解析失败时回退到默认值
   */
  async getNumber(key: string, defaultValue?: number): Promise<number | undefined> {
    return this.get<number>(key, defaultValue)
  }

  /**
   * 获取布尔类型配置，解析失败时回退到默认值
   */
  async getBoolean(key: string, defaultValue?: boolean): Promise<boolean | undefined> {
    return this.get<boolean>(key, defaultValue)
  }

  /**
   * 获取字符串类型配置
   */
  async getString(key: string, defaultValue?: string): Promise<string | undefined> {
    return this.get<string>(key, defaultValue)
  }

  // 设置配置值
  async set(
    key: string,
    value: unknown,
    options?: {
      type?: string
      description?: string
      category?: string
      isSystem?: boolean
    },
  ): Promise<SettingRecord> {
    const existingSetting = await this.settingsRepository.findByKey(key)

    // 确定值的类型
    let type = options?.type
    if (!type) {
      if (typeof value === 'number')
        type = 'number'
      else if (typeof value === 'boolean')
        type = 'boolean'
      else if (typeof value === 'object')
        type = 'json'
      else type = 'string'
    }

    // 转换值为字符串（含敏感 JSON 合并逻辑）
    let stringValue: string
    if (type === 'json') {
      // 规范：允许传入字符串或对象
      let incoming: unknown = value
      if (typeof incoming === 'string') {
        try {
          incoming = JSON.parse(incoming)
        }
        catch {
          // fallback：对于需要自动数组化的键单独处理
          if (this.shouldConvertStringToArray(key)) {
            incoming = [value]
          }
          else {
            // JSON 类型但无法解析，直接报错，避免存入不合法 JSON
            throw new InvalidSettingJsonException({ key, error: 'JSON parse failed' })
          }
        }
      }

      // JSON 类型必须是对象或数组
      const isObjOrArray = typeof incoming === 'object' && incoming !== null
      if (!isObjOrArray) {
        throw new JsonExpectedObjectOrArrayException({ key, actualType: typeof incoming })
      }
      // 针对敏感 JSON：若包含掩码值，进行与现有值的深度合并，保留未修改的真实值
      if (key === 'payment.wgqpay' || key === 'payment.webhookSecrets') {
        if (existingSetting && existingSetting.type === 'json') {
          try {
            const current = JSON.parse(existingSetting.value)
            incoming = mergeMaskedJson(current, incoming)
          }
          catch {
            // ignore merge error, fallback to incoming
          }
        }
      }
      stringValue = JSON.stringify(incoming)
    }
    else {
      stringValue = String(value)
    }

    const description = options?.description ?? existingSetting?.description
    const category = options?.category ?? existingSetting?.category ?? 'general'
    const isSystem = options?.isSystem ?? existingSetting?.isSystem ?? false

    // 保存到数据库
    const setting = await this.settingsRepository.upsert({
      key,
      value: stringValue,
      type,
      description,
      category,
      isSystem,
    })

    // 更新内存缓存
    this.settingsCache.set(key, this.parseValue(setting))

    // 更新缓存
    const cacheData = Object.fromEntries(this.settingsCache)
    await this.cacheService.set(this.cacheKey, cacheData)

    return setting
  }

  // 删除配置
  async delete(key: string): Promise<SettingRecord> {
    const setting = await this.settingsRepository.delete(key)

    // 更新内存缓存
    this.settingsCache.delete(key)

    // 更新缓存
    const cacheData = Object.fromEntries(this.settingsCache)
    await this.cacheService.set(this.cacheKey, cacheData)

    return setting
  }

  // 获取所有配置
  async getAllSettings(): Promise<SettingRecord[]> {
    return this.settingsRepository.findAll()
  }

  // 按分类获取配置
  async getSettingsByCategory(category: string): Promise<SettingRecord[]> {
    return this.settingsRepository.findByCategory(category)
  }

  // 判断是否需要将单个字符串转换为数组
  private shouldConvertStringToArray(key: string): boolean {
    // 对于这些配置项，如果输入的是字符串，自动转换为数组
    const stringToArrayKeys = [
      'debug.chat.userIds',
      // 可以在这里添加其他需要自动转换的配置项
    ]
    return stringToArrayKeys.includes(key)
  }
}
