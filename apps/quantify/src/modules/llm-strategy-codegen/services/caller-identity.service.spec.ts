import { DomainException } from '@/common/exceptions/domain.exception'
import { CallerIdentityService } from './caller-identity.service'

function encodeJwtPart(value: unknown): string {
  return Buffer.from(JSON.stringify(value)).toString('base64url')
}

describe('callerIdentityService', () => {
  afterEach(() => {
    jest.restoreAllMocks()
  })

  it('rejects invalid jwt payloads without constructing raw Error sentinels', async () => {
    const service = new CallerIdentityService({} as never)
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

  it('trusts forwarded x-user-id only when it matches jwt subject', async () => {
    const service = new CallerIdentityService({} as never)
    const token = `header.${encodeJwtPart({ sub: 'user-1', principalType: 'user' })}.signature`

    await expect(
      service.resolveCallerUserIdFromAuthorization(`Bearer ${token}`, 'user-1'),
    ).resolves.toBe('user-1')
  })

  it('rejects forwarded x-user-id when it does not match jwt subject', async () => {
    const service = new CallerIdentityService({} as never)
    const token = `header.${encodeJwtPart({ sub: 'user-1', principalType: 'user' })}.signature`

    await expect(
      service.resolveCallerUserIdFromAuthorization(`Bearer ${token}`, 'user-2'),
    ).rejects.toBeInstanceOf(DomainException)
  })
})
