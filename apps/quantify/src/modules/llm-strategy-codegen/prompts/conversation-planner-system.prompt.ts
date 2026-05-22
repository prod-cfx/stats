import { ATOM_CONTRACT_REGISTRY } from '../atom-contracts/atom-contract-registry'
import type { AtomContractSurface } from '../atom-contracts/atom-contract-surface.types'
import { formatAtomCatalogForPrompt, getPhaseEnum, getRegisteredAtomKeys } from './atom-catalog-projection'
import { readFlatTriggers } from '../types/semantic-state-flat-readers'

/**
 * Issue #1395 — 把 semanticPatch.atoms[] 切到 semanticPatch.rules[] 表达式树形态。
 *
 * 旧形态（atoms[]）只能表达「一堆并列叶子」，无法表达 AND / OR / NOT / SEQUENCE，
 * 也无法把 condition 与 effects 显式绑定到同一条 rule 上。新形态：
 *
 *   semanticPatch.rules[] = [{ id, phase, sideScope, condition: <AtomExpr>, effects: <RuleEffects> }]
 *
 * registry 原子作为 AtomExpr 叶子参与 condition / typed RuleEffects。
 *
 * 同步保留：
 *   - ATOM_CONTRACT_REGISTRY 投影成 LLM 词典（catalog）—— LLM 仍需从词典中挑 atom key
 *   - phase enum 全局 ['entry','exit','gate','program']
 *
 * 与之前 #1345 PR1.2 / #1364 AC-2 的差异：
 *   - 旧 JSON_SHAPE_BLOCK 里的 atoms[] → 新 rules[]（每条 rule 含 condition + effects）
 *   - 旧动态派生的 in-context examples → 5 段固定 in-context examples（覆盖单叶子 / AND / OR / SEQUENCE / 嵌套多周期 AND）
 */

/** Advisory 约束：保持服务端权威 + 不重置 / 不覆盖锁定语义 + JSON-only 输出 */
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
  '输出表达式树 patch（rules[]）；legacy 来源 trigger / action / risk / 仓位 / context 只能映射到 condition + typed effects，不要输出 checklist。',
  'semanticPatch 只表达当前消息涉及的增量语义，不要臆造、补写或弱化任何规则。',
  'semanticPatch.rules[].effects 内的 action atom 必须携带 contracts/capabilities；不得输出缺少执行合约的裸 action。',
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
  '    "rules"?: [',
  '      {',
  '        "id": string,',
  '        "phase": "entry" | "exit" | "gate" | "program",',
  '        "sideScope": "long" | "short" | "both",',
  '        "condition": <AtomExpr>,',
  '        "effects": {',
  '          "actions": [<AtomExpr>, ...],',
  '          "risks": [<AtomExpr>, ...],',
  '          "positions": [<AtomExpr>, ...],',
  '          "orchestration": [<AtomExpr>, ...],',
  '          "programs": [<AtomExpr>, ...]',
  '        },',
  '        "evidence": { "text": string }   // 必填：当前 user message 的连续原文子串（issue #1445 / #1550 硬校验）',
  '      }',
  '    ],',
  '  }',
  '}',
  '',
  '⛔ rules[].evidence.text 硬校验字段（issue #1445 / #1550）：每条 rule 必须提供 evidence.text，必须是当前 user message 的**连续原文子串**（substring）；缺失或非子串 → schema reject 触发单轮 retry。',
]

const RULE_EFFECTS_CONTRACT: readonly string[] = [
  'RuleEffects: semanticPatch.rules[] 是唯一策略语义输出；禁 atoms/triggers/actions/risk/position/orchestration 顶层旧字段。',
  'condition = 原 triggers，保留 AND/OR/NOT/SEQUENCE；effects={actions,risks,positions,orchestration,programs}。',
  'actions/risk/positionConstraint/orchestration/program.* 分别入 effects.actions/risks/positions/orchestration/programs。',
  '程序型策略（grid/DCA/TWAP/自适应网格/webhook/event listener）用 phase=program；program.* 必在 effects.programs。',
]

