// 基础事件类型（脚手架版精简）

export const AUTH_EVENT = {
  USER_REGISTERED: 'auth.user.registered',
  USER_LOGGED_IN: 'auth.user.logged_in',
  ADMIN_LOGGED_IN: 'auth.admin.logged_in',
} as const

export type AuthEventTypeStr = (typeof AUTH_EVENT)[keyof typeof AUTH_EVENT]
