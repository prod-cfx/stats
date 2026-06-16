import { ErrorCode, PrincipalType } from '@ai/shared'
import { ConfigService } from '@nestjs/config'
import type { RoleAssignmentRepository } from '../repositories/role-assignment.repository'
import type { UserAuthRepository } from '../repositories/user-auth.repository'
import { JwtStrategy } from './jwt.strategy'

describe('JwtStrategy', () => {
  const createStrategy = () => {
    const userAuthRepository = {
      findUserTokenVersion: jest.fn().mockResolvedValue({ tokenVersion: 0 }),
    }
    const roleAssignmentRepository = {
      hasAssignment: jest.fn().mockResolvedValue(true),
    }
    const strategy = new JwtStrategy(
      { get: jest.fn((key: string) => key === 'jwt.secret' ? 'test-secret' : undefined) } as unknown as ConfigService,
      userAuthRepository as unknown as UserAuthRepository,
      roleAssignmentRepository as unknown as RoleAssignmentRepository,
    )

    return { strategy, userAuthRepository, roleAssignmentRepository }
  }

  it('rejects refresh tokens used as bearer access tokens', async () => {
    const { strategy, userAuthRepository, roleAssignmentRepository } = createStrategy()

    await expect(strategy.validate({
      sub: 'user-1',
      principalType: 'user',
      tokenType: 'refresh',
      tokenVersion: 0,
    })).rejects.toMatchObject({
      response: expect.objectContaining({ code: ErrorCode.AUTH_UNAUTHORIZED }),
    })

    expect(userAuthRepository.findUserTokenVersion).not.toHaveBeenCalled()
    expect(roleAssignmentRepository.hasAssignment).not.toHaveBeenCalled()
  })

  it('validates user token version and role assignment through repositories', async () => {
    const { strategy, userAuthRepository, roleAssignmentRepository } = createStrategy()

    await expect(strategy.validate({
      sub: 'user-1',
      email: 'user@example.com',
      roles: ['USER'],
      principalType: 'user',
      tokenVersion: 0,
    })).resolves.toEqual({
      id: 'user-1',
      email: 'user@example.com',
      roles: ['USER'],
      principalType: 'user',
      bridged: false,
    })

    expect(userAuthRepository.findUserTokenVersion).toHaveBeenCalledWith('user-1')
    expect(roleAssignmentRepository.hasAssignment).toHaveBeenCalledWith('user-1', PrincipalType.USER)
  })

  it('keeps legacy user access tokens without tokenType valid', async () => {
    const { strategy } = createStrategy()

    await expect(strategy.validate({
      sub: 'user-legacy',
      email: 'legacy@example.com',
      roles: ['USER'],
      principalType: 'user',
      tokenVersion: 0,
    })).resolves.toMatchObject({ id: 'user-legacy' })
  })

  it('skips tokenVersion lookup for admin principals and still checks assignment', async () => {
    const { strategy, userAuthRepository, roleAssignmentRepository } = createStrategy()

    await expect(strategy.validate({
      sub: 'admin-1',
      email: 'admin@example.com',
      roles: ['ADMIN'],
      principalType: 'admin',
      tokenVersion: 99,
    })).resolves.toEqual({
      id: 'admin-1',
      email: 'admin@example.com',
      roles: ['ADMIN'],
      principalType: 'admin',
      bridged: false,
    })

    expect(userAuthRepository.findUserTokenVersion).not.toHaveBeenCalled()
    expect(roleAssignmentRepository.hasAssignment).toHaveBeenCalledWith('admin-1', PrincipalType.ADMIN)
  })

  it('rejects invalidated user tokens when tokenVersion differs', async () => {
    const { strategy, userAuthRepository } = createStrategy()
    userAuthRepository.findUserTokenVersion.mockResolvedValueOnce({ tokenVersion: 2 })

    await expect(strategy.validate({
      sub: 'user-1',
      principalType: 'user',
      tokenVersion: 1,
    })).rejects.toMatchObject({
      response: expect.objectContaining({ code: ErrorCode.AUTH_UNAUTHORIZED }),
    })
  })

  it('rejects principals without role assignment', async () => {
    const { strategy, roleAssignmentRepository } = createStrategy()
    roleAssignmentRepository.hasAssignment.mockResolvedValueOnce(false)

    await expect(strategy.validate({
      sub: 'user-1',
      principalType: 'user',
      tokenVersion: 0,
    })).rejects.toMatchObject({
      response: expect.objectContaining({ code: ErrorCode.AUTH_FORBIDDEN }),
    })
  })
})
