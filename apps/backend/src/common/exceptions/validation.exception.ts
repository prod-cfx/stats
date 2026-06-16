import type { ValidationError } from '@nestjs/common'
import { ErrorCode } from '@ai/shared'
import { HttpStatus } from '@nestjs/common'
import { DomainException } from './domain.exception'

export interface ValidationErrorDetail {
  property: string
  constraints?: Record<string, string>
  children?: ValidationErrorDetail[]
}

export function toValidationErrorDetails(errors: ValidationError[]): ValidationErrorDetail[] {
  return errors.map((error) => {
    const children = error.children?.length ? toValidationErrorDetails(error.children) : undefined

    return {
      property: error.property,
      ...(error.constraints ? { constraints: error.constraints } : {}),
      ...(children ? { children } : {}),
    }
  })
}

export class ValidationException extends DomainException {
  constructor(validationErrors: ValidationErrorDetail[]) {
    super('validation.error', {
      code: ErrorCode.VALIDATION_ERROR,
      status: HttpStatus.BAD_REQUEST,
      args: { validationErrors },
    })
  }
}
