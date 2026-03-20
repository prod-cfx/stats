/**
 * 系统配置值类型
 * 支持基本类型和 JSON 对象/数组
 */
export type SettingValue = string | number | boolean | Record<string, unknown> | unknown[]

/**
 * 配置值类型枚举
 */
export type SettingValueType = 'string' | 'number' | 'boolean' | 'json'

