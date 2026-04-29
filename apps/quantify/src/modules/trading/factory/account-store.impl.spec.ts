import { ConfigCryptoService } from '@/common/services/config-crypto.service'
import { DbExchangeAccountStore } from './account-store.impl'

describe('DbExchangeAccountStore', () => {
  it('backfills OKX testnet flag from the exchange account record', async () => {
    const findFirst = jest.fn().mockResolvedValue({
      id: 'acct-okx-demo',
      userId: 'user-1',
      exchangeId: 'okx',
      encryptedConfig: 'encrypted-okx',
      isTestnet: true,
    })
    const txHost = {
      tx: {
        exchangeAccount: {
          findFirst,
        },
      },
    }
    const crypto = {
      decryptConfig: jest.fn().mockReturnValue({
        apiKey: 'okx-key',
        secret: 'okx-secret',
        passphrase: 'okx-passphrase',
      }),
    }

    const store = new DbExchangeAccountStore(
      txHost as ConstructorParameters<typeof DbExchangeAccountStore>[0],
      crypto as unknown as ConfigCryptoService,
    )

    const account = await store.getAccountConfig('user-1', 'okx')

    expect(account).toEqual({
      exchangeId: 'okx',
      config: {
        apiKey: 'okx-key',
        secret: 'okx-secret',
        passphrase: 'okx-passphrase',
        isTestnet: true,
      },
    })
  })
})
