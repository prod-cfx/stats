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
})