const ATOM_EXPR_BNF: readonly string[] = [
  'AtomExpr 递归类型（用于 condition 和 rules[].effects 各桶内的每个元素）：',
  '  <AtomExpr> ::=',
  '    | { "kind": "atom",     "key": <atomKey>, "params": <object>, "sideScope"?: "long"|"short"|"both" }',
  '    | { "kind": "and",      "children": [<AtomExpr>, <AtomExpr>, ...] }    // ≥2 子节点，全部满足',
  '    | { "kind": "or",       "children": [<AtomExpr>, <AtomExpr>, ...] }    // ≥2 子节点，任一满足',
  '    | { "kind": "not",      "child": <AtomExpr> }',
  '    | { "kind": "sequence", "steps": [<AtomExpr>, <AtomExpr>, ...],',
  '                            "withinBars"?: number, "nextBarOnly"?: boolean }  // 顺序敏感',
  '',
  'condition 内叶子 atom 必须从 trigger / risk(谓词形态) / orchestration-gate 桶取（roles 含 predicate）。',
  'effects.actions / effects.risks / effects.positions / effects.orchestration / effects.programs 内叶子 atom 必须按 registry bucket 与 roles(effect) 分桶。',
  '单 atom 条件 = 单叶子 { "kind": "atom", "key": "...", "params": {...} }，不需要 and/or 包装。',
]

