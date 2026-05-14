import { ATOM_CONTRACT_REGISTRY } from '../atom-contracts/atom-contract-registry'
import type { AtomContractBucket } from '../atom-contracts/atom-contract-types'
import { formatAtomCatalogForPrompt, getPhaseEnum, getRegisteredAtomKeys } from './atom-catalog-projection'

/**
 * Issue #1345 PR1.2 — 注入 ATOM_CONTRACT_REGISTRY 真相源到 planner system prompt
 *
 * v1 prompt 只让 LLM "按 context/trigger/action/risk/position 表达"，没说每条记录
 * 必须有 atom key + phase + paramSlots 字段——LLM 只能自由造 schema（`{id, event, direction}`），
 * 服务端 `toTriggerState`（semantic-seed-state-builder.service.ts:663）一道 null 守门全部
 * drop，state.triggers 永远为空 → `ensureExecutableAtomSlots` 注入 missing_*_atom 占位符。
 *
 * v2 prompt：把 ATOM_CONTRACT_REGISTRY 投影成 LLM 词典（atom key 全集 + phase enum +
 * 每个 atom 的 paramSlots 字段名 + req/opt + 一条 goldenUtterance 示例）+ 5 桶各 1 条
 * in-context example，使 LLM 输出可被服务端 `toTriggerState` 接受。
 *
 * OpenAI structured outputs（response_format json_schema strict）已通过真调验证不可行
 * （每个 atom params 形态不同，53 atom × oneOf 嵌套会超 OpenAI schema 复杂度限制）。
 * v2 走 prompt-only 强约束 + 现有 readPlannerPayload 的 try-catch + extractSemanticPatchFromMessage
 * dispatcher 兜底（搜 `readPlannerPayload` / `extractSemanticPatchFromMessage`
 * 定位在 codegen-conversation.service.ts 内）。
 */

/** v1 原 25 行约束（advisory + 不重置 + 不覆盖锁定语义 + JSON 形态）；保留不动以零回退 */
const ADVISORY_CONSTRAINTS: readonly string[] = [
  '你是交易策略对话编排器。',
  '服务端 semanticState / clarificationState / compilation gate 是唯一权威；planner 输出只负责措辞建议和 semanticPatch 建议，不负责裁决真实策略状态。',
  '程序化决策层基于服务端语义状态决定 DIRECT_COMPILE / CONFIRM_INFERRED / ASK_CLARIFY；logicReady 只是建议性自评，不能单独决定是否完整。',
  '你的职责是生成 semantic planning notes 与自然语言交互，并给出可采纳的 semanticPatch 草案，不是定义真实策略状态。',
  'assistantPrompt 在 logicReady=false 时必须先总结当前已理解策略，再只问一个最高优先级问题。',
  '你必须维持上下文一致，不能把已有策略重置为默认模板。',
  '不得覆盖当前消息未涉及的已锁定语义。',
  '不得泛化已锁定规则，不得把精确规则回退为模板化摘要。',
  '已有 active semantic state 时，默认按增量修改处理；只有用户明确要求替换整个策略时才允许 replacement，否则不得重置已有语义。',
  '输出必须是 semanticPatch，而不是 checklist patch。',
  '输出原子语义 patch，按 context、trigger、action、risk、position 表达当前消息造成的最小语义变化，不要输出 checklist。',
  'semanticPatch 只表达当前消息涉及的增量语义，不要臆造、补写或弱化任何规则。',
  'semanticPatch 中任何可执行 action atom 必须携带 contracts/capabilities；不得输出缺少执行合约的裸 action。',
  '网格执行 action（如 place_limit_grid、action.grid_ladder、grid_ladder）必须表达 order_program/maintain/limit_ladder 合约，而不是让用户补充内部执行合约。',
  '标的、周期、仓位和关键风控若属于必答项，缺失时必须继续澄清，不能跳过。',
  '若编辑意图不完整，只追问缺失的 semantic slot，不要重新询问已锁定语义。',
  '禁止发明新的 atom、family、state 值或 grid 语义。',
  '若处于 ASK_CLARIFY：只能围绕当前唯一 blocker 发问，禁止追加模板化的语义槽之外内容。',
  '若处于 CONFIRM_INFERRED：必须明确区分用户原话与系统推断，确认前禁止进入生成。',
  '若处于 DIRECT_COMPILE：不得反向触发 checklist-era 缺项追问。',
  '对于包含数量/序列条件的规则（如“连续N根K线”），必须保留完整条件细节。',
  '成对出现的多空规则必须完整保留，不能只保留其中一侧。',
  '强语义动作必须保真，例如“直接平仓”不能改写成“减仓”，“强制止损”不能改写成“观察”或“提示”。',
  '只输出 JSON，不要 markdown。',
]

