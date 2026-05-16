/**
 * Issue #1395 (mute-spider): planner rules[] graceful zod parse
 *
 * 行为契约：
 *   - rules[] 逐条独立 parse，invalid 个体进 quarantine（非整体 strip）
 *   - AtomExpr 子树内单点错误剪枝保留 valid 兄弟
 *   - 即便 0 条通过，rules = []，diagnostics.zodQuarantine 含所有 index
 */

import {
  andSchema,
  atomExprSchema,
  atomSchema,
  gracefulParseSemanticRule,
  notSchema,
  orSchema,
  pruneAtomExprToValid,
  pruneAtomExprWithErrors,
  type SemanticRule,
  sequenceSchema,
} from '../../types/atom-expr'
import { CodegenConversationService } from '../codegen-conversation.service'

type Validation = ReturnType<CodegenConversationService['validatePlannerRules']>

function makeService(): CodegenConversationService {
  // 仅测试纯函数 validatePlannerRules，构造空 service shell
  // 通过 prototype 旁路 DI（避免拉起整个 nest module）
  return Object.create(CodegenConversationService.prototype) as CodegenConversationService
}

const validRule = (id: string, key = 'rsi.gte'): SemanticRule => ({
  id,
  phase: 'entry',
  sideScope: 'long',
  condition: { kind: 'atom', key, params: { threshold: 65 } },
  effects: [],
})

