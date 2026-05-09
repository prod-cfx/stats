import { ErrorCode } from '@ai/shared'
import { HttpStatus } from '@nestjs/common'
import { SemanticPresentationTokenNotFoundException } from './semantic-presentation-token-not-found.exception'

describe('SemanticPresentationTokenNotFoundException', () => {
  it('should have correct error code', () => {
    const exception = new SemanticPresentationTokenNotFoundException({ token: 'ema_period' })
    expect(exception.code).toBe(ErrorCode.SEMANTIC_PRESENTATION_TOKEN_NOT_FOUND)
  })

  it('should have NOT_FOUND status', () => {
    const exception = new SemanticPresentationTokenNotFoundException({ token: 'ema_period' })
    expect(exception.getStatus()).toBe(HttpStatus.NOT_FOUND)
  })

  it('should carry token in args', () => {
    const exception = new SemanticPresentationTokenNotFoundException({ token: 'ema_period' })
    expect(exception.args).toEqual({ token: 'ema_period' })
  })

  it('should have descriptive message', () => {
    const exception = new SemanticPresentationTokenNotFoundException({ token: 'x' })
    expect(exception.message).toBe('Semantic presentation token not found in registry')
  })
})
