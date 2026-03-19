/**
 * 共享格式化工具函数
 */

/**
 * 格式化 ISO 日期字符串为 MM-DD HH:mm 格式
 */
export function formatDateTime(isoString: string): string {
  const date = new Date(isoString)
  // 检查日期有效性
  if (Number.isNaN(date.getTime())) return '-'
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  const hours = String(date.getHours()).padStart(2, '0')
  const minutes = String(date.getMinutes()).padStart(2, '0')
  return `${month}-${day} ${hours}:${minutes}`
}

/**
 * 格式化 ISO 日期字符串为 YYYY-MM-DD HH:mm 格式
 */
export function formatDateTimeFull(isoString: string): string {
  const date = new Date(isoString)
  if (Number.isNaN(date.getTime())) return '-'
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  const hours = String(date.getHours()).padStart(2, '0')
  const minutes = String(date.getMinutes()).padStart(2, '0')
  return `${year}-${month}-${day} ${hours}:${minutes}`
}

/**
 * 格式化数字，添加千分位分隔符
 */
export function formatNumber(value: string | number, decimals = 2): string {
  const num = typeof value === 'string' ? Number.parseFloat(value) : value
  if (Number.isNaN(num)) return '0.00'
  return num.toLocaleString('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  })
}

/**
 * 格式化盈亏数值，返回格式化字符串和符号
 */
export function formatPnl(value: string): { formatted: string; sign: '+' | '-' | '' } {
  const num = Number.parseFloat(value)
  if (Number.isNaN(num)) return { formatted: '0.00', sign: '' }
  const sign: '+' | '-' | '' = num >= 0 ? '+' : '-'
  const prefix = num >= 0 ? '+' : ''
  return { formatted: `${prefix}${formatNumber(num)}`, sign }
}

/**
 * 计算两个时间点之间的持续时长
 */
export function calculateDuration(openedAt: string, closedAt: string): string {
  const start = new Date(openedAt).getTime()
  const end = new Date(closedAt).getTime()
  const diffMs = end - start
  if (diffMs <= 0) return '0m'

  const hours = Math.floor(diffMs / (1000 * 60 * 60))
  const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60))

  if (hours > 0) {
    return `${hours}h ${minutes}m`
  }
  return `${minutes}m`
}

/**
 * 相对时间格式化结果
 */
export interface RelativeTimeResult {
  /** 翻译 key（用于 i18n） */
  key: 'justNow' | 'minutesAgo' | 'hoursAgo' | 'today' | 'yesterday' | 'date'
  /** 插值参数 */
  params: { count?: number; date?: string }
}

/**
 * 将时间戳转换为相对时间格式化所需的 key 和参数
 *
 * - 1分钟内: justNow
 * - 1小时内: minutesAgo
 * - 今天内: hoursAgo 或 today
 * - 昨天: yesterday
 * - 更早: date (返回格式化的日期)
 */
export function getRelativeTimeParams(timestamp: number | string | Date): RelativeTimeResult {
  const date = timestamp instanceof Date ? timestamp : new Date(timestamp)
  const now = new Date()

  // 检查日期有效性
  if (Number.isNaN(date.getTime())) {
    return { key: 'date', params: { date: '-' } }
  }

  const diffMs = now.getTime() - date.getTime()

  // 处理未来时间（时钟偏差），视为"刚刚"
  if (diffMs < 0) {
    return { key: 'justNow', params: {} }
  }

  const diffMinutes = Math.floor(diffMs / (1000 * 60))
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60))

  // 1分钟内
  if (diffMinutes < 1) {
    return { key: 'justNow', params: {} }
  }

  // 1小时内
  if (diffMinutes < 60) {
    return { key: 'minutesAgo', params: { count: diffMinutes } }
  }

  // 判断是否是今天
  const isToday =
    date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth() &&
    date.getDate() === now.getDate()

  if (isToday) {
    // 今天内，显示 x 小时前或"今天"
    if (diffHours < 12) {
      return { key: 'hoursAgo', params: { count: diffHours } }
    }
    return { key: 'today', params: {} }
  }

  // 判断是否是昨天
  const yesterday = new Date(now)
  yesterday.setDate(yesterday.getDate() - 1)
  const isYesterday =
    date.getFullYear() === yesterday.getFullYear() &&
    date.getMonth() === yesterday.getMonth() &&
    date.getDate() === yesterday.getDate()

  if (isYesterday) {
    return { key: 'yesterday', params: {} }
  }

  // 更早的日期，返回格式化的日期
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return { key: 'date', params: { date: `${year}-${month}-${day}` } }
}
