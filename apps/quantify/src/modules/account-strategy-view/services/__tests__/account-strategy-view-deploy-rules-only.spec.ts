import type { CanonicalStrategyIrV1 } from '@/modules/llm-strategy-codegen/types/canonical-strategy-ir'
import { CanonicalStrategyAstCompilerService } from '@/modules/llm-strategy-codegen/services/canonical-strategy-ast-compiler.service'
import { CompiledScriptEmitterService } from '@/modules/llm-strategy-codegen/services/compiled-script-emitter.service'
import { CompiledScriptParserService } from '@/modules/llm-strategy-codegen/services/compiled-script-parser.service'
import { DeploySnapshotRequiresRepublishException } from '../../exceptions'
import { AccountStrategyViewService } from '../account-strategy-view.service'

function createRuntimeExecutionSemantics() {
  return [{
    semanticKey: 'on_start.entry.primary',
    trigger: 'on_start',
    phase: 'entry',
    consumePolicy: 'once',
    requiredRuntimeContext: {
      barIndex: 1,
      requiresReferenceBar: true,
      requiresSymbol: true,
      requiresTimeframe: true,
    },
    sourceRefs: ['entry_on_start'],
  }]
}

function createCompiledTruthFixture() {
  const ir: CanonicalStrategyIrV1 = {
    irVersion: 'csi.v1',
    source: {
      graphVersion: 18,
      graphDigest: `sha256:${'1'.repeat(64)}`,
      specHash: `sha256:${'2'.repeat(64)}`,
    },
    market: {
      venue: 'okx',
      instrumentType: 'perpetual',
      symbol: 'ETHUSDT',
      timeframes: ['15m'],
      priceFeed: 'close',
    },
    portfolio: {
      positionMode: 'long_only',
      sizing: { mode: 'pct_equity', value: 10 },
      maxConcurrentPositions: 1,
      allowPyramiding: false,
      maxPyramidingLayers: 1,
    },
    dataRequirements: {
      warmupBars: 2,
      maxLookback: 2,
      requiredTimeframes: ['15m'],
    },
    signalCatalog: {
      series: [
        { id: 'bar_index', kind: 'BAR_INDEX' },
        { id: 'one', kind: 'CONST', value: 1 },
      ],
      levelSets: [],
      predicates: [
        { id: 'entry_on_start', kind: 'EQ', args: ['bar_index', 'one'] },
      ],
    },
    runtimeRequirements: {
      helpers: [],
      stateKeys: [],
    },
    ruleBlocks: [{
      id: 'entry_on_start',
      phase: 'entry',
      when: 'entry_on_start',
      priority: 100,
      actions: [
        { kind: 'OPEN_LONG', quantity: { mode: 'pct_equity', value: 10 } },
      ],
    }],
    orderPrograms: [],
    riskPolicy: {
      guards: [],
      riskPredicates: [],
    },
    executionPolicy: {
      signalEvaluation: 'bar_close',
      fillPolicy: 'next_bar_open',
      timeframeAlignment: 'strict',
      orderTypeDefault: 'market',
      timeInForce: 'gtc',
      allowPartialFill: false,
    },
  }
  const ast = new CanonicalStrategyAstCompilerService().compile(ir)
  const astSnapshot = {
    ...ast,
    runtimeExecutionSemantics: createRuntimeExecutionSemantics(),
  }
  const scriptSnapshot = new CompiledScriptEmitterService().emit({
    ast,
    executionEnvelope: {
      positionMode: 'long_only',
      marginMode: 'isolated',
      tickSize: 0.01,
      pricePrecision: 2,
      quantityPrecision: 4,
      fillAssumption: 'strict',
    },
  })
  const compiledManifest = new CompiledScriptParserService().parse(scriptSnapshot).compiledManifest
  const canonicalSnapshot = {
    market: { exchange: 'okx', symbol: 'ETHUSDT', marketType: 'perp', timeframe: '15m' },
    rules: [{ id: 'entry_on_start', sourcePath: 'rules[0]' }],
  }

  return {
    canonicalSnapshot,
    specSnapshot: canonicalSnapshot,
    irSnapshot: ir as unknown as Record<string, unknown>,
    astSnapshot,
    scriptSnapshot,
    compiledManifest,
    rulesOnlyHashChain: {
      passed: true,
      hashes: {
        rulesHash: `sha256:${'3'.repeat(64)}`,
        canonicalSpecHash: compiledManifest.specHash,
        irHash: compiledManifest.irHash,
        astHash: compiledManifest.astDigest,
        scriptHash: `sha256:${'4'.repeat(64)}`,
      },
    },
  }
}

