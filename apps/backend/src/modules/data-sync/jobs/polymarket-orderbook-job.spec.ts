import { PolymarketOrderbookJob } from './polymarket-orderbook.job'

describe('polymarket orderbook job', () => {
  const createJob = () => {
    const clobClient = {
      fetchOrderbook: jest.fn(),
    }
    const ingestion = {
      listOutcomeTokens: jest.fn(),
      saveOrderbookSnapshot: jest.fn().mockResolvedValue(undefined),
    }
    const configService = {
      get: jest.fn((key: string) => {
        if (key !== 'polymarket') return undefined
        return { filters: { category: 'crypto' } }
      }),
    }

    const job = new PolymarketOrderbookJob(clobClient as any, ingestion as any, configService as any)
    return { job, clobClient, ingestion }
  }

  it('reads outcome tokens and saves snapshots through ingestion service', async () => {
    const { job, clobClient, ingestion } = createJob()
    ingestion.listOutcomeTokens.mockResolvedValueOnce([
      {
        marketDbId: 11,
        marketExternalId: 'market-1',
        outcomeDbId: 22,
        outcomeTokenId: 'token-yes',
      },
    ])
    clobClient.fetchOrderbook.mockResolvedValueOnce({
      bids: [{ price: '0.40', size: '10' }],
      asks: [{ price: '0.45', size: '12' }],
      seq: '123',
      timestamp: '1766738570134',
    })

    const result = await job.run({
      taskId: 1,
      key: job.key,
      cursor: null,
      meta: { category: 'crypto' },
      now: new Date('2026-06-16T00:00:00.000Z'),
    })

    expect(ingestion.listOutcomeTokens).toHaveBeenCalledWith({
      category: 'crypto',
      limit: 25,
      offset: 0,
    })
    expect(ingestion.saveOrderbookSnapshot).toHaveBeenCalledWith(
      expect.objectContaining({
        marketDbId: 11,
        outcomeDbId: 22,
        marketExternalId: 'market-1',
        outcomeTokenId: 'token-yes',
        spread: '0.050000',
        source: 'POLYMARKET',
      }),
    )
    expect(result).toEqual({
      fetchedCount: 1,
      newCursor: JSON.stringify({ offset: 0, failedTokens: undefined, skippedTokens: undefined }),
      meta: expect.objectContaining({
        tokensProcessed: 1,
        success: 1,
        failed: 0,
        skipped: 0,
        nextOffset: 0,
        category: 'crypto',
      }),
    })
  })
})
