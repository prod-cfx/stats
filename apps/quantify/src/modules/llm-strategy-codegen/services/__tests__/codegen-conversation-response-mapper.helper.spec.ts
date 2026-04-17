import { CodegenConversationResponseMapperHelper } from '../codegen-conversation-response-mapper.helper'

describe('codegenConversationResponseMapperHelper', () => {
  const helper = new CodegenConversationResponseMapperHelper()

  it('drops spec-facing fields when clarification gate remains blocked', () => {
    const result = helper.finalizeSessionResponse({
      id: 's1',
      status: 'DRAFTING',
      missingFields: [],
      specDesc: { foo: 'bar' },
      canonicalDigest: 'sha256:abc',
      semanticGraph: { node: 1 },
      clarificationState: null,
    }, () => ({
      blocked: true,
      summary: '缺字段',
      items: [],
      pendingItems: [],
    }))

    expect(result.specDesc).toBeNull()
    expect(result.canonicalDigest).toBeNull()
    expect(result.semanticGraph).toBeNull()
  })

  it('reads publication gate from nested compiler consistency report', () => {
    expect(helper.readPublicationGate({
      compilerConsistency: {
        publicationGate: {
          status: 'failed',
          checks: [{
            key: 'market.symbol',
            blocking: true,
            status: 'failed',
            expected: 'BTCUSDT',
            actual: 'ETHUSDT',
            message: 'symbol mismatch',
          }],
        },
      },
    })).toEqual({
      passed: false,
      blockingMismatches: [{
        field: 'symbol',
        expected: 'BTCUSDT',
        actual: 'ETHUSDT',
        reason: 'symbol mismatch',
      }],
    })
  })

  it('merges published snapshot params with aliases and execution policy overrides', () => {
    expect(helper.buildPublishedSnapshotParamValues({
      paramsSnapshot: { timeframe: '1h', symbol: 'BTCUSDT' },
      lockedParams: { leverage: 2 },
      executionPolicy: { allowPartialFill: 'true' },
    })).toEqual({
      timeframe: '1h',
      baseTimeframe: '1h',
      symbol: 'BTCUSDT',
      leverage: 2,
      backtestAllowPartial: true,
    })
  })

  it('marks legacy snapshot compatibility gaps from missing projections', () => {
    expect(helper.buildPublishedSnapshotProjection({
      publishedSnapshotId: 'snap-1',
      snapshot: {
        strategyConfig: null,
        backtestConfigDefaults: { initialCash: 10000 },
      },
    })).toMatchObject({
      publishedSnapshotCompatibilityMetadata: {
        isLegacySnapshot: true,
        missingStrategyInstanceBinding: true,
        missingBacktestConfigDefaults: false,
        missingDeploymentExecutionDefaults: true,
        missingDeploymentExecutionConstraints: true,
        requiresRepublishForBacktest: true,
        requiresRepublishForDeploy: true,
      },
    })
  })
})
