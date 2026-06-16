import { ConfigService } from '@nestjs/config'
import { JwtService } from '@nestjs/jwt'
import { compare } from 'bcrypt'
import { AdminUserRepository } from '../repositories/admin-user.repository'
import { AdminUserService } from './admin-user.service'

jest.mock('bcrypt', () => ({
  compare: jest.fn(),
  hash: jest.fn(async () => 'hashed-password'),
}))

describe('AdminUserService auth token TTLs', () => {
  it('signs admin access and refresh tokens with configured access and refresh TTLs', async () => {
    const repository = {
      findByUsername: jest.fn().mockResolvedValue({
        id: 'admin-1',
        username: 'root',
        password: 'hashed-password',
        nickName: null,
        email: 'root@example.com',
        avatarUrl: null,
        phone: null,
        isFrozen: false,
      }),
      findRoleCodesByAdmin: jest.fn().mockResolvedValue([{ role: { code: 'SUPER_ADMIN' } }]),
      findRoleAssignments: jest.fn().mockResolvedValue([{ role: { id: 'role-1', code: 'SUPER_ADMIN', name: 'Super Admin', description: null } }]),
    }
    const jwtService = {
      signAsync: jest.fn(async payload => payload.tokenType === 'refresh' ? 'admin-refresh-token' : 'admin-access-token'),
    }
    const configService = {
      get: jest.fn((key: string) => {
        if (key === 'jwt.accessExpiresIn') return '15m'
        if (key === 'jwt.refreshExpiresIn') return '9d'
        return undefined
      }),
    }
    ;(compare as jest.Mock).mockResolvedValue(true)

    const service = new AdminUserService(
      repository as unknown as AdminUserRepository,
      jwtService as unknown as JwtService,
      configService as unknown as ConfigService,
    )

    await expect(service.login('root', 'password')).resolves.toEqual(expect.objectContaining({
      accessToken: 'admin-access-token',
      refreshToken: 'admin-refresh-token',
      expiresIn: '15m',
    }))
    expect(jwtService.signAsync).toHaveBeenCalledWith(
      expect.objectContaining({ tokenType: 'access' }),
      { expiresIn: '15m' },
    )
    expect(jwtService.signAsync).toHaveBeenCalledWith(
      expect.objectContaining({ tokenType: 'refresh' }),
      { expiresIn: '9d' },
    )
  })
})
