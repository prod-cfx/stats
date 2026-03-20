import type { AuthResponseDto, UserProfile } from '@/types/auth'

const mockUser: UserProfile = {
  id: 'mock-user-id',
  email: 'user@example.com',
  nickname: 'Demo User',
  avatarUrl: '',
  emailVerified: true,
  isGuest: false,
  roles: [],
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
}

export const mockRegister = (): Promise<AuthResponseDto> => {
  return new Promise(resolve => {
    setTimeout(() => {
      resolve({
        accessToken: 'mock-access-token',
        user: mockUser,
      })
    }, 1000)
  })
}

export const mockLogin = (): Promise<AuthResponseDto & { hasLinkedAccount: boolean }> => {
  return new Promise(resolve => {
    setTimeout(() => {
      resolve({
        accessToken: 'mock-access-token',
        user: mockUser,
        hasLinkedAccount: false,
      })
    }, 1000)
  })
}

export const mockConnectAccount = (): Promise<{ success: boolean; message: string }> => {
  return new Promise(resolve => {
    setTimeout(() => {
      resolve({ success: true, message: 'Account connected' })
    }, 1000)
  })
}

export const mockCreateFollowing = (): Promise<{ success: boolean; message: string }> => {
  return new Promise(resolve => {
    setTimeout(() => {
      resolve({ success: true, message: 'Strategy followed' })
    }, 1000)
  })
}

export const mockClosePosition = (
  positionId: string
): Promise<{ success: boolean; positionId: string; message: string }> => {
  return new Promise(resolve => {
    setTimeout(() => {
      resolve({ success: true, positionId, message: 'Position closed' })
    }, 1000)
  })
}
