import { DomainException } from '@/common/exceptions/domain.exception'
import { AccountStrategyCallerIdentityService } from './account-strategy-caller-identity.service'

function encodeJwtPart(value: unknown): string {
  return Buffer.from(JSON.stringify(value)).toString('base64url')
}

describe('accountStrategyCallerIdentityService', () => {
  afterEach(() => {
    jest.restoreAllMocks()
  })

  it('rejects invalid jwt payloads without constructing raw Error sentinels', async () => {
    const service = new AccountStrategyCallerIdentityService({} as never)
    const invalidPayloadToken = `header.${encodeJwtPart('not-an-object')}.signature`
    const errorSpy = jest.spyOn(globalThis, 'Error')

    await expect(
      service.resolveCallerUserIdFromAuthorization(`Bearer ${invalidPayloadToken}`),
    ).rejects.toMatchObject({
      message: 'account_strategy.invalid_jwt_payload',
    })
    expect(errorSpy).not.toHaveBeenCalledWith('invalid_jwt_part')
    await expect(
      service.resolveCallerUserIdFromAuthorization(`Bearer ${invalidPayloadToken}`),
    ).rejects.toBeInstanceOf(DomainException)
  })

  it('trusts forwarded x-user-id only when it matches jwt subject', async () => {
    const service = new AccountStrategyCallerIdentityService({} as never)
    const token = `header.${encodeJwtPart({ sub: 'user-1', principalType: 'user' })}.signature`

    await expect(
      service.resolveCallerUserIdFromAuthorization(`Bearer ${token}`, 'user-1'),
    ).resolves.toBe('user-1')
  })

  it('rejects forwarded x-user-id when it does not match jwt subject', async () => {
    const service = new AccountStrategyCallerIdentityService({} as never)
    const token = `header.${encodeJwtPart({ sub: 'user-1', principalType: 'user' })}.signature`

    await expect(
      service.resolveCallerUserIdFromAuthorization(`Bearer ${token}`, 'user-2'),
    ).rejects.toBeInstanceOf(DomainException)
  })

  it('verifies tokens with backend auth before accepting forwarded x-user-id', async () => {
    const service = new AccountStrategyCallerIdentityService({
      getString: jest.fn().mockReturnValue('http://backend.local'),
    } as never)
    const token = `header.${encodeJwtPart({ sub: 'forged-user', principalType: 'user' })}.signature`
    const fetchSpy = jest.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({ data: { id: 'verified-user' } }),
    } as Response)

    await expect(
      service.resolveVerifiedCallerUserIdFromAuthorization(`Bearer ${token}`, 'forged-user'),
    ).rejects.toBeInstanceOf(DomainException)
    expect(fetchSpy).toHaveBeenCalledWith('http://backend.local/users/me', expect.objectContaining({
      headers: { authorization: `Bearer ${token}` },
    }))
  })
})
