import type { GammaMarketsResponse, PolymarketGammaMarket } from './types'
import type { PolymarketConfig } from '@/config/polymarket.config'
import * as path from 'node:path'
import { Injectable, Logger } from '@nestjs/common'
// eslint-disable-next-line ts/consistent-type-imports
import { ConfigService } from '@nestjs/config'

export interface ListMarketsParams {
  limit?: number
  cursor?: string | null
  offset?: number // offset 分页参数
  updatedSince?: string | null
  category?: string | null
  tags?: string[]
  status?: string
  closed?: boolean
  active?: boolean
}

export interface ListMarketsResult {
  markets: PolymarketGammaMarket[]
  nextCursor: string | null
}

@Injectable()
export class PolymarketGammaClient {
  private readonly logger = new Logger(PolymarketGammaClient.name)
  private readonly baseUrl: string
  private readonly apiKey?: string
  private readonly timeoutMs: number
  private readonly maxLimit: number
  private readonly defaultCategory?: string
  private readonly defaultTags: string[]

  constructor(private readonly configService: ConfigService) {
    const cfg = this.configService.get<PolymarketConfig>('polymarket')
    this.baseUrl = cfg?.gamma.baseUrl ?? 'https://gamma-api.polymarket.com'
    this.apiKey = cfg?.gamma.apiKey
    this.timeoutMs = cfg?.gamma.timeoutMs ?? 10_000
    this.maxLimit = cfg?.gamma.maxLimit ?? 200
    this.defaultCategory = cfg?.filters.category
    this.defaultTags = cfg?.filters.tags ?? []
  }

  async listMarkets(params: ListMarketsParams = {}): Promise<ListMarketsResult> {
    // 安全拼接路径，保留 baseUrl 中的路径段
    const url = new URL(this.baseUrl)
    // 使用 path.posix.join 保留原有路径并追加新路径
    url.pathname = path.posix.join(url.pathname, 'markets')
    const limit = Math.max(1, Math.min(this.maxLimit, params.limit ?? this.maxLimit))
    url.searchParams.set('limit', String(limit))

    const cursor = params.cursor ?? undefined
    if (cursor) url.searchParams.set('cursor', cursor)
    
    // offset 分页参数（Gamma API 实际使用）
    const offset = params.offset ?? undefined
    if (offset != null && offset >= 0) url.searchParams.set('offset', String(offset))

    const updatedSince = params.updatedSince ?? undefined
    if (updatedSince) url.searchParams.set('updated_since', updatedSince)

    const category = params.category ?? this.defaultCategory
    if (category) url.searchParams.set('category', category)

    const tags = (params.tags ?? this.defaultTags).filter(Boolean)
    if (tags.length) url.searchParams.set('tags', tags.join(','))

    if (typeof params.closed === 'boolean') {
      url.searchParams.set('closed', String(params.closed))
    }

    if (typeof params.active === 'boolean') {
      url.searchParams.set('active', String(params.active))
    }

    if (params.status) {
      url.searchParams.set('status', params.status)
    }

    const json = await this.fetchJson(url)
    
    // Gamma API 可能返回直接的数组或包含 markets 字段的对象
    let markets: PolymarketGammaMarket[]
    let nextCursor: string | null = null
    
    if (Array.isArray(json)) {
      // 直接返回数组的情况
      markets = json
    } else if (json && typeof json === 'object' && 'markets' in json && Array.isArray(json.markets)) {
      // 返回 {markets: [...], next_cursor: ...} 的情况
      markets = json.markets
      nextCursor = json.next_cursor ?? json.nextCursor ?? null
    } else {
      // 非预期格式，视为错误而非空数据
      this.logger.error(`Unexpected Gamma API response format: ${JSON.stringify(json).substring(0, 500)}`)
      throw new Error(`Gamma API returned unexpected response format. Expected array or object with 'markets' field, got: ${typeof json}`)
    }

    return {
      markets,
      nextCursor,
    }
  }

  private async fetchJson(url: URL): Promise<GammaMarketsResponse | PolymarketGammaMarket[]> {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), this.timeoutMs)
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    }
    if (this.apiKey) {
      headers['x-api-key'] = this.apiKey
    }

    try {
      const response = await fetch(url.toString(), {
        method: 'GET',
        headers,
        signal: controller.signal,
      })

      if (!response.ok) {
        const body = await response.text().catch(() => '')
        throw new Error(
          `Gamma API request failed: status=${response.status} ${response.statusText} url=${url.toString()} body=${body.slice(0, 200)}`,
        )
      }

      const json = (await response.json()) as GammaMarketsResponse | PolymarketGammaMarket[]
      if (!json || (typeof json !== 'object' && !Array.isArray(json))) {
        throw new Error('Gamma API response is invalid')
      }
      return json
    } catch (error) {
      this.logger.error(
        `Gamma API request error: ${error instanceof Error ? error.message : String(error)}`,
      )
      throw error
    } finally {
      clearTimeout(timer)
    }
  }
}