const NEW_IN_CONTEXT_EXAMPLES: readonly string[] = [
  'In-context 示例（含正/反例；7 类 — 5 类组合形态 + 2 类易错纠正）：',
  '',
  '【⚠️ 易错纠正 3：中心价网格】用户："OKX 现货 ETHUSDT、1m 网格以部署时当前价为中心，上下各0.4%共10格、每格10 USDT、限价单并相邻网格自动挂反向单；当价格突破上下边界时立即停止并撤销所有未成交订单"',
  '  正确（必须）：program.fixed_grid_gated / grid.range_rebalance 只能用合法数字 params：stepPct/centerOffsetPct 数字 0.4、levelCount/levels 数字 10、perGridSizing 数字 10、sideMode="both"、breakoutAction="stop"；不要输出中文枚举、百分号字符串或 centerOffsetPct=0。',
  '    rules: [{',
  '      "id": "entry-centered-grid", "phase": "program", "sideScope": "both",',
  '      "condition": { "kind": "atom", "key": "grid.range_rebalance", "params": { "centerOffsetPct": 0.4, "levels": 10, "perGridSizing": 10, "sideMode": "both", "recycle": "true", "breakoutAction": "stop" } },',
  '      "effects": {',
  '        "actions": [],',
  '        "risks": [],',
  '        "positions": [],',
  '        "orchestration": [],',
  '        "programs": [{ "kind": "atom", "key": "program.fixed_grid_gated", "params": { "levelCount": 10, "stepPct": 0.4, "onDeactivate": "cancel" } }]',
  '      },',
  '      "evidence": { "text": "网格以部署时当前价为中心，上下各0.4%共10格、每格10 USDT" }',
  '    }]',
  '  错误（不要这样）：condition.params.centerOffsetPct = "上下各0.4%"、breakoutAction="立即停止"、sideMode="双向"、或 rules=[]；这些会触发 params_strict/schema reject。',
  '',
  '【单叶子】用户："RSI > 65 卖出"',
  '  rules: [{',
  '    "id": "exit-rsi", "phase": "exit", "sideScope": "long",',
  '    "condition": { "kind": "atom", "key": "oscillator.rsi_gte", "params": { "period": 14, "threshold": 65 } },',
  '    "effects": {',
  '      "actions": [{ "kind": "atom", "key": "action.close_long", "params": {} }],',
  '      "risks": [],',
  '      "positions": [],',
  '      "orchestration": [],',
  '      "programs": []',
  '    },',
  '    "evidence": { "text": "RSI > 65 卖出" }',
  '  }]',
  '',
  '【AND】用户："布林下轨触及 AND 成交量 > 20 均量 1.5 倍 买入"',
  '  rules: [{',
  '    "id": "entry-boll-vol", "phase": "entry", "sideScope": "long",',
  '    "condition": { "kind": "and", "children": [',
  '      { "kind": "atom", "key": "bollinger.touch_lower", "params": { "period": 20, "stdDev": 2 } },',
  '      { "kind": "atom", "key": "volume.threshold", "params": { "mode": "relative_to_sma", "multiplier": 1.5, "refWindow": 20 } }',
  '    ]},',
  '    "effects": {',
  '      "actions": [{ "kind": "atom", "key": "action.open_long", "params": {} }],',
  '      "risks": [],',
  '      "positions": [],',
  '      "orchestration": [],',
  '      "programs": []',
  '    },',
  '    "evidence": { "text": "布林下轨触及 AND 成交量 > 20 均量 1.5 倍 买入" }',
  '  }]',
  '',
  '【OR 出场】用户："跌破 MA100 或 MACD 死叉 卖"',
  '  rules: [{',
  '    "id": "exit-or", "phase": "exit", "sideScope": "long",',
  '    "condition": { "kind": "or", "children": [',
  '      { "kind": "atom", "key": "indicator.below", "params": { "indicator": "ma", "period": 100 } },',
  '      { "kind": "atom", "key": "indicator.cross_under", "params": { "indicator": "macd" } }',
  '    ]},',
  '    "effects": {',
  '      "actions": [{ "kind": "atom", "key": "action.close_long", "params": {} }],',
  '      "risks": [],',
  '      "positions": [],',
  '      "orchestration": [],',
  '      "programs": []',
  '    },',
  '    "evidence": { "text": "跌破 MA100 或 MACD 死叉 卖" }',
  '  }]',
  '',
  '【SEQUENCE】用户："突破 24 小时高点后回踩不破 再买，跌破止损"',
  '  rules: [{',
  '    "id": "entry-breakout-retest", "phase": "entry", "sideScope": "long",',
  '    "condition": { "kind": "sequence", "withinBars": 6, "steps": [',
  '      { "kind": "atom", "key": "price.breakout_up", "params": { "lookback": 24 } },',
  '      { "kind": "atom", "key": "price.previous_extrema_retest", "params": { "retestKind": "not_break", "memoryKey": "auto" } }',
  '    ]},',
  '    "effects": {',
  '      "actions": [{ "kind": "atom", "key": "action.open_long", "params": {} }],',
  '      "risks": [{ "kind": "atom", "key": "risk.remembered_level_stop", "params": { "levelKey": "previous_extrema" } }],',
  '      "positions": [],',
  '      "orchestration": [],',
  '      "programs": []',
  '    },',
  '    "evidence": { "text": "突破 24 小时高点后回踩不破 再买，跌破止损" }',
  '  }]',
  '',
  '【嵌套 + 多周期 AND】用户："15m + 1h + 4h 都在 EMA20 上方 买入"',
  '  rules: [{',
  '    "id": "entry-mtf", "phase": "entry", "sideScope": "long",',
  '    "condition": { "kind": "and", "children": [',
  '      { "kind": "atom", "key": "indicator.above", "params": { "indicator": "ema", "period": 20, "timeframe": "15m" } },',
  '      { "kind": "atom", "key": "indicator.above", "params": { "indicator": "ema", "period": 20, "timeframe": "1h" } },',
  '      { "kind": "atom", "key": "indicator.above", "params": { "indicator": "ema", "period": 20, "timeframe": "4h" } }',
  '    ]},',
  '    "effects": {',
  '      "actions": [{ "kind": "atom", "key": "action.open_long", "params": {} }],',
  '      "risks": [],',
  '      "positions": [],',
  '      "orchestration": [],',
  '      "programs": []',
  '    },',
  '    "evidence": { "text": "15m + 1h + 4h 都在 EMA20 上方 买入" }',
  '  }]',
  '',
  '【S3 复合：MA gate AND + RSI 跌破后重新上穿 sequence】用户："BTC 1小时 MA50 在 MA200 上方时，只在 RSI 跌破 35 后重新上穿 35 买入"',
  '  ⚠️ 关键：这是「单条 entry rule」，不是 4 条独立 rule；MA50>MA200 与 RSI 序列必须在同一条 condition 内用 AND 组合。',
  '  rules: [{',
  '    "id": "entry-ma-gate-rsi-seq", "phase": "entry", "sideScope": "long",',
  '    "condition": { "kind": "and", "children": [',
  '      { "kind": "atom", "key": "indicator.above", "params": { "indicator": "ma", "period": 50, "timeframe": "1h" } },',
  '      { "kind": "atom", "key": "indicator.above", "params": { "indicator": "ma", "period": 200, "timeframe": "1h" } },',
  '      { "kind": "sequence", "steps": [',
  '        { "kind": "atom", "key": "oscillator.rsi_lte", "params": { "period": 14, "threshold": 35, "timeframe": "1h" } },',
  '        { "kind": "atom", "key": "indicator.cross_over", "params": { "indicator": "rsi", "period": 14, "threshold": 35, "timeframe": "1h" } }',
  '      ]}',
  '    ]},',
  '    "effects": {',
  '      "actions": [{ "kind": "atom", "key": "action.open_long", "params": {} }],',
  '      "risks": [],',
  '      "positions": [],',
  '      "orchestration": [],',
  '      "programs": []',
  '    },',
  '    "evidence": { "text": "BTC 1小时 MA50 在 MA200 上方时，只在 RSI 跌破 35 后重新上穿 35 买入" }',
  '  }]',
  '  错误（不要这样）：拆成 4 条独立 entry rule（MA50 上方、MA200 上方、RSI<35、RSI 上穿 35），会丢失「先跌破后重新上穿」的时序与「同时满足」的合取语义。',
  '',
  '【S4 双向 directional gate + 触发条件 → 2 条 AND 复合 rule（不是 4 条平铺）】',
  '  用户："价格在 EMA20/60/144 上方时做多开仓，都位于下方只开空；入场是 BOLL 下轨开多，上轨开空"',
  '  关键语义：',
  '    - "上方做多 / 下方做空" 是「方向准入条件」（directional gate / 前提条件）',
  '    - "BOLL 下轨 / 上轨触及" 才是「实际触发条件」',
  '    - 用户的真实意图：「（方向准入）AND（触发条件）→ 开对应方向仓位」',
  '  rules: [',
  '    {',
  '      "id": "entry-long-ema-gate-boll", "phase": "entry", "sideScope": "long",',
  '      "condition": { "kind": "and", "children": [',
  '        { "kind": "atom", "key": "indicator.above", "params": { "indicator": "ema", "period": 20 } },',
  '        { "kind": "atom", "key": "indicator.above", "params": { "indicator": "ema", "period": 60 } },',
  '        { "kind": "atom", "key": "indicator.above", "params": { "indicator": "ema", "period": 144 } },',
  '        { "kind": "atom", "key": "bollinger.touch_lower", "params": { "period": 20, "stdDev": 2 } }',
  '      ]},',
  '      "effects": {',
  '        "actions": [{ "kind": "atom", "key": "action.open_long", "params": {} }],',
  '        "risks": [],',
  '        "positions": [],',
  '        "orchestration": [],',
  '        "programs": []',
  '      },',
  '      "evidence": { "text": "价格在 EMA20/60/144 上方时做多开仓" }',
  '    },',
  '    {',
  '      "id": "entry-short-ema-gate-boll", "phase": "entry", "sideScope": "short",',
  '      "condition": { "kind": "and", "children": [',
  '        { "kind": "atom", "key": "indicator.below", "params": { "indicator": "ema", "period": 20 } },',
  '        { "kind": "atom", "key": "indicator.below", "params": { "indicator": "ema", "period": 60 } },',
  '        { "kind": "atom", "key": "indicator.below", "params": { "indicator": "ema", "period": 144 } },',
  '        { "kind": "atom", "key": "bollinger.touch_upper", "params": { "period": 20, "stdDev": 2 } }',
  '      ]},',
  '      "effects": {',
  '        "actions": [{ "kind": "atom", "key": "action.open_short", "params": {} }],',
  '        "risks": [],',
  '        "positions": [],',
  '        "orchestration": [],',
  '        "programs": []',
  '      },',
  '      "evidence": { "text": "都位于下方只开空" }',
  '    }',
  '  ]',
  '  错误（不要这样）：拆成 4 条独立 entry rule（EMA stack 上方/下方/BOLL 下轨/上轨各一条）——',
  '    会让 UI 显示「入场×4」误导用户以为有 4 个独立入场路径；实际语义只有 2 个入场场景（做多/做空），',
  '    EMA stack 与 BOLL 触轨**必须同时满足**才触发对应方向，应合并为同一条 condition 的 AND 子节点。',
  '',
  '【AND vs OR vs SEQUENCE 辨析】',
  '  - "X 同时 Y" / "X 并且 Y" / "X 且 Y"  → and（合取）',
  '  - "X 或 Y" / "X 或者 Y"               → or（析取）',
  '  - "先 X 后 Y" / "X 之后再 Y" / "跌破 X 后重新上穿 X" → sequence（时序）',
  '  - 「上方做多 / 下方做空」「在 X 之上 / 之下」「位于 X 上方/下方」类**方向准入语句** + 触发条件 → 同一条 AND 复合 rule，不是两条独立 rule（见 S4 example）',
  '  禁止：把上述四类语义之一拆解为多条并列 rule —— 多条并列 rule 表示「彼此独立的入场逻辑」，而不是「需要同时满足的条件」。',
  '',
  '【去重示范】用户："MA50 上方且价格在 MA50 上方时买入"',
  '  ⚠️ 用户两次描述同一条件，必须合并为单一 atom，不要重复出现。',
  '  rules: [{',
  '    "id": "entry-ma50", "phase": "entry", "sideScope": "long",',
  '    "condition": { "kind": "atom", "key": "indicator.above", "params": { "indicator": "ma", "period": 50 } },',
  '    "effects": {',
  '      "actions": [{ "kind": "atom", "key": "action.open_long", "params": {} }],',
  '      "risks": [],',
  '      "positions": [],',
  '      "orchestration": [],',
  '      "programs": []',
  '    },',
  '    "evidence": { "text": "MA50 上方且价格在 MA50 上方时买入" }',
  '  }]',
  '  错误（不要这样）：condition.and.children 里塞两个相同 atom；也不要拆成两条 entry rule。',
]

