import { AuthError, ExchangeError } from '../core/errors'
import { BinanceClient } from './binance-client'

class TestableBinanceClient extends BinanceClient {
  mapErrorForTest(status: number, data: unknown): ExchangeError {
    return this.mapError(status, data)
  }
}

describe('binanceClient mapError', () => {
  const client = new TestableBinanceClient('spot', {
    apiKey: 'test-key',
    secret: 'test-secret',
  })

  it('maps -2011 unknown order to a generic exchange error instead of auth error', () => {
    const error = client.mapErrorForTest(400, {
      code: -2011,
      msg: 'Unknown order sent.',
    })

    expect(error).toBeInstanceOf(ExchangeError)
    expect(error).not.toBeInstanceOf(AuthError)
    expect(error.code).toBe('-2011')
    expect(error.message).toBe('Unknown order sent.')
  })

  it('maps disabled API key messages to auth error', () => {
    const error = client.mapErrorForTest(400, {
      code: -1099,
      msg: 'API key is disabled',
    })

    expect(error).toBeInstanceOf(AuthError)
  })
})
