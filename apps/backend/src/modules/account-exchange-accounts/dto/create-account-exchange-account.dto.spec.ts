import { validate } from 'class-validator'
import { CreateAccountExchangeAccountDto } from './create-account-exchange-account.dto'

describe('createAccountExchangeAccountDto', () => {
  it('accepts supported exchange ids', async () => {
    const dto = new CreateAccountExchangeAccountDto()
    dto.exchangeId = 'hyperliquid'
    dto.name = 'test'
    dto.mainWalletAddress = '0x1111111111111111111111111111111111111111'
    dto.agentPrivateKey = '0x1111111111111111111111111111111111111111111111111111111111111111'

    await expect(validate(dto)).resolves.toHaveLength(0)
  })

  it('rejects unsupported exchange ids', async () => {
    const dto = new CreateAccountExchangeAccountDto()
    dto.exchangeId = 'bybit' as never

    const errors = await validate(dto)

    expect(errors).toHaveLength(1)
    expect(errors[0]?.constraints).toMatchObject({
      isIn: expect.any(String),
    })
  })
})