describe('Issue #1395 mute-spider — validatePlannerRules graceful parse', () => {
  const svc = makeService()

  it('case 1: rules=[valid, invalid, valid] → result.rules 长度 2，quarantine 含 index=1', () => {
    const result: Validation = svc.validatePlannerRules([
      validRule('r1'),
      { id: 'bad', phase: 'NOT_A_PHASE', sideScope: 'long', condition: { kind: 'atom', key: 'x', params: {} }, effects: [] },
      validRule('r3'),
    ])
    expect(result.rules).toHaveLength(2)
    expect(result.rules[0].id).toBe('r1')
    expect(result.rules[1].id).toBe('r3')
    expect(result.quarantine).toHaveLength(1)
    expect(result.quarantine[0].index).toBe(1)
    expect(result.quarantine[0].errorPath).toMatch(/phase/i)
    expect(result.quarantine[0].rawSnippet).toContain('bad')
  })

  it('case 2: condition = AND(valid, invalid_leaf) → 剪枝后退化为单 atom，rule 保留', () => {
    const result = svc.validatePlannerRules([
      {
        id: 'r-and',
        phase: 'entry',
        sideScope: 'long',
        condition: {
          kind: 'and',
          children: [
            { kind: 'atom', key: 'bollinger.touch_lower', params: { period: 20 } },
            { kind: 'atom', key: '', params: {} }, // invalid: empty key
          ],
        },
        effects: [],
      },
    ])
    expect(result.rules).toHaveLength(1)
    expect(result.quarantine).toHaveLength(0)
    const cond = result.rules[0].condition
    // 剪枝后 valid children=1 → 退化为单 atom（去 and 包裹）
    expect(cond.kind).toBe('atom')
    if (cond.kind === 'atom') {
      expect(cond.key).toBe('bollinger.touch_lower')
    }
  })

  it('case 2b: AND(valid, valid, invalid) → 剩 2 valid 时保留 and 组合', () => {
    const result = svc.validatePlannerRules([
      {
        id: 'r-and-2',
        phase: 'entry',
        sideScope: 'long',
        condition: {
          kind: 'and',
          children: [
            { kind: 'atom', key: 'a', params: {} },
            { kind: 'atom', key: 'b', params: {} },
            { kind: 'atom', key: '', params: {} }, // invalid
          ],
        },
        effects: [],
      },
    ])
    expect(result.rules).toHaveLength(1)
    const cond = result.rules[0].condition
    expect(cond.kind).toBe('and')
    if (cond.kind === 'and') {
      expect(cond.children).toHaveLength(2)
    }
  })

  it('case 3: sequence steps=[invalid] → 整 rule 入 quarantine（顺序不可残缺）', () => {
    const result = svc.validatePlannerRules([
      {
        id: 'r-seq',
        phase: 'entry',
        sideScope: 'long',
        condition: {
          kind: 'sequence',
          steps: [
            { kind: 'atom', key: '', params: {} }, // invalid
            { kind: 'atom', key: 'volume.spike', params: {} },
          ],
        },
        effects: [],
      },
    ])
    expect(result.rules).toHaveLength(0)
    expect(result.quarantine).toHaveLength(1)
    expect(result.quarantine[0].errorPath).toMatch(/condition/i)
  })

  it('case 4: S4 风格 LLM 输出（bollinger + volume.threshold multiplier:1.5）通过', () => {
    const s4Rule = {
      id: 's4-entry',
      phase: 'entry' as const,
      sideScope: 'long' as const,
      condition: {
        kind: 'and' as const,
        children: [
          {
            kind: 'atom' as const,
            key: 'bollinger.touch_lower',
            params: { period: 20, stdDev: 2 },
          },
          {
            kind: 'atom' as const,
            key: 'volume.threshold',
            params: {
              comparator: 'gt',
              baseline: 'sma',
              baselinePeriod: 20,
              multiplier: 1.5,
            },
          },
        ],
      },
      effects: [],
    }
    const result = svc.validatePlannerRules([s4Rule])
    expect(result.quarantine).toEqual([])
    expect(result.rules).toHaveLength(1)
    expect(result.rules[0].condition.kind).toBe('and')
  })

  it('case 5: 全部 invalid → rules=[]，quarantine 含所有 index', () => {
    const result = svc.validatePlannerRules([
      { id: '', phase: 'entry', sideScope: 'long', condition: { kind: 'atom', key: 'x', params: {} }, effects: [] },
      { id: 'r2', phase: 'BAD', sideScope: 'long', condition: { kind: 'atom', key: 'x', params: {} }, effects: [] },
      { id: 'r3', phase: 'entry', sideScope: 'WHO_KNOWS', condition: { kind: 'atom', key: 'x', params: {} }, effects: [] },
    ])
    expect(result.rules).toEqual([])
    expect(result.quarantine.map(q => q.index)).toEqual([0, 1, 2])
    for (const q of result.quarantine) {
      expect(typeof q.errorPath).toBe('string')
      expect(q.errorPath.length).toBeGreaterThan(0)
    }
  })

  it('case 6: rules 字段不是数组 → quarantine 单条 index=-1，rules=[]', () => {
    const result = svc.validatePlannerRules({ rules: 'not-array' })
    expect(result.rules).toEqual([])
    expect(result.quarantine).toHaveLength(1)
    expect(result.quarantine[0].index).toBe(-1)
  })

  it('case 7: rawRules=undefined → 直通空结果', () => {
    const result = svc.validatePlannerRules(undefined)
    expect(result).toEqual({ rules: [], quarantine: [] })
  })

  it('case 8: NOT 内部唯一子节点 invalid → 整 rule 入 quarantine', () => {
    const result = svc.validatePlannerRules([
      {
        id: 'r-not',
        phase: 'entry',
        sideScope: 'long',
        condition: { kind: 'not', child: { kind: 'atom', key: '', params: {} } },
        effects: [],
      },
    ])
    expect(result.rules).toHaveLength(0)
    expect(result.quarantine).toHaveLength(1)
  })

  it('case 9: effects 内 invalid 个体被剪枝但 rule 保留', () => {
    const result = svc.validatePlannerRules([
      {
        id: 'r-eff',
        phase: 'entry',
        sideScope: 'long',
        condition: { kind: 'atom', key: 'a', params: {} },
        effects: [
          { kind: 'atom', key: 'order.open', params: {} },
          { kind: 'atom', key: '', params: {} }, // invalid
        ],
      },
    ])
    expect(result.rules).toHaveLength(1)
    expect(result.rules[0].effects).toHaveLength(1)
    expect(result.quarantine).toHaveLength(0)
  })
})

