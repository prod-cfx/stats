/**
 * OAuth 相关常量（前后端共享）
 *
 * @remarks
 * - 此文件供前后端共享，禁止引入框架依赖
 * - 常量用于统一管理 OAuth 流程中的魔法字符串
 */

/**
 * OAuth Cookie 名称
 */
export const OAuthCookies = {
  /** OAuth 绑定意图 Cookie 名称 */
  BIND_INTENT: 'oauth_bind_intent',
  /** OAuth 一次性票据 Cookie 名称 */
  TICKET: 'oauth_ticket',
} as const

/**
 * OAuth LocalStorage 键名
 */
export const OAuthStorageKeys = {
  /** OAuth 意图（如 bind:google） */
  INTENT: 'oauth_intent',
  /** OAuth 重定向目标页签 */
  REDIRECT_TAB: 'oauth_redirect_tab',
  /** OAuth 错误消息 */
  ERROR_MSG: 'oauth_error_msg',
} as const

/**
 * OAuth URL 参数
 */
export const OAuthParams = {
  /** 绑定成功后的刷新参数值 */
  REFRESH_BIND: 'oauth-bind',
} as const

/**
 * OAuth 意图前缀
 */
export const OAuthIntentPrefix = {
  /** 绑定意图前缀（如 bind:google） */
  BIND: 'bind:',
} as const
