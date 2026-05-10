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

    // condition.key 已从 PUBLIC_RESPONSE_INTERNAL_IDENTIFIERS 移除：
    // canonical rule key（如 ma.golden_cross）需经 toPublicRule 暴露；
    // atom key 值（如 indicator.cross_over）仍由 atomRegistry 值扫描拦截。
    expect(() => guard.assertNoLeaks({
      path: 'rules[0].condition.key',
    }, {
      surface: 'test.public-output',
    })).not.toThrow()

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

  it('default ignoreValueAtKeys is empty: structural id with canonical key still triggers leak (fail-closed)', () => {
    // 默认 fail-closed：caller 不显式声明 ignoreValueAtKeys 时，结构性 ID
    // 字段值仍参与 leak 扫描。例外语义必须由调用点旁的 ignoreValueAtKeys 显式声明，
    // 避免未来新增 surface 隐式继承豁免。
    try {
      guard.assertNoLeaks({
        displayLogicGraph: {
          blocks: [{ items: [{ id: 'action-entry-ma-open_long' }] }],
        },
      }, {
        surface: 'test.default-fail-closed',
        scanPaths: true,
      })
      throw new Error('expected internal key leak')
    }
    catch (err) {
      expect((err as Error).message).toBe('semantic_presentation_internal_key_leak:open_long')
    }
  })

  it('caller can opt-in to skip leak scan on structural id fields via ignoreValueAtKeys (#1133)', () => {
    // caller 显式列出 'id'：表示该 surface 上的 contract 允许 id 字段值内嵌 canonical key
    // (例如 displayLogicGraph.blocks[*].items[*].id 形如 `action-entry-ma-open_long`)。
    expect(() => {
      guard.assertNoLeaks({
        displayLogicGraph: {
          blocks: [{ items: [{ id: 'action-entry-ma-open_long' }] }],
        },
      }, {
        surface: 'test.structural-id-explicit',
        scanPaths: true,
        ignoreValueAtKeys: ['id'],
      })
    }).not.toThrow()
  })

  it('still catches leak pattern in non-id prose fields when same canonical key embedded', () => {
    // 同一 canonical key 出现在 prose 字段（如 label/text）仍触发 leak guard，
    // 证明 ignoreValueAtKeys 是 key-name 级开关而非全局放宽。
    try {
      guard.assertNoLeaks({
        displayLogicGraph: {
          blocks: [{
            items: [{
              id: 'action-entry-ma-open_long',
              label: '触发 open_long',
            }],
          }],
        },
      }, {
        surface: 'test.prose-leak-vs-id',
        scanPaths: true,
        ignoreValueAtKeys: ['id'],
      })
      throw new Error('expected internal key leak')
    }
    catch (err) {
      expect((err as Error).message).toBe('semantic_presentation_internal_key_leak:open_long')
      expect((err as { args?: { details?: string } }).args?.details).toContain('path=$.displayLogicGraph.blocks[0].items[0].label')
    }
  })

  it('does not let id exemption bleed into nested objects under the id key', () => {
    // 反向断言（Reviewer A_4）：豁免只对 string-leaf 生效；如果某 contract
    // 错把对象塞进 id 字段，子节点的 lastKey 会更新为子键名，不再继承豁免。
    try {
      guard.assertNoLeaks({
        item: {
          id: { label: '触发 open_long' },
        },
      }, {
        surface: 'test.id-exemption-no-bleed',
        scanPaths: true,
        ignoreValueAtKeys: ['id'],
      })
      throw new Error('expected internal key leak')
    }
    catch (err) {
      expect((err as Error).message).toBe('semantic_presentation_internal_key_leak:open_long')
      expect((err as { args?: { details?: string } }).args?.details).toContain('path=$.item.id.label')
    }
  })

  it('exempts string elements inside an array directly under an ignored key (Reviewer B_M1)', () => {
    // 数组分支不更新 keyPath，所以 `{ id: ['...'] }` 形态下数组元素的 lastKey
    // 仍是 'id'，按 contract 视为同一字段的多值；显式锁定此行为以防 walk 重构回归。
    expect(() => {
      guard.assertNoLeaks({
        item: { id: ['action-entry-ma-open_long', 'action-exit-ma-close_long'] },
      }, {
        surface: 'test.array-id-element-exempt',
        scanPaths: true,
        ignoreValueAtKeys: ['id'],
      })
    }).not.toThrow()
  })

  it('keeps path scan effective even when value scan on id is exempted (Reviewer B_M2)', () => {
    // 即便 caller 在 ignoreValueAtKeys 里豁免 id 值，scanPaths 仍能拦下
    // keyPath 中含 internalKey 的错误字段命名（如把 `condition.kind` 当 record key）。
    try {
      guard.assertNoLeaks({
        'condition.kind': { id: 'safe-id' },
      }, {
        surface: 'test.path-scan-still-effective',
        scanPaths: true,
        ignoreValueAtKeys: ['id'],
      })
      throw new Error('expected internal key leak')
    }
    catch (err) {
      expect((err as Error).message).toBe('semantic_presentation_internal_key_leak:condition.kind')
    }
  })
})
