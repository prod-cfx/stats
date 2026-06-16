import { ErrorCode } from '@ai/shared'
import { ConfigService } from '@nestjs/config'
import { JwtStrategy } from './jwt.strategy'

describe('JwtStrategy', () => {
  const createStrategy = () => {
    const tx = {
      user: {
        findUnique: jest.fn().mockResolvedValue({ tokenVersion: 0 }),
      },
      roleAssignment: {
        findFirst: jest.fn().mockResolvedValue({ id: 'assignment-1' }),
      },
    }
    const strategy = new JwtStrategy(
      { get: jest.fn((key: string) => key === 'jwt.secret' ? 'test-secret' : undefined) } as unknown as ConfigService,
      { tx } as never,
    )

    return { strategy, tx }
  }

  it('rejects refresh tokens used as bearer access tokens', async () => {
    const { strategy, tx } = createStrategy()

    await expect(strategy.validate({
      sub: 'user-1',
      principalType: 'user',
      tokenType: 'refresh',
      tokenVersion: 0,
    })).rejects.toMatchObject({
      response: expect.objectContaining({ code: ErrorCode.AUTH_UNAUTHORIZED }),
    })

    expect(tx.user.findUnique).not.toHaveBeenCalled()
    expect(tx.roleAssignment.findFirst).not.toHaveBeenCalled()
  })

  it('keeps legacy user access tokens without tokenType valid', async () => {
    const { strategy } = createStrategy()

    await expect(strategy.validate({
      sub: 'user-legacy',
      email: 'legacy@example.com',
      roles: ['USER'],
      principalType: 'user',
      tokenVersion: 0,
    })).resolves.toEqual({
      id: 'user-legacy',
      email: 'legacy@example.com',
      roles: ['USER'],
      principalType: 'user',
      bridged: false,
    })
  })
})
