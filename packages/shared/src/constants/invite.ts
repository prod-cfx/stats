/**
 * 邀请码相关常量与工具
 *
 * 说明：该文件仅包含纯函数与常量，符合 @ai/shared 的同构约束
 */

/**
 * 邀请码允许的最大长度
 */
export const INVITATION_CODE_MAX_LENGTH = 64

/**
 * 邀请码字符白名单：大小写字母、数字、下划线、连字符
 */
export const INVITATION_CODE_ALLOWED_PATTERN = /^[\w-]+$/

/**
 * 校验邀请码是否符合规范
 */
export function isValidInvitationCode(code: string | null | undefined): boolean {
  if (!code) return false
  const trimmed = code.trim()
  if (!trimmed) return false
  if (trimmed.length > INVITATION_CODE_MAX_LENGTH) return false
  return INVITATION_CODE_ALLOWED_PATTERN.test(trimmed)
}

/**
 * 对邀请码做脱敏处理（前后各保留两位，其余使用 * 号遮挡）
 */
export function maskInvitationCode(code: string | null | undefined): string | null {
  if (!code) return null
  const trimmed = code.trim()
  if (!trimmed) return null
  if (trimmed.length <= 4) {
    // 短邀请码：保留首尾各一位
    const head = trimmed.slice(0, 1)
    const tail = trimmed.slice(-1)
    return `${head}***${tail}`
  }
  const head = trimmed.slice(0, 2)
  const tail = trimmed.slice(-2)
  const maskLength = Math.max(3, trimmed.length - 4)
  return `${head}${'*'.repeat(maskLength)}${tail}`
}

/**
 * 归一化邀请码（去掉首尾空格）
 */
export function normalizeInvitationCode(code: string): string {
  return code.trim()
}
