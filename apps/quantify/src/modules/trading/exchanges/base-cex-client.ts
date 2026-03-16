import type { IExchangeClient } from '../core/interface'
import type {
  CreateOrderInput,
  MarketType,
  UnifiedBalance,
  UnifiedOrder,
  UnifiedPosition,
  UnifiedTicker,
} from '../core/types'
import { ExchangeError, NetworkError } from '../core/errors'

type HttpMethod = 'GET' | 'POST' | 'DELETE'

interface SignedRequest {
  url: string
  headers: Record<string, string>
  body?: string
}

export abstract class BaseCexClient implements IExchangeClient {
  protected constructor(
    protected readonly baseUrl: string,
    protected readonly marketType: MarketType,
  ) {}

  abstract init(): Promise<void>

  abstract ping(): Promise<void>

  abstract createOrder(input: CreateOrderInput): Promise<UnifiedOrder>

  abstract cancelOrder(id: string, symbol: string): Promise<UnifiedOrder>

  abstract fetchOrder(id: string, symbol: string): Promise<UnifiedOrder>

  abstract fetchOpenOrders(symbol?: string): Promise<UnifiedOrder[]>

  abstract fetchClosedOrders(symbol?: string): Promise<UnifiedOrder[]>

  abstract fetchPositions(): Promise<UnifiedPosition[]>

  abstract fetchBalance(): Promise<UnifiedBalance[]>

  abstract fetchTicker(symbol: string): Promise<UnifiedTicker>

  /**
   * 子类实现具体签名逻辑，返回带 query 和 header 的最终请求信息。
   */
  protected abstract signRequest(
    method: HttpMethod,
    path: string,
    params: Record<string, unknown>,
    isPrivate: boolean,
    body?: unknown,
  ): Promise<SignedRequest>

  protected async request<TResponse>(
    method: HttpMethod,
    path: string,
    params: Record<string, unknown> = {},
    isPrivate = false,
    body?: unknown,
  ): Promise<TResponse> {
    const signed = await this.signRequest(method, path, params, isPrivate, body)

    const url = new URL(signed.url, this.baseUrl)

    const init: RequestInit = {
      method,
      headers: signed.headers,
    }

    if (signed.body !== undefined) {
      init.body = signed.body
    }

    let response: Response
    try {
      response = await fetch(url, init)
    }
    catch (error) {
      throw new NetworkError('Network request failed', error)
    }

    const text = await response.text()

    let data: unknown
    if (text) {
      try {
        data = JSON.parse(text) as unknown
      }
      catch (error) {
        // 统一将解析失败包装为 ExchangeError，避免 SyntaxError 泄露到上层
        throw new ExchangeError(
          'Failed to parse exchange response JSON',
          String(response.status),
          { text, parseError: error },
        )
      }
    }

    if (!response.ok) {
      throw this.mapError(response.status, data)
    }

    return data as TResponse
  }

  /**
   * 默认错误映射，子类可根据交易所错误码覆盖。
   */

  protected mapError(status: number, data: unknown): ExchangeError {
    const message =
      typeof data === 'object' && data !== null && 'msg' in data && typeof (data as Record<string, unknown>).msg === 'string'
        ? (data as { msg: string }).msg
        : `Exchange request failed with status ${status}`

    return new ExchangeError(message, String(status), data)
  }
}
