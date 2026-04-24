import { DomainException } from '@/common/exceptions/domain.exception'
import { CallerIdentityService } from './caller-identity.service'

function encodeJwtPart(value: unknown): string {
  return Buffer.from(JSON.stringify(value)).toString('base64url')
}

describe('callerIdentityService', () => {
  afterEach(() => {
    jest.restoreAllMocks()
  })

  function mockBackendAuth(userId: string) {
    jest.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({ data: { id: userId } }),
    } as Response)
  }

  function createService() {
    return new CallerIdentityService({
      getString: jest.fn().mockReturnValue(undefined),
      isDev: jest.fn().mockReturnValue(false),
      getBoolean: jest.fn().mockReturnValue(false),
    } as never)
  }

  it('rejects invalid jwt payloads without constructing raw Error sentinels', async () => {
    const service = createService()
    const invalidPayloadToken = `header.${encodeJwtPart('not-an-object')}.signature`
    const errorSpy = jest.spyOn(globalThis, 'Error')

    await expect(
      service.resolveCallerUserIdFromAuthorization(`Bearer ${invalidPayloadToken}`),
    ).rejects.toMatchObject({
      message: 'codegen.invalid_jwt_payload',
    })
    expect(errorSpy).not.toHaveBeenCalledWith('invalid_jwt_part')
    await expect(
      service.resolveCallerUserIdFromAuthorization(`Bearer ${invalidPayloadToken}`),
    ).rejects.toBeInstanceOf(DomainException)
  })

  it('trusts forwarded x-user-id only after backend verifies the bearer token user', async () => {
    const service = createService()
    const token = `header.${encodeJwtPart({ sub: 'attacker-controlled', principalType: 'user' })}.signature`
    mockBackendAuth('user-1')

    await expect(
      service.resolveCallerUserIdFromAuthorization(`Bearer ${token}`, 'user-1'),
    ).resolves.toBe('user-1')
    expect(globalThis.fetch).toHaveBeenCalledWith(
      'http://127.0.0.1:3000/api/v1/users/me',
      expect.objectContaining({
        headers: { authorization: `Bearer ${token}` },
      }),
    )
  })

  it('rejects forwarded x-user-id when it does not match backend verified user', async () => {
    const service = createService()
    const token = `header.${encodeJwtPart({ sub: 'user-2', principalType: 'user' })}.signature`
    mockBackendAuth('user-1')

    await expect(
      service.resolveCallerUserIdFromAuthorization(`Bearer ${token}`, 'user-2'),
    ).rejects.toBeInstanceOf(DomainException)
  })
})
