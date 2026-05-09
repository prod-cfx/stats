import { ErrorCode } from '@ai/shared'
import { HttpStatus } from '@nestjs/common'
import { UtteranceGoldenCorpusParseException } from './utterance-golden-corpus-parse.exception'

describe('UtteranceGoldenCorpusParseException', () => {
  it('should have correct error code', () => {
    const exception = new UtteranceGoldenCorpusParseException({ atom: 'volume.threshold' })
    expect(exception.code).toBe(ErrorCode.UTTERANCE_GOLDEN_CORPUS_PARSE_ERROR)
  })

  it('should have UNPROCESSABLE_ENTITY status', () => {
    const exception = new UtteranceGoldenCorpusParseException({ atom: 'volume.threshold' })
    expect(exception.getStatus()).toBe(HttpStatus.UNPROCESSABLE_ENTITY)
  })

  it('should carry atom and reason in args', () => {
    const exception = new UtteranceGoldenCorpusParseException({
      atom: 'volume.threshold',
      reason: 'missing required field: utterance',
    })
    expect(exception.args).toEqual({
      atom: 'volume.threshold',
      reason: 'missing required field: utterance',
    })
  })

  it('should work without params', () => {
    const exception = new UtteranceGoldenCorpusParseException({})
    expect(exception.code).toBe(ErrorCode.UTTERANCE_GOLDEN_CORPUS_PARSE_ERROR)
    expect(exception.message).toBe('Failed to parse utterance golden corpus entry')
  })
})
