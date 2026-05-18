/**
 * Issue #1495 — UI/澄清/unsupported 全部从 rules tree 派生，禁止 internal key 泄漏
 *
 * 防退化护栏：扫描三个 user-facing 文案产生面，断言不含 atom internal key
 * （含 dot 的小写标识符，如 `oscillator.rsi_lte` / `bollinger.touch_lower`），
 * 也不含 `contract.required` / `fieldPath` 这类内部 slot key 字面量。
 *
 * 覆盖：
 *   1) SemanticRuleProjectionService.projectToFlat 产出的 openSlots[].questionHint
 *      （Step 1 修复点：deriveOwnerMetadata fallback 不再含 atomKey/slotKey 插值）
 *   2) SemanticClarificationQuestionRendererService.renderStructured 产出的
 *      question / slotLabel / examples（sanitizeFallback 兜底）
 *   3) UnsupportedFallbackService.buildPendingFallback 产出的 prompt
 *
 * 与 #1279 PR3c.11 internal-key-leak-guard-projection.spec.ts 互补：
 *   - 那个 spec 扫描 buildConversationView 的 summary/trigger/risk/positionSummary
 *   - 本 spec 扫描 openSlots 的 questionHint 与 clarification renderer + unsupported prompt
 */

import type { SemanticRule } from '../../types/atom-expr'
import { ATOM_CONTRACT_REGISTRY } from '../../atom-contracts/atom-contract-registry'
import { SemanticClarificationQuestionRendererService } from '../semantic-clarification-question-renderer.service'
import { SemanticRuleProjectionService } from '../semantic-rule-projection.service'
import { UnsupportedFallbackService } from '../unsupported-fallback.service'

// ─────────────────────────────────────────────────────────────────────────────
// helpers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * 检测含 dot 的 atom internal key 形态：如 `oscillator.rsi_lte`、`bollinger.touch_lower`、
 * `price.percent_change`。要求两端有边界（避免误伤标点附近的版本号 `1.0` 等），
 * 但 dotted segment 必须以英文字母开头，segment 间用 dot 连接。
 */
function containsInternalAtomKey(text: string): boolean {
  return /(?:^|[^\w.])(?:[a-z][a-z0-9_]*\.)+[a-z][a-z0-9_]*(?=$|[^\w.])/u.test(text)
}

function containsInternalSlotLiteral(text: string): boolean {
  return /contract\.required|\bfieldPath\b/u.test(text)
}

function assertNoInternalLeak(text: string, label: string): void {
  if (containsInternalAtomKey(text)) {
    throw new Error(`[${label}] 文本含 internal atom key 泄漏: "${text}"`)
  }
  if (containsInternalSlotLiteral(text)) {
    throw new Error(`[${label}] 文本含 contract.required / fieldPath 内部字面量: "${text}"`)
  }
}

function listAtomsWithRequiredSlots(): string[] {
  const keys: string[] = []
  for (const [key, entry] of Object.entries(ATOM_CONTRACT_REGISTRY as Record<string, unknown>)) {
    const paramSlots = (entry as { surface?: { paramSlots?: Record<string, { required?: boolean }> } } | undefined)?.surface?.paramSlots
    if (!paramSlots) continue
    const hasRequired = Object.values(paramSlots).some(slot => slot?.required === true)
    if (hasRequired) keys.push(key)
  }
  return keys
}

// ─────────────────────────────────────────────────────────────────────────────
// suite
// ─────────────────────────────────────────────────────────────────────────────

// ─────────────────────────────────────────────────────────────────────────────
// scope 说明（Issue #1495-M4）
//
// 本 spec **仅扫 user-visible 文案字段**：
//   - openSlots[].questionHint（projection）
//   - clarification renderer 的 question / slotLabel / examples
//   - unsupported fallback 的 prompt
//
// **不在 scope** 的字段（DTO 结构化字段，依赖 controller 层 sanitize）：
//   - slotKey / fieldPath / atomKey 属性本身（这些是 backend internal 标识，
//     controller 在序列化到 wire 时会另外做 sanitize；本 spec 不替它兜底）
//   - rules tree / atom-expr 结构里的 key 字段
//
// 如果未来引入新的 user-visible 文案产生面，需扩展本 spec 的扫描入口，
// 但保持「只扫文案、不扫结构化字段」的边界。
// ─────────────────────────────────────────────────────────────────────────────

