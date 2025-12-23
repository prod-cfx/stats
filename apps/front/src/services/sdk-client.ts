/**
 * SDK 客户端令牌管理
 * 用于在认证状态变化时更新 API 客户端的访问令牌
 */

let currentToken: string = ''

/**
 * 更新客户端访问令牌
 * @param token - 新的访问令牌，空字符串表示清除
 */
export function updateClientToken(token: string): void {
  currentToken = token
}

/**
 * 获取当前客户端访问令牌
 */
export function getClientToken(): string {
  return currentToken
}
