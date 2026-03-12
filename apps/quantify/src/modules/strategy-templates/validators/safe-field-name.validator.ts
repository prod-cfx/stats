import type { ValidationArguments, ValidationOptions } from 'class-validator'
import { registerDecorator } from 'class-validator'

/**
 * 鍗遍櫓鐨勫師鍨嬫薄鏌撳叧閿瓧
 * 杩欎簺瀛楁浼氬懡涓?Object.prototype锛屽彲鑳藉鑷村畨鍏ㄦ紡娲?
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
 * 瀹夊叏鐨勫瓧娈靛悕姝ｅ垯锛氬彧鍏佽瀛楁瘝銆佹暟瀛椼€佷笅鍒掔嚎銆佽繛瀛楃鍜屽啋鍙?
 * 绀轰緥锛歱rice_close, ma_20, rsi:14, volume-ratio
 */
const SAFE_FIELD_NAME_PATTERN = /^[\w:-]+$/

/**
 * 鏈€澶у瓧娈靛悕闀垮害
 */
const MAX_FIELD_NAME_LENGTH = 100

/**
 * 鏈€澶у瓧娈垫暟缁勯暱搴?
 */
const MAX_FIELDS_ARRAY_LENGTH = 50

/**
 * 楠岃瘉瀛楁鍚嶆槸鍚﹀畨鍏?
 * @param fieldName 瀛楁鍚?
 * @returns 閿欒淇℃伅锛屽鏋滃畨鍏ㄥ垯杩斿洖 null
 */
export function validateFieldNameSafety(fieldName: string): string | null {
  // 1. 妫€鏌ョ被鍨?
  if (typeof fieldName !== 'string') {
    return '瀛楁鍚嶅繀椤绘槸瀛楃涓?
  }

  // 2. 妫€鏌ラ暱搴?
  if (fieldName.length === 0) {
    return '瀛楁鍚嶄笉鑳戒负绌?
  }

  if (fieldName.length > MAX_FIELD_NAME_LENGTH) {
    return `瀛楁鍚嶉暱搴︿笉鑳借秴杩?${MAX_FIELD_NAME_LENGTH} 涓瓧绗
  }

  // 3. 妫€鏌ュ師鍨嬫薄鏌撳叧閿瓧
  if (PROTOTYPE_POLLUTION_KEYWORDS.includes(fieldName)) {
    return `瀛楁鍚?"${fieldName}" 鏄繚鐣欏叧閿瓧锛屼笉鍏佽浣跨敤`
  }

  // 4. 妫€鏌ユ牸寮忥紙鍙厑璁稿畨鍏ㄥ瓧绗︼級
  if (!SAFE_FIELD_NAME_PATTERN.test(fieldName)) {
    return `瀛楁鍚嶅彧鑳藉寘鍚瓧姣嶃€佹暟瀛椼€佷笅鍒掔嚎銆佽繛瀛楃鍜屽啋鍙?(褰撳墠: "${fieldName}")`
  }

  return null
}

/**
 * class-validator 瑁呴グ鍣細楠岃瘉瀛楁鍚嶆暟缁勭殑瀹夊叏鎬?
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
          // 鍏佽 undefined 鎴?null锛堢敱 @IsOptional 鎺у埗锛?
          if (value === undefined || value === null) {
            return true
          }

          // 蹇呴』鏄暟缁?
          if (!Array.isArray(value)) {
            return false
          }

          // 妫€鏌ユ暟缁勯暱搴?
          if (value.length > MAX_FIELDS_ARRAY_LENGTH) {
            return false
          }

          // 妫€鏌ユ瘡涓瓧娈靛悕
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
            return 'requiredFields 蹇呴』鏄瓧绗︿覆鏁扮粍'
          }

          if (value.length > MAX_FIELDS_ARRAY_LENGTH) {
            return `requiredFields 鏁扮粍闀垮害涓嶈兘瓒呰繃 ${MAX_FIELDS_ARRAY_LENGTH}`
          }

          // 鎵惧嚭绗竴涓湁闂鐨勫瓧娈靛悕
          for (const fieldName of value) {
            const error = validateFieldNameSafety(fieldName)
            if (error) {
              return `requiredFields 鍖呭惈鏃犳晥瀛楁鍚? ${error}`
            }
          }

          return 'requiredFields 楠岃瘉澶辫触'
        },
      },
    })
  }
}
