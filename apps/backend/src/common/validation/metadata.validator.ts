import type { ValidationArguments, ValidationOptions } from 'class-validator'
import { registerDecorator } from 'class-validator'

/**
 * 计算 JSON 对象的嵌套深度
 */
function getJsonDepth(obj: any, currentDepth = 0): number {
  // 防止无限递归
  if (currentDepth > 20) {
    return currentDepth
  }

  if (typeof obj !== 'object' || obj === null) {
    return currentDepth
  }

  if (Array.isArray(obj)) {
    if (obj.length === 0) return currentDepth
    return Math.max(...obj.map(item => getJsonDepth(item, currentDepth + 1)))
  }

  const keys = Object.keys(obj)
  if (keys.length === 0) return currentDepth

  return Math.max(...keys.map(key => getJsonDepth(obj[key], currentDepth + 1)))
}

/**
 * 计算 JSON 对象序列化后的字节大小
 */
function getJsonSize(obj: any): number {
  try {
    return Buffer.byteLength(JSON.stringify(obj), 'utf8')
  } catch {
    return 0
  }
}

export interface MetadataValidationOptions {
  /**
   * 最大嵌套深度（默认 5）
   */
  maxDepth?: number

  /**
   * 最大字节大小（默认 10KB = 10240 bytes）
   */
  maxSizeBytes?: number

  /**
   * 是否允许数组（默认 true）
   */
  allowArrays?: boolean
}

/**
 * 验证 metadata 字段的自定义装饰器
 * 
 * 验证规则：
 * - 最大嵌套深度：5 层
 * - 最大大小：10KB
 * - 可选是否允许数组
 * 
 * @example
 * ```typescript
 * class CreateDto {
 *   @IsValidMetadata({ maxDepth: 5, maxSizeBytes: 10240 })
 *   metadata?: Record<string, any>
 * }
 * ```
 */
export function IsValidMetadata(
  options?: MetadataValidationOptions,
  validationOptions?: ValidationOptions,
) {
  const maxDepth = options?.maxDepth ?? 5
  const maxSizeBytes = options?.maxSizeBytes ?? 10240 // 10KB
  const allowArrays = options?.allowArrays ?? true

  return function (object: object, propertyName: string) {
    registerDecorator({
      name: 'isValidMetadata',
      target: object.constructor,
      propertyName,
      options: validationOptions,
      constraints: [maxDepth, maxSizeBytes, allowArrays],
      validator: {
        validate(value: any, args: ValidationArguments) {
          // null 和 undefined 是允许的
          if (value === null || value === undefined) {
            return true
          }

          // 必须是对象
          if (typeof value !== 'object') {
            return false
          }

          // 检查是否允许数组
          const [maxD, maxSize, allowArr] = args.constraints
          if (Array.isArray(value) && !allowArr) {
            return false
          }

          // 检查深度
          const depth = getJsonDepth(value)
          if (depth > maxD) {
            return false
          }

          // 检查大小
          const size = getJsonSize(value)
          if (size > maxSize || size === 0) {
            return false
          }

          // 检查是否包含循环引用
          try {
            JSON.stringify(value)
          } catch {
            return false
          }

          return true
        },
        defaultMessage(args: ValidationArguments) {
          const [maxD, maxSize] = args.constraints
          return `${args.property} must be valid JSON with max depth ${maxD} and size ${maxSize} bytes (${(maxSize / 1024).toFixed(1)}KB)`
        },
      },
    })
  }
}


