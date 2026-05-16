import { buildConversationPlannerSystemPrompt } from '../conversation-planner-system.prompt'
import { ATOM_CONTRACT_REGISTRY } from '../../atom-contracts/atom-contract-registry'
import type { AtomContractSurface } from '../../atom-contracts/atom-contract-surface.types'

// 类型工具：把 ATOM_CONTRACT_REGISTRY[*].surface union 向上拓宽到 AtomContractSurface
//   基类，让 TS 识别可选字段 phraseHints。未声明 phraseHints 的 atom 直接拿 undefined。
function surfaceOf(atom: typeof ATOM_CONTRACT_REGISTRY[keyof typeof ATOM_CONTRACT_REGISTRY]): AtomContractSurface {
  return atom.surface as AtomContractSurface
}

describe('issue #1395 — planner prompt rules shape', () => {
  it('emits rules[] in JSON shape block (zh)', () => {
    const prompt = buildConversationPlannerSystemPrompt('zh')
    expect(prompt).toContain('"rules"?:')
    expect(prompt).toContain('"condition":')
    expect(prompt).toContain('"effects":')
  })

  it('emits AtomExpr BNF', () => {
    const prompt = buildConversationPlannerSystemPrompt('zh')
    expect(prompt).toContain('AtomExpr')
    expect(prompt).toContain('"kind": "and"')
    expect(prompt).toContain('"kind": "or"')
    expect(prompt).toContain('"kind": "not"')
    expect(prompt).toContain('"kind": "sequence"')
  })

  it('contains 5 in-context examples', () => {
    const prompt = buildConversationPlannerSystemPrompt('zh')
    expect(prompt).toContain('【单叶子】')
    expect(prompt).toContain('【AND】')
    expect(prompt).toContain('【OR 出场】')
    expect(prompt).toContain('【SEQUENCE】')
    expect(prompt).toContain('【嵌套 + 多周期 AND】')
  })

  it('contains S3 composite example (MA gate AND + RSI sequence)', () => {
    const prompt = buildConversationPlannerSystemPrompt('zh')
    expect(prompt).toContain('【S3 复合：MA gate AND + RSI 跌破后重新上穿 sequence】')
    expect(prompt).toContain('oscillator.rsi_lte')
    expect(prompt).toContain('indicator.cross_over')
  })

  it('contains AND vs OR vs SEQUENCE 辨析 + 去重示范', () => {
    const prompt = buildConversationPlannerSystemPrompt('zh')
    expect(prompt).toContain('【AND vs OR vs SEQUENCE 辨析】')
    expect(prompt).toContain('【去重示范】')
  })

  it('contains NEGATIVE_EXAMPLES 段 + 禁律', () => {
    const prompt = buildConversationPlannerSystemPrompt('zh')
    expect(prompt).toContain('NEGATIVE_EXAMPLES')
    // 禁止拆 sequence
    expect(prompt).toContain('把「A 后 B」拆成两条独立 entry rule')
    // 禁止拆 AND
    expect(prompt).toContain('把「A 同时 B」拆成两条独立 entry rule')
    // 禁止编造 params
    expect(prompt).toContain('编造 atom paramSlots 没声明的 params 值')
    // 禁止 atom key 不存在
    expect(prompt).toContain('输出 atom key 不存在的原子')
    // S8 幻觉禁止
    expect(prompt).toContain('S8 多周期幻觉')
  })

  // Issue #1403 通用化 v2：ATOM_PARAMS_HINTS 段必含从 registry 派生的标准参数提示。
  // 不再硬编码具体策略短语；只断言 prompt 包含 registry 里声明了 paramDefaultsHint 的 atom 的提示词。
  it('ATOM_PARAMS_HINTS 段从 registry 派生（含至少一条标准参数提示）', () => {
    const prompt = buildConversationPlannerSystemPrompt('zh')
    expect(prompt).toContain('ATOM_PARAMS_HINTS')
    // 自 registry 派生：MACD / RSI / Bollinger / ATR / MA 等任一 paramDefaultsHint 必须出现
    const declaredDefaults = Object.values(ATOM_CONTRACT_REGISTRY)
      .map(atom => surfaceOf(atom).phraseHints?.paramDefaultsHint)
      .filter((s): s is string => typeof s === 'string' && s.length > 0)
    expect(declaredDefaults.length).toBeGreaterThan(0)
    for (const hint of declaredDefaults) {
      expect(prompt).toContain(hint)
    }
  })

  // Issue #1428 R-E：ATOM_PARAMS_HINTS 段必须含「用户原话 > 默认值」硬约束 + 至少 3 个具体反例
  it('R-E: ATOM_PARAMS_HINTS 段含「用户原话 > paramDefaultsHint」硬约束 + BOLL/percent_change/ATR 反例', () => {
    const prompt = buildConversationPlannerSystemPrompt('zh')
    // 硬约束 header
    expect(prompt).toContain('Issue #1428 硬约束')
    expect(prompt).toContain('必须以用户原话为准')
    expect(prompt).toContain('禁止使用下面列出的 paramDefaultsHint 默认值覆盖用户输入')
    // 三个具体反例
    expect(prompt).toContain('布林带 5,1')
    expect(prompt).toContain('止盈 1.5%')
    expect(prompt).toContain('3 分钟跌 1%')
    // 仅当用户完全没给 param 才允许走默认值
    expect(prompt).toContain('仅当用户完全没有给出对应 param 时')
  })

  it('保留跨原子组合 TRIGGER hint (sequence「跌破 X 后重新上穿 X」+ multi-tf + breakout retest)', () => {
    const prompt = buildConversationPlannerSystemPrompt('zh')
    // 「跌破 X 后重新上穿 X」短语由 condition.sequence atom 自身的 phraseHints.triggers 暴露
    expect(prompt).toContain('跌破 X 后重新上穿 X')
    // 跨原子组合形态：breakout + retest 仍在 prompt 中（compositional pattern，非单 atom）
    expect(prompt).toContain('回踩')
    // 多周期共振 compositional hint
    expect(prompt).toContain('多周期共振')
  })

  it('does not contain legacy atoms[] schema', () => {
    const prompt = buildConversationPlannerSystemPrompt('zh')
    // 旧 schema 有 "atoms":[{ "key": string, "phase": ... }] 形态；新 prompt 不应再用
    expect(prompt).not.toContain('"atoms"?:')
  })

  it('en locale also emits rules shape', () => {
    const prompt = buildConversationPlannerSystemPrompt('en')
    expect(prompt).toContain('"rules"?:')
  })

  // Issue #1403 通用化 v2 — registry-derived 验证：
  //   1) ATOM_CONTRACT_REGISTRY 内任一 atom 声明了 phraseHints.triggers，其 keywords[0] 必出现在 prompt；
  //   2) atom 声明的 paramDefaultsHint 必出现在 prompt；
  //   3) atom 声明的 antiPatterns.mistake 必出现在 prompt（以 atom key 标注）。
  // 这把「加 atom = prompt 自动更新」从注释约定提升为编译期 + 单测期硬门禁。
  describe('Issue #1403 v2 — prompt 派生自 ATOM_CONTRACT_REGISTRY.surface.phraseHints', () => {
    const prompt = buildConversationPlannerSystemPrompt('zh')

    it('每个声明 phraseHints.triggers 的 atom，其首个 keyword 都出现在 prompt 中', () => {
      const declared: Array<{ key: string, firstKeyword: string }> = []
      for (const [key, atom] of Object.entries(ATOM_CONTRACT_REGISTRY)) {
        const triggers = surfaceOf(atom).phraseHints?.triggers
        if (!triggers || triggers.length === 0) continue
        const firstKw = triggers[0]?.keywords[0]
        if (firstKw) declared.push({ key, firstKeyword: firstKw })
      }
      expect(declared.length).toBeGreaterThan(0)
      for (const { key, firstKeyword } of declared) {
        expect(prompt).toContain(firstKeyword)
        // mustOutput 必出现
        const atom = ATOM_CONTRACT_REGISTRY[key as keyof typeof ATOM_CONTRACT_REGISTRY]
        const triggers = surfaceOf(atom).phraseHints?.triggers
        for (const t of triggers ?? []) {
          expect(prompt).toContain(t.mustOutput)
        }
      }
    })

    it('每个声明 antiPatterns 的 atom，其条款都以 atom key 标签出现在 prompt 中', () => {
      const declared: Array<{ key: string, mistake: string, fix: string }> = []
      for (const [key, atom] of Object.entries(ATOM_CONTRACT_REGISTRY)) {
        const aps = surfaceOf(atom).phraseHints?.antiPatterns
        for (const ap of aps ?? []) {
          declared.push({ key, mistake: ap.mistake, fix: ap.fix })
        }
      }
      // 至少 1 条 antiPattern（当前 price.candle_pattern / volume.threshold 已声明）
      expect(declared.length).toBeGreaterThan(0)
      for (const { key, mistake, fix } of declared) {
        expect(prompt).toContain(`atom \`${key}\``)
        expect(prompt).toContain(mistake)
        expect(prompt).toContain(fix)
      }
    })

    it('PLANNER_CORRECTION_META 段仅含通用纠错原则，不含策略级硬编码短语', () => {
      // 仍保留通用纠错段
      expect(prompt).toContain('通用纠错（Issue #1403）')
      expect(prompt).toContain('拒绝 dispatcher noisy lift 退化')
      expect(prompt).toContain('Issue #1403')
      // 原硬编码的「连续 N 根」「nextBarOnly」「放量反弹」短语应通过 registry 而非 PLANNER_CORRECTION 段进入 prompt
      //   —— 仍出现在 prompt 中（因为对应 atom 的 phraseHints 派生），但来源是 registry
      //   而非 PLANNER_CORRECTION_RULES hand-written 段。本 spec 不再断言 PLANNER_CORRECTION
      //   内含具体策略短语；只断言「meta 原则」存在 + 「registry 派生段标识」出现。
      expect(prompt).toContain('自 ATOM_CONTRACT_REGISTRY 派生')
    })
  })
})
