import { buildBackfillPlan, parseArgs, runBackfill } from '../backfill-llm-perp-tdmode'

describe('backfill-llm-perp-tdmode', () => {
  function buildPrismaMock() {
    const snapshots = [
      {
        id: 'llm-perp-missing-tdmode',
        strategyConfig: { marketType: 'perp' },
        deploymentExecutionDefaults: { leverage: 1, priceSource: 'close', orderType: 'market', timeInForce: 'gtc' },
        deploymentExecutionConstraints: { supportedPriceSources: ['close'], supportedOrderTypes: ['market'], supportedTimeInForce: ['gtc'] },
        executionEnvelope: { positionMode: 'long_only', marginMode: 'cross', fillAssumption: 'strict' },
        strategyTemplateId: 'template-1',
        strategyInstanceId: 'instance-1',
      },
      {
        id: 'official-perp-missing-tdmode',
        strategyConfig: { marketType: 'perp' },
        deploymentExecutionDefaults: { leverage: 2, priceSource: 'mark', orderType: 'market', timeInForce: 'ioc' },
        deploymentExecutionConstraints: { supportedPriceSources: ['mark'], supportedOrderTypes: ['market'], supportedTimeInForce: ['ioc'] },
        executionEnvelope: { source: 'strategy-plaza-official-template' },
        strategyTemplateId: 'official-template-1',
        strategyInstanceId: 'official-instance-1',
      },
      {
        id: 'non-llm-perp-missing-tdmode',
        strategyConfig: { marketType: 'perp' },
        deploymentExecutionDefaults: { leverage: 3, priceSource: 'close', orderType: 'market', timeInForce: 'gtc' },
        deploymentExecutionConstraints: { supportedPriceSources: ['close'], supportedOrderTypes: ['market'], supportedTimeInForce: ['gtc'] },
        executionEnvelope: { positionMode: 'long_only', marginMode: 'cross', fillAssumption: 'strict' },
        strategyTemplateId: 'manual-template-1',
        strategyInstanceId: 'manual-instance-1',
      },
      {
        id: 'llm-spot',
        strategyConfig: { marketType: 'spot' },
        deploymentExecutionDefaults: { leverage: 1, priceSource: 'close', orderType: 'market', timeInForce: 'gtc' },
        deploymentExecutionConstraints: { supportedPriceSources: ['close'] },
        executionEnvelope: { positionMode: 'long_only', marginMode: 'cross', fillAssumption: 'strict' },
        strategyTemplateId: 'template-spot',
        strategyInstanceId: null,
      },
      {
        id: 'llm-perp-current',
        strategyConfig: { marketType: 'perp' },
        deploymentExecutionDefaults: { leverage: 1, priceSource: 'close', orderType: 'market', timeInForce: 'gtc', tdMode: 'cross' },
        deploymentExecutionConstraints: { supportedTdModes: ['cross'] },
        executionEnvelope: { positionMode: 'long_only', marginMode: 'cross', fillAssumption: 'strict' },
        strategyTemplateId: 'template-current',
        strategyInstanceId: 'instance-current',
      },
    ]
    type InstanceFixture = {
      id: string
      strategyTemplateId: string
      params: unknown
      deploymentExecutionConfig: unknown
      metadata: unknown
    }
    const instances = new Map<string, InstanceFixture>([
      ['instance-1', {
        id: 'instance-1',
        strategyTemplateId: 'template-1',
        params: { deploymentExecutionConfig: { leverage: 1, priceSource: 'close' } },
        deploymentExecutionConfig: { leverage: 1, priceSource: 'close', orderType: 'market', timeInForce: 'gtc' },
        metadata: { source: 'llm-codegen-session' },
      }],
      ['manual-instance-1', {
        id: 'manual-instance-1',
        strategyTemplateId: 'manual-template-1',
        params: {},
        deploymentExecutionConfig: {},
        metadata: { source: 'manual-import' },
      }],
      ['instance-current', {
        id: 'instance-current',
        strategyTemplateId: 'template-current',
        params: { deploymentExecutionConfig: { tdMode: 'cross' } },
        deploymentExecutionConfig: { tdMode: 'cross' },
        metadata: { source: 'llm-codegen-session' },
      }],
    ])
    const templates = new Map<string, { id: string; metadata: unknown }>([
      ['template-1', { id: 'template-1', metadata: { source: 'llm-codegen-session' } }],
      ['manual-template-1', { id: 'manual-template-1', metadata: { source: 'manual-import' } }],
      ['template-spot', { id: 'template-spot', metadata: { source: 'llm-codegen-session' } }],
      ['template-current', { id: 'template-current', metadata: { source: 'llm-codegen-session' } }],
    ])
    const instance = instances.get('instance-1') as InstanceFixture
    const subscription = {
      id: 'subscription-1',
      customParams: { deploymentExecutionConfig: { leverage: 1 } },
    }
    const prisma = {
      publishedStrategySnapshot: {
        findMany: jest.fn(async () => snapshots),
        update: jest.fn(async ({ where, data }: any) => {
          const row = snapshots.find(item => item.id === where.id)!
          row.deploymentExecutionDefaults = data.deploymentExecutionDefaults
          row.deploymentExecutionConstraints = data.deploymentExecutionConstraints
          return row
        }),
      },
      strategyInstance: {
        findUnique: jest.fn(async ({ where }: any) => instances.get(where.id) ?? null),
        update: jest.fn(async ({ where, data }: any) => {
          const row = instances.get(where.id)!
          row.params = data.params
          row.deploymentExecutionConfig = data.deploymentExecutionConfig
        }),
      },
      strategyTemplate: {
        findUnique: jest.fn(async ({ where }: any) => templates.get(where.id) ?? null),
      },
      userStrategySubscription: {
        findMany: jest.fn(async ({ where }: any) => where.strategyInstanceId === instance.id ? [subscription] : []),
        update: jest.fn(async ({ data }: any) => {
          subscription.customParams = data.customParams
        }),
      },
      $transaction: jest.fn(async (callback: (tx: any) => Promise<void>) => callback(prisma)),
    }
    return { instance, instances, prisma, snapshots, subscription }
  }

  it('parses dry-run and apply options', () => {
    expect(parseArgs([])).toEqual({ apply: false })
    expect(parseArgs(['--dry-run'])).toEqual({ apply: false })
    expect(parseArgs(['--apply'])).toEqual({ apply: true })
    expect(() => parseArgs(['--apply', '--dry-run'])).toThrow(/cannot be used together/u)
  })

  it('builds a dry-run plan for ordinary LLM perp snapshots only', async () => {
    const { prisma } = buildPrismaMock()
    const result = await buildBackfillPlan(prisma as never)

    expect(result.scanned).toBe(5)
    expect(result.updated).toBe(0)
    expect(result.plan).toEqual([expect.objectContaining({
      snapshotId: 'llm-perp-missing-tdmode',
      strategyInstanceId: 'instance-1',
      repairs: ['snapshot-defaults-tdMode', 'snapshot-constraints-supportedTdModes', 'instance-deployment-execution-config', 'instance-params-deployment-execution-config', 'subscription-custom-params-deployment-execution-config'],
    })])
    expect(result.skipped).toEqual(expect.arrayContaining([
      expect.objectContaining({ snapshotId: 'official-perp-missing-tdmode', reason: 'official strategy plaza snapshot is out of scope' }),
      expect.objectContaining({ snapshotId: 'non-llm-perp-missing-tdmode', reason: 'snapshot is not an ordinary LLM publication snapshot' }),
      expect.objectContaining({ snapshotId: 'llm-spot', reason: 'snapshot is not perp' }),
      expect.objectContaining({ snapshotId: 'llm-perp-current', reason: 'snapshot already has tdMode contract' }),
    ]))
    expect(prisma.publishedStrategySnapshot.update).not.toHaveBeenCalled()
  })

  it('applies snapshot and bound runtime config repairs', async () => {
    const { instance, prisma, snapshots, subscription } = buildPrismaMock()
    const result = await runBackfill(prisma as never, { apply: true })

    expect(result.updated).toBe(1)
    expect(snapshots[0].deploymentExecutionDefaults).toEqual(expect.objectContaining({ tdMode: 'cross' }))
    expect(snapshots[0].deploymentExecutionConstraints).toEqual(expect.objectContaining({ supportedTdModes: ['cross'] }))
    expect(instance.deploymentExecutionConfig).toEqual(expect.objectContaining({ tdMode: 'cross' }))
    expect(instance.params).toEqual(expect.objectContaining({
      deploymentExecutionConfig: expect.objectContaining({ tdMode: 'cross' }),
    }))
    expect(subscription.customParams).toEqual(expect.objectContaining({
      deploymentExecutionConfig: expect.objectContaining({ tdMode: 'cross' }),
    }))
  })

  it('plans bound runtime repairs when snapshot already has tdMode contract', async () => {
    const state = buildPrismaMock()
    const currentInstance = state.instances.get('instance-current')!
    currentInstance.deploymentExecutionConfig = { leverage: 1 }
    currentInstance.params = { deploymentExecutionConfig: { leverage: 1 } }

    const result = await buildBackfillPlan(state.prisma as never)

    expect(result.plan).toEqual(expect.arrayContaining([
      expect.objectContaining({
        snapshotId: 'llm-perp-current',
        repairs: ['instance-deployment-execution-config', 'instance-params-deployment-execution-config'],
      }),
    ]))
    expect(result.skipped).not.toEqual(expect.arrayContaining([
      expect.objectContaining({ snapshotId: 'llm-perp-current', reason: 'snapshot already has tdMode contract' }),
    ]))
  })

  it.each([
    {
      field: 'strategyInstance.params',
      reason: 'strategyInstance.params is malformed and requires manual repair',
      mutate: (state: ReturnType<typeof buildPrismaMock>) => {
        state.instance.params = ['malformed'] as never
      },
    },
    {
      field: 'strategyInstance.deploymentExecutionConfig',
      reason: 'strategyInstance.deploymentExecutionConfig is malformed and requires manual repair',
      mutate: (state: ReturnType<typeof buildPrismaMock>) => {
        state.instance.deploymentExecutionConfig = 'malformed' as never
      },
    },
    {
      field: 'strategyInstance.params.deploymentExecutionConfig',
      reason: 'strategyInstance.params.deploymentExecutionConfig is malformed and requires manual repair',
      mutate: (state: ReturnType<typeof buildPrismaMock>) => {
        state.instance.params = { deploymentExecutionConfig: ['malformed'] } as never
      },
    },
  ])('skips malformed bound instance JSON at $field without writes', async ({ mutate, reason }) => {
    const state = buildPrismaMock()
    mutate(state)

    const dryRun = await buildBackfillPlan(state.prisma as never)
    const applied = await runBackfill(state.prisma as never, { apply: true })

    expect(dryRun.plan).toEqual([])
    expect(dryRun.skipped).toEqual(expect.arrayContaining([
      expect.objectContaining({ snapshotId: 'llm-perp-missing-tdmode', reason }),
    ]))
    expect(applied.updated).toBe(0)
    expect(state.prisma.publishedStrategySnapshot.update).not.toHaveBeenCalled()
    expect(state.prisma.strategyInstance.update).not.toHaveBeenCalled()
    expect(state.prisma.userStrategySubscription.update).not.toHaveBeenCalled()
  })

  it.each([
    {
      field: 'userStrategySubscription.customParams',
      reason: 'userStrategySubscription.customParams is malformed and requires manual repair',
      mutate: (state: ReturnType<typeof buildPrismaMock>) => {
        state.subscription.customParams = 'malformed' as never
      },
    },
    {
      field: 'userStrategySubscription.customParams.deploymentExecutionConfig',
      reason: 'userStrategySubscription.customParams.deploymentExecutionConfig is malformed and requires manual repair',
      mutate: (state: ReturnType<typeof buildPrismaMock>) => {
        state.subscription.customParams = { deploymentExecutionConfig: ['malformed'] } as never
      },
    },
  ])('skips malformed bound subscription JSON at $field without writes', async ({ mutate, reason }) => {
    const state = buildPrismaMock()
    mutate(state)

    const dryRun = await buildBackfillPlan(state.prisma as never)
    const applied = await runBackfill(state.prisma as never, { apply: true })

    expect(dryRun.plan).toEqual([])
    expect(dryRun.skipped).toEqual(expect.arrayContaining([
      expect.objectContaining({ snapshotId: 'llm-perp-missing-tdmode', reason }),
    ]))
    expect(applied.updated).toBe(0)
    expect(state.prisma.publishedStrategySnapshot.update).not.toHaveBeenCalled()
    expect(state.prisma.strategyInstance.update).not.toHaveBeenCalled()
    expect(state.prisma.userStrategySubscription.update).not.toHaveBeenCalled()
  })
})
