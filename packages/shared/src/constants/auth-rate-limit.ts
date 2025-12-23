/**
 * 游客登录限流配置（前后端共享）
 *
 * - limit: 单窗口内允许的最大请求次数
 * - windowSeconds: 窗口长度（秒）
 */
export const GUEST_LOGIN_RATE_LIMIT = {
  limit: 10,
  windowSeconds: 60 * 60, // 1 小时
} as const

/**
 * 将窗口长度转换为小时，便于展示/日志
 */
export const GUEST_LOGIN_RATE_LIMIT_WINDOW_HOURS = GUEST_LOGIN_RATE_LIMIT.windowSeconds / 3600
