export type DynamicParamSchema = Record<string, unknown>
export type DynamicParamValues = Record<string, unknown>

export interface DynamicParamFieldOption {
  value: string
  label: string
}

export interface DynamicParamFieldViewModel {
  key: string
  label: string
  description?: string
  required: boolean
  type: 'string' | 'number' | 'integer' | 'boolean' | 'array' | 'object'
  control: 'input' | 'select' | 'checkbox' | 'textarea'
  enumOptions?: DynamicParamFieldOption[]
  minimum?: number
  maximum?: number
}

export interface DynamicParamValidationResult {
  valid: boolean
  fieldErrors: Record<string, string>
}

function asObject(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  return value as Record<string, unknown>
}

function asFieldType(value: unknown): DynamicParamFieldViewModel['type'] {
  if (value === 'number') return 'number'
  if (value === 'integer') return 'integer'
  if (value === 'boolean') return 'boolean'
  if (value === 'array') return 'array'
  if (value === 'object') return 'object'
  return 'string'
}

function toLabel(key: string, config: Record<string, unknown>): string {
  if (typeof config.title === 'string' && config.title.trim()) {
    return config.title.trim()
  }
  return key
}

function normalizeEnumOptions(raw: unknown): DynamicParamFieldOption[] | undefined {
  if (!Array.isArray(raw)) return undefined
  const options = raw
    .filter(item => ['string', 'number', 'boolean'].includes(typeof item))
    .map(item => {
      const value = String(item)
      return { value, label: value }
    })
  return options.length > 0 ? options : undefined
}

function isMissingValue(value: unknown): boolean {
  if (value === undefined || value === null) return true
  if (typeof value === 'string' && value.trim() === '') return true
  if (Array.isArray(value) && value.length === 0) return true
  return false
}

function normalizeNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string' && value.trim()) {
    const parsed = Number(value)
    return Number.isFinite(parsed) ? parsed : null
  }
  return null
}

export function buildDynamicParamFields(paramSchema: DynamicParamSchema | null | undefined): DynamicParamFieldViewModel[] {
  const schema = asObject(paramSchema)
  if (!schema) return []
  const properties = asObject(schema.properties)
  if (!properties) return []
  const required = Array.isArray(schema.required)
    ? schema.required.filter((item): item is string => typeof item === 'string')
    : []
  const requiredSet = new Set(required)

  return Object.entries(properties)
    .flatMap(([key, rawConfig]) => {
      const config = asObject(rawConfig)
      if (!config) return []

      const type = asFieldType(config.type)
      const enumOptions = normalizeEnumOptions(config.enum)
      const control = enumOptions
        ? 'select'
        : type === 'boolean'
          ? 'checkbox'
          : type === 'array' || type === 'object'
            ? 'textarea'
            : 'input'

      return [{
        key,
        label: toLabel(key, config),
        description: typeof config.description === 'string' ? config.description : undefined,
        required: requiredSet.has(key),
        type,
        control,
        enumOptions,
        minimum: normalizeNumber(config.minimum) ?? undefined,
        maximum: normalizeNumber(config.maximum) ?? undefined,
      }]
    })
}

export function validateDynamicParamValues(
  paramSchema: DynamicParamSchema | null | undefined,
  paramValues: DynamicParamValues | null | undefined,
): DynamicParamValidationResult {
  const schema = asObject(paramSchema)
  if (!schema) {
    return {
      valid: true,
      fieldErrors: {},
    }
  }
  const values = paramValues ?? {}
  const properties = asObject(schema.properties) ?? {}
  const required = Array.isArray(schema.required)
    ? schema.required.filter((item): item is string => typeof item === 'string')
    : []

  const fieldErrors: Record<string, string> = {}

  for (const key of required) {
    if (isMissingValue(values[key])) {
      fieldErrors[key] = 'required'
    }
  }

  for (const [key, rawConfig] of Object.entries(properties)) {
    const config = asObject(rawConfig)
    if (!config) continue
    const value = values[key]
    if (isMissingValue(value)) continue

    const type = asFieldType(config.type)
    if (type === 'string' && typeof value !== 'string') {
      fieldErrors[key] = 'type'
      continue
    }
    if ((type === 'number' || type === 'integer')) {
      const numberValue = normalizeNumber(value)
      if (numberValue === null) {
        fieldErrors[key] = 'type'
        continue
      }
      if (type === 'integer' && !Number.isInteger(numberValue)) {
        fieldErrors[key] = 'type'
        continue
      }
      const minimum = normalizeNumber(config.minimum)
      const maximum = normalizeNumber(config.maximum)
      if (minimum !== null && numberValue < minimum) {
        fieldErrors[key] = 'minimum'
        continue
      }
      if (maximum !== null && numberValue > maximum) {
        fieldErrors[key] = 'maximum'
      }
      continue
    }
    if (type === 'boolean' && typeof value !== 'boolean') {
      fieldErrors[key] = 'type'
      continue
    }
    if (type === 'array' && !Array.isArray(value)) {
      fieldErrors[key] = 'type'
      continue
    }
    if (type === 'object' && (!value || typeof value !== 'object' || Array.isArray(value))) {
      fieldErrors[key] = 'type'
      continue
    }

    if (Array.isArray(config.enum)) {
      const enumValues = config.enum.map(item => String(item))
      if (!enumValues.includes(String(value))) {
        fieldErrors[key] = 'enum'
      }
    }
  }

  return {
    valid: Object.keys(fieldErrors).length === 0,
    fieldErrors,
  }
}
