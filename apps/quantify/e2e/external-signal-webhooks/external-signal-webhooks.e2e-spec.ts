import type { INestApplication } from '@nestjs/common'
import type { PrismaService } from '@/prisma/prisma.service'
import { createHmac } from 'node:crypto'
import { TOPIC_EXTERNAL_SIGNAL_RECEIVED } from '@/modules/message-bus/message-bus.topics'
import { createApiClient, createTestingApp } from '../fixtures/fixtures'

function bearerForUser(userId: string): string {
  return `test-token:${userId}`
}

function forgedBearerForUser(userId: string): string {
  const header = Buffer.from(JSON.stringify({ alg: 'none', typ: 'JWT' })).toString('base64url')
  const payload = Buffer.from(JSON.stringify({ sub: userId, principalType: 'user' })).toString('base64url')
  return `${header}.${payload}.signature`
}

function sign(secret: string, timestamp: string, rawBody: string): string {
  return createHmac('sha256', secret)
    .update(`${timestamp}.`)
    .update(Buffer.from(rawBody, 'utf8'))
    .digest('hex')
}

describe('External signal webhooks (E2E)', () => {
  let app: INestApplication
  let prisma: PrismaService
  let originalFetch: typeof globalThis.fetch
  const ownerId = 'external-signal-owner'
  const otherUserId = 'external-signal-other'
  const templateId = 'external-signal-template'
  const instanceId = 'external-signal-instance'

  beforeAll(async () => {
    originalFetch = globalThis.fetch
    globalThis.fetch = jest.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
      const authorization = init?.headers && typeof init.headers === 'object' && !Array.isArray(init.headers)
        ? (init.headers as Record<string, string>).authorization
        : undefined
      const token = authorization?.replace(/^Bearer\s+/i, '')
      const userId = token?.startsWith('test-token:') ? token.slice('test-token:'.length) : null
      if (!userId) {
        return new Response(JSON.stringify({ message: 'unauthorized' }), { status: 401 })
      }
      return new Response(JSON.stringify({ data: { id: userId } }), { status: 200 })
    }) as typeof globalThis.fetch

    const context = await createTestingApp()
    app = context.app
    prisma = context.prisma!

    await prisma.outboxMessage.deleteMany({ where: { topic: TOPIC_EXTERNAL_SIGNAL_RECEIVED } })
    await prisma.webhookSignalAudit.deleteMany({ where: { strategyInstanceId: instanceId } })
    await prisma.webhookSignalEvent.deleteMany({ where: { strategyInstanceId: instanceId } })
    await prisma.webhookSignalSubscription.deleteMany({ where: { strategyInstanceId: instanceId } })
    await prisma.strategyInstance.deleteMany({ where: { id: instanceId } })
    await prisma.strategyTemplate.deleteMany({ where: { id: templateId } })

    await prisma.user.upsert({
      where: { id: ownerId },
      update: {},
      create: { id: ownerId, email: 'external-signal-owner@test.local', nickname: 'Webhook Owner' },
    })
    await prisma.user.upsert({
      where: { id: otherUserId },
      update: {},
      create: { id: otherUserId, email: 'external-signal-other@test.local', nickname: 'Webhook Other' },
    })
    await prisma.strategyTemplate.upsert({
      where: { id: templateId },
      update: {},
      create: {
        id: templateId,
        name: 'External Signal Template',
        description: 'External signal webhook e2e template',
        llmModel: 'test',
        promptTemplate: 'test',
        paramsSchema: {},
        status: 'live',
        createdBy: ownerId,
        updatedBy: ownerId,
      },
    })
    await prisma.strategyInstance.upsert({
      where: { id: instanceId },
      update: { createdBy: ownerId, updatedBy: ownerId },
      create: {
        id: instanceId,
        strategyTemplateId: templateId,
        name: 'External Signal Instance',
        llmModel: 'test',
        status: 'running',
        mode: 'PAPER',
        createdBy: ownerId,
        updatedBy: ownerId,
      },
    })
  })

  afterAll(async () => {
    await prisma.outboxMessage.deleteMany({ where: { topic: TOPIC_EXTERNAL_SIGNAL_RECEIVED } })
    await prisma.webhookSignalAudit.deleteMany({ where: { strategyInstanceId: instanceId } })
    await prisma.webhookSignalEvent.deleteMany({ where: { strategyInstanceId: instanceId } })
    await prisma.webhookSignalSubscription.deleteMany({ where: { strategyInstanceId: instanceId } })
    await prisma.strategyInstance.deleteMany({ where: { id: instanceId } })
    await prisma.strategyTemplate.deleteMany({ where: { id: templateId } })
    await prisma.user.deleteMany({ where: { id: { in: [ownerId, otherUserId] } } })
    await app.close()
    globalThis.fetch = originalFetch
  })

  it('creates, lists, rotates, accepts, rejects, and audits signed webhook attempts', async () => {
    const client = createApiClient(app)

    const createResponse = await client
      .post(`account/ai-quant/strategies/${instanceId}/external-signal-subscriptions`)
      .set('authorization', `Bearer ${bearerForUser(ownerId)}`)
      .set('x-user-id', ownerId)
      .send({ provider: 'tradingview', signalId: 'BTC_PERP_LONG_01', metadata: { source: 'e2e' } })
      .expect(201)

    const created = createResponse.body.data as { id: string; secret: string; webhookUrl: string }
    expect(created.secret).toEqual(expect.any(String))
    expect(created.webhookUrl).toBe(`/api/v1/webhook/strategy/${instanceId}/signal`)

    await client
      .get(`account/ai-quant/strategies/${instanceId}/external-signal-subscriptions`)
      .set('authorization', `Bearer ${bearerForUser(otherUserId)}`)
      .set('x-user-id', otherUserId)
      .expect(403)

    await client
      .get(`account/ai-quant/strategies/${instanceId}/external-signal-subscriptions`)
      .set('authorization', `Bearer ${forgedBearerForUser(ownerId)}`)
      .set('x-user-id', ownerId)
      .expect(401)

    await client
      .get(`account/ai-quant/strategies/${instanceId}/external-signal-subscriptions`)
      .set('authorization', `Bearer ${bearerForUser(ownerId)}`)
      .set('x-user-id', ownerId)
      .expect(200)
      .expect(res => {
        expect(res.body.data).toEqual([
          expect.objectContaining({ id: created.id, signalId: 'BTC_PERP_LONG_01' }),
        ])
        expect(res.body.data[0]).not.toHaveProperty('secret')
      })

    await client
      .post(`account/ai-quant/external-signal-subscriptions/${created.id}/rotate`)
      .set('authorization', `Bearer ${bearerForUser(otherUserId)}`)
      .set('x-user-id', otherUserId)
      .expect(404)

    const rotateResponse = await client
      .post(`account/ai-quant/external-signal-subscriptions/${created.id}/rotate`)
      .set('authorization', `Bearer ${bearerForUser(ownerId)}`)
      .set('x-user-id', ownerId)
      .expect(200)

    const rotated = rotateResponse.body.data as { secret: string; secretVersion: number }
    expect(rotated.secret).toEqual(expect.any(String))
    expect(rotated.secret).not.toBe(created.secret)
    expect(rotated.secretVersion).toBe(2)

    const timestamp = String(Date.now())
    const rawBody = JSON.stringify({ signalId: 'BTC_PERP_LONG_01', provider: 'tradingview', side: 'long' })
    await client
      .post(`webhook/strategy/${instanceId}/signal`)
      .set('content-type', 'application/json')
      .set('x-external-signal-timestamp', timestamp)
      .set('x-external-signal-signature', sign(rotated.secret, timestamp, rawBody))
      .send(rawBody)
      .expect(202)
      .expect(res => {
        expect(res.body.data).toEqual(expect.objectContaining({ accepted: true, eventId: expect.any(String) }))
      })

    await client
      .post(`webhook/strategy/${instanceId}/signal`)
      .set('content-type', 'application/json')
      .set('x-external-signal-timestamp', String(Date.now()))
      .send(JSON.stringify({ signalId: 'BTC_PERP_LONG_01' }))
      .expect(400)

    const mismatchBody = JSON.stringify({ signalId: 'OTHER_SIGNAL' })
    const mismatchTimestamp = String(Date.now())
    await client
      .post(`webhook/strategy/${instanceId}/signal`)
      .set('content-type', 'application/json')
      .set('x-external-signal-timestamp', mismatchTimestamp)
      .set('x-external-signal-signature', sign(rotated.secret, mismatchTimestamp, mismatchBody))
      .send(mismatchBody)
      .expect(400)

    const oldTimestamp = String(Date.now() - 6 * 60 * 1000)
    const oldBody = JSON.stringify({ signalId: 'BTC_PERP_LONG_01' })
    await client
      .post(`webhook/strategy/${instanceId}/signal`)
      .set('content-type', 'application/json')
      .set('x-external-signal-timestamp', oldTimestamp)
      .set('x-external-signal-signature', sign(rotated.secret, oldTimestamp, oldBody))
      .send(oldBody)
      .expect(400)

    const [events, audits, outbox] = await Promise.all([
      prisma.webhookSignalEvent.findMany({ where: { strategyInstanceId: instanceId } }),
      prisma.webhookSignalAudit.findMany({ where: { strategyInstanceId: instanceId } }),
      prisma.outboxMessage.findMany({ where: { topic: TOPIC_EXTERNAL_SIGNAL_RECEIVED } }),
    ])

    expect(events).toHaveLength(1)
    expect(audits.filter(audit => audit.signatureStatus === 'ACCEPTED')).toHaveLength(1)
    expect(audits.filter(audit => audit.signatureStatus === 'REJECTED')).toHaveLength(3)
    expect(outbox).toHaveLength(1)
    expect(outbox[0].payload).toEqual(expect.objectContaining({
      eventId: events[0].id,
      strategyInstanceId: instanceId,
      signalId: 'BTC_PERP_LONG_01',
    }))
  })
})
