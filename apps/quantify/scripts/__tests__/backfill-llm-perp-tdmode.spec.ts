import { buildBackfillPlan, parseArgs, runBackfill } from '../backfill-llm-perp-tdmode'

describe('backfill-llm-perp-tdmode', () => {
  function buildPrismaMock() {
    const snapshots = [
      {
        id: 'llm-perp-missing-tdmode',
        strategyConfig: { marketType: 'perp' },
        deploymentExecutionDefaults: { leverage: 1, priceSource: 'close', orderType: 'market', timeInForce: 'gtc' },
        deploymentExecutionConstraints: { supportedPriceSources: ['close'], supportedOrderTypes: ['market'], supportedTimeInForce: ['gtc'] },
        executionEnvelope: { source: 'llm-codegen-session' },
        strategyInstanceId: 'instance-1',
      },
      {
        id: 'official-perp-missing-tdmode',
        strategyConfig: { marketType: 'perp' },
        deploymentExecutionDefaults: { leverage: 2, priceSource: 'mark', orderType: 'market', timeInForce: 'ioc' },
        deploymentExecutionConstraints: { supportedPriceSources: ['mark'], supportedOrderTypes: ['market'], supportedTimeInForce: ['ioc'] },
        executionEnvelope: { source: 'strategy-plaza-official-template' },
        strategyInstanceId: 'official-instance-1',
      },
      {
        id: 'llm-spot',
        strategyConfig: { marketType: 'spot' },
        deploymentExecutionDefaults: { leverage: 1, priceSource: 'close', orderType: 'market', timeInForce: 'gtc' },
        deploymentExecutionConstraints: { supportedPriceSources: ['close'] },
        executionEnvelope: { source: 'llm-codegen-session' },
        strategyInstanceId: null,
      },
      {
        id: 'llm-perp-current',
        strategyConfig: { marketType: 'perp' },
        deploymentExecutionDefaults: { leverage: 1, priceSource: 'close', orderType: 'market', timeInForce: 'gtc', tdMode: 'cross' },
        deploymentExecutionConstraints: { supportedTdModes: ['cross'] },
        executionEnvelope: { source: 'llm-codegen-session' },
        strategyInstanceId: null,
      },
    ]
    const instance = {
      id: 'instance-1',
      params: { deploymentExecutionConfig: { leverage: 1, priceSource: 'close' } },
      deploymentExecutionConfig: { leverage: 1, priceSource: 'close', orderType: 'market', timeInForce: 'gtc' },
    }
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
        findUnique: jest.fn(async ({ where }: any) => where.id === instance.id ? instance : null),
        update: jest.fn(async ({ data }: any) => {
          instance.params = data.params
          instance.deploymentExecutionConfig = data.deploymentExecutionConfig
        }),
      },
      userStrategySubscription: {
        findMany: jest.fn(async () => [subscription]),
        update: jest.fn(async ({ data }: any) => {
          subscription.customParams = data.customParams
        }),
      },
      $transaction: jest.fn(async (callback: (tx: any) => Promise<void>) => callback(prisma)),
    }
    return { instance, prisma, snapshots, subscription }
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

    expect(result.scanned).toBe(4)
    expect(result.updated).toBe(0)
    expect(result.plan).toEqual([expect.objectContaining({
      snapshotId: 'llm-perp-missing-tdmode',
      strategyInstanceId: 'instance-1',
      repairs: ['snapshot-defaults-tdMode', 'snapshot-constraints-supportedTdModes', 'instance-deployment-execution-config', 'instance-params-deployment-execution-config', 'subscription-custom-params-deployment-execution-config'],
    })])
    expect(result.skipped).toEqual(expect.arrayContaining([
      expect.objectContaining({ snapshotId: 'official-perp-missing-tdmode', reason: 'official strategy plaza snapshot is out of scope' }),
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
})