/**
 * Issue #1395 / S3+S8 — 显式禁律段
 *
 * 实测：S3「先跌破后重新上穿」被拆成 4 条独立 entry rule；S8「多周期同向」被错配成
 * 「EMA15 下穿 EMA20」幻觉。补这段 NEGATIVE_EXAMPLES 段把高频错误形态点名禁止。
 */
const NEGATIVE_EXAMPLES: readonly string[] = [
  '⛔ NEGATIVE_EXAMPLES — 以下输出形态明确禁止，违反会被服务端拒绝：',
  '',
  '❌ 错误 1：把「A 后 B」拆成两条独立 entry rule。',
  '  用户："先 A 后 B 买入" → 必须是单条 entry rule，condition = sequence([A, B])；',
  '  禁止：rules=[{condition: A}, {condition: B}]（两条并列 entry 表示彼此独立入场，时序丢失）。',
  '',
  '❌ 错误 2：把「A 同时 B」拆成两条独立 entry rule。',
  '  用户："A 并且 B 买入" → 必须是单条 entry rule，condition = and([A, B])；',
  '  禁止：rules=[{condition: A}, {condition: B}]（两条并列 entry 各自独立触发，合取语义丢失）。',
  '',
  '❌ 错误 3：编造 atom paramSlots 没声明的 params 值。',
  '  禁止：MACD 写成 fast=100/slow=26/signal=9（标准是 12/26/9）；RSI period 默认 14，无明显理由不要改；',
  '  禁止：往 atom params 里塞 paramFields 没列的字段；缺哪个字段就走 openSlots 让服务端澄清。',
  '',
  '❌ 错误 4：输出 atom key 不存在的原子。',
  '  禁止：自创 "indicator.ema_cross_under"、"price.multi_tf_above" 这类未在 ATOM_CONTRACT_REGISTRY 列出的 key；',
  '  正确：从下方 atom 词典中精确挑选；多周期同向必须用「多个相同 atom 叶子 + 不同 timeframe」+ and 包裹，而不是新造一个 atom。',
  '',
  '❌ 错误 5：S8 多周期幻觉。用户："15m / 1h / 4h 价格都在 EMA20 上方 买入"',
  '  禁止：输出「EMA15 下穿 EMA20」「EMA 金叉死叉」等用户未提及的语义；',
  '  正确：condition = and([ema20_above@15m, ema20_above@1h, ema20_above@4h])，单条 entry rule。',
  '',
  '❌ 错误 6：把「方向准入语句 + 触发条件」拆成 N 条独立 entry rule。',
  '  用户："X 上方做多 / 下方做空 + 触发条件 Y" → 必须 2 条 entry rule，每条 condition=and([gate, Y])；',
  '  禁止：rules=[{gate_long}, {gate_short}, {Y_long}, {Y_short}] 这种 4 条并列形态。',
]

