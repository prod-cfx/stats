import type { OfficialStrategyPlazaTemplate } from '../types/official-strategy-plaza-template'
import { StrategyPlazaOfficialSnapshotRepository } from './strategy-plaza-official-snapshot.repository'

function createTxHost(tx: unknown): ConstructorParameters<typeof StrategyPlazaOfficialSnapshotRepository>[0] {
  return { tx } as ConstructorParameters<typeof StrategyPlazaOfficialSnapshotRepository>[0]
}

describe('StrategyPlazaOfficialSnapshotRepository', () => {
  const template = {
    id: 'ma-cross',
    name: 'MA 均线交叉',
    description: '短均线上穿长均线做多，跌回长均线下方退出。',
    logicDescription: '使用 20/60 均线判断趋势方向，适合趋势初期跟随。',
    tags: ['趋势跟随', '均线', 'OKX 模拟盘'],
    riskLevel: 'medium',
    scenario: '趋势行情',
    exchange: 'okx',
    environment: 'demo',
    status: 'live',
    displayOrder: 10,
    runConfig: {
      exchange: 'okx',
      marketType: 'perp',
      symbol: 'BTC-USDT-SWAP',
      timeframe: '15m',
      positionPct: 10,
      leverage: 2,
      publishedSnapshotId: 'official-plaza-ma-cross-v1-snapshot',
      deploymentExecutionConfig: { leverage: 2, priceSource: 'mark', orderType: 'market', timeInForce: 'ioc' },
    },
    editSeed: {
      initialMessage: '创建一个 MA 20/60 均线交叉趋势跟随策略。',
    },
    displayMetrics: { label: 'official_sample_backtest', returnPct: null, winRatePct: null, maxDrawdownPct: null },
  } satisfies OfficialStrategyPlazaTemplate

  it('reuses an existing user-visible official snapshot', async () => {
    const existingSnapshot = {
      id: 'user-snapshot-1',
      snapshotHash: 'snapshot-hash-1',
      strategyInstanceId: 'strategy-instance-1',
    }
    const tx = {
      publishedStrategySnapshot: {
        findFirst: jest.fn().mockResolvedValue(existingSnapshot),
        create: jest.fn(),
      },
      llmStrategyCodegenSession: {
        upsert: jest.fn(),
      },
      strategyTemplate: {
        upsert: jest.fn(),
      },
      strategyInstance: {
        upsert: jest.fn(),
        update: jest.fn(),
      },
    }
    const repo = new StrategyPlazaOfficialSnapshotRepository(createTxHost(tx))

    await expect(repo.resolveOfficialSnapshotForUser({ userId: 'user-1', template })).resolves.toEqual({
      id: 'user-snapshot-1',
    })

    expect(tx.publishedStrategySnapshot.findFirst).toHaveBeenCalledWith({
      where: {
        sessionId: 'strategy-plaza:official:ma-cross:user:user-1',
        strategyInstanceId: { not: null },
        session: { userId: 'user-1' },
      },
      orderBy: [{ createdAt: 'desc' }],
      select: { id: true, snapshotHash: true, strategyInstanceId: true },
    })
    expect(tx.publishedStrategySnapshot.create).not.toHaveBeenCalled()
    expect(tx.strategyInstance.update).toHaveBeenCalledWith({
      where: { id: 'strategy-instance-1' },
      data: {
        metadata: expect.objectContaining({
          bindingSource: 'PUBLISHED_SNAPSHOT',
          publishedSnapshotId: 'user-snapshot-1',
          snapshotHash: 'snapshot-hash-1',
        }),
      },
    })
  })

  it('creates a user-visible snapshot and binds the source strategy instance to it', async () => {
    const tx = {
      publishedStrategySnapshot: {
        findFirst: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockResolvedValue({ id: 'user-snapshot-1', snapshotHash: 'snapshot-hash-1' }),
      },
      llmStrategyCodegenSession: {
        upsert: jest.fn().mockResolvedValue({ id: 'strategy-plaza:official:ma-cross:user:user-1' }),
        update: jest.fn(),
      },
      strategyTemplate: {
        upsert: jest.fn().mockResolvedValue({ id: 'strategy-template-1' }),
      },
      strategyInstance: {
        upsert: jest.fn().mockResolvedValue({ id: 'strategy-instance-1' }),
        update: jest.fn(),
      },
    }
    const repo = new StrategyPlazaOfficialSnapshotRepository(createTxHost(tx))

    await expect(repo.resolveOfficialSnapshotForUser({ userId: 'user-1', template })).resolves.toEqual({
      id: 'user-snapshot-1',
    })

    expect(tx.llmStrategyCodegenSession.upsert).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 'strategy-plaza:official:ma-cross:user:user-1' },
      create: expect.objectContaining({
        id: 'strategy-plaza:official:ma-cross:user:user-1',
        userId: 'user-1',
        status: 'PUBLISHED',
      }),
    }))
    expect(tx.strategyTemplate.upsert).toHaveBeenCalledWith(expect.objectContaining({
      create: expect.objectContaining({
        status: 'live',
        createdBy: 'user-1',
        metadata: expect.objectContaining({
          officialSnapshotId: 'official-plaza-ma-cross-v1-snapshot',
          officialTemplateId: 'ma-cross',
          source: 'strategy-plaza-official-template',
        }),
      }),
    }))
    expect(tx.publishedStrategySnapshot.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        session: { connect: { id: 'strategy-plaza:official:ma-cross:user:user-1' } },
        strategyInstanceId: 'strategy-instance-1',
        strategyTemplateId: 'strategy-template-1',
        strategyConfig: expect.objectContaining({
          exchange: 'okx',
          marketType: 'perp',
          symbol: 'BTC-USDT-SWAP',
          positionPct: 10,
        }),
        deploymentExecutionDefaults: {
          leverage: 2,
          priceSource: 'mark',
          orderType: 'market',
          timeInForce: 'ioc',
        },
        astSnapshot: expect.objectContaining({
          runtimeExecutionSemantics: [expect.objectContaining({
            semanticKey: 'on_start.entry.ma-cross',
          })],
        }),
      }),
      select: { id: true, snapshotHash: true },
    }))
    expect(tx.strategyInstance.update).toHaveBeenCalledWith({
      where: { id: 'strategy-instance-1' },
      data: {
        metadata: expect.objectContaining({
          bindingSource: 'PUBLISHED_SNAPSHOT',
          publishedSnapshotId: 'user-snapshot-1',
          snapshotHash: 'snapshot-hash-1',
        }),
      },
    })
  })
})
