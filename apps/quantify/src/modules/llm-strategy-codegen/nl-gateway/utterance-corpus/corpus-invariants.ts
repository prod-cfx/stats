/**
 * Corpus 三大通用反向不变量注册表
 *
 * 设计原则：本文件只放声明式数据（映射表 + 互斥表 + 子句绑定表），不放断言逻辑。
 * 断言逻辑放进 `utterance-corpus.spec.ts`，从本表驱动。
 * 新增/修改不变量只改本表 → 编译期 TS 守护 + 运行期 spec 守护。
 *
 * - INVARIANT-A: NLG → state parity（全 frame kind）
 * - INVARIANT-B: Atom 互斥（atom mutex registry + phrase context mutex）
 * - INVARIANT-C: Clause-bound param locality（子句号位边界）
 */

import type { SemanticNaturalLanguageFrame } from '../../types/semantic-natural-language-frame'
import type {
  SemanticOrchestrationContractKind,
  SemanticOrchestrationNode,
  SemanticState,
} from '../../types/semantic-state'
import type { SupportedExecutableUtteranceAtom } from './utterance-corpus.types'

// =========================================================
// 不变量 A — NLG → state parity（全 frame kind）
//
// 对每条 locked corpus utterance：跑 NaturalLanguageGatewayService.parse() 得 frame[]，
// 每个 frame.kind 都必须能在 state 中找到 ≥1 对应原子。
// 凡 NLG 新增 frame kind 未在此表声明 → TS `Record<FrameKind, ...>` exhaustive 编译失败。
// =========================================================

type FrameKind = SemanticNaturalLanguageFrame['kind']
type AtomLookup = (state: SemanticState) => readonly { readonly key?: string }[]

function orchestrationNodes(state: SemanticState): readonly SemanticOrchestrationNode[] {
  return state.orchestration?.nodes ?? []
}

export const FRAME_KIND_TO_STATE_LOOKUP: Record<FrameKind, AtomLookup | 'no_state_projection'> = {
  // —— 顶层 state 字段 ——
  action: state => state.actions ?? [],
  risk: state => state.risk ?? [],
  indicator_compare: state => state.triggers ?? [],
  boundary_touch: state => state.triggers ?? [],
  combination: state => state.triggers ?? [],

  // —— state.orchestration.nodes filter by kind + key ——
  portfolio_drawdown: state =>
    orchestrationNodes(state).filter(
      n => n.kind === 'portfolioRisk' && n.key === 'portfolioRisk.drawdown_block',
    ),
  portfolio_symbol_exposure_cap: state =>
    orchestrationNodes(state).filter(
      n => n.kind === 'portfolioRisk' && n.key === 'portfolioRisk.symbol_exposure_cap',
    ),
  portfolio_substrategy_exposure_cap: state =>
    orchestrationNodes(state).filter(
      n => n.kind === 'portfolioRisk' && n.key === 'portfolioRisk.substrategy_exposure_cap',
    ),

  // —— state.orchestration.nodes filter by kind ——
  regime_gate: state => orchestrationNodes(state).filter(n => n.kind === 'gate'),
  sub_strategy_gate: state => orchestrationNodes(state).filter(n => n.kind === 'gate'),
  fixed_grid_gated: state => orchestrationNodes(state).filter(n => n.kind === 'program'),
  dynamic_grid: state => orchestrationNodes(state).filter(n => n.kind === 'program'),
  adaptive_volatility_grid: state => orchestrationNodes(state).filter(n => n.kind === 'program'),
  event_listener: state => orchestrationNodes(state).filter(n => n.kind === 'program'),

  // —— scope 类 frame：落 state.orchestration.nodes 中 kind:'scope'，按 sub-kind 区分 ——
  symbol_scope: state =>
    orchestrationNodes(state).filter(n => n.kind === 'scope' && n.symbolScopeKind === 'symbol'),
  leg_scope: state =>
    orchestrationNodes(state).filter(n => n.kind === 'scope' && n.legScopeKind === 'leg'),
  timeframe_scope: state =>
    orchestrationNodes(state).filter(
      n => n.kind === 'scope' && n.timeframeScopeKind === 'timeframe',
    ),
  data_source_scope: state =>
    orchestrationNodes(state).filter(
      n => n.kind === 'scope' && n.dataSourceScopeKind === 'dataSource',
    ),
  sub_strategy_scope: state =>
    orchestrationNodes(state).filter(
      n => n.kind === 'scope' && n.subStrategyScopeKind === 'subStrategy',
    ),

  // —— context 类 frame：落 state.contextSlots（与本不变量监控的"原子级"分离）——
  context: 'no_state_projection',
}

// =========================================================
// 不变量 B-1 — Atom 互斥矩阵
//
// 当 corpus locked utterance 的 expected.key = X 落位时，
// state 中不得共存 ATOM_MUTEX[X] 列出的任何 atom key。
// 新加 atom 应在此处声明与既有 atom 的互斥关系；不声明 = 不互斥。
// =========================================================

export const ATOM_MUTEX: Partial<Record<SupportedExecutableUtteranceAtom, readonly string[]>> = {
  // 分批止盈胜过单值止盈：同 state 不得并存，否则 UI 单值兜底导致档位丢失
  'risk.partial_take_profit': ['risk.take_profit_pct'],
}