/**
 * Issue #1403 通用化 v2 — 跨原子组合形态（cross-atom structural patterns）。
 *
 * 这些 hint 不归属任一 atom（需要多个 atom 协作或描述 sequence/AND 嵌套结构）。
 * 单 atom 触发短语已沉淀回 ATOM_CONTRACT_REGISTRY[*].surface.phraseHints，由
 * buildRegistryDerivedHintSections() 自动派生进入 prompt。
 *
 * 加新策略 = 加 atom + 在 atom 自身声明 phraseHints；本段只在出现「跨 atom 组合」
 * 的结构性 pattern 时才需要扩展。
 */
const COMPOSITIONAL_PATTERN_HINTS: readonly string[] = [
  '关键短语 → 跨原子组合形态（用户原话出现下列模式时，必须按对应组合形态输出 rules[]）：',
  '',
  '【突破后回踩 / 回踩突破位 / retest / pullback / 不破突破位】',
  '  → sequence([price.breakout_up | price.breakout_down, price.previous_extrema_retest])；',
  '    price.previous_extrema_retest.params.retestKind="not_break"（用户说「不破」）或 "break_through"（用户说「跌破」）。',
  '  → 同 rule 内绑定的止损若引用突破位，effects 应包含 risk.remembered_level_stop + levelKey="previous_extrema"。',
  '',
  '【多周期共振 / 15min 1h 4h 都 X / 都在 X 上方 / multi-timeframe / X@15m AND X@1h】',
  '  → 多个相同 atom 叶子用 { kind: "and" } 包成单条 entry condition，每个叶子的 params.timeframe 设为对应周期；',
  '    不要丢失 timeframe，也不要合并到单一周期 atom；',
  '    禁止：编造「短周期 EMA 下穿长周期 EMA」「EMA 金叉死叉」等用户未提及的语义；用户说「都在 X 上方」就是 above，不是 cross。',
  '',
  '【MA50 / MA200 在 / 上方时 + RSI 跌破 X 后重新上穿 X】',
  '  → gate rule（phase=gate）condition=indicator.above(MA200) 或 AND(MA50>MA200)；',
  '  → entry rule（phase=entry）condition=sequence([oscillator.rsi_lte(value=X), indicator.cross_over(rsi, value=X)])；',
  '  → exit rule（phase=exit）condition=oscillator.rsi_gte(value=Y)。',
  '',
  '【方向准入语句 + 触发条件】',
  '  关键短语："X 上方做多 / 下方做空"、"在 X 之上 / 之下时做多/做空"、"位于 X 上方 / 下方时"',
  '  这类语句不是独立 entry，而是「方向 gate」。必须按用户给出的 sideScope（双向语句拆 2 条 long/short；',
  '  单向语句 1 条）输出 entry rule，每条 condition = and([方向准入 atom..., 触发 atom])，',
  '  effects = open_long / open_short。',
  '  禁止：把方向准入与触发拆成多条并列 entry rule（会让 UI 显示「入场×N」并丢失合取语义）。',
  '  边界：本段处理「方向准入短语 + 单触发原子」二元形态；若用户额外给出 RSI sequence /',
  '  突破回踩等复杂时序触发（命中上一条 MA50/MA200 + RSI sequence hint），按上一条形态执行，',
  '  仍可在 entry rule 的 condition.and.children 内嵌入 sequence 子节点，不要拆为独立 phase=gate rule。',
]

