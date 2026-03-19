/**
 * 默认游客昵称（用于后端创建游客账号时的占位字段）
 * - 使用中文“游客”以兼容现有数据
 */
export const DEFAULT_GUEST_NICKNAME = '游客'

/**
 * 判断昵称是否为游客默认昵称或其等价别名
 * @param nickname 当前昵称
 */
export function isDefaultGuestNickname(nickname?: string | null): boolean {
  if (!nickname) return true

  const normalized = nickname.trim().toLowerCase()
  if (!normalized) return true

  const aliases = ['guest', '游客', 'user', '用户']
  return aliases.some(alias => alias.toLowerCase() === normalized)
}
