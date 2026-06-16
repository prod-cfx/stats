import type { ValidationError } from '@nestjs/common'
import { toValidationErrorDetails } from './validation.exception'

describe('toValidationErrorDetails', () => {
  it('preserves nested validation errors without exposing validated values', () => {
    const errors: ValidationError[] = [
      {
        property: 'channels',
        value: [{ thresholdUsd: 'invalid' }],
        children: [
          {
            property: '0',
            value: { thresholdUsd: 'invalid' },
            children: [
              {
                property: 'thresholdUsd',
                value: 'invalid',
                constraints: {
                  min: 'thresholdUsd must not be less than 1',
                  isNumber: 'thresholdUsd must be a number conforming to the specified constraints',
                },
              },
            ],
          },
        ],
      },
    ]

    expect(toValidationErrorDetails(errors)).toEqual([
      {
        property: 'channels',
        children: [
          {
            property: '0',
            children: [
              {
                property: 'thresholdUsd',
                constraints: {
                  min: 'thresholdUsd must not be less than 1',
                  isNumber: 'thresholdUsd must be a number conforming to the specified constraints',
                },
              },
            ],
          },
        ],
      },
    ])
  })
})
