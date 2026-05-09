import { ErrorCode } from '@ai/shared/constants/error-codes'
import { HttpStatus } from '@nestjs/common'

import { DomainException } from '@/common/exceptions/domain.exception'

export class UtteranceGoldenCorpusParseException extends DomainException {
  constructor(params: { atom?: string; reason?: string }) {
    super('Failed to parse utterance golden corpus entry', {
      code: ErrorCode.UTTERANCE_GOLDEN_CORPUS_PARSE_ERROR,
      status: HttpStatus.UNPROCESSABLE_ENTITY,
      args: params,
    })
  }
}