describe('pruneAtomExprToValid — 纯函数行为', () => {
  it('OR(valid, valid, invalid) 保留 or 组合', () => {
    const out = pruneAtomExprToValid({
      kind: 'or',
      children: [
        { kind: 'atom', key: 'a', params: {} },
        { kind: 'atom', key: 'b', params: {} },
        { kind: 'atom', key: '', params: {} },
      ],
    })
    expect(out?.kind).toBe('or')
    if (out?.kind === 'or') expect(out.children).toHaveLength(2)
  })

  it('AND(invalid, invalid) → null', () => {
    const out = pruneAtomExprToValid({
      kind: 'and',
      children: [
        { kind: 'atom', key: '', params: {} },
        { kind: 'atom', key: '', params: {} },
      ],
    })
    expect(out).toBeNull()
  })

  it('sequence 任一 step null → 整树 null', () => {
    const out = pruneAtomExprToValid({
      kind: 'sequence',
      steps: [
        { kind: 'atom', key: 'a', params: {} },
        { kind: 'atom', key: '', params: {} },
      ],
    })
    expect(out).toBeNull()
  })
})

describe('gracefulParseSemanticRule', () => {
  it('header invalid → fail with errorPath', () => {
    const out = gracefulParseSemanticRule({
      id: 'x',
      phase: 'nope',
      sideScope: 'long',
      condition: { kind: 'atom', key: 'a', params: {} },
      effects: [],
    })
    expect(out.ok).toBe(false)
    expect(out.ok === false ? out.errorPath : '').toMatch(/phase/)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// Issue #1399 — discriminated union 路径精度回归
//
// 验证 zod errorPath 必须能精确到 `condition.children[N].key` /
// `condition.steps[M].kind` 这种节点级别，而不是 `#1396` 时代的笼统
// "condition: pruned to empty" 一坨。
// ─────────────────────────────────────────────────────────────────────────────
describe('Issue #1399 — errorPath 精确路径回归', () => {
  const svc = makeService()

  it('AND.children[1].key 空串 → 走兄弟剪枝，无 quarantine', () => {
    // 兄弟 valid，单 leaf 失效会被剪掉而非弹整 rule；这里只验剪枝路径可观测
    const out = pruneAtomExprToValid({
      kind: 'and',
      children: [
        { kind: 'atom', key: 'a', params: {} },
        { kind: 'atom', key: '', params: {} }, // invalid
      ],
    })
    expect(out?.kind).toBe('atom') // 1 valid 退化为该 atom
  })

  it('AND 全部 invalid → errorPath 含 condition.children[N].key 精确路径', () => {
    const result = svc.validatePlannerRules([
      {
        id: 'r-bad-and',
        phase: 'entry',
        sideScope: 'long',
        condition: {
          kind: 'and',
          children: [
            { kind: 'atom', key: '', params: {} },
            { kind: 'atom', key: '', params: {} },
          ],
        },
        effects: [],
      },
    ])
    expect(result.rules).toHaveLength(0)
    expect(result.quarantine).toHaveLength(1)
    // 路径必须精确到具体 child + 字段（不再是 "condition: pruned to empty"）
    expect(result.quarantine[0].errorPath).toMatch(/condition\.children\[\d+\]\.key/)
  })

  it('SEQUENCE.steps[M].kind 非法 → errorPath 精确到 steps[M]', () => {
    const result = svc.validatePlannerRules([
      {
        id: 'r-seq-bad',
        phase: 'entry',
        sideScope: 'long',
        condition: {
          kind: 'sequence',
          steps: [
            { kind: 'atom', key: 'ok', params: {} },
            { kind: 'WRONG_KIND' as never, key: 'x', params: {} } as never,
          ],
        },
        effects: [],
      },
    ])
    expect(result.rules).toHaveLength(0)
    expect(result.quarantine).toHaveLength(1)
    // 精度到具体字段（区分 condition.steps[1] 与 condition.steps[1].kind）
    expect(result.quarantine[0].errorPath).toMatch(/condition\.steps\[1\]\.kind/)
  })

  it('NOT.child 失效 → errorPath 含 condition.child', () => {
    const result = svc.validatePlannerRules([
      {
        id: 'r-not',
        phase: 'entry',
        sideScope: 'long',
        condition: { kind: 'not', child: { kind: 'atom', key: '', params: {} } },
        effects: [],
      },
    ])
    expect(result.rules).toHaveLength(0)
    expect(result.quarantine).toHaveLength(1)
    expect(result.quarantine[0].errorPath).toMatch(/condition\.child\.key/)
  })

  it('OR.children[1].sideScope 非法枚举 → 精确报路径', () => {
    const out = pruneAtomExprWithErrors({
      kind: 'or',
      children: [
        { kind: 'atom', key: 'a', params: {}, sideScope: 'long' },
        { kind: 'atom', key: 'b', params: {}, sideScope: 'NOT_A_SIDE' },
      ],
    }, 'condition')
    // 单 leaf 报路径，整体退化为唯一 valid child
    const sideScopeErr = out.errors.find(e => e.path === 'condition.children[1].sideScope')
    expect(sideScopeErr).toBeDefined()
    expect(out.result?.kind).toBe('atom')
  })

  it('header 失败错误路径精确到字段（id/phase/sideScope）', () => {
    const result = svc.validatePlannerRules([
      { id: '', phase: 'WRONG', sideScope: 'long', condition: { kind: 'atom', key: 'a', params: {} }, effects: [] },
    ])
    expect(result.quarantine).toHaveLength(1)
    // 旧实现是 "header: path=phase code=..."；新实现是 "id: too_small; phase: invalid_..."
    expect(result.quarantine[0].errorPath).toMatch(/id|phase/)
    expect(result.quarantine[0].errorPath).not.toMatch(/^header:/)
  })

  it('嵌套 AND(OR(...), atom) 多级路径：condition.children[0].children[1].key 精确穿透', () => {
    // 现网真实 LLM 幻觉常嵌套出现（OR 内含坏 leaf），路径穿透必须保留全链
    const result = svc.validatePlannerRules([
      {
        id: 'r-nested',
        phase: 'entry',
        sideScope: 'long',
        condition: {
          kind: 'and',
          children: [
            {
              kind: 'or',
              children: [
                { kind: 'atom', key: '', params: {} }, // invalid
                { kind: 'atom', key: '', params: {} }, // invalid
              ],
            },
            { kind: 'atom', key: '', params: {} }, // invalid
          ],
        },
        effects: [],
      },
    ])
    expect(result.rules).toHaveLength(0)
    expect(result.quarantine).toHaveLength(1)
    // errors[0] 应是最具体叶子路径 condition.children[0].children[0].key
    expect(result.quarantine[0].errorPath).toMatch(/condition\.children\[0\]\.children\[\d+\]\.key/)
  })

  it('NOT 内嵌 sequence 整体失败 → errorPath 不被压扁，保留 condition.child.steps[N] 路径', () => {
    const out = pruneAtomExprWithErrors({
      kind: 'not',
      child: {
        kind: 'sequence',
        steps: [
          { kind: 'atom', key: 'ok', params: {} },
          { kind: 'atom', key: '', params: {} }, // invalid
        ],
      },
    }, 'condition')
    expect(out.result).toBeNull()
    // 多级路径不应被压扁为 condition.child 或 condition
    expect(out.errors.some(e => /^condition\.child\.steps\[1\]\.key$/.test(e.path))).toBe(true)
    // errors[errors.length-1] 应是顶层 not 的聚合 pruned_to_empty 根因
    const last = out.errors[out.errors.length - 1]
    expect(last.reason === 'pruned_to_empty' || last.reason === 'sequence_step_invalid').toBe(true)
  })

  it('AND 退化保留时 errors 含被丢弃 child 的 warning 路径（result !== null 不丢诊断）', () => {
    const out = pruneAtomExprWithErrors({
      kind: 'and',
      children: [
        { kind: 'atom', key: 'valid', params: {} },
        { kind: 'atom', key: '', params: {} }, // invalid → 被丢弃
      ],
    }, 'condition')
    expect(out.result?.kind).toBe('atom') // 退化为唯一 valid child
    // 被丢弃 child 的 path 应仍在 errors 里，供观测层做 warning 分流
    expect(out.errors.some(e => e.path === 'condition.children[1].key')).toBe(true)
  })
})

// 5 个 kind schema 各自命名导出的成功/失败用例
describe('Issue #1399 — 5 个 kind schema 各自 parse', () => {
  it('atomSchema：成功 + 失败 path 落在 key/kind 字段', () => {
    expect(atomSchema.safeParse({ kind: 'atom', key: 'a', params: {} }).success).toBe(true)
    const bad = atomSchema.safeParse({ kind: 'atom', key: '', params: {} })
    expect(bad.success).toBe(false)
    if (!bad.success) {
      expect(bad.error.issues.some(i => i.path.includes('key'))).toBe(true)
    }
  })

  it('andSchema：children.length=1 → fail（min=2）', () => {
    const ok = andSchema.safeParse({
      kind: 'and',
      children: [
        { kind: 'atom', key: 'a', params: {} },
        { kind: 'atom', key: 'b', params: {} },
      ],
    })
    expect(ok.success).toBe(true)
    const bad = andSchema.safeParse({
      kind: 'and',
      children: [{ kind: 'atom', key: 'a', params: {} }],
    })
    expect(bad.success).toBe(false)
  })

  it('orSchema：成功 + 路由到 or 分支', () => {
    const ok = orSchema.safeParse({
      kind: 'or',
      children: [
        { kind: 'atom', key: 'a', params: {} },
        { kind: 'atom', key: 'b', params: {} },
      ],
    })
    expect(ok.success).toBe(true)
  })

  it('notSchema：child 缺失 → fail', () => {
    const ok = notSchema.safeParse({
      kind: 'not',
      child: { kind: 'atom', key: 'a', params: {} },
    })
    expect(ok.success).toBe(true)
    const bad = notSchema.safeParse({ kind: 'not' })
    expect(bad.success).toBe(false)
  })

  it('sequenceSchema：成功 + steps[0] 非对象失败路径落 steps[0]', () => {
    const ok = sequenceSchema.safeParse({
      kind: 'sequence',
      steps: [
        { kind: 'atom', key: 'a', params: {} },
        { kind: 'atom', key: 'b', params: {} },
      ],
    })
    expect(ok.success).toBe(true)
    const bad = sequenceSchema.safeParse({
      kind: 'sequence',
      steps: [
        'not-an-object',
        { kind: 'atom', key: 'b', params: {} },
      ],
    })
    expect(bad.success).toBe(false)
    if (!bad.success) {
      expect(bad.error.issues.some(i => i.path[0] === 'steps' && i.path[1] === 0)).toBe(true)
    }
  })

  it('atomExprSchema discriminatedUnion：通过 kind 路由到对应分支', () => {
    expect(atomExprSchema.safeParse({ kind: 'atom', key: 'a', params: {} }).success).toBe(true)
    expect(atomExprSchema.safeParse({
      kind: 'not',
      child: { kind: 'atom', key: 'a', params: {} },
    }).success).toBe(true)
    // unknown kind → discriminated union 直接 fail，issue 落在 kind 字段
    const bad = atomExprSchema.safeParse({ kind: 'xor', children: [] })
    expect(bad.success).toBe(false)
  })
})
