import type { OfficialStrategyPlazaTemplate } from '../types/official-strategy-plaza-template'
import { BacktestStrategyAdapterService } from '@/modules/backtesting/services/backtest-strategy-adapter.service'
import { buildOfficialStrategySnapshotContent } from '../utils/official-strategy-plaza-snapshot-builder'
import { StrategyPlazaOfficialSnapshotRepository } from './strategy-plaza-official-snapshot.repository'

function createTxHost(tx: unknown): ConstructorParameters<typeof StrategyPlazaOfficialSnapshotRepository>[0] & { withTransaction: jest.Mock } {
  return {
    tx,
    withTransaction: jest.fn(async (callback: () => Promise<unknown>) => callback()),
  } as unknown as ConstructorParameters<typeof StrategyPlazaOfficialSnapshotRepository>[0] & { withTransaction: jest.Mock }
}

describe('strategyPlazaOfficialSnapshotRepository', () => {
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
      $executeRaw: jest.fn().mockResolvedValue(0),
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
      },
      strategyInstance: {
        findFirst: jest.fn().mockResolvedValue(overrides?.existingSnapshot
          ? { id: overrides.existingSnapshot.strategyInstanceId }
          : null),
        create: jest.fn().mockResolvedValue({ id: 'strategy-instance-1' }),
        update: jest.fn().mockResolvedValue({ id: 'strategy-instance-1' }),
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
    const txHost = createTxHost(tx)
    const repo = new StrategyPlazaOfficialSnapshotRepository(txHost)

    await expect(repo.resolveOfficialSnapshotForUser({ userId: 'user-1', template })).resolves.toEqual({
      id: 'user-snapshot-1',
    })

    expect(txHost.withTransaction).toHaveBeenCalledTimes(1)
    expect(tx.publishedStrategySnapshot.findUnique).toHaveBeenCalledWith({
      where: { id: 'official-plaza-ma-cross-v1-snapshot' },
    })
    expect(tx.publishedStrategySnapshot.upsert).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 'official-plaza-ma-cross-v1-snapshot' },
      create: expect.objectContaining({
        id: 'official-plaza-ma-cross-v1-snapshot',
        snapshotVersion: 3,
        userIntentSummary: expect.objectContaining({ templateId: 'ma-cross' }),
      }),
      update: expect.objectContaining({
        snapshotVersion: 3,
        scriptSnapshot: expect.stringContaining('protocolVersion: "v1"'),
      }),
    }))
    expect(tx.publishedStrategySnapshot.upsert).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 'official-plaza-ma-cross-v1-snapshot' },
      update: expect.objectContaining({
        scriptSnapshot: expect.stringContaining('risk.stopLoss'),
      }),
    }))
    expect(tx.strategyInstance.create).toHaveBeenCalled()
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

  it('does not reuse an existing user snapshot when its strategy instance is archived', async () => {
    const existingSnapshot = {
      id: 'user-snapshot-archived',
      snapshotHash: sourceSnapshot.snapshotHash,
      strategyInstanceId: 'archived-strategy-instance',
    }
    const tx = buildTx({ existingSnapshot })
    tx.strategyInstance.findFirst.mockResolvedValue(null)
    const repo = new StrategyPlazaOfficialSnapshotRepository(createTxHost(tx))

    await expect(repo.resolveOfficialSnapshotForUser({ userId: 'user-1', template })).resolves.toEqual({
      id: 'user-snapshot-1',
    })

    expect(tx.strategyInstance.findFirst).toHaveBeenCalledWith({
      where: {
        id: 'archived-strategy-instance',
        createdBy: 'user-1',
        archivedAt: null,
        // 复用路径同时排除 view-only 实例：用户主动把策略转为只读后，
        // 不应再被 plaza「再次运行」复活。
        viewOnlyAt: null,
      },
      select: { id: true },
    })
    expect(tx.$executeRaw).toHaveBeenCalledTimes(1)
    expect(tx.strategyInstance.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        name: 'MA 均线交叉 官方模板',
        createdBy: 'user-1',
      }),
      select: { id: true },
    }))
    expect(tx.publishedStrategySnapshot.upsert).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: expect.stringMatching(/^plaza_/) },
      create: expect.objectContaining({ strategyInstanceId: 'strategy-instance-1' }),
      update: expect.objectContaining({ strategyInstanceId: 'strategy-instance-1' }),
    }))
  })

  it('does not reuse an existing user snapshot when its strategy instance is view-only', async () => {
    // 用户主动把策略转为只读（viewOnlyAt 非空）后，plaza「再次运行」不应再
    // 复用同一个 strategyInstance —— 否则只读策略会从只读态被复活，违反规格。
    const existingSnapshot = {
      id: 'user-snapshot-view-only',
      snapshotHash: sourceSnapshot.snapshotHash,
      strategyInstanceId: 'view-only-strategy-instance',
    }
    const tx = buildTx({ existingSnapshot })
    // findFirst 加了 viewOnlyAt: null 过滤后，只读实例不会被命中。
    tx.strategyInstance.findFirst.mockResolvedValue(null)
    const repo = new StrategyPlazaOfficialSnapshotRepository(createTxHost(tx))

    await expect(repo.resolveOfficialSnapshotForUser({ userId: 'user-1', template })).resolves.toEqual({
      id: 'user-snapshot-1',
    })

    expect(tx.strategyInstance.findFirst).toHaveBeenCalledWith({
      where: {
        id: 'view-only-strategy-instance',
        createdBy: 'user-1',
        archivedAt: null,
        viewOnlyAt: null,
      },
      select: { id: true },
    })
    // 创建一个全新的 strategyInstance，旧的只读实例不被复活也不被改动。
    expect(tx.strategyInstance.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ createdBy: 'user-1' }),
      select: { id: true },
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
        },
      }),
    })
    expect(tx.strategyInstance.update).toHaveBeenCalledWith({
      where: { id: 'strategy-instance-1' },
      data: {
        metadata: expect.objectContaining({
          bindingSource: 'PUBLISHED_SNAPSHOT',
          officialSnapshotHash: sourceSnapshot.snapshotHash,
          officialSnapshotId: sourceSnapshot.id,
          officialSnapshotVersion: sourceSnapshot.snapshotVersion,
          publishedSnapshotId: 'user-snapshot-1',
          snapshotHash: sourceSnapshot.snapshotHash,
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
      data: {
        metadata: expect.objectContaining({
          publishedSnapshotId: firstSnapshotId,
          snapshotHash: sourceSnapshot.snapshotHash,
        }),
      },
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
    expect(tx.strategyInstance.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
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
        deploymentExecutionDefaults: { leverage: 2, priceSource: 'mark', orderType: 'market', timeInForce: 'ioc' },
        deploymentExecutionConstraints: {
          platformRiskMaxLeverage: 2,
          strategyDeclaredLeverageRange: { min: 1, max: 2 },
          defaultLeverage: 2,
          supportedPriceSources: ['mark'],
          supportedOrderTypes: ['market'],
          supportedTimeInForce: ['ioc'],
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
