import type { PolymarketGammaMarket } from '@/clients/polymarket/types'
import { PolymarketMarketsJob } from './polymarket-markets.job'

describe('PolymarketMarketsJob', () => {
  const createJob = () => {
    const gammaClient = {
      listMarkets: jest.fn(),
    }

    const repo = {
      upsertMarketWithOutcomes: jest.fn().mockResolvedValue(undefined),
      findMarketsForTranslation: jest.fn().mockResolvedValue([]),
    }

    const configService = {
      get: jest.fn((key: string) => {
        if (key !== 'polymarket') return undefined
        return {
          filters: { category: 'crypto', tags: [] },
          gamma: { maxLimit: 200 },
          translation: { enabled: false },
        }
      }),
    }

    const translateClient = {
      translateBatch: jest.fn(),
    }

    const job = new PolymarketMarketsJob(
      gammaClient as any,
      repo as any,
      configService as any,
      translateClient as any,
    )

    return {
      job,
      gammaClient,
      repo,
    }
  }

  const createMarket = (overrides: Partial<PolymarketGammaMarket> = {}): PolymarketGammaMarket => {
    return {
      id: 'm-1',
      slug: 'btc-100k',
      title: 'BTC 100k',
      question: 'Will BTC hit 100k?',
      category: null,
      tags: ['crypto'],
      outcomes: [
        {
          id: 'o-1',
          token_id: 'token-yes',
          name: 'Yes',
          side: 'YES',
          price: '0.6',
          probability: '0.6',
        },
      ],
      ...overrides,
    } as PolymarketGammaMarket
  }

  it('does not skip market when meta.category=crypto but gamma category is null', async () => {
    const { job, gammaClient, repo } = createJob()
    gammaClient.listMarkets.mockResolvedValueOnce({
      markets: [createMarket({ category: null })],
      nextCursor: null,
    })

    const result = await job.run({
      taskId: 1,
      key: job.key,
      cursor: null,
      meta: {
        category: 'crypto',
        onlyActive: true,
      },
      now: new Date(),
    })

    expect(result.fetchedCount).toBe(1)
    expect(repo.upsertMarketWithOutcomes).toHaveBeenCalledTimes(1)
    expect(gammaClient.listMarkets).toHaveBeenCalledWith(
      expect.objectContaining({
        category: 'crypto',
        closed: false,
      }),
    )
  })

  it('skips market when gamma category explicitly mismatches meta.category', async () => {
    const { job, gammaClient, repo } = createJob()
    gammaClient.listMarkets.mockResolvedValueOnce({
      markets: [createMarket({ category: 'sports' })],
      nextCursor: null,
    })

    const result = await job.run({
      taskId: 1,
      key: job.key,
      cursor: null,
      meta: {
        category: 'crypto',
      },
      now: new Date(),
    })

    expect(result.fetchedCount).toBe(0)
    expect(repo.upsertMarketWithOutcomes).not.toHaveBeenCalled()
  })

  it('skips null-category market when content is clearly non-crypto', async () => {
    const { job, gammaClient, repo } = createJob()
    gammaClient.listMarkets.mockResolvedValueOnce({
      markets: [
        createMarket({
          category: null,
          question: 'Will the Lakers win tonight?',
          title: 'NBA game winner',
          slug: 'nba-game-winner',
          tags: [],
          event: {
            title: 'NBA game winner',
            tags: [],
          } as any,
        }),
      ],
      nextCursor: null,
    })

    const result = await job.run({
      taskId: 1,
      key: job.key,
      cursor: null,
      meta: {
        category: 'crypto',
      },
      now: new Date(),
    })

    expect(result.fetchedCount).toBe(0)
    expect(repo.upsertMarketWithOutcomes).not.toHaveBeenCalled()
  })

  it('resets cursor when filter changes to avoid stale offset pages', async () => {
    const { job, gammaClient } = createJob()
    gammaClient.listMarkets.mockResolvedValueOnce({
      markets: [createMarket({ category: 'crypto', question: 'Will BTC hit 200k?' })],
      nextCursor: null,
    })

    await job.run({
      taskId: 1,
      key: job.key,
      cursor: JSON.stringify({
        offset: 1100,
        usedCursor: false,
        filterSignature: JSON.stringify({
          category: null,
          tags: [],
          onlyActive: false,
        }),
      }),
      meta: {
        category: 'crypto',
        onlyActive: true,
      },
      now: new Date(),
    })

    expect(gammaClient.listMarkets).toHaveBeenCalledWith(
      expect.objectContaining({
        offset: 0,
      }),
    )
  })

  it('continues to next page when current page has no matched markets', async () => {
    const { job, gammaClient } = createJob()
    gammaClient.listMarkets
      .mockResolvedValueOnce({
        markets: Array.from({ length: 100 }).map((_, idx) =>
          createMarket({
            id: `m-empty-page-${idx}`,
            category: null,
            question: `Will team ${idx} win tonight?`,
            title: 'NBA game winner',
            slug: `nba-game-winner-${idx}`,
            tags: [],
            event: {
              title: 'NBA game winner',
              tags: [],
            } as any,
          }),
        ),
        nextCursor: null,
      })
      .mockResolvedValueOnce({
        markets: [
          createMarket({
            id: 'm-next-page-crypto',
            category: 'crypto',
            question: 'Will BTC hit 200k?',
          }),
        ],
        nextCursor: null,
      })

    const result = await job.run({
      taskId: 1,
      key: job.key,
      cursor: JSON.stringify({
        offset: 200,
        usedCursor: false,
        filterSignature: JSON.stringify({
          category: 'crypto',
          tags: [],
          onlyActive: true,
        }),
      }),
      meta: {
        category: 'crypto',
        onlyActive: true,
      },
      now: new Date(),
    })

    const newCursor = JSON.parse(result.newCursor as string) as {
      offset?: number
      usedCursor?: boolean
    }
    expect(gammaClient.listMarkets).toHaveBeenCalledTimes(2)
    expect(gammaClient.listMarkets).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        offset: 300,
      }),
    )
    expect(result.fetchedCount).toBe(1)
    expect(newCursor.offset).toBe(0)
    expect(newCursor.usedCursor).toBe(false)
  })
})