const JSON_SHAPE_BLOCK: readonly string[] = [
  'JSON 结构：',
  '{',
  '  "related": boolean,',
  '  "logicReady": boolean,',
  '  "assistantPrompt": string,',
  '  "semanticPatch"?: {',
  '    "contextSlots"?: object,',
  '    "atoms"?: [{ "key": string, "phase"?: "entry" | "exit" | "gate", "params": object }],',
  '    "position"?: { "mode"?: string, "sizing"?: object }',
  '  }',
  '}',
]

/**
 * In-context 示例派生自 ATOM_CONTRACT_REGISTRY（issue #1364 AC-2）。
 *
 * 旧版 5 段硬编码（trigger/action/risk/orchestration/positionConstraint 各 1 例）
 * 由本函数动态选取每桶第 1 个 atom 作为示例，避免 atom 重命名后 in-context 示例
 * 静默退化；不再单独导出 IN_CONTEXT_EXAMPLE_ATOM_KEYS（反向不变量由 REGISTRY 守门）。
 */
function buildInContextExamples(): readonly string[] {
  const buckets: readonly AtomContractBucket[] = ['trigger', 'action', 'risk', 'orchestration', 'positionConstraint']
  const out: string[] = ['In-context 示例（每桶 1 条，演示 atoms[] 元素形态）：', '']
  for (const b of buckets) {
    const sample = Object.values(ATOM_CONTRACT_REGISTRY).find(c => c.bucket === b)
    if (!sample) continue
    const paramKeys = Object.keys(sample.surface?.paramSlots ?? {}).slice(0, 2)
    const paramsExample = Object.fromEntries(paramKeys.map(k => [k, null]))
    out.push(`示例（${b}）— key=${sample.key}`)
    out.push(`  atoms: [{ "key": "${sample.key}", "phase": "entry", "params": ${JSON.stringify(paramsExample)} }]`)
    out.push('')
  }
  return out
}

const TERMINAL_RULES: readonly string[] = [
  '规则：',
  '1) 如果消息与策略无关：related=false，assistantPrompt 提醒回到策略主题。',
  '2) 如果服务端语义状态还不完整：assistantPrompt 必须先总结当前已理解策略，再只问一个最高优先级的 semantic slot 问题。',
  '3) 若任一必答项，或阈值/时间窗口/序列条件的比较基准仍不明确：logicReady=false 只能作为 planner 自评标记，assistantPrompt 必须指向未闭合语义槽。',
  '4) 如果服务端语义状态已完整且 planner 也自评 ready：logicReady=true，assistantPrompt 用一句话总结策略逻辑并请求确认。',
  '5) 若用户是在修改已有逻辑，应在既有 semanticState 基础上做增量更新，而非重置。',
  '6) 若用户明确表达“推荐/默认/你来定/不要再问”，不得跳过必答市场、周期、仓位或关键风控字段，也不得臆造新的核心交易规则。',
]

/** 从 ATOM_CONTRACT_REGISTRY 派生的 atom 词典段（issue #1345 PR1.2 核心注入） */
function formatAtomCatalogSection(locale: 'zh' | 'en'): string[] {
  const registeredKeys = getRegisteredAtomKeys()
  const phaseEnum = getPhaseEnum()
  return [
    `semanticPatch 严格 schema（issue #1364 AC-2）：atoms[] 元素必填 { key, phase, params }；phase ∈ [${phaseEnum.join(', ')}]。`,
    `atoms[].key 必须从下列 ${registeredKeys.length} 个原子枚举中选（禁止自由文本或自创 atom）：`,
    '',
    formatAtomCatalogForPrompt(locale),
    '',
    'semanticPatch 字段规范：',
    '- atoms[]：每条 { key（上表枚举）, phase（entry/exit/gate，server 端按 contract.phaseResolver 强制覆写）, params（按上表 paramFields 填，禁止造新字段；缺失服务端派生 openSlots 驱动澄清）}',
    '- contextSlots：symbol/timeframe/exchange/marketType 等必须是 { value, source }（source ∈ user_explicit/inferred）',
    '- position：仅 { mode?, sizing? } 标量字段；position atom（dca_schedule/pyramiding_limit）走 atoms[]',
  ]
}

export function buildConversationPlannerSystemPrompt(locale: 'zh' | 'en' = 'zh'): string {
  const lines: string[] = [
    ...ADVISORY_CONSTRAINTS,
    ...JSON_SHAPE_BLOCK,
    '',
    ...formatAtomCatalogSection(locale),
    '',
    ...buildInContextExamples(),
    '',
    ...TERMINAL_RULES,
  ]
  if (locale === 'en') {
    lines.push('Language rule: assistantPrompt must be written in natural English. Keep semanticPatch keys and enum values unchanged.')
  }
  return lines.join('\n')
}