/**
 * Issue #1403 通用化 v2 — Planner 拒绝 dispatcher noisy lift 的 meta-rule。
 *
 * 此段只承载「通用纠错原则」；具体每个 atom 的 dispatcher 误形态 + 矫正方向沉淀回
 * ATOM_CONTRACT_REGISTRY[*].surface.phraseHints.antiPatterns，由
 * buildRegistryDerivedHintSections() 自动派生附在本段后。
 *
 * 加新策略 = 给对应 atom 加 antiPatterns 条款；本段不必扩展。
 */
const PLANNER_CORRECTION_META_RULES: readonly string[] = [
  '【通用纠错（Issue #1403）：拒绝 dispatcher noisy lift 退化】',
  '',
  '  Dispatcher 在 LLM 调用前已对用户原话做轻量启发式抽取，会在 readFlatTriggers(state) /',
  '  state.positionConstraint 桶里落下「孤立」atom（可能缺关键参数）。这些 atom',
  '  对 planner 仅是参考，**不是约束**。',
  '',
  '  通用原则：dispatcher 已抽出的 atom 即使形态不完整，**planner 必须根据用户原话',
  '  重写为正确的 rules[] 表达式树**，不要 echo dispatcher 输出。assistantPrompt 中',
  '  的关键短语必须可在 rules[] 内一一对应（同 TERMINAL_RULES.7 验收 hook）。',
  '',
  '  下方按 atom 列出该原子相关的 dispatcher 误形态 + 矫正方向（自 ATOM_CONTRACT_REGISTRY 派生）：',
]

/**
 * 从 ATOM_CONTRACT_REGISTRY 派生 phraseHints / antiPatterns / paramDefaultsHint，
 * 三段一次性遍历产出，供下方 build*Section() 消费。
 *
 * 各 atom 自描述自己的高频短语、误形态、标准参数；新增策略只要给 atom 加
 * phraseHints，prompt 自动重新派生，不必回 prompt 文件挂条款。
 */
