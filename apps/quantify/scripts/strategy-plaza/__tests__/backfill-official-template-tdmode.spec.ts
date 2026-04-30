import { OFFICIAL_STRATEGY_PLAZA_TEMPLATES } from '../../../src/modules/strategy-plaza/constants/official-strategy-plaza-templates'
import { buildOfficialStrategySnapshotContent } from '../../../src/modules/strategy-plaza/utils/official-strategy-plaza-snapshot-builder'
import { buildBackfillPlan, parseArgs, runBackfill, selectBackfillTemplates } from '../backfill-official-template-tdmode'

describe('backfill-official-template-tdmode', () => {
  const template = OFFICIAL_STRATEGY_PLAZA_TEMPLATES.find(item => item.id === 'ma-cross')!
  const expected = buildOfficialStrategySnapshotContent(template)

  function buildPrismaMock() {
    const snapshots = [
      {
        id: template.runConfig.publishedSnapshotId,
        snapshotHash: 'stale-source-hash',
        snapshotVersion: 3,
        strategyTemplateId: null,
        strategyInstanceId: null,
      },
      {
        id: 'user-snapshot-1',
        snapshotHash: 'stale-user-hash',
        snapshotVersion: 3,
        strategyTemplateId: 'strategy-template-1',
        strategyInstanceId: 'strategy-instance-1',
      },
    ]
    const instance = {
      id: 'strategy-instance-1',
      strategyTemplateId: 'strategy-template-1',
      params: { deploymentExecutionConfig: { leverage: 5, priceSource: 'mark' } },
      deploymentExecutionConfig: { leverage: 5, priceSource: 'mark', orderType: 'market', timeInForce: 'ioc' },
      executionConfigVersion: 3,
      metadata: { previous: true },
    }
    const subscription = {
      id: 'subscription-1',
      customParams: { deploymentExecutionConfig: { leverage: 5, priceSource: 'mark' } },
    }
    const runtimeStates = [{ id: 'runtime-state-1', snapshotHash: 'stale-user-hash' }]

    const prisma = {
      publishedStrategySnapshot: {
        findUnique: jest.fn(async () => snapshots[0]),
        findMany: jest.fn(async () => [snapshots[1]]),
        update: jest.fn(async ({ where, data }: any) => {
          const row = snapshots.find(item => item.id === where.id)
          if (row) {
            row.snapshotHash = data.snapshotHash
            row.snapshotVersion = data.snapshotVersion
          }
          return row
        }),
      },
      strategyTemplate: {
        update: jest.fn(),
      },
      strategyInstance: {
        findUnique: jest.fn(async () => instance),
        update: jest.fn(async ({ data }: any) => {
          instance.params = data.params
          instance.deploymentExecutionConfig = data.deploymentExecutionConfig
          instance.executionConfigVersion = data.executionConfigVersion
          instance.metadata = data.metadata
        }),
      },
      userStrategySubscription: {
        findMany: jest.fn(async () => [subscription]),
        update: jest.fn(async ({ data }: any) => {
          subscription.customParams = data.customParams
        }),
      },
      strategyRuntimeExecutionState: {
        findMany: jest.fn(async ({ where }: any) => {
          if (where.snapshotHash?.not === expected.snapshotHash) {
            return runtimeStates.filter(item => item.snapshotHash !== expected.snapshotHash)
          }
          return runtimeStates
        }),
        updateMany: jest.fn(async ({ data }: any) => {
          for (const item of runtimeStates) item.snapshotHash = data.snapshotHash
          return { count: runtimeStates.length }
        }),
      },
      $transaction: jest.fn(async (callback: (tx: any) => Promise<void>) => {
        await callback(prisma)
      }),
    }
    return { instance, prisma, runtimeStates, snapshots, subscription }
  }

  it('selects official perp templates only and supports template filtering', () => {
    expect(selectBackfillTemplates().map(item => item.id).sort()).toEqual([
      'bollinger-reversion',
      'breakout-follow',
      'ma-cross',
      'macd-cross',
    ])
    expect(selectBackfillTemplates(['ma-cross']).map(item => item.id)).toEqual(['ma-cross'])
    expect(() => selectBackfillTemplates(['missing-template'])).toThrow(/unknown template ids/u)
  })

  it('parses dry-run/apply options without allowing conflicting modes', () => {
    expect(parseArgs([])).toEqual({ apply: false, templateIds: undefined })
    expect(parseArgs(['--apply', '--template=ma-cross,macd-cross'])).toEqual({
      apply: true,
      templateIds: ['ma-cross', 'macd-cross'],
    })
    expect(() => parseArgs(['--apply', '--dry-run'])).toThrow(/cannot be used together/u)
  })

  it('builds an auditable dry-run plan without writing data', async () => {
    const { prisma } = buildPrismaMock()

    const result = await buildBackfillPlan(prisma as never, { templateIds: ['ma-cross'] })

    expect(result.scanned).toBe(2)
    expect(result.updated).toBe(0)
    expect(result.plan).toHaveLength(2)
    expect(result.plan[0]).toEqual(expect.objectContaining({
      templateId: 'ma-cross',
      oldHash: 'stale-source-hash',
      newHash: expected.snapshotHash,
      repairs: ['snapshot-content'],
      reason: expect.stringContaining('tdMode=cross'),
    }))
    expect(result.plan[1]).toEqual(expect.objectContaining({
      repairs: expect.arrayContaining([
        'snapshot-content',
        'instance-deployment-execution-config',
        'instance-params-deployment-execution-config',
        'subscription-custom-params-deployment-execution-config',
        'runtime-state-snapshot-hash',
      ]),
    }))
    expect(prisma.$transaction).not.toHaveBeenCalled()
    expect(prisma.publishedStrategySnapshot.update).not.toHaveBeenCalled()
  })

  it('applies snapshot and runtime binding repairs without overwriting user leverage, then becomes idempotent', async () => {
    const { instance, prisma, runtimeStates, snapshots, subscription } = buildPrismaMock()

    const first = await runBackfill(prisma as never, { apply: true, templateIds: ['ma-cross'] })

    expect(first.updated).toBe(2)
    expect(snapshots.map(item => item.snapshotHash)).toEqual([expected.snapshotHash, expected.snapshotHash])
    expect(instance.deploymentExecutionConfig).toEqual(expect.objectContaining({
      leverage: 5,
      tdMode: 'cross',
    }))
    expect(instance.executionConfigVersion).toBe(3)
    expect(instance.params).toEqual(expect.objectContaining({
      deploymentExecutionConfig: expect.objectContaining({
        leverage: 5,
        tdMode: 'cross',
      }),
      executionConfigVersion: 3,
    }))
    expect(subscription.customParams).toEqual(expect.objectContaining({
      deploymentExecutionConfig: expect.objectContaining({
        leverage: 5,
        tdMode: 'cross',
      }),
      executionConfigVersion: 3,
    }))
    expect(prisma.strategyRuntimeExecutionState.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        strategyInstanceId: 'strategy-instance-1',
        publishedSnapshotId: 'user-snapshot-1',
      }),
      data: { snapshotHash: expected.snapshotHash },
    }))
    expect(runtimeStates).toEqual([{ id: 'runtime-state-1', snapshotHash: expected.snapshotHash }])

    const second = await runBackfill(prisma as never, { apply: true, templateIds: ['ma-cross'] })
    expect(second.updated).toBe(0)
  })


  it('skips orphan copied snapshots without aborting apply', async () => {
    const { prisma } = buildPrismaMock()
    prisma.strategyInstance.findUnique.mockResolvedValue(null)

    const dryRun = await buildBackfillPlan(prisma as never, { templateIds: ['ma-cross'] })

    expect(dryRun.plan).toHaveLength(1)
    expect(dryRun.plan[0]).toEqual(expect.objectContaining({
      snapshotId: template.runConfig.publishedSnapshotId,
      repairs: ['snapshot-content'],
    }))
    expect(dryRun.skipped).toEqual(expect.arrayContaining([expect.objectContaining({
      input: expect.objectContaining({
        snapshotId: 'user-snapshot-1',
        strategyInstanceId: 'strategy-instance-1',
      }),
      reason: 'snapshot references a missing strategy instance',
    })]))

    await expect(runBackfill(prisma as never, { apply: true, templateIds: ['ma-cross'] })).resolves.toEqual(expect.objectContaining({
      updated: 1,
    }))
  })

  it('repairs runtime-only drift even when snapshot content is already current', async () => {
    const { instance, prisma, snapshots, subscription } = buildPrismaMock()
    for (const snapshot of snapshots) {
      snapshot.snapshotHash = expected.snapshotHash
      snapshot.snapshotVersion = expected.snapshotVersion
    }

    const result = await runBackfill(prisma as never, { apply: true, templateIds: ['ma-cross'] })

    expect(result.updated).toBe(1)
    expect(prisma.publishedStrategySnapshot.update).not.toHaveBeenCalled()
    expect(instance.deploymentExecutionConfig).toEqual(expect.objectContaining({ leverage: 5, tdMode: 'cross' }))
    expect(subscription.customParams).toEqual(expect.objectContaining({
      deploymentExecutionConfig: expect.objectContaining({ leverage: 5, tdMode: 'cross' }),
    }))
  })
})
