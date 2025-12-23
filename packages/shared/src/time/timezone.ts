/**
 * 通用时区格式化工具
 * 仅依赖标准 Intl API，确保前后端同构可用
 */

type DateInput = string | number | Date

const DEFAULT_LOCALE = 'en-CA'
const DEFAULT_DATE_OPTIONS: Intl.DateTimeFormatOptions = {
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
}
const DEFAULT_TIME_OPTIONS: Intl.DateTimeFormatOptions = {
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
}
const DEFAULT_TIME_WITH_SECONDS: Intl.DateTimeFormatOptions = {
  ...DEFAULT_TIME_OPTIONS,
  second: '2-digit',
}

let cachedTimezone: string | null = null
const formatterCache = new Map<string, Intl.DateTimeFormat>()
const warnedTopics = new Set<string>()

const isProduction = process.env.NODE_ENV === 'production'

const warnOnce = (topic: string, message: string, detail?: unknown) => {
  if (isProduction || warnedTopics.has(topic)) return
  warnedTopics.add(topic)
  if (detail) {
    console.warn(message, detail)
  } else {
    console.warn(message)
  }
}

const getFormatter = (locale: string, options: Intl.DateTimeFormatOptions): Intl.DateTimeFormat => {
  const sortedEntries = Object.entries(options).sort(([a], [b]) => (a > b ? 1 : a < b ? -1 : 0))
  const cacheKey = `${locale}__${JSON.stringify(sortedEntries)}`
  const cached = formatterCache.get(cacheKey)
  if (cached) return cached
  const formatter = new Intl.DateTimeFormat(locale, options)
  formatterCache.set(cacheKey, formatter)
  return formatter
}

const toDate = (value: DateInput): Date | null => {
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value
  const date =
    typeof value === 'number' ? new Date(value) : typeof value === 'string' ? new Date(value) : null
  if (!date || Number.isNaN(date.getTime())) {
    warnOnce('invalid-date', '收到无法解析的日期输入', { value })
    return null
  }
  return date
}

/**
 * 获取当前用户的 IANA 时区标识
 * 无论在浏览器还是 Node 环境均可安全调用
 */
export const getUserTimezone = (): string => {
  if (cachedTimezone) return cachedTimezone

  try {
    cachedTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone
    return cachedTimezone
  } catch (error) {
    warnOnce('timezone-fallback', '自动检测时区失败，回退到 UTC', error)
    cachedTimezone = 'UTC'
    return cachedTimezone
  }
}

/**
 * 清除内部缓存（测试或显式切换时区时使用）
 */
export const clearTimezoneCache = (): void => {
  cachedTimezone = null
}

const formatDateParts = (
  date: Date,
  options: Intl.DateTimeFormatOptions,
  locale: string,
): { date: string; time?: string } => {
  const formatter = getFormatter(locale, {
    ...options,
    timeZone: getUserTimezone(),
  })
  const parts = formatter.formatToParts(date)
  const year = parts.find(p => p.type === 'year')?.value ?? ''
  const month = parts.find(p => p.type === 'month')?.value ?? ''
  const day = parts.find(p => p.type === 'day')?.value ?? ''
  const hour = parts.find(p => p.type === 'hour')?.value
  const minute = parts.find(p => p.type === 'minute')?.value
  const second = parts.find(p => p.type === 'second')?.value

  const dateSegment = `${year}-${month}-${day}`
  const timeSegment =
    hour && minute
      ? `${hour}:${minute}${second ? `:${second}` : ''}`
      : second
        ? `00:00:${second}`
        : undefined

  return { date: dateSegment, time: timeSegment }
}

interface FormatConfig {
  locale?: string
  includeSeconds?: boolean
}

const ensureDate = (value: DateInput): Date | null => {
  const parsed = toDate(value)
  if (!parsed) {
    return null
  }
  return parsed
}

/**
 * 将日期时间转换为用户时区的本地表示
 * 默认输出：YYYY-MM-DD HH:mm
 */
export const formatDateInUserTimezone = (value: DateInput, config: FormatConfig = {}): string => {
  const date = ensureDate(value)
  if (!date) return String(value)

  const locale = config.locale ?? DEFAULT_LOCALE
  const timeOptions = config.includeSeconds ? DEFAULT_TIME_WITH_SECONDS : DEFAULT_TIME_OPTIONS
  const parts = formatDateParts(date, { ...DEFAULT_DATE_OPTIONS, ...timeOptions }, locale)

  return parts.time ? `${parts.date} ${parts.time}` : parts.date
}

/**
 * 仅输出日期（YYYY-MM-DD）
 */
export const formatDateOnly = (value: DateInput, locale = DEFAULT_LOCALE): string => {
  const date = ensureDate(value)
  if (!date) return String(value)

  const parts = formatDateParts(date, DEFAULT_DATE_OPTIONS, locale)
  return parts.date
}

/**
 * 仅输出时间（HH:mm 或 HH:mm:ss）
 */
export const formatTimeOnly = (
  value: DateInput,
  config: Omit<FormatConfig, 'locale'> & { locale?: string } = { includeSeconds: true },
): string => {
  const date = ensureDate(value)
  if (!date) return String(value)

  const locale = config.locale ?? DEFAULT_LOCALE
  const includeSeconds = config.includeSeconds ?? true
  const timeOptions = includeSeconds ? DEFAULT_TIME_WITH_SECONDS : DEFAULT_TIME_OPTIONS
  const parts = formatDateParts(date, timeOptions, locale)
  return parts.time ?? ''
}

/**
 * 获取用户当前日期（YYYY-MM-DD）
 */
export const getUserCurrentDate = (locale = DEFAULT_LOCALE): string => {
  return formatDateOnly(new Date(), locale)
}

/**
 * 相对时间描述（刚刚/XX分钟前/XX小时前/XX天前）
 */
export const formatRelativeTime = (value: DateInput): string => {
  const date = ensureDate(value)
  if (!date) return String(value)

  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffSec = Math.floor(diffMs / 1000)
  const diffMin = Math.floor(diffSec / 60)
  const diffHour = Math.floor(diffMin / 60)
  const diffDay = Math.floor(diffHour / 24)

  if (diffSec < 60) return '刚刚'
  if (diffMin < 60) return `${diffMin} 分钟前`
  if (diffHour < 24) return `${diffHour} 小时前`
  if (diffDay < 7) return `${diffDay} 天前`

  return formatDateOnly(date)
}

/**
 * 暴露给调用方的综合格式化入口
 */
export const formatWithOptions = (
  value: DateInput,
  options: Intl.DateTimeFormatOptions,
  locale = DEFAULT_LOCALE,
): string => {
  const date = ensureDate(value)
  if (!date) return String(value)

  const formatter = getFormatter(locale, { ...options, timeZone: getUserTimezone() })
  return formatter.format(date)
}

export type { DateInput, FormatConfig }
