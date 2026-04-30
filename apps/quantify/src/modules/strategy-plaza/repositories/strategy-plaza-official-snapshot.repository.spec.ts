import type { OfficialStrategyPlazaTemplate } from '../types/official-strategy-plaza-template'
import { BacktestStrategyAdapterService } from '@/modules/backtesting/services/backtest-strategy-adapter.service'
import { buildOfficialStrategySnapshotContent } from '../utils/official-strategy-plaza-snapshot-builder'
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
      deploymentExecutionConfig: { leverage: 2, priceSource: 'mark', orderType: 'market', timeInForce: 'ioc', tdMode: 'cross' },
    },
    editSeed: {
      initialMessage: '创建一个 MA 20/60 均线交叉趋势跟随策略。',
    },
    displayMetrics: { label: 'official_sample_backtest', returnPct: null, winRatePct: null, maxDrawdownPct: null },
  } satisfies OfficialStrategyPlazaTemplate

  const sourceContent = buildOfficialStrategySnapshotContent(template)
  const sourceSnapshot = {
    id: 'official-plaza-ma-cross-v1-snapshot',
    snapshotHash: sourceContent.snapshotHash,
    scriptHash: sourceContent.scriptHash,
    specHash: sourceContent.specHash,
    irHash: sourceContent.irHash,
    astDigest: sourceContent.astDigest,
    structuralDigest: sourceContent.structuralDigest,
    scriptSnapshot: sourceContent.scriptSnapshot,
    specSnapshot: sourceContent.specSnapshot,
    semanticGraph: sourceContent.semanticGraph,
    compiledIr: sourceContent.compiledIr,
    irSnapshot: sourceContent.irSnapshot,
    astSnapshot: sourceContent.astSnapshot,
    compiledManifest: sourceContent.compiledManifest,
    consistencyReport: sourceContent.consistencyReport,
    paramsSnapshot: sourceContent.paramsSnapshot,
    strategyConfig: sourceContent.strategyConfig,
    backtestConfigDefaults: sourceContent.backtestConfigDefaults,
    deploymentExecutionDefaults: sourceContent.deploymentExecutionDefaults,
    deploymentExecutionConstraints: sourceContent.deploymentExecutionConstraints,
    executionEnvelope: sourceContent.executionEnvelope,
    executionPolicy: sourceContent.executionPolicy,
    dataRequirements: sourceContent.dataRequirements,
    userIntentSummary: sourceContent.userIntentSummary,
    strategySummary: sourceContent.strategySummary,
    scriptSummary: sourceContent.scriptSummary,
    lockedParams: sourceContent.lockedParams,
    snapshotVersion: sourceContent.snapshotVersion,
  }

  function buildTx(overrides?: {
    existingSnapshot?: { id: string, snapshotHash: string, strategyInstanceId: string } | null
    source?: typeof sourceSnapshot | null
  }) {
    return {
      publishedStrategySnapshot: {
        findUnique: jest.fn().mockResolvedValue(overrides?.source === undefined ? sourceSnapshot : overrides.source),
        findFirst: jest.fn().mockResolvedValue(overrides?.existingSnapshot ?? null),
        create: jest.fn().mockResolvedValue({ id: 'user-snapshot-1', snapshotHash: sourceSnapshot.snapshotHash }),
        upsert: jest.fn().mockResolvedValue({ id: 'user-snapshot-1', snapshotHash: sourceSnapshot.snapshotHash }),
        update: jest.fn().mockResolvedValue({ id: 'user-snapshot-1', snapshotHash: sourceSnapshot.snapshotHash }),
      },
      llmStrategyCodegenSession: {
        upsert: jest.fn().mockResolvedValue({ id: 'strategy-plaza-session-1' }),
        update: jest.fn(),
      },
      strategyTemplate: {
        upsert: jest.fn().mockResolvedValue({ id: 'strategy-template-1' }),
        update: jest.fn(),
      },
      strategyInstance: {
        upsert: jest.fn().mockResolvedValue({ id: 'strategy-instance-1' }),
        findUnique: jest.fn().mockResolvedValue({
          id: 'strategy-instance-1',
          strategyTemplateId: 'strategy-template-1',
          params: { deploymentExecutionConfig: { leverage: 5, priceSource: 'mark' } },
          deploymentExecutionConfig: { leverage: 5, priceSource: 'mark', orderType: 'market', timeInForce: 'ioc' },
          metadata: { existing: true },
        }),
        update: jest.fn(),
      },
      userStrategySubscription: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: 'subscription-1',
            customParams: { deploymentExecutionConfig: { leverage: 5, priceSource: 'mark' } },
          },
        ]),
        update: jest.fn(),
      },
      strategyRuntimeExecutionState: {
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
    }
  }

  it('self-heals the official source snapshot when it is unavailable', async () => {
    const tx = buildTx({ source: null })
    tx.publishedStrategySnapshot.upsert.mockImplementation(async ({ where, create }) => {
      if (where.id === 'official-plaza-ma-cross-v1-snapshot') {
        return { ...sourceSnapshot, ...create }
      }
      return { id: 'user-snapshot-1', snapshotHash: sourceSnapshot.snapshotHash }
    })
    const repo = new StrategyPlazaOfficialSnapshotRepository(createTxHost(tx))

    await expect(repo.resolveOfficialSnapshotForUser({ userId: 'user-1', template })).resolves.toEqual({
      id: 'user-snapshot-1',
    })

    expect(tx.publishedStrategySnapshot.findUnique).toHaveBeenCalledWith({
      where: { id: 'official-plaza-ma-cross-v1-snapshot' },
    })
    expect(tx.publishedStrategySnapshot.upsert).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 'official-plaza-ma-cross-v1-snapshot' },
      create: expect.objectContaining({
        id: 'official-plaza-ma-cross-v1-snapshot',
        snapshotVersion: 4,
        userIntentSummary: expect.objectContaining({ templateId: 'ma-cross' }),
      }),
      update: expect.objectContaining({
        snapshotVersion: 4,
        scriptSnapshot: expect.stringContaining('protocolVersion: "v1"'),
      }),
    }))
    expect(tx.publishedStrategySnapshot.upsert).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 'official-plaza-ma-cross-v1-snapshot' },
      update: expect.objectContaining({
        scriptSnapshot: expect.stringContaining('risk.stopLoss'),
      }),
    }))
    expect(tx.strategyInstance.upsert).toHaveBeenCalled()
  })

  it('refreshes a legacy official source snapshot that still contains HOLD script', async () => {
    const tx = buildTx({
      source: {
        ...sourceSnapshot,
        scriptSnapshot: 'export default function strategy() { return { action: "HOLD" } }\n',
      },
    })
    tx.publishedStrategySnapshot.upsert.mockImplementation(async ({ where, create }) => {
      if (where.id === 'official-plaza-ma-cross-v1-snapshot') {
        return { ...sourceSnapshot, ...create }
      }
      return { id: 'user-snapshot-1', snapshotHash: sourceSnapshot.snapshotHash }
    })
    const repo = new StrategyPlazaOfficialSnapshotRepository(createTxHost(tx))

    await expect(repo.resolveOfficialSnapshotForUser({ userId: 'user-1', template })).resolves.toEqual({
      id: 'user-snapshot-1',
    })

    expect(tx.publishedStrategySnapshot.upsert).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 'official-plaza-ma-cross-v1-snapshot' },
      update: expect.objectContaining({
        scriptSnapshot: expect.stringContaining('protocolVersion: "v1"'),
      }),
    }))
  })

  it('refreshes a source snapshot when only the generated script identity changes', async () => {
    const tx = buildTx({
      source: {
        ...sourceSnapshot,
        snapshotHash: 'stale-snapshot-hash',
        scriptHash: 'stale-script-hash',
        scriptSnapshot: sourceSnapshot.scriptSnapshot.replace('riskForEntry', 'legacyRiskForEntry'),
      },
    })
    tx.publishedStrategySnapshot.upsert.mockImplementation(async ({ where, create }) => {
      if (where.id === 'official-plaza-ma-cross-v1-snapshot') {
        return { ...sourceSnapshot, ...create }
      }
      return { id: 'user-snapshot-1', snapshotHash: sourceSnapshot.snapshotHash }
    })
    const repo = new StrategyPlazaOfficialSnapshotRepository(createTxHost(tx))

    await expect(repo.resolveOfficialSnapshotForUser({ userId: 'user-1', template })).resolves.toEqual({
      id: 'user-snapshot-1',
    })

    expect(tx.publishedStrategySnapshot.upsert).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 'official-plaza-ma-cross-v1-snapshot' },
      update: expect.objectContaining({
        snapshotHash: sourceSnapshot.snapshotHash,
        scriptHash: sourceSnapshot.scriptHash,
        scriptSnapshot: sourceSnapshot.scriptSnapshot,
      }),
    }))
  })

  it('builds a backtest adapter from the generated official source script', async () => {
    const content = buildOfficialStrategySnapshotContent(template)
    const adapter = new BacktestStrategyAdapterService()

    await expect(adapter.build({
      id: 'official-ma-cross',
      protocolVersion: 'v1',
      scriptCode: content.scriptSnapshot,
      params: content.paramsSnapshot,
    })).resolves.toMatchObject({
      id: 'official-ma-cross',
      params: expect.objectContaining({
        symbol: 'BTC-USDT-SWAP',
        timeframe: '15m',
      }),
    })
  })

  it('reuses an existing user-visible snapshot for the same official source hash and version', async () => {
    const existingSnapshot = {
      id: 'user-snapshot-1',
      snapshotHash: sourceSnapshot.snapshotHash,
      strategyInstanceId: 'strategy-instance-1',
    }
    const tx = buildTx({ existingSnapshot })
    const repo = new StrategyPlazaOfficialSnapshotRepository(createTxHost(tx))

    await expect(repo.resolveOfficialSnapshotForUser({ userId: 'user-1', template })).resolves.toEqual({
      id: 'user-snapshot-1',
    })

    expect(tx.publishedStrategySnapshot.findFirst).toHaveBeenCalledWith({
      where: expect.objectContaining({
        sessionId: expect.stringContaining('strategy-plaza:official:ma-cross'),
        snapshotHash: sourceSnapshot.snapshotHash,
        snapshotVersion: sourceSnapshot.snapshotVersion,
        strategyInstanceId: { not: null },
        session: { userId: 'user-1' },
      }),
      orderBy: [{ createdAt: 'desc' }],
      select: { id: true, snapshotHash: true, strategyInstanceId: true },
    })
    expect(tx.publishedStrategySnapshot.create).not.toHaveBeenCalled()
    expect(tx.publishedStrategySnapshot.upsert).not.toHaveBeenCalled()
    expect(tx.publishedStrategySnapshot.update).toHaveBeenCalledWith({
      where: { id: 'user-snapshot-1' },
      data: expect.objectContaining({
        paramsSnapshot: expect.objectContaining({
          exchange: 'okx',
          marketType: 'perp',
          symbol: 'BTC-USDT-SWAP',
          timeframe: '15m',
          positionPct: 10,
          leverage: 2,
          optimizedParams: expect.objectContaining({ fastPeriod: 6, slowPeriod: 48 }),
          parameterSearchId: expect.stringContaining('ma-cross'),
        }),
        strategyConfig: expect.objectContaining({
          exchange: 'okx',
          marketType: 'perp',
          symbol: 'BTC-USDT-SWAP',
          baseTimeframe: '15m',
          positionPct: 10,
        }),
        deploymentExecutionDefaults: {
          leverage: 2,
          priceSource: 'mark',
          orderType: 'market',
          timeInForce: 'ioc',
          tdMode: 'cross',
        },
      }),
    })
    expect(tx.strategyInstance.update).toHaveBeenCalledWith({
      where: { id: 'strategy-instance-1' },
      data: expect.objectContaining({
        deploymentExecutionConfig: expect.objectContaining({
          leverage: 5,
          tdMode: 'cross',
        }),
        params: expect.objectContaining({
          deploymentExecutionConfig: expect.objectContaining({
            leverage: 5,
            tdMode: 'cross',
          }),
        }),
        metadata: expect.objectContaining({
          bindingSource: 'PUBLISHED_SNAPSHOT',
          officialSnapshotHash: sourceSnapshot.snapshotHash,
          officialSnapshotId: sourceSnapshot.id,
          officialSnapshotVersion: sourceSnapshot.snapshotVersion,
          publishedSnapshotId: 'user-snapshot-1',
          snapshotHash: sourceSnapshot.snapshotHash,
        }),
      }),
    })
    expect(tx.userStrategySubscription.update).toHaveBeenCalledWith({
      where: { id: 'subscription-1' },
      data: {
        customParams: expect.objectContaining({
          deploymentExecutionConfig: expect.objectContaining({
            leverage: 5,
            tdMode: 'cross',
          }),
        }),
      },
    })
  })

  it('upserts a deterministic copied snapshot instead of reusing an old official source version', async () => {
    const tx = buildTx({ existingSnapshot: null })
    const repo = new StrategyPlazaOfficialSnapshotRepository(createTxHost(tx))

    await expect(repo.resolveOfficialSnapshotForUser({ userId: 'user-1', template })).resolves.toEqual({
      id: 'user-snapshot-1',
    })

    expect(tx.publishedStrategySnapshot.findFirst).toHaveBeenCalledWith({
      where: expect.objectContaining({
        snapshotHash: sourceSnapshot.snapshotHash,
        snapshotVersion: sourceSnapshot.snapshotVersion,
      }),
      orderBy: [{ createdAt: 'desc' }],
      select: { id: true, snapshotHash: true, strategyInstanceId: true },
    })
    expect(tx.publishedStrategySnapshot.create).not.toHaveBeenCalled()
    expect(tx.publishedStrategySnapshot.upsert).toHaveBeenCalledWith(expect.objectContaining({
      where: {
        id: expect.stringMatching(/^plaza_[0-9a-f]{32}$/u),
      },
      create: expect.objectContaining({
        id: expect.stringMatching(/^plaza_[0-9a-f]{32}$/u),
        snapshotHash: sourceSnapshot.snapshotHash,
        snapshotVersion: sourceSnapshot.snapshotVersion,
      }),
      update: expect.objectContaining({
        strategyInstanceId: 'strategy-instance-1',
      }),
      select: { id: true, snapshotHash: true },
    }))
  })

  it('returns the same deterministic copied snapshot id for repeated create attempts', async () => {
    const tx = buildTx({ existingSnapshot: null })
    tx.publishedStrategySnapshot.upsert.mockImplementation(async ({ where, create }) => ({
      id: where.id,
      snapshotHash: create.snapshotHash,
    }))
    const repo = new StrategyPlazaOfficialSnapshotRepository(createTxHost(tx))

    const first = await repo.resolveOfficialSnapshotForUser({ userId: 'user-1', template })
    const second = await repo.resolveOfficialSnapshotForUser({ userId: 'user-1', template })

    expect(first).toEqual(second)
    expect(tx.publishedStrategySnapshot.create).not.toHaveBeenCalled()
    expect(tx.publishedStrategySnapshot.upsert).toHaveBeenCalledTimes(2)
    const firstSnapshotId = tx.publishedStrategySnapshot.upsert.mock.calls[0][0].where.id
    const secondSnapshotId = tx.publishedStrategySnapshot.upsert.mock.calls[1][0].where.id
    expect(secondSnapshotId).toBe(firstSnapshotId)
    expect(tx.strategyInstance.update).toHaveBeenCalledWith({
      where: { id: 'strategy-instance-1' },
      data: expect.objectContaining({
        metadata: expect.objectContaining({
          publishedSnapshotId: firstSnapshotId,
          snapshotHash: sourceSnapshot.snapshotHash,
        }),
      }),
    })
    expect(tx.strategyInstance.update).not.toHaveBeenCalledWith({
      where: { id: 'strategy-instance-1' },
      data: {
        metadata: expect.objectContaining({
          publishedSnapshotId: expect.not.stringMatching(firstSnapshotId),
        }),
      },
    })
  })

  it('copies executable artifacts from the official source and runtime config from the plaza template', async () => {
    const tx = buildTx()
    const repo = new StrategyPlazaOfficialSnapshotRepository(createTxHost(tx))

    await expect(repo.resolveOfficialSnapshotForUser({ userId: 'user-1', template })).resolves.toEqual({
      id: 'user-snapshot-1',
    })

    expect(tx.llmStrategyCodegenSession.upsert).toHaveBeenCalledWith(expect.objectContaining({
      create: expect.objectContaining({
        latestDraftCode: sourceSnapshot.scriptSnapshot,
        latestSpecDesc: sourceSnapshot.specSnapshot,
        status: 'PUBLISHED',
        userId: 'user-1',
      }),
    }))
    expect(tx.strategyTemplate.upsert).toHaveBeenCalledWith(expect.objectContaining({
      create: expect.objectContaining({
        script: sourceSnapshot.scriptSnapshot,
        rulesJson: sourceSnapshot.specSnapshot,
        status: 'live',
        createdBy: 'user-1',
        metadata: expect.objectContaining({
          officialSnapshotHash: sourceSnapshot.snapshotHash,
          officialSnapshotId: sourceSnapshot.id,
          officialSnapshotVersion: sourceSnapshot.snapshotVersion,
          source: 'strategy-plaza-official-template',
        }),
      }),
    }))
    expect(tx.strategyTemplate.upsert).toHaveBeenCalledWith(expect.objectContaining({
      create: expect.objectContaining({
        defaultParams: expect.objectContaining({
          exchange: 'okx',
          marketType: 'perp',
          symbol: 'BTC-USDT-SWAP',
          timeframe: '15m',
          positionPct: 10,
          leverage: 2,
        }),
        dataRequirements: { primary: ['15m'] },
      }),
      update: expect.objectContaining({
        defaultParams: expect.objectContaining({
          exchange: 'okx',
          marketType: 'perp',
          symbol: 'BTC-USDT-SWAP',
          timeframe: '15m',
          positionPct: 10,
          leverage: 2,
        }),
      }),
    }))
    expect(tx.strategyInstance.upsert).toHaveBeenCalledWith(expect.objectContaining({
      create: expect.objectContaining({
        params: expect.objectContaining({
          exchange: 'okx',
          marketType: 'perp',
          symbol: 'BTC-USDT-SWAP',
          timeframe: '15m',
          positionPct: 10,
          leverage: 2,
        }),
      }),
      update: expect.objectContaining({
        params: expect.objectContaining({
          exchange: 'okx',
          marketType: 'perp',
          symbol: 'BTC-USDT-SWAP',
          timeframe: '15m',
          positionPct: 10,
          leverage: 2,
        }),
      }),
    }))
    expect(tx.publishedStrategySnapshot.upsert).toHaveBeenCalledWith(expect.objectContaining({
      create: expect.objectContaining({
        id: expect.stringMatching(/^plaza_[0-9a-f]{32}$/u),
        session: { connect: { id: expect.stringContaining('strategy-plaza:official:ma-cross') } },
        strategyInstanceId: 'strategy-instance-1',
        strategyTemplateId: 'strategy-template-1',
        snapshotHash: sourceSnapshot.snapshotHash,
        scriptHash: sourceSnapshot.scriptHash,
        specHash: sourceSnapshot.specHash,
        irHash: sourceSnapshot.irHash,
        astDigest: sourceSnapshot.astDigest,
        structuralDigest: sourceSnapshot.structuralDigest,
        scriptSnapshot: sourceSnapshot.scriptSnapshot,
        specSnapshot: sourceSnapshot.specSnapshot,
        semanticGraph: sourceSnapshot.semanticGraph,
        compiledIr: sourceSnapshot.compiledIr,
        irSnapshot: sourceSnapshot.irSnapshot,
        astSnapshot: sourceSnapshot.astSnapshot,
        compiledManifest: sourceSnapshot.compiledManifest,
        consistencyReport: sourceSnapshot.consistencyReport,
        paramsSnapshot: expect.objectContaining({
          exchange: 'okx',
          marketType: 'perp',
          symbol: 'BTC-USDT-SWAP',
          timeframe: '15m',
          positionPct: 10,
          leverage: 2,
          optimizedParams: expect.objectContaining({ fastPeriod: 6, slowPeriod: 48 }),
          parameterSearchId: expect.stringContaining('ma-cross'),
        }),
        strategyConfig: {
          exchange: 'okx',
          marketType: 'perp',
          symbol: 'BTC-USDT-SWAP',
          baseTimeframe: '15m',
          timeframe: '15m',
          positionPct: 10,
          strategyDeclaredLeverageRange: { min: 1, max: 2 },
        },
        backtestConfigDefaults: {
          initialCash: 10000,
          leverage: 2,
          slippageBps: 10,
          feeBps: 5,
          priceSource: 'mark',
          allowPartial: false,
        },
        deploymentExecutionDefaults: { leverage: 2, priceSource: 'mark', orderType: 'market', timeInForce: 'ioc', tdMode: 'cross' },
        deploymentExecutionConstraints: {
          platformRiskMaxLeverage: 2,
          strategyDeclaredLeverageRange: { min: 1, max: 2 },
          defaultLeverage: 2,
          supportedPriceSources: ['mark'],
          supportedOrderTypes: ['market'],
          supportedTimeInForce: ['ioc'],
          supportedTdModes: ['cross'],
          constraintExplanation: 'official strategy plaza template runtime constraints',
        },
        executionEnvelope: sourceSnapshot.executionEnvelope,
        executionPolicy: sourceSnapshot.executionPolicy,
        dataRequirements: { primary: ['15m'] },
        userIntentSummary: sourceSnapshot.userIntentSummary,
        strategySummary: sourceSnapshot.strategySummary,
        scriptSummary: sourceSnapshot.scriptSummary,
        lockedParams: expect.objectContaining({
          exchange: 'okx',
          marketType: 'perp',
          symbol: 'BTC-USDT-SWAP',
          timeframe: '15m',
          positionPct: 10,
          leverage: 2,
        }),
        snapshotVersion: sourceSnapshot.snapshotVersion,
      }),
      update: expect.objectContaining({
        paramsSnapshot: expect.objectContaining({
          symbol: 'BTC-USDT-SWAP',
          timeframe: '15m',
        }),
        strategyConfig: expect.objectContaining({
          symbol: 'BTC-USDT-SWAP',
          baseTimeframe: '15m',
        }),
        deploymentExecutionDefaults: expect.objectContaining({
          leverage: 2,
          priceSource: 'mark',
          tdMode: 'cross',
        }),
      }),
      select: { id: true, snapshotHash: true },
    }))
    expect(tx.publishedStrategySnapshot.upsert).not.toHaveBeenCalledWith(expect.objectContaining({
      create: expect.objectContaining({
        scriptSnapshot: expect.stringContaining('// Official Strategy Plaza template'),
      }),
    }))
  })
})
