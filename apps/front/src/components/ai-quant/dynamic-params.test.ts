import { describe, expect, it } from '@jest/globals'
import {
  buildDynamicParamFields,
  parseDynamicParamInputValue,
  validateDynamicParamValues,
} from './dynamic-params'

describe('ai-quant dynamic-params', () => {
  const schema = {
    type: 'object',
    required: ['exchange', 'positionPct'],
    properties: {
      exchange: {
        type: 'string',
        title: '交易所',
        enum: ['binance', 'okx'],
      },
      positionPct: {
        type: 'number',
        minimum: 1,
        maximum: 100,
      },
      enabled: {
        type: 'boolean',
      },
    },
  }

  it('builds field view model from schema properties', () => {
    const fields = buildDynamicParamFields(schema)
    expect(fields).toEqual([
      {
        key: 'exchange',
        label: '交易所',
        description: undefined,
        required: true,
        type: 'string',
        control: 'select',
        enumOptions: [
          { value: 'binance', label: 'binance' },
          { value: 'okx', label: 'okx' },
        ],
        minimum: undefined,
        maximum: undefined,
      },
      {
        key: 'positionPct',
        label: 'positionPct',
        description: undefined,
        required: true,
        type: 'number',
        control: 'input',
        enumOptions: undefined,
        minimum: 1,
        maximum: 100,
      },
      {
        key: 'enabled',
        label: 'enabled',
        description: undefined,
        required: false,
        type: 'boolean',
        control: 'checkbox',
        enumOptions: undefined,
        minimum: undefined,
        maximum: undefined,
      },
    ])
  })

  it('validates required, enum and number bounds', () => {
    const result = validateDynamicParamValues(schema, {
      exchange: 'kraken',
      positionPct: 120,
    })
    expect(result.valid).toBe(false)
    expect(result.fieldErrors).toEqual({
      exchange: 'enum',
      positionPct: 'maximum',
    })
  })

  it('returns required/type errors explicitly', () => {
    const result = validateDynamicParamValues(schema, {
      exchange: '',
      positionPct: 'bad',
      enabled: 'true',
    })
    expect(result.valid).toBe(false)
    expect(result.fieldErrors).toEqual({
      exchange: 'required',
      positionPct: 'type',
      enabled: 'type',
    })
  })

  it('does not coerce empty numeric input to 0', () => {
    expect(parseDynamicParamInputValue('number', '')).toBeUndefined()
    expect(parseDynamicParamInputValue('integer', '   ')).toBeUndefined()
    expect(parseDynamicParamInputValue('number', '12.5')).toBe(12.5)
  })

  it('validates nested object required fields', () => {
    const nestedSchema = {
      type: 'object',
      properties: {
        riskRules: {
          type: 'object',
          required: ['positionPct', 'maxDrawdownPct'],
          properties: {
            positionPct: { type: 'number', minimum: 1, maximum: 100 },
            maxDrawdownPct: { type: 'number', minimum: 1, maximum: 100 },
          },
        },
      },
    }
    const result = validateDynamicParamValues(nestedSchema, {
      riskRules: {},
    })
    expect(result.valid).toBe(false)
    expect(result.fieldErrors).toEqual({
      'riskRules.positionPct': 'required',
      'riskRules.maxDrawdownPct': 'required',
    })
  })
})
