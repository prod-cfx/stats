import { ErrorCode } from '@ai/shared'
import { HttpStatus } from '@nestjs/common'
import { AtomVersionGateValidationFailedException } from './atom-version-gate-validation-failed.exception'

describe('AtomVersionGateValidationFailedException', () => {
  it('should have correct error code', () => {
    const exception = new AtomVersionGateValidationFailedException({ version: 'bad-version' })
    expect(exception.code).toBe(ErrorCode.ATOM_VERSION_GATE_VALIDATION_FAILED)
  })

  it('should have BAD_REQUEST status', () => {
    const exception = new AtomVersionGateValidationFailedException({ version: 'bad-version' })
    expect(exception.getStatus()).toBe(HttpStatus.BAD_REQUEST)
  })

  it('should carry version and reason in args', () => {
    const exception = new AtomVersionGateValidationFailedException({
      version: 'bad-version',
      reason: 'must match \\d{4}\\.\\d{2}\\.W\\d{2}',
    })
    expect(exception.args).toEqual({
      version: 'bad-version',
      reason: 'must match \\d{4}\\.\\d{2}\\.W\\d{2}',
    })
  })

  it('should have descriptive message', () => {
    const exception = new AtomVersionGateValidationFailedException({ version: 'x' })
    expect(exception.message).toBe(
      'Atom version gate validation failed: invalid semantic version format',
    )
  })
})