// =========================================================
// 不变量 B-2 — 触发短语 vs 风控短语 上下文判定
//
// 某些短语属于触发条件而非风控信号（如"盈利 N% 后加仓"中 N% 是加仓触发阈值，
//   不应被 risk extractor 误抓为 take_profit_pct）。
// 凡 utterance 命中 pattern，state 不得含 forbidStateAtoms 中任一 atom。
// =========================================================

export const PHRASE_CONTEXT_MUTEX: ReadonlyArray<{
  description: string
  pattern: RegExp
  forbidStateAtoms: readonly string[]
}> = [
  {
    description: '加仓触发条件的"盈利 N%（后/之后/再/则）加仓"不应被识别为止盈',
    pattern: /盈利\s*\d+(?:\.\d+)?\s*%\s*(?:之后|后|再|则)\s*加仓/u,
    forbidStateAtoms: ['risk.take_profit_pct'],
  },
  {
    description: 'profit-after add_position（英文，词边界 + 子句内限制）',
    pattern: /\b(?:scale\s*in|add|pyramid)\b[^.,;。，；]{0,20}(?:when|if|after)\s+profit/iu,
    forbidStateAtoms: ['risk.take_profit_pct'],
  },
]

// =========================================================
// 不变量 C — Clause-bound param locality（子句号位边界）
//
// 某些原子的数值参数必须与上下文关键词出现在同一子句内（按中英标点分段）。
// 防止跨子句数值漂移（如"总投入不超过 500 USDT"中的 500 漂到 RSI extractor）。
// 新加易污染原子应在此处声明 contextKeyword + paramField。
// =========================================================

export const CLAUSE_BOUND_PARAM_CHECKS: ReadonlyArray<{
  description: string
  atomKeyMatcher: (key: string) => boolean
  contextKeyword: RegExp
  paramFieldPath: readonly string[]
}> = [
  {
    description: 'oscillator.rsi_* 的 value 必须与 RSI 关键词同子句',
    atomKeyMatcher: key => /^oscillator\.rsi_/.test(key),
    contextKeyword: /RSI/iu,
    paramFieldPath: ['value'],
  },
]

// =========================================================
// 工具：utterance 按中英标点切分为子句
// =========================================================

export function splitClauses(utterance: string): readonly string[] {
  // 中英标点 + 换行；英文句号 `.` 与冒号 `:` 暂未加入（易与小数点 / "BTCUSDT: 15m" 等合法 token 冲突）
  // —— 多行 utterance 的精细切分作为 follow-up
  return utterance.split(/[，,；;。\n]/u).map(s => s.trim()).filter(s => s.length > 0)
}

// =========================================================
// 不变量 D — Orchestration → classifier 全量识别（#1152）
//
// 每个 locked SemanticOrchestrationNode（kind ∈ scope/gate/program/portfolioRisk）
// 都必须经 SemanticOrchestrationRegistryService 解析；classifier 输出 unknownAtoms
// 中不得含其 key。任何 SemanticOrchestrationContractKind 新增 kind 而未在此声明
// support 来源，TS exhaustive 编译失败。
// =========================================================

export const ORCHESTRATION_KIND_TO_REGISTRY_LOOKUP: Record<SemanticOrchestrationContractKind, 'orchestration_registry'> = {
  scope: 'orchestration_registry',
  gate: 'orchestration_registry',
  program: 'orchestration_registry',
  portfolioRisk: 'orchestration_registry',
}

export function readParamPath(obj: unknown, path: readonly string[]): unknown {
  let current: unknown = obj
  for (const seg of path) {
    if (current == null || typeof current !== 'object') return undefined
    current = (current as Record<string, unknown>)[seg]
  }
  return current
}

// =========================================================
// 不变量 E — Conversation render integrity（#1154）
//
// 对每条 locked utterance，若 state 中出现 RENDER_CONTRACT_ATOM_FIELDS 声明的 atom，
// 则 buildConversationView 的相应 summary 段必须包含该 atom 的关键参数值字符串。
// 新增需要渲染完整性保障的 atom 只需在此表声明，spec 会自动驱动断言。
// =========================================================

export const RENDER_CONTRACT_ATOM_FIELDS: Partial<Record<SupportedExecutableUtteranceAtom, ReadonlyArray<{
  field: string
  mustAppearIn: 'summary' | 'riskSummary' | 'positionSummary'
}>>> = {
  'risk.partial_take_profit': [{ field: 'params.tiers[0].trigger.threshold', mustAppearIn: 'riskSummary' }],
  'action.add_position': [
    { field: 'params.addRatio', mustAppearIn: 'summary' },
    // #1158：profit_pct/drawdown_pct 模式 emit 的触发阈值必须出现在 summary
    //   spec it.each 对 readParamPath 返回 null 的字段自动跳过，未 emit 阈值的 case 不会被假红
    { field: 'params.profitThreshold', mustAppearIn: 'summary' },
    { field: 'params.drawdownThreshold', mustAppearIn: 'summary' },
  ],
  'position.pyramiding_limit': [{ field: 'params.maxLayers', mustAppearIn: 'positionSummary' }],
}
