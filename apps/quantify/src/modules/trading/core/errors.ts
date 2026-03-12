export class ExchangeError extends Error {
  constructor(
    message: string,
    public readonly code?: string,
    public readonly details?: unknown,
  ) {
    super(message)
    this.name = 'ExchangeError'
  }
}

export class AuthError extends ExchangeError {
  constructor(message = 'Authentication failed', details?: unknown) {
    super(message, 'AUTH_ERROR', details)
    this.name = 'AuthError'
  }
}

export class InsufficientBalanceError extends ExchangeError {
  constructor(message = 'Insufficient balance', details?: unknown) {
    super(message, 'INSUFFICIENT_BALANCE', details)
    this.name = 'InsufficientBalanceError'
  }
}

export class NetworkError extends ExchangeError {
  constructor(message = 'Network error', details?: unknown) {
    super(message, 'NETWORK_ERROR', details)
    this.name = 'NetworkError'
  }
}

export class RateLimitError extends ExchangeError {
  constructor(message = 'Rate limit exceeded', details?: unknown) {
    super(message, 'RATE_LIMIT', details)
    this.name = 'RateLimitError'
  }
}

export class OrderNotFoundError extends ExchangeError {
  constructor(message = 'Order not found', details?: unknown) {
    super(message, 'ORDER_NOT_FOUND', details)
    this.name = 'OrderNotFoundError'
  }
}
