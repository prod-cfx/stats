import type { IExchangeClient } from '../core/interface'
import type {
  CreateOrderInput,
  MarketType,
  UnifiedBalance,
  UnifiedOrder,
  UnifiedPosition,
  UnifiedTicker,
} from '../core/types'
import type { Dispatcher } from 'undici'
import { Agent, ProxyAgent } from 'undici'
import { ExchangeError, NetworkError } from '../core/errors'

type HttpMethod = 'GET' | 'POST' | 'DELETE'

type RequestInitWithDispatcher = RequestInit & {
  dispatcher?: Dispatcher
}

export interface HttpEgressOptions {
  proxyUrl?: string
  localAddress?: string
}

interface SignedRequest {
  url: string
  headers: Record<string, string>
  body?: string
}

interface BeforeRequestContext {
  isPrivate: boolean
  method: HttpMethod
  path: string
}

interface RetryPolicy {
  maxAttempts: number
  baseDelayMs: number
  maxDelayMs?: number
}

function trimOptional(value?: string): string | undefined {
  const trimmed = value?.trim()
  return trimmed ? trimmed : undefined
}

export function createHttpEgressDispatcher(options?: HttpEgressOptions): Dispatcher | undefined {
  const proxyUrl = trimOptional(options?.proxyUrl)
  if (proxyUrl) {
    return new ProxyAgent(proxyUrl)
  }

  const localAddress = trimOptional(options?.localAddress)
  if (localAddress) {
    return new Agent({ connect: { localAddress } })
  }

  return undefined
}

export abstract class BaseCexClient implements IExchangeClient {
  protected constructor(
    protected readonly baseUrl: string,
    protected readonly marketType: MarketType,
    private readonly dispatcher?: Dispatcher,
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
    const retryPolicy = this.getRetryPolicy()
    let attempt = 0

    while (true) {
      attempt += 1
      const signed = await this.signRequest(method, path, params, isPrivate, body)

      const url = new URL(signed.url, this.baseUrl)

      await this.beforeRequest({ isPrivate, method, path })

      const init: RequestInitWithDispatcher = {
        method,
        headers: signed.headers,
      }

      if (signed.body !== undefined) {
        init.body = signed.body
      }

      if (this.dispatcher !== undefined) {
        init.dispatcher = this.dispatcher
      }

      try {
        const data = await this.fetchAndParse(url, init)
        return data as TResponse
      }
      catch (error) {
        if (
          error instanceof ExchangeError
          && attempt < retryPolicy.maxAttempts
          && this.shouldRetryRequest(error)
        ) {
          await this.sleepBeforeRetry(this.getRetryDelayMs(attempt, retryPolicy))
          continue
        }

        throw error
      }
    }
  }

  private async fetchAndParse(url: URL, init: RequestInitWithDispatcher): Promise<unknown> {
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

    const responseError = this.mapSuccessfulResponseError(data)
    if (responseError) {
      throw responseError
    }

    return data
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

  protected mapSuccessfulResponseError(_data: unknown): ExchangeError | undefined {
    return undefined
  }

  protected getRetryPolicy(): RetryPolicy {
    return { maxAttempts: 1, baseDelayMs: 0 }
  }

  protected shouldRetryRequest(_error: ExchangeError): boolean {
    return false
  }

  protected sleepBeforeRetry(delayMs: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, delayMs))
  }

  private getRetryDelayMs(attempt: number, policy: RetryPolicy): number {
    const delayMs = policy.baseDelayMs * (2 ** Math.max(0, attempt - 1))
    if (policy.maxDelayMs === undefined) {
      return delayMs
    }

    return Math.min(delayMs, policy.maxDelayMs)
  }

  protected beforeRequest(_context: BeforeRequestContext): Promise<void> | void {}
}
