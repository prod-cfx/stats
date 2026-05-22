import { CodegenConversationResponseMapperHelper } from '../codegen-conversation-response-mapper.helper'

describe('codegenConversationResponseMapperHelper', () => {
  const helper = new CodegenConversationResponseMapperHelper()

  it('drops spec-facing fields when clarification gate remains blocked', () => {
    const result = helper.finalizeSessionResponse({
      id: 's1',
      status: 'DRAFTING',
      missingFields: [],
      specDesc: {
        foo: 'bar',
        publicQuestion: '请补充 condition.kind。',
      },
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

  it('drops semantic graph from public non-blocked responses', () => {
    const result = helper.finalizeSessionResponse({
      id: 's2',
      status: 'CONFIRM_GATE',
      missingFields: [],
      specDesc: { summary: '策略规则共 1 条' },
      semanticGraph: {
        nodes: [{
          key: 'condition.expression',
        }],
      },
      clarificationState: null,
    }, () => ({
      blocked: false,
      summary: null,
      items: [],
      pendingItems: [],
    }))

    expect(result.semanticGraph).toBeNull()
    expect(result.specDesc).toEqual({ summary: '策略规则共 1 条' })
  })

  it('projects unsupported fallback to public-safe fields', () => {
    const result = helper.finalizeSessionResponse({
      id: 's3',
      status: 'UNSUPPORTED',
      missingFields: [],
      specDesc: null,
      unsupportedFallback: {
        status: 'fallback',
        prompt: '使用均线交叉策略',
        unsupportedAtoms: [{
          key: 'condition.kind',
          displayName: '内部条件',
          publicReason: '暂不支持',
          reasonCode: 'INTERNAL_KEY',
        }],
        recommendedStrategy: {
          strategyKey: 'ma_cross',
          description: '均线交叉',
          patch: { rules: [{ condition: { key: 'condition.expression' } }] },
        },
      },
      clarificationState: null,
    }, () => ({
      blocked: false,
      summary: null,
      items: [],
      pendingItems: [],
    }))

    expect(result.unsupportedFallback).toEqual({
      status: 'fallback',
      prompt: '使用均线交叉策略',
      unsupportedAtoms: [{
        displayName: '内部条件',
        publicReason: '暂不支持',
      }],
      recommendedStrategy: {
        strategyKey: 'ma_cross',
        description: '均线交叉',
      },
    })
    expect(JSON.stringify(result.unsupportedFallback)).not.toContain('condition.kind')
    expect(JSON.stringify(result.unsupportedFallback)).not.toContain('patch')
  })

  it('projects rule condition text by stable rule id and renders risk rule text inline', () => {
    const result = helper.finalizeSessionResponse({
      id: 's4',
      status: 'CONFIRM_GATE',
      missingFields: [],
      specDesc: {
        displayLogicGraph: {
          blocks: [{
            items: [
              { id: 'condition-decoy', kind: 'condition', text: '不应绑定到 entry-1' },
              { id: 'condition-entry-1', kind: 'condition', text: '3m 内下跌 1% 买入' },
            ],
          }],
        },
        rules: [
          {
            id: 'entry-1',
            phase: 'entry',
            condition: { key: 'condition.kind', value: 'entry' },
            actions: [{ type: 'OPEN_LONG', sizing: { mode: 'RATIO', value: 0.2 } }],
            metadata: { triggerKeys: ['condition.kind'] },
          },
          {
            id: 'risk-1',
            phase: 'risk',
            condition: { key: 'position_loss_pct', value: 0.05 },
          },
        ],
      },
      clarificationState: null,
    }, () => ({
      blocked: false,
      summary: null,
      items: [],
      pendingItems: [],
    }))

    expect(result.specDesc).toMatchObject({
      rules: [
        { id: 'entry-1', condition: { text: '3m 内下跌 1% 买入' } },
        { id: 'risk-1', condition: { text: '亏损达到 5%' } },
      ],
    })
    // Phase 5 公开契约：specDesc 不暴露 legacy riskRules 字段
    // （e2e original-strategy-flow LEGACY_CHECKLIST_FIELD_NAMES 全局禁用）
    expect(result.specDesc).not.toHaveProperty('riskRules')
    expect(JSON.stringify(result.specDesc)).not.toContain('condition.kind')
    expect(JSON.stringify(result.specDesc)).not.toContain('triggerKeys')
  })

  it('does not leak grid rule keys from published specDesc without display graph text', () => {
    const result = helper.finalizeSessionResponse({
      id: 's-grid',
      status: 'PUBLISHED',
      missingFields: [],
      specDesc: {
        rules: [{
          id: 'semantic-entry-grid-range-rebalance-long',
          phase: 'entry',
          condition: {
            key: 'grid.range_rebalance',
            params: { rangeMin: 60000, rangeMax: 80000, stepPct: 0.5 },
          },
          actions: [{ type: 'OPEN_LONG', sizing: { mode: 'RATIO', value: 0.1 } }],
        }],
        semanticPredicateGraph: {
          nodes: [{
            id: 'semantic-entry-grid-range-rebalance-long',
            left: { kind: 'atom', key: 'grid.range_rebalance' },
          }],
        },
      },
      clarificationState: null,
    }, () => ({
      blocked: false,
      summary: null,
      items: [],
      pendingItems: [],
    }))

    expect(result.specDesc).toEqual({
      rules: [{
        id: 'semantic-entry-grid-range-rebalance-long',
        phase: 'entry',
        actions: [{ type: 'OPEN_LONG', sizing: { mode: 'RATIO', value: 0.1 } }],
        condition: { text: '网格区间 60000-80000，间距 0.5%' },
      }],
    })
    expect(JSON.stringify(result.specDesc)).not.toContain('grid.range_rebalance')
    expect(JSON.stringify(result.specDesc)).not.toContain('semanticPredicateGraph')
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
        missingBacktestConfigDefaults: false,
        missingDeploymentExecutionDefaults: true,
        missingDeploymentExecutionConstraints: true,
        requiresRepublishForBacktest: true,
        requiresRepublishForDeploy: true,
      },
    })
  })
})
