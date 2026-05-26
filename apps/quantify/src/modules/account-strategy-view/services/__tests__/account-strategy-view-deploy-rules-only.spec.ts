import type { CanonicalStrategyIrV1 } from '@/modules/llm-strategy-codegen/types/canonical-strategy-ir'
import { createHash } from 'node:crypto'
import { canonicalSerialize } from '@ai/shared/script-engine/compiled-runtime'
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

function hashCanonical(value: unknown): `sha256:${string}` {
  return `sha256:${createHash('sha256').update(canonicalSerialize(value)).digest('hex')}`
}

function hashText(value: string): `sha256:${string}` {
  return `sha256:${createHash('sha256').update(value, 'utf8').digest('hex')}`
}

function createCompiledTruthFixture() {
  const rulesHash = hashCanonical([{ id: 'entry_on_start', sourcePath: 'rules[0]' }])
  const canonicalSnapshot = {
    metadata: { rulesHash },
    market: { exchange: 'okx', symbol: 'ETHUSDT', marketType: 'perp', timeframe: '15m' },
    rules: [{ id: 'entry_on_start', sourcePath: 'rules[0]' }],
  }
  const canonicalSpecHash = hashCanonical(canonicalSnapshot)
  const ir: CanonicalStrategyIrV1 = {
    irVersion: 'csi.v1',
    source: {
      graphVersion: 18,
      graphDigest: canonicalSpecHash,
      specHash: canonicalSpecHash,
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
    orchestrationScopes: [
      { id: 'scope-eth', scopeKind: 'symbol', symbols: ['ETHUSDT'], primarySymbol: 'ETHUSDT' },
    ],
    orchestrationLegScopes: [
      { id: 'leg-long-eth', scopeKind: 'leg', legId: 'leg.long.eth', direction: 'long', instrumentRef: 'scope-eth' },
    ],
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
        rulesHash,
        canonicalSpecHash,
        irHash: compiledManifest.irHash,
        astHash: compiledManifest.astDigest,
        scriptHash: hashText(scriptSnapshot),
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

  it('continues deploy when rules-only hash evidence is persisted in snapshot columns and consistency report', async () => {
    const truth = createCompiledTruthFixture()
    const hashes = truth.rulesOnlyHashChain.hashes
    const { rulesOnlyHashChain: _rulesOnlyHashChain, ...persistedTruth } = truth
    const snapshot = createDeploySnapshot({
      ...persistedTruth,
      specHash: hashes.canonicalSpecHash,
      scriptHash: hashes.scriptHash.replace(/^sha256:/u, ''),
      consistencyReport: {
        status: 'PASSED',
        compilerConsistency: {
          status: 'PASSED',
          graphVsIr: {
            passed: true,
            specHash: hashes.canonicalSpecHash,
          },
          irVsScript: {
            passed: true,
            irHash: hashes.irHash,
            astDigest: hashes.astHash,
          },
          manifestSelfCheck: {
            passed: true,
            specHash: hashes.canonicalSpecHash,
            irHash: hashes.irHash,
            astDigest: hashes.astHash,
          },
        },
      },
    })
    const { service, repo } = createService(snapshot)

    await service.deployStrategy({
      userId: 'user-1',
      name: 'rules only strategy',
      publishedSnapshotId: 'snap-rules-only-1',
      deployRequestId: 'deploy-req-persisted-truth',
      exchangeAccountId: 'exchange-account-1',
      mode: 'TESTNET',
    } as any)

    expect(repo.deployStrategyForUser).toHaveBeenCalledWith(expect.objectContaining({
      publishedSnapshotBinding: expect.objectContaining({
        publishedSnapshotId: 'snap-rules-only-1',
      }),
    }))
  })

  it('requires republish when ast orchestration scope content no longer matches hash chain', async () => {
    const truth = createCompiledTruthFixture()
    const snapshot = createDeploySnapshot({
      ...truth,
      astSnapshot: {
        ...truth.astSnapshot,
        orchestrationScopes: [
          { id: 'scope-btc', scopeKind: 'symbol', symbols: ['BTCUSDT'], primarySymbol: 'BTCUSDT' },
        ],
      },
    })
    const { service, repo } = createService(snapshot)

    await expect(service.deployStrategy({
      userId: 'user-1',
      name: 'rules only strategy',
      publishedSnapshotId: 'snap-rules-only-1',
      deployRequestId: 'deploy-req-3',
      exchangeAccountId: 'exchange-account-1',
      mode: 'TESTNET',
    } as any)).rejects.toBeInstanceOf(DeploySnapshotRequiresRepublishException)

    expect(repo.createDeployRequestProcessing).not.toHaveBeenCalled()
    expect(repo.deployStrategyForUser).not.toHaveBeenCalled()
  })

  it('requires republish when ir snapshot content no longer matches manifest hash', async () => {
    const truth = createCompiledTruthFixture()
    const snapshot = createDeploySnapshot({
      ...truth,
      irSnapshot: {
        ...truth.irSnapshot,
        market: { ...((truth.irSnapshot as unknown as CanonicalStrategyIrV1).market), symbol: 'BTCUSDT' },
      },
    })
    const { service, repo } = createService(snapshot)

    await expect(service.deployStrategy({
      userId: 'user-1',
      name: 'rules only strategy',
      publishedSnapshotId: 'snap-rules-only-1',
      deployRequestId: 'deploy-req-4',
      exchangeAccountId: 'exchange-account-1',
      mode: 'TESTNET',
    } as any)).rejects.toBeInstanceOf(DeploySnapshotRequiresRepublishException)

    expect(repo.createDeployRequestProcessing).not.toHaveBeenCalled()
    expect(repo.deployStrategyForUser).not.toHaveBeenCalled()
  })

  it('requires republish when script snapshot content no longer matches script hash', async () => {
    const truth = createCompiledTruthFixture()
    const snapshot = createDeploySnapshot({
      ...truth,
      scriptSnapshot: `${truth.scriptSnapshot}\n// tampered`,
    })
    const { service, repo } = createService(snapshot)

    await expect(service.deployStrategy({
      userId: 'user-1',
      name: 'rules only strategy',
      publishedSnapshotId: 'snap-rules-only-1',
      deployRequestId: 'deploy-req-5',
      exchangeAccountId: 'exchange-account-1',
      mode: 'TESTNET',
    } as any)).rejects.toBeInstanceOf(DeploySnapshotRequiresRepublishException)

    expect(repo.createDeployRequestProcessing).not.toHaveBeenCalled()
    expect(repo.deployStrategyForUser).not.toHaveBeenCalled()
  })
})
