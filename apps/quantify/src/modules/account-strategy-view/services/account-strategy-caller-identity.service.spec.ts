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
})