describe('#1495 internal-key-leak invariant', () => {
  // Issue #1495-M4: atom key 命名约束 invariant
  //   regex `containsInternalAtomKey` 假设 atom key 全部以小写字母开头；
  //   未来若有 PascalCase 或大写起首的 atom key，必须同步更新该 regex，否则会漏报泄漏。
  //   这里加一道护栏，提早暴露不一致。
  it('#1495-M4 ATOM_CONTRACT_REGISTRY 所有 key 都以小写字母开头（与 leak 检测 regex 约束一致）', () => {
    const keys = Object.keys(ATOM_CONTRACT_REGISTRY)
    expect(keys.length).toBeGreaterThan(0)
    const offenders = keys.filter(k => !/^[a-z]/.test(k))
    expect(offenders).toEqual([])
  })


  describe('SemanticRuleProjectionService.projectToFlat openSlots[].questionHint', () => {
    const projection = new SemanticRuleProjectionService()
    const atomKeys = listAtomsWithRequiredSlots()

    it('registry 中至少存在一个含 required slot 的 atom（防止 fixture 退化空跑）', () => {
      expect(atomKeys.length).toBeGreaterThan(0)
    })

    for (const atomKey of atomKeys) {
      it(`atom=${atomKey} 缺失 required slot 时 openSlots.questionHint 不泄漏 internal key`, () => {
        // 故意传空 params 触发 required slot missing → 走 deriveOwnerMetadata fallback 路径
        const rule: SemanticRule = {
          id: `r-${atomKey.replace(/[^a-z0-9]/gi, '_')}`,
          phase: 'entry',
          sideScope: 'both',
          condition: { kind: 'atom', key: atomKey, params: {} },
          effects: [],
        }
        const out = projection.projectToFlat([rule])
        // condition 投到 trigger 桶
        const allOpenSlots = [
          ...out.trigger.flatMap(t => t.openSlots ?? []),
          ...out.action.flatMap(a => a.openSlots ?? []),
          ...out.risk.flatMap(r => r.openSlots ?? []),
          ...out.positionConstraint.flatMap(p => p.openSlots ?? []),
          ...out.orchestration.flatMap(o => o.openSlots ?? []),
        ]
        for (const slot of allOpenSlots) {
          assertNoInternalLeak(slot.questionHint, `projection:${atomKey}:${slot.slotKey}`)
        }
      })
    }
  })

  describe('SemanticClarificationQuestionRendererService.renderStructured', () => {
    const renderer = new SemanticClarificationQuestionRendererService()

    // 构造一组可能从 deriveOwnerMetadata 流出的 fallback 文案（含历史误用 internal key 的形态），
    // 让 sanitizeFallback 兜底；以及 atom-driven slotKey 形态。
    const cases: Array<{ slotKey: string, fallback: string, label: string }> = [
      { slotKey: 'oscillator.rsi_lte.value', fallback: '请补充 oscillator.rsi_lte 的 value 参数。', label: 'legacy-fallback-with-atomkey' },
      { slotKey: 'bollinger.touch_lower.period', fallback: '请补充 bollinger.touch_lower 的 period 参数。', label: 'legacy-fallback-with-atomkey-2' },
      { slotKey: 'price.percent_change.valuePct', fallback: '请补充该条件的参数。', label: 'safe-fallback' },
      { slotKey: 'trigger.entry', fallback: '请补充入场触发条件。', label: 'known-slot' },
    ]

    for (const { slotKey, fallback, label } of cases) {
      it(`case=${label} renderStructured(zh) 不泄漏 internal key`, () => {
        const out = renderer.renderStructured({ slotKey, fallback }, 'zh')
        assertNoInternalLeak(out.question, `renderer-zh:${label}:question`)
        assertNoInternalLeak(out.slotLabel, `renderer-zh:${label}:slotLabel`)
        for (const ex of out.examples) {
          assertNoInternalLeak(ex, `renderer-zh:${label}:example`)
        }
      })

      it(`case=${label} renderStructured(en) 不泄漏 internal key`, () => {
        const out = renderer.renderStructured({ slotKey, fallback }, 'en')
        assertNoInternalLeak(out.question, `renderer-en:${label}:question`)
        assertNoInternalLeak(out.slotLabel, `renderer-en:${label}:slotLabel`)
        for (const ex of out.examples) {
          assertNoInternalLeak(ex, `renderer-en:${label}:example`)
        }
      })
    }
  })

  describe('#1495-M1 publicName fallback chain 防 空字符串短路', () => {
    // 回归点：原代码 ?? 链对空字符串不短路 → publicName.zh = '' 会被采用，导致 questionHint = '请补充的参数。'
    // 修复后改用 trim() || 兜底链，空串 / 全空白都跳到下一兜底
    const projection = new SemanticRuleProjectionService()
    // 选一个含 required slot 的 atom；mutate display.publicName 模拟数据退化
    const targetAtomKey = 'oscillator.rsi_lte'
    const registryAny = ATOM_CONTRACT_REGISTRY as unknown as Record<string, { display: { publicName: { zh?: string, en?: string } }, clarificationQuestion?: unknown }>
    let originalPublicName: { zh?: string, en?: string }
    let originalClarification: unknown
    beforeEach(() => {
      originalPublicName = { ...registryAny[targetAtomKey].display.publicName }
      originalClarification = registryAny[targetAtomKey].clarificationQuestion
      // 禁用 contract clarificationQuestion，强制走 fallback 路径
      registryAny[targetAtomKey].clarificationQuestion = undefined
    })
    afterEach(() => {
      registryAny[targetAtomKey].display.publicName = originalPublicName
      registryAny[targetAtomKey].clarificationQuestion = originalClarification as never
    })

    function projectAndCollectHints(): string[] {
      const rule: SemanticRule = {
        id: 'r-m1',
        phase: 'entry',
        sideScope: 'both',
        condition: { kind: 'atom', key: targetAtomKey, params: {} },
        effects: [],
      }
      const out = projection.projectToFlat([rule])
      return [
        ...out.trigger.flatMap(t => t.openSlots ?? []),
        ...out.action.flatMap(a => a.openSlots ?? []),
        ...out.risk.flatMap(r => r.openSlots ?? []),
        ...out.positionConstraint.flatMap(p => p.openSlots ?? []),
        ...out.orchestration.flatMap(o => o.openSlots ?? []),
      ].map(s => s.questionHint)
    }

    it('publicName.zh = "" 且 en 非空 → questionHint 走 en 兜底（含 en 文本，不出现「补充的参数」）', () => {
      registryAny[targetAtomKey].display.publicName = { zh: '', en: 'RSI Below' }
      const hints = projectAndCollectHints()
      expect(hints.length).toBeGreaterThan(0)
      for (const hint of hints) {
        expect(hint).toContain('RSI Below')
        expect(hint).not.toMatch(/^请补充的参数。$/)
      }
    })

    it('publicName.zh = "" 且 en = "" → questionHint 走「该条件」兜底', () => {
      registryAny[targetAtomKey].display.publicName = { zh: '', en: '' }
      const hints = projectAndCollectHints()
      expect(hints.length).toBeGreaterThan(0)
      for (const hint of hints) {
        expect(hint).toContain('该条件')
        expect(hint).not.toMatch(/^请补充的参数。$/)
      }
    })

    it('publicName.zh = "   "（全空白）→ trim 后视为空，走 en 兜底', () => {
      registryAny[targetAtomKey].display.publicName = { zh: '   ', en: 'RSI Below' }
      const hints = projectAndCollectHints()
      expect(hints.length).toBeGreaterThan(0)
      for (const hint of hints) {
        expect(hint).toContain('RSI Below')
      }
    })
  })

  describe('UnsupportedFallbackService.buildPendingFallback', () => {
    const svc = new UnsupportedFallbackService()

    // 模拟 dispatcher 抛出的 unsupported atom 输入，displayName 是 user-facing 名，
    // publicReason 也是 user-facing；key/reasonCode 仅供 reasoning，禁止漏到 prompt。
    // 使用 SemanticAtomRegistryService 已注册 + 有 replacement 的 unsupported atom key
    const unsupportedAtoms = [
      {
        key: 'volume.spike',
        displayName: '成交量放大',
        reasonCode: 'volume_condition_public_beta_unsupported',
        publicReason: '成交量条件当前公测暂未支持生成和回测。',
      },
    ]

    it('zh prompt 不泄漏 internal key（atomKey 不能出现在 user-facing 文案）', () => {
      const out = svc.buildPendingFallback(unsupportedAtoms, [], 'zh')
      expect(out).not.toBeNull()
      assertNoInternalLeak(out!.prompt, 'unsupported-zh:prompt')
      expect(out!.prompt).toContain('成交量放大')
      expect(out!.prompt).not.toContain('volume.spike')
    })

    it('en prompt 不泄漏 internal key（#1495 修复点：EN locale 也用 displayName）', () => {
      const out = svc.buildPendingFallback(unsupportedAtoms, [], 'en')
      expect(out).not.toBeNull()
      assertNoInternalLeak(out!.prompt, 'unsupported-en:prompt')
      expect(out!.prompt).not.toContain('volume.spike')
    })
  })
})