function buildRegistryDerivedHintSections(): {
  readonly triggers: readonly string[]
  readonly antiPatterns: readonly string[]
  readonly paramDefaults: readonly string[]
} {
  const triggers: string[] = []
  const antiPatterns: string[] = []
  const paramDefaults: string[] = []
  const keys = Object.keys(ATOM_CONTRACT_REGISTRY).sort() as Array<keyof typeof ATOM_CONTRACT_REGISTRY>
  for (const key of keys) {
    // 把 union 类型的 surface 向上拓宽到接口基类，让 TS 识别可选 phraseHints 字段；
    //   未声明 phraseHints 的 atom 直接拿到 undefined。
    const surface = ATOM_CONTRACT_REGISTRY[key]?.surface as AtomContractSurface | undefined
    const hints = surface?.phraseHints
    if (!hints) continue
    for (const t of hints.triggers ?? []) {
      triggers.push(`【${t.keywords.join(' / ')}】`)
      triggers.push(`  → ${t.mustOutput}`)
      triggers.push('')
    }
    for (const ap of hints.antiPatterns ?? []) {
      antiPatterns.push(`  - atom \`${key}\`：${ap.mistake}`)
      antiPatterns.push(`    → ${ap.fix}`)
      antiPatterns.push('')
    }
    if (hints.paramDefaultsHint) {
      paramDefaults.push(`- ${hints.paramDefaultsHint}`)
    }
  }
  return { triggers, antiPatterns, paramDefaults }
}

function buildTriggerPhraseHintsSection(): readonly string[] {
  const { triggers } = buildRegistryDerivedHintSections()
  return [
    ...COMPOSITIONAL_PATTERN_HINTS,
    '',
    '关键短语 → 单 atom 形态（自 ATOM_CONTRACT_REGISTRY.surface.phraseHints 派生；',
    '加新策略只需给对应 atom 在 registry 声明 phraseHints.triggers，prompt 自动重新派生）：',
    '',
    ...triggers,
  ]
}

function buildPlannerCorrectionRulesSection(): readonly string[] {
  const { antiPatterns } = buildRegistryDerivedHintSections()
  return [
    ...PLANNER_CORRECTION_META_RULES,
    '',
    ...antiPatterns,
  ]
}

function buildAtomParamsHintsSection(): readonly string[] {
  const { paramDefaults } = buildRegistryDerivedHintSections()
  return [
    '📐 ATOM_PARAMS_HINTS — 常见指标 atom 的标准 params。',
    '',
    '⛔ Issue #1428 硬约束（必读）：',
    '  - 若用户原话中显式给出 params（括号数字 "(X,Y)"、"X 周期"、"X 倍"、"X%"、"X 分钟" 等），',
    '    必须以用户原话为准，禁止使用下面列出的 paramDefaultsHint 默认值覆盖用户输入。',
    '  - 例：用户说"布林带 5,1" → params.period=5, params.stdDev=1（绝不写 20/2）。',
    '  - 例：用户说"止盈 1.5%" → 走 risk.fixed_take_profit + pct=1.5，绝不识别成 risk.atr_take_profit + multiple=1.5。',
    '    （% 与倍数互斥：含 "%" 走 fixed_take_profit；含 "倍 ATR" / "x ATR" / "X*ATR" 走 atr_take_profit；其它情况询问澄清。）',
    '  - 例：用户说"3 分钟跌 1%" → price.percent_change + valuePct=-1 + window="3m"，禁止丢 valuePct/window。',
    '  - 仅当用户完全没有给出对应 param 时，才允许使用 paramDefaultsHint。',
    '',
    '（以下默认值列表自 ATOM_CONTRACT_REGISTRY.surface.phraseHints.paramDefaultsHint 派生；',
    '使用前请先确认用户原话未显式覆盖）：',
    '',
    ...paramDefaults,
    '- 多周期同向类 condition：用相同 atom 叶子 + 不同 params.timeframe 用 and 组合，不要合并到单个 atom。',
  ]
}

