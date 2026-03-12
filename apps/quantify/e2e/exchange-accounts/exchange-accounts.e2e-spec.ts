import type { INestApplication } from '@nestjs/common'
import type { User } from '@prisma/client'
import type { PrismaService } from '@/prisma/prisma.service'
import { createApiClient, createTestingApp } from '../fixtures/fixtures'

describe('ExchangeAccounts (E2E)', () => {
  let app: INestApplication
  let prisma: PrismaService
  let testUser: User

  const originalFetch = globalThis.fetch
  const withUserId = <T extends Record<string, unknown>>(payload: T) => ({ userId: testUser.id, ...payload })
  const withUserIdPath = (path: string, userId = testUser.id) =>
    `${path}${path.includes('?') ? '&' : '?'}userId=${userId}`

  beforeAll(async () => {
    // Mock fetch 鎷︽埅浜ゆ槗鎵€ API 璇锋眰
    globalThis.fetch = jest.fn(async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
      const url = typeof input === 'string' || input instanceof URL ? new URL(input.toString()) : new URL(input.url)
      const method = (init?.method || 'GET').toUpperCase()

      // 瑙ｆ瀽璇锋眰澶村拰鍙傛暟
      const headers = init?.headers as Record<string, string> || {}
      const urlParams = new URLSearchParams(url.search)

      // ===== Binance Mock =====
      if (url.hostname === 'api.binance.com' || url.hostname === 'testnet.binance.vision') {
        // Binance 鏌ヨ浣欓
        if (url.pathname === '/api/v3/account' && method === 'GET') {
          const apiKey = headers['X-MBX-APIKEY'] || headers['x-mbx-apikey']
          const signature = urlParams.get('signature')

          // 妯℃嫙涓嶅悓鐨勯敊璇満鏅?
          if (apiKey === 'invalid_key') {
            return new Response(JSON.stringify({
              code: -2015,
              msg: 'Invalid API-key, IP, or permissions for action.'
            }), {
              status: 400,
              headers: { 'content-type': 'application/json' },
            })
          }

          if (apiKey === 'wrong_secret') {
            return new Response(JSON.stringify({
              code: -1022,
              msg: 'Signature for this request is not valid.'
            }), {
              status: 400,
              headers: { 'content-type': 'application/json' },
            })
          }

          if (apiKey === 'ip_restricted') {
            return new Response(JSON.stringify({
              code: -2010,
              msg: 'API-key format invalid.'
            }), {
              status: 403,
              headers: { 'content-type': 'application/json' },
            })
          }

          if (apiKey === 'disabled_key') {
            return new Response(JSON.stringify({
              code: -2011,
              msg: 'This API-key is disabled.'
            }), {
              status: 403,
              headers: { 'content-type': 'application/json' },
            })
          }

          if (apiKey === 'no_permission') {
            return new Response(JSON.stringify({
              code: -2015,
              msg: 'Invalid API-key, IP, or permissions for action. Permission not enabled.'
            }), {
              status: 403,
              headers: { 'content-type': 'application/json' },
            })
          }

          // 姝ｅ父鍝嶅簲
          if (apiKey === 'valid_key' && signature) {
            return new Response(JSON.stringify({
              balances: [
                { asset: 'BTC', free: '1.5', locked: '0' },
                { asset: 'USDT', free: '10000', locked: '0' },
              ]
            }), {
              status: 200,
              headers: { 'content-type': 'application/json' },
            })
          }
        }

        // Binance futures 浣欓
        if (url.pathname === '/fapi/v2/balance' && method === 'GET') {
          const apiKey = headers['X-MBX-APIKEY'] || headers['x-mbx-apikey']
          if (apiKey === 'valid_key') {
            return new Response(JSON.stringify([
              { asset: 'USDT', balance: '10000', availableBalance: '10000' }
            ]), {
              status: 200,
              headers: { 'content-type': 'application/json' },
            })
          }
        }

        // Binance ping
        if (url.pathname === '/api/v3/ping' || url.pathname === '/fapi/v1/ping') {
          return new Response('{}', {
            status: 200,
            headers: { 'content-type': 'application/json' },
          })
        }
      }

      // ===== OKX Mock =====
      if (url.hostname === 'www.okx.com') {
        const apiKey = headers['OK-ACCESS-KEY']
        const passphrase = headers['OK-ACCESS-PASSPHRASE']
        const signature = headers['OK-ACCESS-SIGN']

        // OKX 鏌ヨ浣欓
        if (url.pathname === '/api/v5/account/balance' && method === 'GET') {
          // 妯℃嫙閿欒鍦烘櫙
          if (apiKey === 'invalid_key') {
            return new Response(JSON.stringify({
              code: '50113',
              msg: 'Invalid API key',
              data: []
            }), {
              status: 401,
              headers: { 'content-type': 'application/json' },
            })
          }

          if (apiKey === 'expired_key') {
            return new Response(JSON.stringify({
              code: '50114',
              msg: 'API key expired',
              data: []
            }), {
              status: 401,
              headers: { 'content-type': 'application/json' },
            })
          }

          if (passphrase === 'wrong_passphrase') {
            return new Response(JSON.stringify({
              code: '50111',
              msg: 'Invalid passphrase',
              data: []
            }), {
              status: 401,
              headers: { 'content-type': 'application/json' },
            })
          }

          if (apiKey === 'ip_restricted') {
            return new Response(JSON.stringify({
              code: '50112',
              msg: 'IP address not whitelisted',
              data: []
            }), {
              status: 403,
              headers: { 'content-type': 'application/json' },
            })
          }

          if (apiKey === 'no_permission') {
            return new Response(JSON.stringify({
              code: '51001',
              msg: 'Permission denied for this operation',
              data: []
            }), {
              status: 403,
              headers: { 'content-type': 'application/json' },
            })
          }

          if (apiKey === 'disabled_key') {
            return new Response(JSON.stringify({
              code: '50115',
              msg: 'API key has been deleted or disabled',
              data: []
            }), {
              status: 403,
              headers: { 'content-type': 'application/json' },
            })
          }

          // 姝ｅ父鍝嶅簲
          if (apiKey === 'valid_key' && passphrase === 'valid_passphrase' && signature) {
            return new Response(JSON.stringify({
              code: '0',
              msg: '',
              data: [{
                details: [
                  { ccy: 'BTC', availEq: '1.5', eq: '1.5' },
                  { ccy: 'USDT', availEq: '10000', eq: '10000' },
                ]
              }]
            }), {
              status: 200,
              headers: { 'content-type': 'application/json' },
            })
          }
        }

        // OKX ping
        if (url.pathname === '/api/v5/public/time' && method === 'GET') {
          return new Response(JSON.stringify({
            code: '0',
            msg: '',
            data: [{ ts: String(Date.now()) }]
          }), {
            status: 200,
            headers: { 'content-type': 'application/json' },
          })
        }
      }

      // 榛樿鍝嶅簲
      return new Response('{}', {
        status: 404,
        headers: { 'content-type': 'application/json' },
      })
    }) as typeof fetch

    // 鍒涘缓娴嬭瘯搴旂敤
    const result = await createTestingApp()
    app = result.app
    prisma = result.prisma

    // 鍒涘缓娴嬭瘯鐢ㄦ埛
    testUser = await prisma.getClient().user.create({
      data: {
        email: `test-${Date.now()}@example.com`,
      }
    })
  })

  afterAll(async () => {
    // 娓呯悊娴嬭瘯鏁版嵁
    if (testUser) {
      await prisma.getClient().exchangeAccount.deleteMany({
        where: { userId: testUser.id }
      })
      await prisma.getClient().user.delete({
        where: { id: testUser.id }
      })
    }

    await app.close()
    globalThis.fetch = originalFetch
  })

  describe('POST /exchange-accounts - Binance', () => {
    it('should successfully create Binance account with valid credentials', async () => {
      const response = await createApiClient(app)
        .post('exchange-accounts')
        .send(withUserId({
          exchangeId: 'binance',
          apiKey: 'valid_key',
          apiSecret: 'valid_secret',
          marketType: 'spot',
          name: 'My Binance Account',
        }))
        .expect(201)

      expect(response.body).toMatchObject({
        exchangeId: 'binance',
        name: 'My Binance Account',
        isTestnet: false,
      })
      expect(response.body.id).toBeDefined()
      expect(response.body.lastValidatedAt).toBeDefined()
      expect(response.body.createdAt).toBeDefined()
    })

    it('should reject invalid Binance API key', async () => {
      const response = await createApiClient(app)
        .post('exchange-accounts')
        .send(withUserId({
          exchangeId: 'binance',
          apiKey: 'invalid_key',
          apiSecret: 'any_secret',
          marketType: 'spot',
        }))
        .expect(400)

      expect(response.body.message).toContain('API Key鎴朣ecret閿欒')
      expect(response.body.message).toContain('涓嶈鏈夊浣欑┖鏍?)
    })

    it('should reject wrong Binance secret', async () => {
      const response = await createApiClient(app)
        .post('exchange-accounts')
        .send(withUserId({
          exchangeId: 'binance',
          apiKey: 'wrong_secret',
          apiSecret: 'wrong_secret_value',
          marketType: 'spot',
        }))
        .expect(400)

      expect(response.body.message).toContain('API绛惧悕楠岃瘉澶辫触')
      expect(response.body.message).toContain('妫€鏌PI Secret')
    })

    it('should reject IP restricted Binance key', async () => {
      const response = await createApiClient(app)
        .post('exchange-accounts')
        .send(withUserId({
          exchangeId: 'binance',
          apiKey: 'ip_restricted',
          apiSecret: 'any_secret',
          marketType: 'spot',
        }))
        .expect(400)

      expect(response.body.message).toContain('IP鍦板潃鏈姞鍏ョ櫧鍚嶅崟')
      expect(response.body.message).toContain('甯佸畨API绠＄悊椤甸潰')
    })

    it('should reject disabled Binance key', async () => {
      const response = await createApiClient(app)
        .post('exchange-accounts')
        .send(withUserId({
          exchangeId: 'binance',
          apiKey: 'disabled_key',
          apiSecret: 'any_secret',
          marketType: 'spot',
        }))
        .expect(400)

      expect(response.body.message).toContain('API Key宸茶绂佺敤')
      expect(response.body.message).toContain('甯佸畨API绠＄悊椤甸潰妫€鏌ョ姸鎬?)
    })

    it('should reject Binance key without permission', async () => {
      const response = await createApiClient(app)
        .post('exchange-accounts')
        .send(withUserId({
          exchangeId: 'binance',
          apiKey: 'no_permission',
          apiSecret: 'any_secret',
          marketType: 'spot',
        }))
        .expect(400)

      expect(response.body.message).toContain('API Key鏉冮檺涓嶈冻')
      expect(response.body.message).toContain('璇诲彇')
      expect(response.body.message).toContain('浜ゆ槗')
    })

    it('should create Binance futures account', async () => {
      const response = await createApiClient(app)
        .post('exchange-accounts')
        .send(withUserId({
          exchangeId: 'binance',
          apiKey: 'valid_key',
          apiSecret: 'valid_secret',
          marketType: 'perp',
          name: 'Binance Futures',
        }))
        .expect(201)

      expect(response.body.exchangeId).toBe('binance')
      expect(response.body.name).toBe('Binance Futures')
    })
  })

  describe('POST /exchange-accounts - OKX', () => {
    it('should successfully create OKX account with valid credentials', async () => {
      const response = await createApiClient(app)
        .post('exchange-accounts')
        .send(withUserId({
          exchangeId: 'okx',
          apiKey: 'valid_key',
          apiSecret: 'valid_secret',
          passphrase: 'valid_passphrase',
          marketType: 'spot',
          name: 'My OKX Account',
        }))
        .expect(201)

      expect(response.body).toMatchObject({
        exchangeId: 'okx',
        name: 'My OKX Account',
        isTestnet: false,
      })
      expect(response.body.lastValidatedAt).toBeDefined()
    })

    it('should reject invalid OKX API key', async () => {
      const response = await createApiClient(app)
        .post('exchange-accounts')
        .send(withUserId({
          exchangeId: 'okx',
          apiKey: 'invalid_key',
          apiSecret: 'any_secret',
          passphrase: 'any_passphrase',
          marketType: 'spot',
        }))
        .expect(400)

      expect(response.body.message).toContain('API Key鏃犳晥')
      expect(response.body.message).toContain('妫€鏌ユ槸鍚︽纭鍒?)
    })

    it('should reject expired OKX API key', async () => {
      const response = await createApiClient(app)
        .post('exchange-accounts')
        .send(withUserId({
          exchangeId: 'okx',
          apiKey: 'expired_key',
          apiSecret: 'any_secret',
          passphrase: 'any_passphrase',
          marketType: 'spot',
        }))
        .expect(400)

      expect(response.body.message).toContain('API Key宸茶繃鏈?)
      expect(response.body.message).toContain('14澶╀笉浣跨敤鍚庤嚜鍔ㄥけ鏁?)
    })

    it('should reject wrong OKX passphrase', async () => {
      const response = await createApiClient(app)
        .post('exchange-accounts')
        .send(withUserId({
          exchangeId: 'okx',
          apiKey: 'valid_key',
          apiSecret: 'valid_secret',
          passphrase: 'wrong_passphrase',
          marketType: 'spot',
        }))
        .expect(400)

      expect(response.body.message).toContain('Passphrase閿欒')
      expect(response.body.message).toContain('瀵嗙爜鐭')
    })

    it('should reject IP restricted OKX key', async () => {
      const response = await createApiClient(app)
        .post('exchange-accounts')
        .send(withUserId({
          exchangeId: 'okx',
          apiKey: 'ip_restricted',
          apiSecret: 'any_secret',
          passphrase: 'any_passphrase',
          marketType: 'spot',
        }))
        .expect(400)

      expect(response.body.message).toContain('IP鍦板潃鏈姞鍏ョ櫧鍚嶅崟')
      expect(response.body.message).toContain('OKX API绠＄悊椤甸潰')
    })

    it('should reject OKX key without permission', async () => {
      const response = await createApiClient(app)
        .post('exchange-accounts')
        .send(withUserId({
          exchangeId: 'okx',
          apiKey: 'no_permission',
          apiSecret: 'any_secret',
          passphrase: 'any_passphrase',
          marketType: 'spot',
        }))
        .expect(400)

      expect(response.body.message).toContain('API Key鏉冮檺涓嶈冻')
      expect(response.body.message).toContain('璇诲彇')
      expect(response.body.message).toContain('浜ゆ槗')
    })

    it('should reject disabled OKX key', async () => {
      const response = await createApiClient(app)
        .post('exchange-accounts')
        .send(withUserId({
          exchangeId: 'okx',
          apiKey: 'disabled_key',
          apiSecret: 'any_secret',
          passphrase: 'any_passphrase',
          marketType: 'spot',
        }))
        .expect(400)

      expect(response.body.message).toContain('API Key宸茶绂佺敤鎴栧垹闄?)
      expect(response.body.message).toContain('OKX API绠＄悊椤甸潰妫€鏌ョ姸鎬?)
    })

    it('should reject OKX request without passphrase', async () => {
      const response = await createApiClient(app)
        .post('exchange-accounts')
        .send(withUserId({
          exchangeId: 'okx',
          apiKey: 'valid_key',
          apiSecret: 'valid_secret',
          // Missing passphrase
          marketType: 'spot',
        }))
        .expect(400)

      // 搴旇鍦?DTO 楠岃瘉闃舵灏辫鎷掔粷
      expect(response.body.message).toBeDefined()
    })
  })

  describe('GET /exchange-accounts', () => {
    let createdAccountId: string

    beforeAll(async () => {
      // 鍒涘缓涓€涓祴璇曡处鎴?
      const response = await createApiClient(app)
        .post('exchange-accounts')
        .send(withUserId({
          exchangeId: 'binance',
          apiKey: 'valid_key',
          apiSecret: 'valid_secret',
          marketType: 'spot',
          name: 'Test Account for List',
        }))

      createdAccountId = response.body.id
    })

    it('should list user exchange accounts', async () => {
      const response = await createApiClient(app)
        .get(withUserIdPath('exchange-accounts'))
        .expect(200)

      expect(Array.isArray(response.body)).toBe(true)
      expect(response.body.length).toBeGreaterThan(0)

      const account = response.body.find((a: any) => a.id === createdAccountId)
      expect(account).toBeDefined()
      expect(account.exchangeId).toBe('binance')
      expect(account.name).toBe('Test Account for List')
    })

    it('should not return sensitive data', async () => {
      const response = await createApiClient(app)
        .get(withUserIdPath('exchange-accounts'))
        .expect(200)

      const account = response.body[0]
      expect(account.encryptedConfig).toBeUndefined()
      expect(account.apiKey).toBeUndefined()
      expect(account.apiSecret).toBeUndefined()
      expect(account.passphrase).toBeUndefined()
    })

    it('should require explicit userId', async () => {
      await createApiClient(app)
        .get('exchange-accounts')
        .expect(400)
    })
  })

  describe('DELETE /exchange-accounts/:id', () => {
    let accountToDelete: string

    beforeEach(async () => {
      // 鍒涘缓涓€涓处鎴风敤浜庡垹闄?
      const response = await createApiClient(app)
        .post('exchange-accounts')
        .send(withUserId({
          exchangeId: 'binance',
          apiKey: 'valid_key',
          apiSecret: 'valid_secret',
          marketType: 'spot',
          name: 'Account to Delete',
        }))

      accountToDelete = response.body.id
    })

    it('should delete exchange account', async () => {
      await createApiClient(app)
        .delete(withUserIdPath(`exchange-accounts/${accountToDelete}`))
        .expect(200)

      // 楠岃瘉璐︽埛宸茶鍒犻櫎
      const response = await createApiClient(app)
        .get(withUserIdPath('exchange-accounts'))
        .expect(200)

      const account = response.body.find((a: any) => a.id === accountToDelete)
      expect(account).toBeUndefined()
    })

    it('should return 404 for non-existent account', async () => {
      await createApiClient(app)
        .delete(withUserIdPath('exchange-accounts/non-existent-id'))
        .expect(404)
    })

    it('should not allow deleting other user\'s account', async () => {
      // 鍒涘缓鍙︿竴涓敤鎴?
      const otherUser = await prisma.getClient().user.create({
        data: {
          email: `other-${Date.now()}@example.com`,
        }
      })

      // 灏濊瘯鐢ㄥ彟涓€涓?userId 鍒犻櫎璐︽埛
      await createApiClient(app)
        .delete(withUserIdPath(`exchange-accounts/${accountToDelete}`, otherUser.id))
        .expect(404) // 搴旇杩斿洖404锛屽洜涓烘壘涓嶅埌灞炰簬璇ョ敤鎴风殑璐︽埛

      // 娓呯悊
      await prisma.getClient().user.delete({
        where: { id: otherUser.id }
      })
    })
  })

  describe('Validation', () => {
    it('should reject missing apiKey', async () => {
      const response = await createApiClient(app)
        .post('exchange-accounts')
        .send(withUserId({
          exchangeId: 'binance',
          // apiKey missing
          apiSecret: 'secret',
          marketType: 'spot',
        }))
        .expect(400)

      expect(response.body.message).toBeDefined()
    })

    it('should reject missing apiSecret', async () => {
      const response = await createApiClient(app)
        .post('exchange-accounts')
        .send(withUserId({
          exchangeId: 'binance',
          apiKey: 'key',
          // apiSecret missing
          marketType: 'spot',
        }))
        .expect(400)

      expect(response.body.message).toBeDefined()
    })

    it('should reject invalid exchangeId', async () => {
      const response = await createApiClient(app)
        .post('exchange-accounts')
        .send(withUserId({
          exchangeId: 'invalid_exchange',
          apiKey: 'key',
          apiSecret: 'secret',
          marketType: 'spot',
        }))
        .expect(400)

      expect(response.body.message).toBeDefined()
    })

    it('should reject invalid marketType', async () => {
      const response = await createApiClient(app)
        .post('exchange-accounts')
        .send(withUserId({
          exchangeId: 'binance',
          apiKey: 'key',
          apiSecret: 'secret',
          marketType: 'invalid_market',
        }))
        .expect(400)

      expect(response.body.message).toBeDefined()
    })

    it('should accept optional name field', async () => {
      const response = await createApiClient(app)
        .post('exchange-accounts')
        .send(withUserId({
          exchangeId: 'binance',
          apiKey: 'valid_key',
          apiSecret: 'valid_secret',
          marketType: 'spot',
          // name is optional
        }))
        .expect(201)

      expect(response.body.name).toBeNull()
    })

    it('should accept testnet flag', async () => {
      const response = await createApiClient(app)
        .post('exchange-accounts')
        .send(withUserId({
          exchangeId: 'binance',
          apiKey: 'valid_key',
          apiSecret: 'valid_secret',
          marketType: 'spot',
          isTestnet: true,
        }))
        .expect(201)

      expect(response.body.isTestnet).toBe(true)
    })
  })

  describe('Edge Cases', () => {
    it('should handle concurrent requests', async () => {
      // 鍚屾椂鍒涘缓澶氫釜璐︽埛
      const promises = Array.from({ length: 5 }, (_, i) =>
        createApiClient(app)
          .post('exchange-accounts')
          .send(withUserId({
            exchangeId: 'binance',
            apiKey: 'valid_key',
            apiSecret: 'valid_secret',
            marketType: 'spot',
            name: `Concurrent Account ${i}`,
          }))
      )

      const results = await Promise.all(promises)
      results.forEach(response => {
        expect(response.status).toBe(201)
      })
    })

    it('should handle very long account names', async () => {
      const longName = 'A'.repeat(64) // Max length

      const response = await createApiClient(app)
        .post('exchange-accounts')
        .send(withUserId({
          exchangeId: 'binance',
          apiKey: 'valid_key',
          apiSecret: 'valid_secret',
          marketType: 'spot',
          name: longName,
        }))
        .expect(201)

      expect(response.body.name).toBe(longName)
    })

    it('should reject account names exceeding max length', async () => {
      const tooLongName = 'A'.repeat(65) // Over max length

      await createApiClient(app)
        .post('exchange-accounts')
        .send(withUserId({
          exchangeId: 'binance',
          apiKey: 'valid_key',
          apiSecret: 'valid_secret',
          marketType: 'spot',
          name: tooLongName,
        }))
        .expect(400)
    })
  })
})
