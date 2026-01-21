import { ErrorCode } from '@ai/shared'
import { SourceConsistencyException } from './source-consistency.exception'

describe('sourceConsistencyException', () => {
  it('should create exception with correct error code and args', () => {
    const exception = new SourceConsistencyException({
      expected: 'BBX',
      got: 'BBX_SCRAPER',
    })

    expect(exception.code).toBe(ErrorCode.DATA_CONSISTENCY_ERROR)
    expect(exception.args).toEqual({
      expected: 'BBX',
      got: 'BBX_SCRAPER',
    })
    expect(exception.getStatus()).toBe(400)
  })

  it('should have correct error message format', () => {
    const exception = new SourceConsistencyException({ expected: 'A', got: 'B' })

    expect(exception.message).toBe('Source consistency check failed')
  })
})
