import { getToken } from './auth-storage'

describe('auth-storage', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('reads token from auth_session when legacy accessToken key is missing', () => {
    localStorage.setItem('auth_session', JSON.stringify({
      userId: 'user-1',
      email: 'u@example.com',
      accessToken: 'Bearer a.b.c',
      expiresAt: Date.now() + 60_000,
      loginMethods: ['email'],
    }))

    expect(getToken()).toBe('a.b.c')
    expect(localStorage.getItem('accessToken')).toBe('a.b.c')
  })
})
