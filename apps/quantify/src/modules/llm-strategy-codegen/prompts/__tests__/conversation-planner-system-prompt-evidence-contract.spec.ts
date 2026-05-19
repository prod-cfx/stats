/**
 * Issue #1550 — planner prompt 与 validator 之间的 evidence.text 契约守门。
 *
 * 真实 LLM rules-first 入口失败的根因：prompt 没有声明 rules[].evidence.text 必填，
 * LLM 按 prompt 输出时省略 evidence；随后 PlannerDispatcherMergeService.
 * validatePlannerSemanticPatch() 因 evidence_text_missing reject，进入单轮重试；
 * 初始 prompt 不变又重新 reject → 走 unsupported fallback。
 *
 * 本 spec 把 "prompt 必须声明 evidence.text + 所有 in-context examples 都示范 evidence.text"
 * 钉死，防止后续编辑漂移再次破坏契约。
 */
import { buildConversationPlannerSystemPrompt } from '../conversation-planner-system.prompt'
import { PlannerDispatcherMergeService } from '../../services/planner-dispatcher-merge.service'

describe('conversation-planner-system prompt ↔ validator evidence.text 契约 (issue #1550)', () => {
  it('JSON_SHAPE_BLOCK 显式声明 rules[].evidence.text 必填', () => {
    const prompt = buildConversationPlannerSystemPrompt('zh')
    // evidence 字段在 JSON shape 中必须出现，且与 text:string 一起声明
    expect(prompt).toMatch(/"evidence"\s*:\s*\{\s*"text"\s*:\s*string\s*\}/)
    // 硬约束说明必须提及"硬校验字段"与"连续原文子串"两个关键词
    expect(prompt).toContain('rules[].evidence.text 硬校验字段')
    expect(prompt).toContain('连续原文子串')
  })

  it('terminal rule 列出 evidence.text 必填 + substring 约束（与 reject reminder 一致）', () => {
    const prompt = buildConversationPlannerSystemPrompt('zh')
    expect(prompt).toContain('每条 rule 必须含 evidence.text')
    expect(prompt).toMatch(/连续原文子串/)
    expect(prompt).toMatch(/服务端硬校验拒绝/)
  })

  it('atom catalog 字段规范段同时声明 rules[].evidence 必填', () => {
    const prompt = buildConversationPlannerSystemPrompt('zh')
    expect(prompt).toContain('evidence（{ text: string }，必填，user message 连续原文子串）')
  })

  it('en prompt 同样保留 evidence.text 契约（不能因 locale 漂移）', () => {
    const prompt = buildConversationPlannerSystemPrompt('en')
    expect(prompt).toMatch(/"evidence"\s*:\s*\{\s*"text"\s*:\s*string\s*\}/)
    expect(prompt).toContain('rules[].evidence.text 硬校验字段')
  })

  it('所有 in-context examples 中的 rule 都示范 evidence.text（不再诱导 LLM 漏字段）', () => {
    const prompt = buildConversationPlannerSystemPrompt('zh')
    // 启发式：所有出现 `"id":` + `"phase":` 的 example 段，紧随其后的几行内必须看到 `"evidence":`。
    //
    // 实现方式：把 prompt 切成 in-context example 片段（以 `"id":` 为锚点向后取 ~22 行），
    // 检查每个片段内是否含 evidence 声明。
    const lines = prompt.split('\n')
    const exampleRuleAnchors: number[] = []
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]
      if (/"id"\s*:\s*"(entry|exit)-[\w-]+"/.test(line) && /"phase"\s*:\s*"(entry|exit|gate)"/.test(line)) {
        exampleRuleAnchors.push(i)
      }
    }
    expect(exampleRuleAnchors.length).toBeGreaterThanOrEqual(10)

    for (const idx of exampleRuleAnchors) {
      const window = lines.slice(idx, Math.min(idx + 24, lines.length)).join('\n')
      // 每个 example rule 24 行窗口内必须含 evidence: { text: "..." }
      expect({ ruleAtLine: idx + 1, hasEvidence: /"evidence"\s*:\s*\{\s*"text"\s*:\s*"/.test(window) })
        .toEqual({ ruleAtLine: idx + 1, hasEvidence: true })
    }
  })

  it('prompt 内每个 example evidence.text 值必须能在该 example 注释里的 user 原话中找到（子串 self-check）', () => {
    // 这一项守的是 prompt 内部自洽：每个 example 把"用户原话"写在前面注释中，
    // 紧随其后给出 rules[]；rules[].evidence.text 应是该用户原话的子串。
    // 否则我们就在示范 LLM 输出 non-substring evidence，引导继续漂移。
    const prompt = buildConversationPlannerSystemPrompt('zh')
    const lines = prompt.split('\n')

    // 解析所有 `用户："..."` 片段及其行号
    // Major M3 修复：example 范围由【...】section 头部界定。
    //   NEGATIVE_EXAMPLES 段也用 `用户："..."` 字面（反例），不能作为 example evidence 的 owner。
    //   只在「example 段头部 (`【...】`) → 下一个 section 头部」之间寻找 owner，
    //   并且要求 owner 出现在 example 内部 evidence 之前。
    type UserBlock = { startLine: number, endLine: number, text: string }
    const userBlocks: UserBlock[] = []
    // 找所有 example section 头部锚点（行首零或多空格 + 【xxx】）；NEGATIVE_EXAMPLES 段的
    // 头部是 `⛔ NEGATIVE_EXAMPLES`，不以【】开头，自然被排除。
    const sectionAnchors: number[] = []
    for (let i = 0; i < lines.length; i++) {
      if (/^\s*【[^】]+】/.test(lines[i])) sectionAnchors.push(i)
    }
    expect(sectionAnchors.length).toBeGreaterThanOrEqual(8)

    // 每个 example section 内只取第一条 `用户："..."`，section 范围 = 当前 anchor → 下一个 anchor 前
    for (let s = 0; s < sectionAnchors.length; s++) {
      const start = sectionAnchors[s]
      const end = s + 1 < sectionAnchors.length ? sectionAnchors[s + 1] : lines.length
      for (let i = start; i < end; i++) {
        const m = lines[i].match(/用户[：:]\s*"([^"]+)"/)
        if (m) {
          userBlocks.push({ startLine: i, endLine: end - 1, text: m[1] })
          break  // 一个 example 段只认第一条 user 原话
        }
      }
    }
    expect(userBlocks.length).toBeGreaterThanOrEqual(8)

    // 解析所有 evidence.text 字面量及行号
    type Evidence = { line: number, text: string }
    const evidences: Evidence[] = []
    for (let i = 0; i < lines.length; i++) {
      const m = lines[i].match(/"evidence"\s*:\s*\{\s*"text"\s*:\s*"([^"]+)"\s*\}/)
      if (m) evidences.push({ line: i, text: m[1] })
    }
    expect(evidences.length).toBeGreaterThanOrEqual(10)

    // 对每个 evidence：owner = 「同一个 example section 内、startLine < evLine 的 userBlock」。
    // 避免落到 NEGATIVE_EXAMPLES 段的 user 反例字符串上（NEGATIVE 段不属于 example anchor）。
    for (const ev of evidences) {
      const owner = userBlocks.find(ub => ub.startLine < ev.line && ev.line <= ub.endLine)
      expect({ evidenceLine: ev.line + 1, ownerFound: !!owner })
        .toEqual({ evidenceLine: ev.line + 1, ownerFound: true })
      if (!owner) continue
      // Minor m7：与 validator 一致，evidence.text 子串校验前先 trim
      const evText = ev.text.trim()
      const isSubstring = owner.text.includes(evText)
      expect({
        evidenceLine: ev.line + 1,
        evidenceText: evText,
        ownerUserText: owner.text,
        isSubstring,
      }).toEqual(expect.objectContaining({ isSubstring: true }))
    }
  })

  it('prompt 中示范的合规 rule shape 也能通过 validatePlannerSemanticPatch（契约一致性）', () => {
    // 把 prompt 内的 "去重示范" rule 反过来手工重建一份并喂 validator，
    // 验证 prompt 示范与 validator 接受的 shape 是同一份契约（防止 prompt 教 LLM 输出
    // 一种合规形态，但 validator 实际要求另一种）。
    const svc = new PlannerDispatcherMergeService()
    const userMessage = 'MA50 上方且价格在 MA50 上方时买入'
    const patch = {
      rules: [
        {
          id: 'entry-ma50',
          phase: 'entry',
          sideScope: 'long',
          condition: { kind: 'atom', key: 'indicator.above', params: { indicator: 'ma', period: 50 } },
          effects: [{ kind: 'atom', key: 'action.open_long', params: {} }],
          evidence: { text: 'MA50 上方且价格在 MA50 上方时买入' },
        },
      ],
    }
    const result = svc.validatePlannerSemanticPatch(patch, userMessage)
    expect(result.ok).toBe(true)
  })

  it('缺 evidence 的同形态 rule（旧 prompt 示范形态）被 validator 明确拒绝', () => {
    // 反向用例：旧 prompt 漏的就是这种 shape。validator 必须 reject 才能保证
    // 「prompt 不教 LLM 输出这种缺 evidence 的 rule」与「validator fail-closed」两端
    // 锁死，retry 路径才有意义。
    const svc = new PlannerDispatcherMergeService()
    const userMessage = '价格在 EMA20 上方时做多开仓'
    const patch = {
      rules: [
        {
          id: 'entry-ema20',
          phase: 'entry',
          sideScope: 'long',
          condition: { kind: 'atom', key: 'indicator.above', params: { indicator: 'ema', period: 20 } },
          effects: [{ kind: 'atom', key: 'action.open_long', params: {} }],
          // evidence 缺
        },
      ],
    }
    const result = svc.validatePlannerSemanticPatch(patch, userMessage)
    expect(result.ok).toBe(false)
    if (result.ok === false) {
      expect(result.reasons).toContain('evidence_text_missing')
      // reminder 也应直接点名 evidence.text 必填，与新 prompt 表述对齐
      expect(result.reminder).toMatch(/evidence\.text/)
    }
  })
})
