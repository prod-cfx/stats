import type { ValidationArguments, ValidationOptions } from 'class-validator'
import { registerDecorator } from 'class-validator'

/**
 * 危险的原型污染关键字
 * 这些字段会命中 Object.prototype，可能导致安全漏洞
 */
const PROTOTYPE_POLLUTION_KEYWORDS = [
  '__proto__',
  'constructor',
  'prototype',
  'toString',
  'toLocaleString',
  'valueOf',
  'hasOwnProperty',
  'isPrototypeOf',
  'propertyIsEnumerable',
  '__defineGetter__',
  '__defineSetter__',
  '__lookupGetter__',
  '__lookupSetter__',
]

/**
 * 安全的字段名正则：只允许字母、数字、下划线、连字符和冒号
 * 示例：price_close, ma_20, rsi:14, volume-ratio
 */
const SAFE_FIELD_NAME_PATTERN = /^[\w:-]+$/

/**
 * 最大字段名长度
 */
const MAX_FIELD_NAME_LENGTH = 100

/**
 * 最大字段数组长度
 */
const MAX_FIELDS_ARRAY_LENGTH = 50

/**
 * 验证字段名是否安全
 * @param fieldName 字段名
 * @returns 错误信息，如果安全则返回 null
 */
export function validateFieldNameSafety(fieldName: string): string | null {
  // 1. 检查类型
  if (typeof fieldName !== 'string') {
    return '字段名必须是字符串'
  }

  // 2. 检查长度
  if (fieldName.length === 0) {
    return '字段名不能为空'
  }

  if (fieldName.length > MAX_FIELD_NAME_LENGTH) {
    return `字段名长度不能超过 ${MAX_FIELD_NAME_LENGTH} 个字符`
  }

  // 3. 检查原型污染关键字
  if (PROTOTYPE_POLLUTION_KEYWORDS.includes(fieldName)) {
    return `字段名 "${fieldName}" 是保留关键字，不允许使用`
  }

  // 4. 检查格式（只允许安全字符）
  if (!SAFE_FIELD_NAME_PATTERN.test(fieldName)) {
    return `字段名只能包含字母、数字、下划线、连字符和冒号 (当前: "${fieldName}")`
  }

  return null
}

/**
 * class-validator 装饰器：验证字段名数组的安全性
 */
export function IsSafeFieldNameArray(validationOptions?: ValidationOptions) {
  return function (object: object, propertyName: string) {
    registerDecorator({
      name: 'isSafeFieldNameArray',
      target: object.constructor,
      propertyName,
      options: validationOptions,
      validator: {
        validate(value: any, _args: ValidationArguments) {
          // 允许 undefined 或 null（由 @IsOptional 控制）
          if (value === undefined || value === null) {
            return true
          }

          // 必须是数组
          if (!Array.isArray(value)) {
            return false
          }

          // 检查数组长度
          if (value.length > MAX_FIELDS_ARRAY_LENGTH) {
            return false
          }

          // 检查每个字段名
          for (const fieldName of value) {
            const error = validateFieldNameSafety(fieldName)
            if (error) {
              return false
            }
          }

          return true
        },
        defaultMessage(args: ValidationArguments) {
          const value = args.value

          if (!Array.isArray(value)) {
            return 'requiredFields 必须是字符串数组'
          }

          if (value.length > MAX_FIELDS_ARRAY_LENGTH) {
            return `requiredFields 数组长度不能超过 ${MAX_FIELDS_ARRAY_LENGTH}`
          }

          // 找出第一个有问题的字段名
          for (const fieldName of value) {
            const error = validateFieldNameSafety(fieldName)
            if (error) {
              return `requiredFields 包含无效字段名: ${error}`
            }
          }

          return 'requiredFields 验证失败'
        },
      },
    })
  }
}
