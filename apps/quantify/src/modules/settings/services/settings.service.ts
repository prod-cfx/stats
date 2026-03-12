import type { OnModuleInit } from '@nestjs/common'
import { Inject, Injectable, Logger } from '@nestjs/common'
// Nest 娉ㄥ叆闇€瑕佽繍琛屾椂寮曠敤 CacheService锛屼繚鐣欏€煎鍏?
import { CacheService } from '@/common/services/cache.service'
import {
  InvalidSettingJsonException,
  JsonExpectedObjectOrArrayException,
} from '../exceptions'
// Nest 娉ㄥ叆闇€瑕佽繍琛屾椂寮曠敤 SettingsRepository锛屼繚鐣欏€煎鍏?
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
    this.logger.log('绯荤粺閰嶇疆宸插姞杞藉埌鍐呭瓨')
  }

  // 鍔犺浇鎵€鏈夐厤缃埌鍐呭瓨鍜岀紦瀛?
  async loadAllSettings(): Promise<void> {
    const settings = await this.settingsRepository.findAll()

    // 娓呴櫎褰撳墠缂撳瓨
    this.settingsCache.clear()

    // 鍔犺浇鍒板唴瀛?
    for (const setting of settings) {
      this.settingsCache.set(setting.key, this.parseValue(setting))
    }

    // 鏇存柊缂撳瓨
    const cacheData = Object.fromEntries(this.settingsCache)
    await this.cacheService.set(this.cacheKey, cacheData)
  }

  // 瑙ｆ瀽閰嶇疆鍊?
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
      this.logger.error(`瑙ｆ瀽閰嶇疆鍊煎け璐? ${setting.key}`, errorMsg)
      return setting.value // 瑙ｆ瀽澶辫触杩斿洖鍘熷瀛楃涓?
    }
  }

  // 鑾峰彇閰嶇疆鍊?
  async get<T>(key: string, defaultValue?: T): Promise<T | undefined> {
    // 鍏堜粠鍐呭瓨涓幏鍙?
    if (this.settingsCache.has(key)) {
      return this.settingsCache.get(key) as T
    }

    // 濡傛灉鍐呭瓨涓病鏈夛紝灏濊瘯浠庢暟鎹簱鍔犺浇
    const setting = await this.settingsRepository.findByKey(key)
    if (setting) {
      const value = this.parseValue(setting)
      this.settingsCache.set(key, value)
      return value as T
    }

    return defaultValue
  }

  /**
   * 鑾峰彇 JSON 绫诲瀷閰嶇疆骞惰嚜鍔ㄨВ鏋愪负瀵硅薄鎴栨暟缁?
   */
  async getJson<T = unknown>(key: string, defaultValue?: T): Promise<T | undefined> {
    return this.get<T>(key, defaultValue)
  }

  /**
   * 鑾峰彇鏁板€肩被鍨嬮厤缃紝瑙ｆ瀽澶辫触鏃跺洖閫€榛樿鍊?
   */
  async getNumber(key: string, defaultValue?: number): Promise<number | undefined> {
    return this.get<number>(key, defaultValue)
  }

  /**
   * 鑾峰彇甯冨皵绫诲瀷閰嶇疆锛岃В鏋愬け璐ユ椂鍥為€€榛樿鍊?
   */
  async getBoolean(key: string, defaultValue?: boolean): Promise<boolean | undefined> {
    return this.get<boolean>(key, defaultValue)
  }

  /**
   * 鑾峰彇瀛楃涓茬被鍨嬮厤缃?
   */
  async getString(key: string, defaultValue?: string): Promise<string | undefined> {
    return this.get<string>(key, defaultValue)
  }

  // 璁剧疆閰嶇疆鍊?
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

    // 纭畾鍊肩殑绫诲瀷
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

    // 杞崲鍊间负瀛楃涓诧紙鍚晱鎰?JSON 鍚堝苟閫昏緫锛?
    let stringValue: string
    if (type === 'json') {
      // 瑙勮寖锛氬厑璁镐紶鍏ュ瓧绗︿覆鎴栧璞?
      let incoming: unknown = value
      if (typeof incoming === 'string') {
        try {
          incoming = JSON.parse(incoming)
        }
        catch {
          // fallback锛氬浜庨渶瑕佽嚜鍔ㄦ暟缁勫寲鐨勯敭鍗曠嫭澶勭悊
          if (this.shouldConvertStringToArray(key)) {
            incoming = [value]
          }
          else {
            // JSON 绫诲瀷浣嗘棤娉曡В鏋愶紝鐩存帴鎶ラ敊锛岄伩鍏嶅瓨鍏ヤ笉鍚堟硶 JSON
            throw new InvalidSettingJsonException({ key, error: 'JSON parse failed' })
          }
        }
      }

      // JSON 绫诲瀷蹇呴』鏄璞℃垨鏁扮粍
      const isObjOrArray = typeof incoming === 'object' && incoming !== null
      if (!isObjOrArray) {
        throw new JsonExpectedObjectOrArrayException({ key, actualType: typeof incoming })
      }
      // 閽堝鏁忔劅 JSON锛氳嫢鍖呭惈鎺╃爜鍊硷紝杩涜涓庣幇鏈夊€肩殑娣卞害鍚堝苟锛屼繚鐣欐湭淇敼鐨勭湡瀹炲€?
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

    // 淇濆瓨鍒版暟鎹簱
    const setting = await this.settingsRepository.upsert({
      key,
      value: stringValue,
      type,
      description,
      category,
      isSystem,
    })

    // 鏇存柊鍐呭瓨缂撳瓨
    this.settingsCache.set(key, this.parseValue(setting))

    // 鏇存柊缂撳瓨
    const cacheData = Object.fromEntries(this.settingsCache)
    await this.cacheService.set(this.cacheKey, cacheData)

    return setting
  }

  // 鍒犻櫎閰嶇疆
  async delete(key: string): Promise<SettingRecord> {
    const setting = await this.settingsRepository.delete(key)

    // 鏇存柊鍐呭瓨缂撳瓨
    this.settingsCache.delete(key)

    // 鏇存柊缂撳瓨
    const cacheData = Object.fromEntries(this.settingsCache)
    await this.cacheService.set(this.cacheKey, cacheData)

    return setting
  }

  // 鑾峰彇鎵€鏈夐厤缃?
  async getAllSettings(): Promise<SettingRecord[]> {
    return this.settingsRepository.findAll()
  }

  // 鎸夊垎绫昏幏鍙栭厤缃?
  async getSettingsByCategory(category: string): Promise<SettingRecord[]> {
    return this.settingsRepository.findByCategory(category)
  }

  // 鍒ゆ柇鏄惁闇€瑕佸皢鍗曚釜瀛楃涓茶浆鎹负鏁扮粍
  private shouldConvertStringToArray(key: string): boolean {
    // 瀵逛簬杩欎簺閰嶇疆椤癸紝濡傛灉杈撳叆鐨勬槸瀛楃涓诧紝鑷姩杞崲涓烘暟缁?
    const stringToArrayKeys = [
      'debug.chat.userIds',
      // 鍙互鍦ㄨ繖閲屾坊鍔犲叾浠栭渶瑕佽嚜鍔ㄨ浆鎹㈢殑閰嶇疆椤?
    ]
    return stringToArrayKeys.includes(key)
  }
}