function createDeploySnapshot(overrides: Record<string, unknown> = {}) {
  return {
    id: 'snap-rules-only-1',
    snapshotHash: 'sha256:snap-rules-only-1',
    strategyInstanceId: 'draft-1',
    strategyTemplateId: 'template-1',
    strategyConfig: {
      exchange: 'okx',
      symbol: 'ETHUSDT',
      baseTimeframe: '15m',
      marketType: 'perp',
      positionSizing: { mode: 'pct_equity', value: 10 },
      positionPct: 10,
    },
    deploymentExecutionDefaults: {
      leverage: 2,
      priceSource: 'close',
      orderType: 'market',
      timeInForce: 'GTC',
    },
    deploymentExecutionConstraints: {
      defaultLeverage: 2,
      platformRiskMaxLeverage: 5,
      effectiveAllowedLeverageRange: { min: 1, max: 5 },
    },
    ...overrides,
  }
}

function createService(snapshot: Record<string, unknown>) {
  const repo = {
    findDeployRequestByUserAndRequestId: jest.fn().mockResolvedValue(null),
    createDeployRequestProcessing: jest.fn().mockResolvedValue({ id: 'deploy-request-1' }),
    deployStrategyForUser: jest.fn().mockResolvedValue({ strategyInstanceId: 'inst-1', mode: 'TESTNET' }),
    upsertRiskProfile: jest.fn().mockResolvedValue(undefined),
    markDeployRequestSucceeded: jest.fn().mockResolvedValue(undefined),
    markDeployRequestFailed: jest.fn().mockResolvedValue(undefined),
    markStrategyInstanceRuntimeBindingFailed: jest.fn().mockResolvedValue(undefined),
    activateStrategyInstanceForRuntime: jest.fn().mockResolvedValue(undefined),
  }
  const runtimeExecutionStateService = {
    buildExecutionSemanticKeysFromSnapshot: jest.fn().mockReturnValue(['on_start.entry.primary']),
    initializeStatesForDeploy: jest.fn().mockResolvedValue(['on_start.entry.primary']),
  }
  const snapshotsRepository = {
    findByIdForUser: jest.fn().mockResolvedValue(snapshot),
  }
  const service = new AccountStrategyViewService(
    repo as any,
    { calculateBatchStats: jest.fn() } as any,
    { updateInstance: jest.fn() } as any,
    { ensureSymbolsSubscribed: jest.fn().mockResolvedValue(undefined) } as any,
    undefined,
    undefined,
    { getLeverageConstraints: jest.fn().mockResolvedValue({ minLeverage: 1, maxLeverage: 5 }) } as any,
    snapshotsRepository as any,
    runtimeExecutionStateService as any,
  )
  service.getStrategyDetail = jest.fn().mockResolvedValue({ id: 'inst-1' } as any)
  return { service, repo, runtimeExecutionStateService }
}

describe('accountStrategyViewService deploy rules-only snapshot truth', () => {
  it('requires republish before creating a deploy instance when compiled snapshot truth is missing', async () => {
    const { service, repo } = createService(createDeploySnapshot({
      astSnapshot: {
        astVersion: 'csa.v1',
        runtimeExecutionSemantics: createRuntimeExecutionSemantics(),
      },
    }))

    await expect(service.deployStrategy({
      userId: 'user-1',
      name: 'rules only strategy',
      publishedSnapshotId: 'snap-rules-only-1',
      deployRequestId: 'deploy-req-1',
      exchangeAccountId: 'exchange-account-1',
      mode: 'TESTNET',
    } as any)).rejects.toBeInstanceOf(DeploySnapshotRequiresRepublishException)

    expect(repo.createDeployRequestProcessing).not.toHaveBeenCalled()
    expect(repo.deployStrategyForUser).not.toHaveBeenCalled()
  })

  it('continues deploy and initializes runtime keys from a complete rules-only snapshot truth chain', async () => {
    const snapshot = createDeploySnapshot(createCompiledTruthFixture())
    const { service, repo, runtimeExecutionStateService } = createService(snapshot)

    await service.deployStrategy({
      userId: 'user-1',
      name: 'rules only strategy',
      publishedSnapshotId: 'snap-rules-only-1',
      deployRequestId: 'deploy-req-2',
      exchangeAccountId: 'exchange-account-1',
      mode: 'TESTNET',
    } as any)

    expect(repo.deployStrategyForUser).toHaveBeenCalledWith(expect.objectContaining({
      publishedSnapshotBinding: expect.objectContaining({
        publishedSnapshotId: 'snap-rules-only-1',
        snapshotHash: 'sha256:snap-rules-only-1',
      }),
    }))
    expect(runtimeExecutionStateService.initializeStatesForDeploy).toHaveBeenCalledWith({
      strategyInstanceId: 'inst-1',
      publishedSnapshotId: 'snap-rules-only-1',
      snapshotHash: 'sha256:snap-rules-only-1',
      snapshot,
    })
  })
})
