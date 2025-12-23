export const DEFAULT_AVATAR_URL = 'https://prod.ugirl.ai/mascot/DefaultAvatar.jpg'

export function isDefaultAvatar(avatarUrl?: string | null): boolean {
  if (!avatarUrl) {
    return true
  }

  return avatarUrl === DEFAULT_AVATAR_URL
}

