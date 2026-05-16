import { buildConversationPlannerSystemPrompt } from '../conversation-planner-system.prompt'

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

  it('contains ATOM_PARAMS_HINTS 段（MACD 12/26/9 等标准默认值）', () => {
    const prompt = buildConversationPlannerSystemPrompt('zh')
    expect(prompt).toContain('ATOM_PARAMS_HINTS')
    expect(prompt).toContain('{ fast: 12, slow: 26, signal: 9 }')
    expect(prompt).toContain('{ period: 14 }')
    expect(prompt).toContain('{ period: 20, stdDev: 2 }')
  })

  it('contains TRIGGER hint for 跌破 X 后重新上穿 X', () => {
    const prompt = buildConversationPlannerSystemPrompt('zh')
    expect(prompt).toContain('跌破 X 后重新上穿 X')
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
})
