import { CodegenConversationResponseMapperHelper } from '../../services/codegen-conversation-response-mapper.helper'
import { listDisplayTokens } from '../display-registry'
import { utteranceCorpus } from '../utterance-corpus'
import { InternalKeyLeakGuardService } from './internal-key-leak-guard'

describe('internalKeyLeakGuardService', () => {
  const guard = new InternalKeyLeakGuardService()

  it('reports leak path and repair suggestion for raw internal keys', () => {
    try {
      guard.assertNoLeaks({
        clarification: {
          question: '请补充 condition.kind。',
        },
      }, {
        surface: 'test.public-output',
        scanPaths: true,
      })
      throw new Error('expected internal key leak')
    }
    catch (err) {
      expect((err as Error).message).toBe('semantic_presentation_internal_key_leak:condition.kind')
      expect((err as { args?: { details?: string } }).args?.details).toContain('path=$.clarification.question')
      expect((err as { args?: { details?: string } }).args?.details).toContain('suggestion=')
    }
  })

  it('keeps nl-gateway display copy and utterance corpus free of internal keys', () => {
    guard.assertNoLeaks({
      displayTokenZh: listDisplayTokens().map(token => token.zh),
      utterances: utteranceCorpus.map(item => item.utterance),
    }, {
      surface: 'nl-gateway.public-copy',
    })
  })

  it('reports internal keys that only appear in object paths', () => {
    expect(() => guard.assertNoLeaks({
      publicSpec: {
        condition: {
          kind: 'atom',
        },
      },
    }, {
      surface: 'test.public-output',
      scanPaths: true,
    })).toThrow('semantic_presentation_internal_key_leak:condition.kind')

    expect(() => guard.assertNoLeaks({
      publicSpec: {
        'condition.kind': 'atom',
      },
    }, {
      surface: 'test.public-output',
      scanPaths: true,
    })).toThrow('semantic_presentation_internal_key_leak:condition.kind')
  })

  it('reports internal keys embedded in public string path expressions', () => {
    expect(() => guard.assertNoLeaks({
      path: '$.condition.kind',
    }, {
      surface: 'test.public-output',
    })).toThrow('semantic_presentation_internal_key_leak:condition.kind')

    expect(() => guard.assertNoLeaks({
      path: 'rules[0].condition.key',
    }, {
      surface: 'test.public-output',
    })).toThrow('semantic_presentation_internal_key_leak:condition.key')

    expect(() => guard.assertNoLeaks({
      path: 'public.condition.expression',
    }, {
      surface: 'test.public-output',
    })).toThrow('semantic_presentation_internal_key_leak:condition.expression')
  })

  it('keeps public canonical session specDesc free of internal key paths', () => {
    const mapper = new CodegenConversationResponseMapperHelper()
    const result = mapper.finalizeSessionResponse({
      id: 's-public-spec-desc',
      status: 'CONFIRM_GATE',
      missingFields: [],
      clarificationState: null,
      specDesc: {
        viewType: 'canonical-semantic-view.v1',
        canonicalDigest: 'sha256:abc',
        version: 2,
        market: { symbols: ['BTCUSDT'], timeframes: ['15m'], session: '24x7' },
        canonicalSpec: {
          market: { symbol: 'BTCUSDT', defaultTimeframe: '15m' },
          sizing: { mode: 'RATIO', value: 0.1 },
          rules: [{
            condition: { kind: 'atom', key: 'condition.expression' },
          }],
        },
        rules: [{
          id: 'entry-1',
          phase: 'entry',
          condition: { kind: 'atom', key: 'condition.expression' },
          actions: [{ type: 'OPEN_LONG' }],
        }],
        normalizedIntent: {
          stateHints: [{ key: 'generic_boundary' }],
        },
        displayLogicGraph: {
          blocks: [{
            type: 'IF',
            items: [{ kind: 'condition', id: 'condition-entry-1', text: '收盘价高于开盘价' }],
          }],
        },
        summary: '策略规则共 1 条（入场 1、出场 0、风控 0）',
      },
    }, () => ({
      blocked: false,
      summary: null,
      items: [],
      pendingItems: [],
    }))

    expect(result.specDesc).toHaveProperty('rules')
    expect(result.specDesc?.rules).toEqual([{
      id: 'entry-1',
      phase: 'entry',
      condition: { text: '收盘价高于开盘价' },
      actions: [{ type: 'OPEN_LONG' }],
    }])
    expect(result.specDesc?.canonicalSpec).toEqual({
      market: { symbol: 'BTCUSDT', defaultTimeframe: '15m' },
      sizing: { mode: 'RATIO', value: 0.1 },
    })
    expect(result.specDesc).not.toHaveProperty('normalizedIntent')
    guard.assertNoLeaks(result.specDesc, {
      surface: 'codegen.session.specDesc',
      scanPaths: true,
    })
  })
})
