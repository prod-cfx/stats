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