const TERMINAL_RULES: readonly string[] = [
  '规则：',
  '1) 如果消息与策略无关：related=false，assistantPrompt 提醒回到策略主题。',
  '2) 如果服务端语义状态还不完整：assistantPrompt 必须先总结当前已理解策略，再只问一个最高优先级的 semantic slot 问题。',
  '3) 若任一必答项，或阈值/时间窗口/序列条件的比较基准仍不明确：logicReady=false 只能作为 planner 自评标记，assistantPrompt 必须指向未闭合语义槽。',
  '4) 如果服务端语义状态已完整且 planner 也自评 ready：logicReady=true，assistantPrompt 用一句话总结策略逻辑并请求确认。',
  '5) 若用户是在修改已有逻辑，应在既有 semanticState 基础上做增量更新，而非重置。',
  '6) 若用户明确表达“推荐/默认/你来定/不要再问”，不得跳过必答市场、周期、仓位或关键风控字段，也不得臆造新的核心交易规则。',
  '7) Issue #1395：assistantPrompt 必须忠实复述 rules[] 内每条 condition / effects 涉及的所有 atom 与关键参数（指标周期、阈值、倍数、timeframe、序列计数等），不得抹平为「通用入场」「双向开仓」「连续实体」等模糊概述。assistantPrompt 出现的关键短语必须可在 rules[] 内一一对应（用户验收 hook）。',
  '8) Issue #1395：rules[] 长度可以多条；每条聚焦一个独立的 phase × 入/出/gate 语义。多周期共振、多入场条件、多出场条件请用 AND/OR/SEQUENCE 嵌入 condition，不要拆成多个并列的 entry/exit rule（除非语义上确实独立）。',
  '9) Issue #1445 / #1550：每条 rule 必须含 evidence.text，且必须是当前 user message 的连续原文子串；缺失或非子串 → 服务端硬校验拒绝触发单轮 retry。',
]

/** 从 ATOM_CONTRACT_REGISTRY 派生的 atom 词典段（issue #1345 PR1.2 注入，#1395 适配 rules 形态） */
function formatAtomCatalogSection(locale: 'zh' | 'en'): string[] {
  const registeredKeys = getRegisteredAtomKeys()
  const phaseEnum = getPhaseEnum()
  return [
    `semanticPatch 严格 schema（issue #1395）：rules[] 元素必填 { id, phase, sideScope, condition, effects }；phase ∈ [${phaseEnum.join(', ')}]。`,
    `condition / effects 内的叶子 atom key 必须从下列 ${registeredKeys.length} 个原子枚举中选（禁止自由文本或自创 atom）：`,
    '',
    formatAtomCatalogForPrompt(locale),
    '',
    'semanticPatch 字段规范：',
    '- rules[]：每条 { id, phase, sideScope, condition, effects, evidence（{ text: string }，必填，user message 连续原文子串）}',
    '- effects：必须是 RuleEffects 对象 { actions, risks, positions, orchestration, programs }，每个字段都是 AtomExpr[]；禁止回退为 effects 数组或旧顶层 actions/risk/position/orchestration 字段',
    '- 叶子 atom 的 params 按上表 paramFields 填，禁止造新字段；缺失服务端派生 openSlots 驱动澄清',
    '- contextSlots：symbol/timeframe/exchange/marketType 等必须是 { value, source }（source ∈ user_explicit/inferred）',
    '- 仓位类语义必须走 rules[].effects.positions 的 AtomExpr 叶子（例如 position.dca_schedule / position.pyramiding_limit），禁止输出 semanticPatch 的 position 顶层字段',
  ]
}

export function buildConversationPlannerSystemPrompt(locale: 'zh' | 'en' = 'zh'): string {
  // Issue #1395：易错纠正 + 关键短语映射前置（小模型 attention bias 偏 prompt 头部 / 尾部，
  //   把这两段同时前置 + 复述在尾部 TERMINAL_RULES 之上以双层强化）。
  // Issue #1403 通用化 v2：单 atom 触发短语 / antiPatterns / paramDefaults 从
  //   ATOM_CONTRACT_REGISTRY[*].surface.phraseHints 自动派生；加新策略只需扩 atom 元数据。
  const lines: string[] = [
    '⚠️ 高优先级规则（优先读完再处理用户消息）：',
    ...RULE_EFFECTS_CONTRACT,
    '',
    ...buildTriggerPhraseHintsSection(),
    '',
    ...buildPlannerCorrectionRulesSection(),
    '',
    ...NEGATIVE_EXAMPLES,
    '',
    ...buildAtomParamsHintsSection(),
    '',
    ...NEW_IN_CONTEXT_EXAMPLES,
    '',
    ...ADVISORY_CONSTRAINTS,
    ...JSON_SHAPE_BLOCK,
    '',
    ...RULE_EFFECTS_CONTRACT,
    '',
    ...ATOM_EXPR_BNF,
    '',
    ...formatAtomCatalogSection(locale),
    '',
    ...TERMINAL_RULES,
  ]
  if (locale === 'en') {
    lines.push('Language rule: assistantPrompt must be written in natural English. Keep semanticPatch keys and enum values unchanged.')
  }
  return lines.join('\n')
}
