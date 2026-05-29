import type {
  AtomContractSurface,
  Direction,
  ExtractorSpec,
  ParamSlotSchema,
  ResolveCtx,
  SideResolverSpec,
} from '../atom-contracts/atom-contract-surface.types'
import type { AtomContract, AtomContractBucket } from '../atom-contracts/atom-contract-types'
import type { CodegenSemanticPatch } from '../types/codegen-semantic-patch'
import type { AtomExpr, RuleEffectsByRole, SemanticRule } from '../types/atom-expr'
import type { SemanticPositionSizingContract, SemanticPositionState } from '../types/semantic-state'
/**
 * GenericSeedDispatcher — Issue #1279 PR2 唯一真相源 NL→seed 分发器
 *
 * 红线（用户裁定 turn 5）：
 *   入口（dispatcher）永远只读 ATOM_CONTRACT_REGISTRY，业务规则全部沉淀到
 *   atom contract。dispatcher 不允许"一个策略一个 if"。
 *
 * 红线守门：
 *   - eslint-rules/no-atom-key-literal.js — 禁止 `key === 'oscillator.rsi_gte'`
 *     之类 atom-key 字面量比较 / switch case
 *   - eslint-rules/no-business-rule-in-dispatcher.js — 禁止 dispatcher 文件内
 *     `bucket === 'trigger'` 等 bucket 字面量比较（业务规则硬编码）
 *
 * 工作原理（pure registry-driven）：
 *   1. 接收 NL 字符串
 *   2. 用标点切分子句
 *   3. 对每个子句，遍历 ATOM_CONTRACT_REGISTRY 36 atom：
 *      - 用 surface.intent.keywords / verbs 匹配文本 → 命中 atom
 *      - 用 surface.paramSlots schema + extractor 抽取参数（generic parser registry）
 *      - 用 surface.phaseResolver 派生 phase
 *      - 用 surface.sideResolver 派生 sideScope
 *   4. 用 contract.bucket 派生 patch 顶层位置（triggers / actions / risk / ...）
 *   5. 返回 5 桶 atom 语义；执行 contract 由 SemanticSeedStateBuilder 统一合成
 *
 * Refs: #1279
 */
import { Injectable } from '@nestjs/common'
import { ATOM_CONTRACT_REGISTRY } from '../atom-contracts/atom-contract-registry'
import { isTimeframeGroupableTriggerKey } from '../atom-contracts/trigger-display-contract'
import {
  matchKeyword,
  matchVerbDirection,
  resolvePhaseFromClause,
} from './generic-seed-dispatcher.helpers'

/** 子句级匹配中间结果 */
export interface AtomMatch {
  readonly atomKey: string
  readonly clauseText: string
  readonly direction: Direction | null
  readonly params: Readonly<Record<string, unknown>>
  readonly phase: 'entry' | 'exit' | 'gate' | 'program' | null
  readonly sideScope: 'long' | 'short' | 'both' | null
}

export type DispatchResult = {
  contextSlots?: CodegenSemanticPatch['contextSlots']
  rules?: SemanticRule[]
}

/* ──────────────────────────────────────────────────────────────────────────
 * 共享 symbol 校验常量（被 Parser + contextSlots 两处共用，需在两者之前声明）
 * ────────────────────────────────────────────────────────────────────────── */

/**
 * SYMBOL_RE / PARSER_SYMBOL_BASE_QUOTE 支持的显式 quote 货币（explicit 路径）。
 * 修改这里会同时更新 regex 和 parser，避免两处手动同步。
 *
 * 注意：BTC/ETH 在 explicit 路径可作为 quote（如 ETHBTC），但在推断路径
 * 应保留作为合法 base（"BTC" → BTCUSDT）。两者集合语义不同，不直接合并。
 */
const SYMBOL_QUOTES = ['USDT', 'USDC', 'USD', 'BTC', 'ETH', 'BUSD'] as const

/**
 * 推断路径（inferred）的 base 排除集：仅含稳定币/法币 quote，
 * 不含 BTC/ETH（它们在推断路径仍是合法 base）。
 * 另补 TUSD/FDUSD（市场存在但不在 SYMBOL_QUOTES 的 explicit 枚举中）。
 */
const QUOTE_TOKENS = new Set(['USDT', 'USDC', 'USD', 'BUSD', 'TUSD', 'FDUSD'])

/**
 * 技术指标/策略类型/英文停用词黑名单（纯数据表，不是业务分流）：
 * 这些全大写 token 形似 base symbol，但实为指标缩写、策略名称或常见停用词，
 * 不应被推断为 base。
 */
const INDICATOR_KEYWORDS = new Set([
  // 技术指标
  'MACD', 'RSI', 'KDJ', 'MA', 'EMA', 'SMA', 'WMA', 'BOLL', 'BB',
  'ATR', 'ADX', 'CCI', 'OBV', 'MFI', 'DMI', 'SAR', 'ROC', 'WR',
  'STOCH', 'STOCRSI', 'STOCHRSI',
  // 策略/执行类型
  'DCA', 'TWAP', 'VWAP', 'ICT', 'SMC',
  // 英文常见停用词（3 字母，避免 'AND'/'FOR'/'BUY'/'THE' 被推为 base）
  'AND', 'FOR', 'THE', 'BUY', 'SEL', 'GET', 'SET', 'PUT', 'OFF', 'OUT',
  'ALL', 'ANY', 'ARE', 'CAN', 'DID', 'HAS', 'HAD', 'LET', 'MAY', 'NEW',
  'NOT', 'NOW', 'OLD', 'OUR', 'OWN', 'RUN', 'SAY', 'SEE', 'TOP', 'TRY',
  'TWO', 'USE', 'WAY', 'WHO', 'YOU', 'AGO', 'API', 'APP', 'BOT',
  // 交易所 / 市场类型 token，避免 "在 okx 买 btc" 推断为 OKXUSDT。
  'OKX', 'BINANCE', 'HYPERLIQUID', 'SPOT', 'PERP', 'SWAP', 'CONTRACT',
  'EXCHANGE', 'TIMEFRAME', 'MARKETTYPE', 'SYMBOL', 'POSITION', 'POSITIONS',
  'EXECUTIONCONTEXT', 'RULESTREE', 'SEMANTIC', 'ACTION', 'ADD',
  'EXIT', 'ENTRY', 'RISK', 'CONSTRAINT', 'SIZING',
  'MISSING', 'RULES', 'RULESMAINFLOW', 'CONTEXTSLOTS', 'EFFECTS',
  // 字段路径片段：用户在 clarification 答案里粘了 fieldPath（如
  // "rules[0].effects.positions[0].params.value: 10%"）时，避免 PARAMS/VALUE/REASON
  // 等结构性 token 被推断为 base symbol。这些是 SemanticState/StrategyClarificationItem
  // 内部字段名，不可能是合法交易 base。
  'PARAMS', 'VALUE', 'REASON', 'FIELDPATH', 'SLOTKEY', 'SLOTID',
  'OPENSLOTS', 'EVIDENCE', 'STATUS', 'KEY', 'KIND',
])

/** 短句 token 形态：3-10 位大写字母 */
const SHORT_SYMBOL_RE = /^[A-Z]{3,10}$/

/**
 * 判断 token 是否看起来像合法 base symbol（纯数据查表，无业务分流）：
 *   - 3-10 位大写字母
 *   - 不在 QUOTE_TOKENS（quote 货币本身）
 *   - 不在 INDICATOR_KEYWORDS（技术指标/策略/停用词）
 */
function looksLikeBaseToken(token: string): boolean {
  return SHORT_SYMBOL_RE.test(token)
    && !QUOTE_TOKENS.has(token)
    && !INDICATOR_KEYWORDS.has(token)
}

/* ──────────────────────────────────────────────────────────────────────────
 * Generic Parser Registry
 *
 * 每个 ExtractorSpec.kind 对应一个纯函数 parser；dispatcher 通过 spec.kind
 * 查表（不读 atom-key）。新加 parser kind 时在此添加，**不应**为某个 atom
 * 单独写分支。
 * ────────────────────────────────────────────────────────────────────────── */

type ParserFn = (clause: string, spec: ExtractorSpec) => unknown

/**
 * matchNumberAtIndex —— 按 spec.index 取第 N 个匹配的字符串（Issue #1338）。
 * 默认 index=0（首个匹配，保持原行为）。同 pattern 多命中场景（如 "EMA20 上穿 EMA50"）
 * 用此区分位置语义：fastPeriod index=0 → "20"，slowPeriod index=1 → "50"。
 */
function matchNumberAtIndex(clause: string, pattern: string | undefined, fallback: RegExp, index: number): string | undefined {
  const pickCapture = (match: RegExpMatchArray | undefined): string | undefined =>
    match ? (match.slice(1).find(item => item !== undefined) ?? match[0]) : undefined
  if (index === 0) {
    const re = pattern ? new RegExp(pattern, 'i') : fallback
    const m = clause.match(re)
    return pickCapture(m ?? undefined)
  }
  const globalRe = pattern ? new RegExp(pattern, 'gi') : new RegExp(fallback.source, 'g')
  const all = [...clause.matchAll(globalRe)]
  return pickCapture(all[index])
}

/**
 * Issue #1403 通用化 — 数字抽取的 quantifier 上下文过滤。
 *
 * 让 number-int / number-decimal 在 spec.quantifier 声明下统一处理「N + 量词」
 * 上下文约束，替代过去在 pattern 里硬编码 `(\d+)\s*(?:根|条)(?!\s*分钟)` 的
 * ad-hoc 写法。
 *
 * 行为：
 *   - include 非空：clause 内**遍历所有**数字匹配；每个数字必须紧跟 include 中
 *     任一量词（可选空白），首个通过的取返；
 *   - exclude 非空：已通过 include 检查的数字，剥掉 include 量词后**忽略空白**，
 *     不得紧跟 exclude 中任一量词；
 *   - 当 quantifier 在场时**接管** matchNumberAtIndex 路径（自己 matchAll
 *     遍历），spec.index / spec.pattern 仅对无 quantifier 的旧调用生效。
 */
function findNumberWithQuantifier(
  clause: string,
  fallback: RegExp,
  spec: ExtractorSpec,
): string | undefined {
  const q = spec.quantifier
  if (!q || (!q.include?.length && !q.exclude?.length)) return undefined
  const re = new RegExp(spec.pattern ?? fallback.source, 'g')
  for (const m of clause.matchAll(re)) {
    const raw = (m as RegExpMatchArray).slice(1).find(item => item !== undefined) ?? m[0]
    const at = (m.index ?? -1) + m[0].length
    if (at <= 0) continue
    const tail = clause.slice(at).replace(/^\s+/u, '')
    if (q.include?.length) {
      const includeUnit = q.include.find(unit => tail.startsWith(unit))
      if (!includeUnit) continue
      const afterInclude = tail.slice(includeUnit.length).replace(/^\s+/u, '')
      const excludeHit = q.exclude?.some(unit => afterInclude.startsWith(unit)) ?? false
      if (excludeHit) continue
      return raw
    }
    // include 缺省，仅 exclude：直接看 tail
    const excludeHit = q.exclude?.some(unit => tail.startsWith(unit)) ?? false
    if (excludeHit) continue
    return raw
  }
  return undefined
}

const PARSER_NUMBER_INT: ParserFn = (clause, spec) => {
  const raw = spec.quantifier
    ? findNumberWithQuantifier(clause, /\d+/, spec)
    : matchNumberAtIndex(clause, spec.pattern, /\d+/, spec.index ?? 0)
  if (raw === undefined) return undefined
  const n = Number.parseInt(raw, 10)
  if (Number.isNaN(n)) return undefined
  if (spec.range && (n < spec.range[0] || n > spec.range[1])) return undefined
  return n
}

const PARSER_NUMBER_DECIMAL: ParserFn = (clause, spec) => {
  const raw = spec.quantifier
    ? findNumberWithQuantifier(clause, /\d+(?:\.\d+)?/, spec)
    : matchNumberAtIndex(clause, spec.pattern, /\d+(?:\.\d+)?/, spec.index ?? 0)
  if (raw === undefined) return undefined
  const n = Number.parseFloat(raw)
  if (Number.isNaN(n)) return undefined
  if (spec.range && (n < spec.range[0] || n > spec.range[1])) return undefined
  return n
}

const PARSER_PERCENT: ParserFn = (clause, spec) => {
  const re = spec.pattern ? new RegExp(spec.pattern) : /-?\d+(?:\.\d+)?\s*%/
  const m = clause.match(re) ?? clause.match(/(?:百分之?|percent)\s*(-?\d+(?:\.\d+)?)/iu)
  if (!m) return undefined
  const raw = m[1] ?? m[0]
  const sign = raw.startsWith('-') || /下跌|跌|回撤/.test(clause) ? -1 : 1
  const n = Number.parseFloat(raw.replace(/[^\d.]/g, ''))
  if (Number.isNaN(n)) return undefined
  const value = spec.range?.[1] !== undefined && spec.range[1] <= 1
    ? n / 100
    : n
  return sign * value
}

const PARSER_DURATION: ParserFn = (clause, spec) => {
  const re = spec.pattern ? new RegExp(spec.pattern) : /(\d+)\s*([mhdw])/i
  const m = clause.match(re)
    ?? clause.match(/(\d+)\s*(分钟|分|min|m|小时|时|h|天|日|d|周|w)/iu)
  if (!m) return undefined
  const raw = m[0]
  const value = m[1] ?? raw.match(/\d+/u)?.[0]
  if (!value) return undefined
  const unitRaw = m[2] ?? raw.match(/[a-z]+|分钟|分|小时|时|天|日|周/iu)?.[0] ?? ''
  const unit = unitRaw.toLowerCase()
  const normalizedUnit = unit === '分钟' || unit === '分' || unit === 'min'
    ? 'm'
    : unit === '小时' || unit === '时'
      ? 'h'
      : unit === '天' || unit === '日'
        ? 'd'
        : unit === '周'
          ? 'w'
          : unit
  return `${value}${normalizedUnit}`
}

const PARSER_ENUM_ZH_MAP: ParserFn = (clause, spec) => {
  const map = spec.enumMap
  if (!map) return undefined
  const lower = clause.toLowerCase()
  // 长 key 优先匹配（review C2 真 bug 修复）：避免 "大于等于" 被先匹中的 "大于" 提前 short-circuit。
  // Object.entries 不保证按 key 长度排序，必须显式 sort。
  const entries = Object.entries(map).sort(([a], [b]) => b.length - a.length)
  for (const [zh, normalized] of entries) {
    if (lower.includes(zh.toLowerCase())) return normalized
  }
  return undefined
}

const PARSER_TIME_WINDOW_LIST: ParserFn = (clause) => {
  const re = /(\d{1,2})[:：](\d{2})\s*[-~到至]\s*(\d{1,2})[:：](\d{2})/g
  const out: Array<{ start: string, end: string }> = []
  for (const m of clause.matchAll(re)) {
    out.push({
      start: `${m[1].padStart(2, '0')}:${m[2]}`,
      end: `${m[3].padStart(2, '0')}:${m[4]}`,
    })
  }
  return out.length > 0 ? out : undefined
}

// quote 枚举从 SYMBOL_QUOTES 派生，与 SYMBOL_RE 共享单一真相源（M1）
const SYMBOL_BASE_QUOTE_RE = new RegExp(`([A-Z]{2,10})(${SYMBOL_QUOTES.join('|')})`, 'i')
const PARSER_SYMBOL_BASE_QUOTE: ParserFn = (clause) => {
  const m = clause.match(SYMBOL_BASE_QUOTE_RE)
  if (!m) return undefined
  const base = m[1].toUpperCase()
  // H2: base 二次校验——防止 MACD/RSI 等指标词被误作 base
  if (!looksLikeBaseToken(base)) return undefined
  return { base, quote: m[2].toUpperCase() }
}

const PARSER_VERBATIM: ParserFn = (clause) => clause

const GENERIC_PARSERS: Readonly<Record<string, ParserFn>> = {
  'number-int': PARSER_NUMBER_INT,
  'number-decimal': PARSER_NUMBER_DECIMAL,
  'percent': PARSER_PERCENT,
  'duration': PARSER_DURATION,
  'enum-zh-map': PARSER_ENUM_ZH_MAP,
  'time-window-list': PARSER_TIME_WINDOW_LIST,
  'symbol-base-quote': PARSER_SYMBOL_BASE_QUOTE,
  'verbatim-clause': PARSER_VERBATIM,
}

/* ──────────────────────────────────────────────────────────────────────────
 * Derive Function Table（按 ExtractorSpec.derive 查表，不读 atom-key）
 * ────────────────────────────────────────────────────────────────────────── */

type DeriveFn = (clause: string, ctx: ResolveCtx) => unknown

const DERIVES: Readonly<Record<string, DeriveFn>> = {
  'period-range': (clause, ctx) => {
    const period = (ctx.params.period as number | undefined)
      ?? (() => {
        const m = clause.match(/(?:EMA|SMA|MA)\s*[（(]?\s*(\d{1,4})/iu)
          ?? clause.match(/(\d{1,4})\s*(?:日|周期)?均线/iu)
          ?? clause.match(/\d+/)
        return m ? Number.parseInt(m[1] ?? m[0], 10) : 0
      })()
    if (period < 10) return 'short_term'
    if (period < 50) return 'mid_term'
    return 'long_term'
  },
}

function deriveMovingAverageReferenceRole(period: number): 'short_term' | 'mid_term' | 'long_term' {
  if (period < 10) return 'short_term'
  if (period < 50) return 'mid_term'
  return 'long_term'
}

function extractMovingAverageReferencePeriods(clause: string): number[] {
  const compact = clause.replace(/\s+/gu, '')
  const prefixed = Array.from(compact.matchAll(/(?:EMA|SMA|MA)[（(]?(\d{1,4})[)）]?/giu))
    .map(match => Number(match[1]))
    .filter(value => Number.isFinite(value) && value > 0)
  const zh = Array.from(compact.matchAll(/(\d{1,4})(?:日|周期)?均线/gu))
    .map(match => Number(match[1]))
    .filter(value => Number.isFinite(value) && value > 0)
  return Array.from(new Set([...prefixed, ...zh]))
}

function expandMovingAverageReferenceMatches(
  match: Omit<AtomMatch, 'atomKey'>,
  surface: AtomContractSurface,
): Array<Omit<AtomMatch, 'atomKey'>> {
  if (!Object.prototype.hasOwnProperty.call(surface.paramSlots, 'reference.period')) {
    return [match]
  }

  const indicator = typeof match.params.indicator === 'string' ? match.params.indicator.toLowerCase() : ''
  if (indicator !== 'ma' && indicator !== 'sma' && indicator !== 'ema') {
    return [match]
  }

  const periods = extractMovingAverageReferencePeriods(match.clauseText)
  if (periods.length <= 1) {
    return [match]
  }

  return periods.map(period => ({
    ...match,
    params: {
      ...match.params,
      referenceRole: deriveMovingAverageReferenceRole(period),
      'reference.period': period,
    },
  }))
}

/* ──────────────────────────────────────────────────────────────────────────
 * SideResolver eval（按 SideResolverSpec 派生，不读 atom-key）
 *
 * direction → side 的内置映射是通用 NL 知识（与 atom 无关）：
 *   cross_over / gte / touch_lower / breakout_up    → long
 *   cross_under / lte / touch_upper / breakout_down → short
 *   其它 direction                                   → both
 * ────────────────────────────────────────────────────────────────────────── */

const DIRECTION_TO_SIDE: Readonly<Record<string, 'long' | 'short' | 'both'>> = {
  cross_over: 'long',
  gte: 'long',
  touch_lower: 'long',
  breakout_up: 'long',
  cross_under: 'short',
  lte: 'short',
  touch_upper: 'short',
  breakout_down: 'short',
  touch_middle: 'both',
  divergence: 'both',
  fixed: 'both',
}

/**
 * Issue #1338 review M1 修复：close-verb → sideScope 派生表（exit phase 优先）。
 *
 * 现象：'EMA20 下穿 EMA50 时市价平多' 的 phase=exit，但 from-direction 仅按
 *   cross_under direction 派生 short，与"平多"语义矛盾——平的是 long 仓，
 *   sideScope 应为 long。dispatcher 在 exit phase 探测 close-verb 命中即覆盖
 *   direction-derived side，保证 issue #1338 AC："cross_under@exit@long" 不变量。
 *
 * 仅在 phase==='exit' 时启用；entry phase 仍由 direction 派生（'EMA20 上穿 EMA50
 *   开多'：cross_over → long，正确）。
 */
const CLOSE_VERB_TO_SIDE: Readonly<Record<string, 'long' | 'short'>> = {
  '平多': 'long',
  '平多仓': 'long',
  '关多': 'long',
  '卖出': 'long',
  '平空': 'short',
  '平空仓': 'short',
  '关空': 'short',
  'close long': 'long',
  'close short': 'short',
}

const ACTION_VERB_TO_SIDE: Readonly<Record<string, 'long' | 'short'>> = {
  '开多': 'long',
  '做多': 'long',
  '买入': 'long',
  'long': 'long',
  'buy': 'long',
  '开空': 'short',
  '做空': 'short',
  'short': 'short',
  'sell short': 'short',
  ...CLOSE_VERB_TO_SIDE,
}

function detectSideFromVerbMap(
  clause: string,
  verbMap: Readonly<Record<string, 'long' | 'short'>>,
): 'long' | 'short' | null {
  const lower = clause.toLowerCase()
  // 长 key 优先，避免 '平多仓' 被 '平多' 提前 short-circuit（虽然结果相同，但保持
  // matchKeyword 风格一致）
  const entries = Object.entries(verbMap).sort(([a], [b]) => b.length - a.length)
  for (const [verb, side] of entries) {
    if (lower.includes(verb.toLowerCase())) return side
  }
  return null
}

function detectCloseSide(clause: string): 'long' | 'short' | null {
  return detectSideFromVerbMap(clause, CLOSE_VERB_TO_SIDE)
}

function detectExplicitActionSide(clause: string): 'long' | 'short' | null {
  return detectSideFromVerbMap(clause, ACTION_VERB_TO_SIDE)
}

function resolveSide(
  spec: SideResolverSpec,
  clause: string,
  direction: Direction | null,
): 'long' | 'short' | 'both' | null {
  if (spec === 'both') return 'both'
  if (spec === 'inherit') return null
  if (spec === 'from-direction') {
    if (!direction) return null
    return DIRECTION_TO_SIDE[direction] ?? 'both'
  }
  if (typeof spec === 'object' && spec !== null && spec.kind === 'fn') {
    return spec.fn(clause, direction)
  }
  return null
}

/* ──────────────────────────────────────────────────────────────────────────
 * 子句切分（最小可用版本，标点驱动 — 不读 atom-key）
 * ────────────────────────────────────────────────────────────────────────── */

function splitClauses(text: string): string[] {
  if (!text) return []
  return text
    .split(/[，,。；;\n]+|(?<!\d)\.(?!\d)/g)
    .map(s => s.trim())
    .flatMap(splitClauseByEventBoundary)
    .filter(s => s.length > 0)
}

const EVENT_TERMINATOR_RE = /(?:买入|卖出|开多|开空|做多|做空|平多仓?|平空仓?|平仓|止损\s*-?\d+(?:\.\d+)?\s*%?|止盈\s*-?\d+(?:\.\d+)?\s*%?|资金|仓位)/g

function splitClauseByEventBoundary(clause: string): string[] {
  const normalized = clause.replace(/\s+/gu, ' ').trim()
  if (!normalized) return []

  const parts: string[] = []
  let start = 0
  for (const match of normalized.matchAll(EVENT_TERMINATOR_RE)) {
    const end = match.index + match[0].length
    const part = normalized.slice(start, end).trim()
    if (part) parts.push(part)
    start = end
  }

  const tail = normalized.slice(start).trim()
  if (tail) parts.push(tail)
  return parts.length > 0 ? parts : [normalized]
}

type ExtractedSizingRole = {
  readonly sizing: SemanticPositionSizingContract
  readonly evidenceText: string
}

const SIZING_SLOT_RE = /(?:sizing|size|budget)/iu
const SIZING_ROLE_PREFIX_RE = /(?:仓位|资金(?!费率)|比例|使用|投入|固定|单笔|每格|每次|每笔|每单|用|加投|加仓|补仓|账户权益(?:的)?|权益(?:的)?|账户资金(?:的)?|(?:使用|用|投入).*(?:账户权益|权益|账户资金)(?:的)?)\s*(?:使用|用|投入)?\s*[：:]?\s*$/u
const SIZING_ROLE_SUFFIX_RE = /^\s*(?:仓位|资金(?!费率)|比例)/u
const RISK_ROLE_NEAR_RE = /(?:止损|止盈|亏损|盈利|ATR|atr)\s*$/u
const EXIT_PRICE_CHANGE_NEAR_RE = /(?:上涨|下跌|涨|跌|突破|跌破|回撤|回落|回到|低于|高于|触及|相对入场均价)\s*$/u
const EXIT_ACTION_AFTER_RE = /^\s*(?:时|就|则)?\s*(?:卖出|平仓|平多|平空|退出|止损|止盈)/u

function hasSizingRoleContext(text: string, index: number, length: number): boolean {
  const prefix = text.slice(Math.max(0, index - 14), index)
  const suffix = text.slice(index + length, index + length + 14)
  if (RISK_ROLE_NEAR_RE.test(prefix) || /^(?:\s*(?:止损|止盈|亏损|盈利|ATR|atr))/u.test(suffix)) return false
  if (EXIT_PRICE_CHANGE_NEAR_RE.test(prefix) && EXIT_ACTION_AFTER_RE.test(suffix)) return false
  return SIZING_ROLE_PREFIX_RE.test(prefix) || SIZING_ROLE_SUFFIX_RE.test(suffix)
}

function normalizeQuoteAsset(input: string): 'USDT' | 'USDC' | 'USD' {
  const upper = input.toUpperCase()
  if (upper === 'USDT' || upper === 'U') return 'USDT'
  if (upper === 'USDC') return 'USDC'
  return 'USD'
}

function parseSizingPercentNumber(valueText: string | undefined): number {
  if (!valueText) return Number.NaN
  const numeric = Number(valueText)
  if (Number.isFinite(numeric)) return numeric
  const digitMap: Record<string, number> = {
    一: 1,
    二: 2,
    三: 3,
    四: 4,
    五: 5,
    六: 6,
    七: 7,
    八: 8,
    九: 9,
  }
  if (valueText === '十') return 10
  const tenIndex = valueText.indexOf('十')
  if (tenIndex >= 0) {
    const leadingText = valueText.slice(0, tenIndex)
    const trailingText = valueText.slice(tenIndex + 1)
    const leading = leadingText === '' ? 1 : digitMap[leadingText]
    const trailing = trailingText === '' ? 0 : digitMap[trailingText]
    return leading !== undefined && trailing !== undefined ? leading * 10 + trailing : Number.NaN
  }
  return digitMap[valueText] ?? Number.NaN
}

function extractSizingRoleFromText(text: string): ExtractedSizingRole | null {
  const normalized = text.trim().replace(/\s+/gu, ' ').replace(/％/gu, '%')
  if (!normalized) return null

  const percentPattern = /(?:百分之?\s*(\d+(?:\.\d+)?|[一二三四五六七八九十]+)|(\d+(?:\.\d+)?)\s*%)/gu
  for (const match of normalized.matchAll(percentPattern)) {
    if (match.index === undefined) continue
    if (!hasSizingRoleContext(normalized, match.index, match[0].length)) continue
    const percent = parseSizingPercentNumber(match[1] ?? match[2])
    if (!Number.isFinite(percent) || percent <= 0 || percent > 100) continue
    return {
      sizing: { kind: 'ratio', value: percent / 100, unit: 'ratio' },
      evidenceText: normalized,
    }
  }

  const quotePattern = /(?<![\d.])(\d+(?:\.\d+)?)\s*(USDT|USDC|USD|[uU](?![A-Za-z0-9])|刀|美元)/giu
  for (const match of normalized.matchAll(quotePattern)) {
    if (match.index === undefined || !match[1] || !match[2]) continue
    const isBareAnswer = normalized === match[0]
    if (!isBareAnswer && !hasSizingRoleContext(normalized, match.index, match[0].length)) continue
    const value = Number(match[1])
    if (!Number.isFinite(value) || value <= 0) continue
    return {
      sizing: { kind: 'quote', value, asset: normalizeQuoteAsset(match[2]) },
      evidenceText: normalized,
    }
  }

  const bareNumberPattern = /(?<![\d.])(\d+(?:\.\d+)?)(?![\d.]|\s*(?:%|％))/gu
  for (const match of normalized.matchAll(bareNumberPattern)) {
    if (match.index === undefined || !match[1]) continue
    if (!hasSizingRoleContext(normalized, match.index, match[0].length)) continue
    const value = Number(match[1])
    if (!Number.isFinite(value) || value <= 0) continue
    return {
      sizing: { kind: 'quote', value, asset: 'USDT' },
      evidenceText: normalized,
    }
  }

  return null
}

function extractTopLevelPositionSizingRole(clauses: readonly string[], fullText: string): ExtractedSizingRole | null {
  const isLifecycleClause = (clause: string): boolean =>
    /(?:DCA|dca|定投|加投|加仓|补仓|回撤)/u.test(clause)

  return clauses
    .filter(clause => !isLifecycleClause(clause))
    .map(clause => extractSizingRoleFromText(clause))
    .find((role): role is ExtractedSizingRole => role !== null)
    ?? (isLifecycleClause(fullText) ? null : extractSizingRoleFromText(fullText))
}

function toPerOrderSizingShape(sizing: SemanticPositionSizingContract): Record<string, unknown> {
  return { ...sizing }
}

function semanticPositionModeFromSizing(sizing: SemanticPositionSizingContract): string {
  if (sizing.kind === 'ratio') return 'fixed_ratio'
  if (sizing.kind === 'quote') return 'fixed_quote'
  return 'fixed_qty'
}

function extractParamsWithSizingRoles(
  paramSlots: Readonly<Record<string, ParamSlotSchema>>,
  clause: string,
  atomKey: string,
): Record<string, unknown> {
  const params = normalizeLifecycleParams(atomKey, clause, extractParams(paramSlots, clause, atomKey))
  const hasSizingSlot = Object.keys(paramSlots).some(slotKey => SIZING_SLOT_RE.test(slotKey))
  if (!hasSizingSlot) return params

  const role = extractSizingRoleFromText(clause)
  if (!role) return params

  params.perOrderSizing = toPerOrderSizingShape(role.sizing)
  for (const slotKey of Object.keys(paramSlots)) {
    if (!SIZING_SLOT_RE.test(slotKey)) continue
    if (role.sizing.kind === 'ratio') {
      params[slotKey] = role.sizing.value
    }
  }
  return params
}

function normalizeLifecycleParams(
  atomKey: string,
  clause: string,
  params: Record<string, unknown>,
): Record<string, unknown> {
  if (atomKey === ATOM_CONTRACT_REGISTRY['position.dca_schedule'].key) {
    return normalizeDcaScheduleParams(clause, params)
  }

  if (atomKey === ATOM_CONTRACT_REGISTRY['action.add_position'].key) {
    const sizingRole = extractSizingRoleFromText(clause)
    const next = { ...params }
    if (typeof next.drawdownThreshold === 'number') next.drawdownThreshold = Math.abs(next.drawdownThreshold)
    if (typeof next.profitThreshold === 'number') next.profitThreshold = Math.abs(next.profitThreshold)
    if (next.addMode === 'drawdown_pct') delete next.profitThreshold
    if (next.addMode === 'profit_pct') delete next.drawdownThreshold
    if (sizingRole) {
      next.sizing = toPerOrderSizingShape(sizingRole.sizing)
      delete next.addRatio
    }
    else if (typeof next.addRatio === 'number') {
      next.addRatio = Math.abs(next.addRatio)
    }
    return next
  }

  if (atomKey === ATOM_CONTRACT_REGISTRY['portfolioRisk.drawdown_block'].key) {
    const next = { ...params }
    if (typeof next.thresholdPct === 'number') next.thresholdPct = Math.abs(next.thresholdPct)
    return next
  }

  return params
}

function normalizeDcaScheduleParams(
  clause: string,
  params: Record<string, unknown>,
): Record<string, unknown> {
  const next: Record<string, unknown> = { ...params }
  const sizingRole = extractSizingRoleFromText(clause)
  const perOrderBudget = typeof params.perOrderBudget === 'number' && Number.isFinite(params.perOrderBudget)
    ? params.perOrderBudget
    : null
  if (sizingRole) {
    next.perOrderSizing = toPerOrderSizingShape(sizingRole.sizing)
  }
  else if (perOrderBudget !== null && perOrderBudget > 0) {
    next.perOrderSizing = { kind: 'quote', value: perOrderBudget, asset: 'USDT' }
  }
  delete next.perOrderBudget

  // #s30：当 DCA 子句同时声明「定投 X」与「回撤 N% 加投 Y」两段 sizing 时，
  //   主 leg 的 perOrderSizing 取首段，第二段 sizing 透传为 drawdownPerOrderSizing，
  //   保证回撤加投金额不被静默丢弃（generic：不做 case 模板，只识别 "回撤/加投/补仓" 切分点）。
  const drawdownSplitMatch = clause.match(/(回撤|加投|补仓)/u)
  if (drawdownSplitMatch && drawdownSplitMatch.index !== undefined) {
    const tail = clause.slice(drawdownSplitMatch.index)
    const tailRole = extractSizingRoleFromText(tail)
    const primary = next.perOrderSizing as { kind?: string; value?: number; asset?: string } | undefined
    if (
      tailRole
      && tailRole.sizing.kind === 'quote'
      && (
        !primary
        || primary.kind !== tailRole.sizing.kind
        || primary.value !== tailRole.sizing.value
        || primary.asset !== tailRole.sizing.asset
      )
    ) {
      next.drawdownPerOrderSizing = toPerOrderSizingShape(tailRole.sizing)
    }
  }

  const explicitMaxCount = clause.match(/最多\s*(\d{1,4})\s*(?:次|笔|单)/u)
  if (explicitMaxCount) {
    next.maxCount = Number(explicitMaxCount[1])
  }
  delete next.maxOrders

  const capitalCap = clause.match(/(?:总(?:投入|资金|预算|金额)|上限|不超过)\s*(\d+(?:\.\d+)?)\s*(USDT|USDC|USD|[uU](?![A-Za-z0-9])|刀|美元)/iu)
  if (capitalCap) {
    next.capitalCap = {
      kind: 'quote',
      value: Number(capitalCap[1]),
      asset: normalizeQuoteAsset(capitalCap[2]),
    }
  }

  if (/每天|每日/u.test(clause)) {
    next.triggerMode = 'time_interval'
    next.timeIntervalBars = 1
  }
  else if (/每周|每星期/u.test(clause)) {
    next.triggerMode = 'time_interval'
    next.timeIntervalBars = 7
  }
  else if (/每月/u.test(clause)) {
    next.triggerMode = 'time_interval'
    next.timeIntervalBars = 30
  }
  else if (typeof params.dropPct === 'number' && Number.isFinite(params.dropPct)) {
    next.triggerMode = 'price_interval'
    next.priceIntervalPct = params.dropPct
  }

  return next
}

function removeInPlace<T>(items: T[], predicate: (item: T) => boolean): void {
  for (let i = items.length - 1; i >= 0; i--) {
    if (predicate(items[i]!)) items.splice(i, 1)
  }
}

/* ──────────────────────────────────────────────────────────────────────────
 * contextSlots 抽取（NL 通用解析，不读 atom-key）
 * ────────────────────────────────────────────────────────────────────────── */

const EXCHANGE_RE = /\b(okx|binance|bybit|coinbase|kraken|huobi|gate|bitget)\b|欧易|币安/i
const EXCHANGE_ALIASES: Readonly<Record<string, string>> = {
  '欧易': 'okx',
  '币安': 'binance',
}
// quote 枚举从 SYMBOL_QUOTES 派生，两处保持单一真相源（M1）
const SYMBOL_RE = new RegExp(`([A-Z]{2,10})[\\s/]?(${SYMBOL_QUOTES.join('|')})\\b`, 'i')
const TIMEFRAME_RE = /\b(1m|3m|5m|15m|30m|1h|2h|4h|6h|8h|12h|1d|3d|1w)\b/i
/**
 * PR2c-final-2 Step1：复合 timeframe 形态识别（短 token surface 精度补齐）。
 *
 * 覆盖：
 *   - "15min" / "15 min" / "15分钟" / "15 分钟" → '15m'
 *   - "4 小时" / "4小时" / "4hours"            → '4h'
 *   - "1 天" / "1天" / "1day"                  → '1d'
 *   - "1 周" / "1周" / "1week"                 → '1w'
 *
 * 单位归一是通用 NL 知识，与 atom-key 无关；表内 token 都是物理时间单位字面量，
 * 与 BUCKET_LITERALS / atom-key prefix 集合不交叉，AC-13 / no-atom-key-literal
 * 不会误报。
 */
const TIMEFRAME_COMPOUND_RE = /(?<![A-Za-z0-9])(\d{1,3})\s*(分钟|小时|天|周(?!期)|min(?:ute)?s?|hours?|days?|weeks?|m|h|d|w)(?![A-Za-z0-9])/i
const TIMEFRAME_DAILY_RE = /(?<![A-Za-z0-9])(?:日线|日K|daily)(?![A-Za-z0-9])/iu
const TIMEFRAME_TOKEN_RE = /(?<![A-Za-z0-9])(?:(1m|3m|5m|15m|30m|1h|2h|4h|6h|8h|12h|1d|3d|1w)|(\d{1,3})\s*(分钟|小时|天|周(?!期)|min(?:ute)?s?|hours?|days?|weeks?|m|h|d|w)|(日线|日K|daily))(?![A-Za-z0-9])/gi
const TIMEFRAME_UNIT_TO_CANONICAL: Readonly<Record<string, 'm' | 'h' | 'd' | 'w'>> = {
  '分钟': 'm',
  'min': 'm',
  'mins': 'm',
  'minute': 'm',
  'minutes': 'm',
  'm': 'm',
  '小时': 'h',
  'hour': 'h',
  'hours': 'h',
  'h': 'h',
  '天': 'd',
  'day': 'd',
  'days': 'd',
  'd': 'd',
  '周': 'w',
  'week': 'w',
  'weeks': 'w',
  'w': 'w',
}
function normalizeCompoundTimeframe(valueRaw: string | undefined, unitRaw: string | undefined): string | undefined {
  if (!valueRaw || !unitRaw) return undefined
  const value = Number.parseInt(valueRaw, 10)
  if (Number.isNaN(value) || value <= 0) return undefined
  const unit = TIMEFRAME_UNIT_TO_CANONICAL[unitRaw.toLowerCase()]
  if (!unit) return undefined
  return `${value}${unit}`
}
function tryNormalizeTimeframes(text: string): string[] {
  const values: string[] = []
  const seen = new Set<string>()
  for (const match of text.matchAll(TIMEFRAME_TOKEN_RE)) {
    const timeframe = typeof match[1] === 'string' && match[1].length > 0
      ? match[1].toLowerCase()
      : typeof match[4] === 'string' && match[4].length > 0
        ? '1d'
        : normalizeCompoundTimeframe(match[2], match[3])
    if (!timeframe || seen.has(timeframe)) continue
    seen.add(timeframe)
    values.push(timeframe)
  }
  return values
}
function tryNormalizeTimeframe(text: string): string | undefined {
  const firstByPosition = tryNormalizeTimeframes(text)[0]
  if (firstByPosition) return firstByPosition
  if (TIMEFRAME_DAILY_RE.test(text)) return '1d'
  const compound = text.match(TIMEFRAME_COMPOUND_RE)
  if (!compound) return undefined
  return normalizeCompoundTimeframe(compound[1], compound[2])
}
// #1296：加 \b 边界，避免 'perpetual swap' / 'perplexity' 等英文长词被前缀误命中；
// 中文 '合约' / '永续' 不需要边界（CJK 字符默认无 word char 邻接歧义）。
// 'spot' 同理避免 'spotlight' 等前缀误命中。
const MARKET_TYPE_PERP_RE = /合约|永续|\bperp\b/i
const MARKET_TYPE_SPOT_RE = /现货|\bspot\b/i

export interface ExplicitSymbolSlot {
  value: string
  source: 'user_explicit'
  evidenceText: string
  base: string
  quote: string
  quoteSource: 'explicit'
}

export interface InferredSymbolSlot {
  value: string
  source: 'inferred'
  evidenceText: string
  base: string
  quote: string
  quoteSource: 'default_usdt'
}

interface ContextSlots {
  exchange?: string
  symbol?: ExplicitSymbolSlot | InferredSymbolSlot
  marketType?: 'perp' | 'spot'
  timeframe?: string
}

/**
 * 短句 symbol 推断（pure data-lookup, no business-rule branching）:
 * 将整条文本按空白/标点切分后，找第一个通过 looksLikeBaseToken 的 token。
 * 产出 source='inferred' + quoteSource='default_usdt'（quote 默认 USDT）。
 */
function tryInferShortSymbol(text: string): InferredSymbolSlot | undefined {
  const tokens = text.match(/(?<![A-Za-z0-9])[A-Za-z]{2,10}(?![A-Za-z0-9])/gu) ?? []
  for (const token of tokens) {
    const upper = token.toUpperCase()
    if (looksLikeBaseToken(upper)) {
      const value = `${upper}USDT`
      return {
        value,
        source: 'inferred',
        evidenceText: token,
        base: upper,
        quote: 'USDT',
        quoteSource: 'default_usdt',
      }
    }
  }
  return undefined
}

function normalizeExchange(value: string): string {
  return EXCHANGE_ALIASES[value] ?? value.toLowerCase()
}

function extractContextSlots(text: string): ContextSlots | undefined {
  const slots: ContextSlots = {}
  const exMatch = text.match(EXCHANGE_RE)
  if (exMatch) slots.exchange = normalizeExchange(exMatch[1] ?? exMatch[0])
  const symMatch = text.match(SYMBOL_RE)
  if (symMatch) {
    const base = symMatch[1].toUpperCase()
    const quote = symMatch[2].toUpperCase()
    // H1: base 二次校验——防止 MACD/RSI 等指标词被 SYMBOL_RE 误匹配为 base
    if (looksLikeBaseToken(base)) {
      const value = `${base}${quote}`
      slots.symbol = {
        value,
        source: 'user_explicit',
        evidenceText: value,
        base,
        quote,
        quoteSource: 'explicit',
      }
    }
  }
  if (!slots.symbol) {
    // 短句 fallback：'BTC' / 'ETH' / 'SOL' 等单 base token → 推断 USDT
    const inferred = tryInferShortSymbol(text)
    if (inferred) slots.symbol = inferred
  }
  const tf = tryNormalizeTimeframe(text)
  if (tf) slots.timeframe = tf
  if (MARKET_TYPE_PERP_RE.test(text)) slots.marketType = 'perp'
  else if (MARKET_TYPE_SPOT_RE.test(text)) slots.marketType = 'spot'
  if (Object.keys(slots).length === 0) return undefined
  return slots
}

/* ──────────────────────────────────────────────────────────────────────────
 * Param 抽取（按 ExtractorSpec 查表，不读 atom-key）
 * ────────────────────────────────────────────────────────────────────────── */

function extractParams(
  paramSlots: Readonly<Record<string, ParamSlotSchema>>,
  clause: string,
  atomKey: string,
): Record<string, unknown> {
  const params: Record<string, unknown> = {}
  for (const [slotKey, schema] of Object.entries(paramSlots)) {
    let value: unknown
    const ext = schema.extractor
    if (ext) {
      const parser = GENERIC_PARSERS[ext.kind]
      // review M3：parser/derive 找不到必须抛错而非静默吞——typo 应该立刻被发现
      if (!parser) {
        throw new Error(
          `[GenericSeedDispatcher] Unknown extractor.kind="${ext.kind}" for atom="${atomKey}" slot="${slotKey}". `
          + `Register parser in GENERIC_PARSERS or fix typo in registry.`,
        )
      }
      value = parser(clause, ext)
      if ((value === undefined || value === null) && ext.derive) {
        const derive = DERIVES[ext.derive]
        if (!derive) {
          throw new Error(
            `[GenericSeedDispatcher] Unknown extractor.derive="${ext.derive}" for atom="${atomKey}" slot="${slotKey}". `
            + `Register derive in DERIVES or fix typo in registry.`,
          )
        }
        value = derive(clause, { atomKey, params })
      }
      if ((value === undefined || value === null) && ext.default !== undefined) {
        value = ext.default
      }
    }
    if ((value === undefined || value === null) && schema.default !== undefined) {
      value = schema.default
    }
    if (value !== undefined && value !== null) {
      params[slotKey] = value
    }
  }
  return params
}

/* ──────────────────────────────────────────────────────────────────────────
 * Bucket → Patch slot 派生表
 *
 * 红线说明：本表是 patch 数据结构 schema 派生（CodegenSemanticPatch 顶层
 * 字段就是 triggers / actions / risk / position 等），不是业务规则分流。
 * 改 patch schema 时（PR3+）才会动；新增 atom 不会动。
 * ────────────────────────────────────────────────────────────────────────── */

// #1298：key 改 AtomContractBucket 联合类型——新增 bucket 必须在此表显式声明，
// 否则 TS exhaustive check 编译报错；不再依赖运行时 `if (!slot) continue` silent skip。
const BUCKET_TO_PATCH_SLOT: Readonly<Record<AtomContractBucket, 'triggers' | 'actions' | 'risk' | null>> = {
  trigger: 'triggers',
  action: 'actions',
  risk: 'risk',
  positionConstraint: null,
  orchestration: null,
}

type PatchAtomNode = Record<string, unknown> & {
  key: string
  phase: 'entry' | 'exit' | 'gate' | 'program' | null
  sideScope?: 'long' | 'short' | 'both' | null
  params: Record<string, unknown>
  evidence?: unknown
}

interface InternalSeedDraft {
  contextSlots?: CodegenSemanticPatch['contextSlots']
  position?: SemanticPositionState
  triggers?: PatchAtomNode[]
  actions?: PatchAtomNode[]
  risk?: PatchAtomNode[]
  atoms?: PatchAtomNode[]
}

type RuleEffectRole = keyof RuleEffectsByRole

const EMPTY_RULE_EFFECTS = (): Record<RuleEffectRole, AtomExpr[]> => ({
  actions: [],
  risks: [],
  positions: [],
  orchestration: [],
  programs: [],
})

function canMergePatchAtomParams(left: Record<string, unknown>, right: Record<string, unknown>): boolean {
  for (const [key, value] of Object.entries(right)) {
    if (!(key in left)) {
      continue
    }
    if (JSON.stringify(left[key]) !== JSON.stringify(value)) {
      return false
    }
  }
  return true
}

function mergeCompatiblePatchAtomNodes<T extends PatchAtomNode>(nodes: T[]): T[] {
  const out: T[] = []
  for (const node of nodes) {
    const existing = out.find(item =>
      item.key === node.key
      && item.phase === node.phase
      && (item.sideScope ?? null) === (node.sideScope ?? null)
      && canMergePatchAtomParams(item.params, node.params),
    )
    if (!existing) {
      out.push(node)
      continue
    }
    existing.params = { ...existing.params, ...node.params }
    existing.evidence = existing.evidence ?? node.evidence
  }
  return out
}

function isEvidenceWithText(value: unknown): value is { text: string } {
  return !!value
    && typeof value === 'object'
    && typeof (value as { text?: unknown }).text === 'string'
    && (value as { text: string }).text.trim().length > 0
}

/* ──────────────────────────────────────────────────────────────────────────
 * Dispatcher 主体（pure registry-driven）
 * ────────────────────────────────────────────────────────────────────────── */

@Injectable()
export class GenericSeedDispatcher {
  constructor() {}

  /** review M12：input length cap 防 ReDoS（registry pattern 含回溯型 regex 时长 utterance 触发指数爆炸）*/
  static readonly MAX_UTTERANCE_LENGTH = 10000

  dispatch(message?: string): DispatchResult {
    const text = (message ?? '').trim()
    const flatPatch = this.dispatchFlatPatch(text)
    const rules = this.buildTypedRulesFromFlatPatch(flatPatch, text)
    return {
      ...(flatPatch.contextSlots ? { contextSlots: flatPatch.contextSlots } : {}),
      ...(rules.length > 0 ? { rules } : {}),
    }
  }

  private dispatchFlatPatch(message?: string): InternalSeedDraft {
    const text = (message ?? '').trim()
    if (text.length > GenericSeedDispatcher.MAX_UTTERANCE_LENGTH) {
      throw new Error(
        `[GenericSeedDispatcher] utterance length ${text.length} exceeds MAX_UTTERANCE_LENGTH=${GenericSeedDispatcher.MAX_UTTERANCE_LENGTH}; reject to prevent ReDoS.`,
      )
    }
    const patch: InternalSeedDraft = {}

    const ctx = extractContextSlots(text)
    if (ctx) patch.contextSlots = ctx as CodegenSemanticPatch['contextSlots']

    const clauses = splitClauses(text)
    const sizingRole = extractTopLevelPositionSizingRole(clauses, text)
    if (sizingRole) {
      patch.position = {
        mode: semanticPositionModeFromSizing(sizingRole.sizing),
        value: sizingRole.sizing.value,
        positionMode: 'long_only',
        sizing: sizingRole.sizing,
        status: 'locked',
        source: 'user_explicit',
        evidence: { text: sizingRole.evidenceText, source: 'user_explicit' },
        openSlots: [],
      }
    }
    const slotItems: Record<'triggers' | 'actions' | 'risk', PatchAtomNode[]> = {
      triggers: [],
      actions: [],
      risk: [],
    }
    const atomItems: PatchAtomNode[] = []
    // Issue #1338 Phase 4：跨 clause 命中去重——同一 atom 在多个 clause 命中且
    // (phase, sideScope, params) 完全相同时，只保留首条。例如 'EMA20 上穿 EMA50
    // 时市价开多；EMA20 下穿 EMA50 时市价平多' 中 position.no_position 因 verb '时'
    // 两次命中产生重复 gate 规则；dedupe 后只保留 1 条。
    const slotDedupeKeys: Record<'triggers' | 'actions' | 'risk', Set<string>> = {
      triggers: new Set(),
      actions: new Set(),
      risk: new Set(),
    }
    const atomDedupeKeys = new Set<string>()

    for (const clause of clauses) {
      const matches = this.matchClauseAgainstRegistry(clause)
      const clauseTimeframes = tryNormalizeTimeframes(clause)
      for (const m of matches) {
        const contract = (ATOM_CONTRACT_REGISTRY as Record<string, AtomContract>)[m.atomKey]
        if (!contract) continue
        const slot = BUCKET_TO_PATCH_SLOT[contract.bucket]

        const timeframeFanout = clauseTimeframes.length > 1 && isTimeframeGroupableTriggerKey(m.atomKey)
          ? clauseTimeframes
          : [null]
        const phase = m.phase ?? 'entry'
        const sideScope = m.sideScope ?? 'both'

        for (const fanoutTimeframe of timeframeFanout) {
          const params = fanoutTimeframe === null
            ? { ...m.params }
            : { ...m.params, timeframe: fanoutTimeframe }

          // Issue #1338 Phase 4：dedupe key 用 (atomKey, phase, sideScope, sorted params JSON)，
          // 跨 clause 等价命中只保留首条。
          const sortedParams = Object.fromEntries(
            Object.entries(params).sort(([a], [b]) => a.localeCompare(b)),
          )
          const dedupeKey = `${m.atomKey}|${phase}|${sideScope}|${JSON.stringify(sortedParams)}`
          if (atomDedupeKeys.has(dedupeKey)) continue
          atomDedupeKeys.add(dedupeKey)
          if (slot) {
            if (slotDedupeKeys[slot].has(dedupeKey)) continue
            slotDedupeKeys[slot].add(dedupeKey)
          }

          // evidence.source 由 atom surface.evidenceProvenance 声明（数据驱动，无 atom-key 字面量比较）。
          // external.signal 声明 'webhook'；其余 atom 省略，默认 'user_explicit'。
          const evidenceSource: NonNullable<AtomContractSurface['evidenceProvenance']> = contract.surface?.evidenceProvenance ?? 'user_explicit'
          const evidence = { text: m.clauseText, source: evidenceSource }
          // phase は resolver が解決した後に全 slot に記録する（M1: actionMatchesFulfilledPhases が
          // action.phase を参照できるよう action にも phase を付与）。
          // sideScope は triggers のみ意味を持つため引き続き trigger 限定。
          const node: PatchAtomNode = {
            key: m.atomKey,
            phase,
            params,
            evidence,
          }
          if (slot === 'triggers' || slot === 'actions' || slot === 'risk') {
            node.sideScope = sideScope
          }
          atomItems.push({ ...node, sideScope })
          if (slot) {
            slotItems[slot].push(node)
          }
        }
      }
    }

    // Issue #1383 后续：跨子句对偶继承通用 pass（registry-driven, atom-contract = 唯一真相源）
    //
    // 适用场景：用户在出场/入场子句省略 keyword，例如
    //   "EMA7 上穿 EMA21 时开多；下穿 时平多" 出场子句只有动词没有指标 keyword。
    // dispatcher 不再硬编码对偶规则；任意 atom 在 contract.surface.crossClauseInheritFrom
    // 声明继承源 + inheritParams 即可参与本机制。
    this.applyCrossClauseInheritance(
      clauses,
      atomItems,
      slotItems,
      atomDedupeKeys,
      slotDedupeKeys,
    )

    // s30: 跨子句 DCA drawdown leg sizing 回填（generic）
    //   场景："每天定投 100 USDT，回撤 5% 加投 200 USDT"——splitClauses 在 `，` 处切分后，
    //   首段命中 position.dca_schedule（"定投"），尾段（"回撤 5% 加投 200 USDT"）不含 DCA
    //   keyword 故无独立 match。normalizeDcaScheduleParams 仅看单子句，无法察觉尾段 sizing。
    //   此处在 dispatcher 末段扫描全文：若存在 DCA atom 且 text 含"回撤/加投/补仓"语义切分点，
    //   抽取尾段 sizing 透传为 drawdownPerOrderSizing（并补 dropPct）。
    this.applyDcaDrawdownLegBackfill(text, atomItems, slotItems)

    // #1633 s29: 跨子句 pyramiding 触发阈值 + 加仓比例 backfill（generic）
    //   场景："盈利 N% 后加仓 M% ... 最多加 K 层"——splitClauses 在 `，` 处切分后，
    //   pyramiding_limit 仅由 "最多加 K 层" 子句命中（keyword '最多加'），单子句
    //   范围内既无 "加仓 M%" 也无 "盈利 N%"，故 maxLayers 命中但 layerSizing /
    //   profitThreshold 抽不到。此处在 dispatcher 末段扫描全文回填，让下游 token 检查
    //   能配对 take_profit + N% + M% pair（staging30 #1633 s29 修复）。
    this.applyPyramidingProfitTriggerBackfill(text, atomItems, slotItems)

    this.applySemanticConflictResolution(atomItems, slotItems)

    // review C3：替代 `as never` 类型逃生，使用 patch schema 自身派生的精确 cast；
    // 未来 PR3+ 改 CodegenSemanticPatch 字段类型时编译器能抓到 mismatch。
    const mergedSlotItems: Record<'triggers' | 'actions' | 'risk', PatchAtomNode[]> = {
      triggers: mergeCompatiblePatchAtomNodes(slotItems.triggers),
      actions: mergeCompatiblePatchAtomNodes(slotItems.actions),
      risk: mergeCompatiblePatchAtomNodes(slotItems.risk),
    }
    const mergedAtomItems = mergeCompatiblePatchAtomNodes(atomItems)

    if (mergedSlotItems.triggers.length > 0) {
      patch.triggers = mergedSlotItems.triggers
    }
    if (mergedSlotItems.actions.length > 0) {
      patch.actions = mergedSlotItems.actions
    }
    if (mergedSlotItems.risk.length > 0) {
      patch.risk = mergedSlotItems.risk
    }
    if (mergedAtomItems.length > 0) {
      patch.atoms = mergedAtomItems
    }

    return patch
  }

  private buildTypedRulesFromFlatPatch(
    flatPatch: InternalSeedDraft,
    userMessage: string,
  ): SemanticRule[] {
    const predicates = this.collectTypedRulePredicates(flatPatch, userMessage)
    const effects = this.collectTypedRuleGlobalEffects(flatPatch, userMessage)
    if (predicates.length === 0 || effects.length === 0) return []

    const hasProgramStrategySignal = this.hasProgramStrategySignal(userMessage)
    const phases = new Set<SemanticRule['phase']>()
    for (const predicate of predicates) phases.add(this.normalizeTypedRulePhase(predicate.phase))
    for (const effect of effects) {
      if (effect.kind !== 'atom') continue
      const phase = typeof effect.params.phase === 'string' ? effect.params.phase : null
      if (phase === 'entry' || phase === 'exit' || phase === 'gate' || phase === 'program') phases.add(phase)
      if (this.isProgramEffectAtom(effect.key)) phases.add('program')
    }
    if (/平仓|平多|平空|卖出|止盈|止损|跌破|下穿|close|sell/iu.test(userMessage)) phases.add('exit')
    if (/只做|只在|已有持仓|如果已有|过滤|filter|gate|(?:上方|下方)\s*[，,]\s*(?!出场|平仓|平多|平空|卖出|跌破|下穿)/iu.test(userMessage)) phases.add('gate')
    if (hasProgramStrategySignal) phases.add('program')
    if (phases.size === 0) phases.add('entry')

    const rules: SemanticRule[] = []
    for (const phase of phases) {
      const phasePredicates = predicates.filter(item => this.normalizeTypedRulePhase(item.phase) === phase)
      const predicate = phasePredicates[0] ?? this.selectTypedRuleFallbackPredicate(
        predicates,
        phase,
        hasProgramStrategySignal,
      )
      if (!predicate) continue
      const sideScope = predicate.sideScope ?? 'both'
      const typedEffects = EMPTY_RULE_EFFECTS()
      for (const effect of effects) {
        if (!this.typedEffectAppliesToPhase(effect, phase)) continue
        this.appendTypedEffect(typedEffects, effect)
      }
      const condition = phasePredicates.length > 1
        ? {
            kind: 'and' as const,
            children: phasePredicates.map(item => ({
              kind: 'atom' as const,
              key: item.key,
              params: item.params ?? {},
              ...(item.sideScope ? { sideScope: item.sideScope } : {}),
              ...(isEvidenceWithText(item.evidence) ? { evidence: { text: item.evidence.text } } : {}),
            })),
          }
        : {
            kind: 'atom' as const,
            key: predicate.key,
            params: predicate.params ?? {},
            ...(predicate.sideScope ? { sideScope: predicate.sideScope } : {}),
            ...(isEvidenceWithText(predicate.evidence) ? { evidence: { text: predicate.evidence.text } } : {}),
          }
      rules.push({
        id: `dispatcher-typed-rule-${rules.length + 1}`,
        phase,
        sideScope,
        condition,
        effects: typedEffects,
        ...(isEvidenceWithText(predicate.evidence) ? { evidence: { text: predicate.evidence.text } } : {}),
      })
    }
    return rules
  }

  private selectTypedRuleFallbackPredicate(
    predicates: PatchAtomNode[],
    phase: SemanticRule['phase'],
    hasProgramStrategySignal: boolean,
  ): PatchAtomNode | null {
    if (phase === 'program') return predicates[0] ?? null
    const nonProgramPredicate = predicates.find(item => this.normalizeTypedRulePhase(item.phase) !== 'program')
    if (nonProgramPredicate) return nonProgramPredicate
    const fallback = predicates[0]
    if (
      !hasProgramStrategySignal
      && fallback?.key === ATOM_CONTRACT_REGISTRY['execution.on_start'].key
    ) {
      return fallback
    }
    return null
  }

  private appendTypedEffect(
    effects: Record<RuleEffectRole, AtomExpr[]>,
    effect: AtomExpr,
  ): void {
    const role = this.resolveRuleEffectRole(effect)
    if (!role) return
    const signature = this.semanticEffectSignature(effect)
    if (effects[role].some(item => this.semanticEffectSignature(item) === signature)) return
    effects[role].push(effect)
  }

  private semanticEffectSignature(effect: AtomExpr): string {
    if (effect.kind !== 'atom') return JSON.stringify(effect)
    return JSON.stringify({ kind: effect.kind, key: effect.key, params: effect.params, sideScope: effect.sideScope })
  }

  private typedEffectAppliesToPhase(effect: AtomExpr, phase: SemanticRule['phase']): boolean {
    if (effect.kind !== 'atom') return false
    const role = this.resolveRuleEffectRole(effect)
    if (!role) return false
    const effectPhase = effect.params.phase
    if (effectPhase === undefined || effectPhase === null) return true
    if (effectPhase === 'risk' && role === 'risks') return phase === 'exit' || phase === 'program'
    return effectPhase === phase
  }

  private hasProgramStrategySignal(userMessage: string): boolean {
    // Only gates phase fallback for texts with program-shaped workflows; atom roles still come from registry.
    return /网格|webhook|自适应|grid/iu.test(userMessage)
  }

  private resolveRuleEffectRole(effect: AtomExpr): RuleEffectRole | null {
    if (effect.kind !== 'atom') return null
    if (effect.key === 'position.sizing') return 'positions'
    if (this.isProgramEffectAtom(effect.key)) return 'programs'
    const bucket = (ATOM_CONTRACT_REGISTRY as Record<string, AtomContract | undefined>)[effect.key]?.bucket
    switch (bucket) {
      case 'action':
        return 'actions'
      case 'risk':
        return 'risks'
      case 'positionConstraint':
        return 'positions'
      case 'orchestration':
        return 'orchestration'
      default:
        return null
    }
  }

  private isProgramEffectAtom(key: string): boolean {
    return key.startsWith('program.')
  }

  private normalizeTypedRulePhase(phase: unknown): SemanticRule['phase'] {
    return phase === 'entry' || phase === 'exit' || phase === 'gate' || phase === 'program' ? phase : 'entry'
  }

  private collectTypedRulePredicates(
    flatPatch: InternalSeedDraft,
    userMessage: string,
  ): PatchAtomNode[] {
    const out: PatchAtomNode[] = []
    const push = (item: { key: string, phase?: unknown, sideScope?: 'long' | 'short' | 'both' | null, params?: Record<string, unknown>, evidence?: unknown }): void => {
      const contract = (ATOM_CONTRACT_REGISTRY as Record<string, AtomContract | undefined>)[item.key]
      if (!contract?.roles.includes('predicate') && item.key !== ATOM_CONTRACT_REGISTRY['grid.range_rebalance'].key) return
      out.push({
        key: item.key,
        phase: this.resolveTypedRulePhaseForAtom(item.key, item.phase),
        sideScope: item.sideScope ?? 'both',
        params: item.params ?? {},
        evidence: item.evidence,
      })
    }
    for (const trigger of flatPatch.triggers ?? []) push(trigger)
    for (const atom of flatPatch.atoms ?? []) push(atom)
    this.pushTypedLifecyclePredicates(out, flatPatch)
    // #1633 staging30 s18：用户说 "放量反弹 / 量能放大 / volume spike" 但未给出
    //   数值时，surface.intent.verbs (gte) 不命中 → volume.threshold 不被
    //   matchSurface 选中，导致 dispatcher typed-rule condition 缺少 volume 语义。
    //   按 corpus.phraseHints.triggers 提示，统一兜底成 mode=relative_to_sma 的
    //   均量倍数预设（multiplier=2, refWindow=20），与 atom-contract 推荐对齐。
    if (
      this.hasVolumeSpikeIntent(userMessage)
      && !out.some(item => item.key === ATOM_CONTRACT_REGISTRY['volume.threshold'].key)
    ) {
      const evidence = this.findEvidenceText(userMessage, '(?:放量|放大量|量能放大|量能放量|成交量放大|volume\\s*(?:spike|surge|breakout))')
      out.push({
        key: ATOM_CONTRACT_REGISTRY['volume.threshold'].key,
        phase: 'entry',
        sideScope: 'both',
        params: {
          mode: 'relative_to_sma',
          multiplier: 2,
          refWindow: 20,
          metric: 'base_volume',
          operator: 'GT',
        },
        ...(evidence ? { evidence: { text: evidence } } : {}),
      })
    }
    if (/webhook/iu.test(userMessage) && !out.some(item => item.key === ATOM_CONTRACT_REGISTRY['external.signal'].key)) {
      out.push({
        key: ATOM_CONTRACT_REGISTRY['external.signal'].key,
        phase: 'program',
        sideScope: 'both',
        params: { eventType: 'webhook' },
        evidence: { text: userMessage.trim(), source: 'user_explicit' },
      })
    }
    if (out.length === 0 && userMessage.trim().length > 0) {
      out.push({
        key: ATOM_CONTRACT_REGISTRY['execution.on_start'].key,
        phase: 'program',
        sideScope: 'both',
        params: { timing: 'on_start', orderType: 'market', occurrence: 'once' },
        evidence: { text: userMessage.trim(), source: 'user_explicit' },
      })
    }
    return mergeCompatiblePatchAtomNodes(out)
  }

  private pushTypedLifecyclePredicates(out: PatchAtomNode[], flatPatch: InternalSeedDraft): void {
    const dcaKey = ATOM_CONTRACT_REGISTRY['position.dca_schedule'].key
    const addPositionKey = ATOM_CONTRACT_REGISTRY['action.add_position'].key
    const onStartKey = ATOM_CONTRACT_REGISTRY['execution.on_start'].key
    const percentChangeKey = ATOM_CONTRACT_REGISTRY['price.percent_change'].key

    const dcaAtom = (flatPatch.atoms ?? []).find(atom => atom.key === dcaKey)
    if (dcaAtom) {
      out.push({
        key: onStartKey,
        phase: 'entry',
        sideScope: dcaAtom.sideScope ?? 'long',
        params: { timing: 'on_start', orderType: 'market', occurrence: 'once' },
        evidence: dcaAtom.evidence,
      })
    }

    const addAtoms = [
      ...(flatPatch.actions ?? []).filter(atom => atom.key === addPositionKey),
      ...(flatPatch.atoms ?? []).filter(atom => atom.key === addPositionKey),
    ]
    for (const atom of addAtoms) {
      const params = atom.params ?? {}
      const addMode = typeof params.addMode === 'string' ? params.addMode : null
      const sideScope = atom.sideScope ?? 'long'
      if (addMode === 'profit_pct' && typeof params.profitThreshold === 'number') {
        out.push({
          key: percentChangeKey,
          phase: 'entry',
          sideScope,
          params: {
            basis: 'entry_avg_price',
            direction: 'up',
            valuePct: Math.abs(params.profitThreshold),
          },
          evidence: atom.evidence,
        })
      }
      if (addMode === 'drawdown_pct' && typeof params.drawdownThreshold === 'number') {
        out.push({
          key: percentChangeKey,
          phase: 'entry',
          sideScope,
          params: {
            basis: 'entry_avg_price',
            direction: 'down',
            valuePct: Math.abs(params.drawdownThreshold),
          },
          evidence: atom.evidence,
        })
      }
    }
  }

  private resolveTypedRulePhaseForAtom(key: string, phase: unknown): SemanticRule['phase'] {
    const phaseResolver = (ATOM_CONTRACT_REGISTRY as Record<string, AtomContract | undefined>)[key]?.surface?.phaseResolver
    switch (phaseResolver) {
      case 'fixed-entry':
        return 'entry'
      case 'fixed-exit':
        return 'exit'
      case 'fixed-gate':
        return 'gate'
      case 'fixed-program':
        return 'program'
      default:
        return this.normalizeTypedRulePhase(phase)
    }
  }

  private collectTypedRuleGlobalEffects(flatPatch: InternalSeedDraft, userMessage: string): AtomExpr[] {
    const out: AtomExpr[] = []
    const pushAtom = (item: { key: string, phase?: unknown, params?: Record<string, unknown>, sideScope?: 'long' | 'short' | 'both' | null, evidence?: unknown }): void => {
      const effect: AtomExpr = {
        kind: 'atom',
        key: item.key,
        params: {
          ...(item.params ?? {}),
          ...(typeof item.phase === 'string' ? { phase: item.phase } : {}),
        },
        ...(item.sideScope ? { sideScope: item.sideScope } : {}),
        ...(isEvidenceWithText(item.evidence) ? { evidence: { text: item.evidence.text } } : {}),
      }
      if (this.resolveRuleEffectRole(effect)) out.push(effect)
    }
    for (const item of flatPatch.actions ?? []) pushAtom(item)
    for (const item of flatPatch.risk ?? []) pushAtom(item)
    for (const item of flatPatch.atoms ?? []) pushAtom(item)
    const contextSlots = flatPatch.contextSlots ?? {}
    const symbolEvidence = this.findEvidenceText(userMessage, this.escapeRegexText(contextSlots.symbol))
    if (typeof contextSlots.symbol === 'string' && contextSlots.symbol.trim().length > 0) {
      pushAtom({
        key: ATOM_CONTRACT_REGISTRY['scope.symbol'].key,
        params: {
          symbolScopeKind: 'symbol',
          symbols: [contextSlots.symbol],
          primarySymbol: contextSlots.symbol,
        },
        ...(symbolEvidence ? { evidence: { text: symbolEvidence } } : {}),
      })
    }
    const timeframeEvidence = this.findTimeframeEvidence(userMessage, contextSlots.timeframe)
    if (typeof contextSlots.timeframe === 'string' && contextSlots.timeframe.trim().length > 0) {
      pushAtom({
        key: ATOM_CONTRACT_REGISTRY['scope.timeframe'].key,
        params: {
          timeframeScopeKind: 'timeframe',
          primaryTimeframe: contextSlots.timeframe,
          requiredTimeframes: [contextSlots.timeframe],
          alignmentPolicy: 'tolerant',
        },
        ...(timeframeEvidence ? { evidence: { text: timeframeEvidence } } : {}),
      })
    }
    if (flatPatch.position?.sizing) {
      out.push({
        kind: 'atom',
        key: 'position.sizing',
        params: { sizing: flatPatch.position.sizing, phase: 'entry' },
        ...(isEvidenceWithText(flatPatch.position.evidence) ? { evidence: { text: flatPatch.position.evidence.text } } : {}),
      })
    }
    // Issue #1707 Gap C：原 fallback 在 hasSizingIntent && 无 sizing shape 时硬塞一个
    //   params={phase:'entry'} 的空 `position.sizing` atom，PerTradeSizingResolver (d)
    //   `tryReadSizingShape(params.sizing)` 立刻返回 null → anchor 永不 executionAnchored，
    //   叠加 Gap B 后整条 position.sizing leaf 零 anchor。
    //   clarification 仍会通过 detectSizingItems（resolver 返回空 anchors）追问 sizing，
    //   readiness 通过 capital.allocate.per_order_budget 缺失报 READINESS_PER_ORDER_BUDGET_MISSING。
    //   删空 emit 避免污染 rules tree / 生成假 position role fact，让 clarification 与
    //   readiness 在"识别到 sizing 意图但无形状"的灰色态下输出干净。
    if (
      !out.some(effect => effect.kind === 'atom' && this.resolveRuleEffectRole(effect) === 'actions')
      && this.hasOpenActionIntent(userMessage)
    ) {
      const evidence = this.findEvidenceText(userMessage, '(?:买入|买|开多|开空|开仓|做多|做空|进场|open|buy|long|short|enter)')
      pushAtom({
        key: ATOM_CONTRACT_REGISTRY['action.open_long'].key,
        phase: 'entry',
        params: {},
        ...(evidence ? { evidence: { text: evidence } } : {}),
      })
    }
    // Issue #1691 staging30 s28：对称补全 close-action fallback。
    // 用户描述「下穿平仓 / 跌破止损 / sell」等纯出场动作但未指明 long/short 侧时（如「平多/平空」
    // 已经被 NL gateway 解析到 action.close_long / action.close_short），需根据已有
    // entry action 的 side 推断对应 close。无 entry action 时默认 long（对称 open_long fallback）。
    // 否则 dispatcher exit 规则只剩 scope.timeframe 等 orchestration 副作用，
    // readiness.hasExit=false，前端持续追问 rulesTree.exit，造成 assistant_prompt_loop。
    if (
      this.hasCloseActionIntent(userMessage)
      && !out.some((effect) => {
        if (effect.kind !== 'atom') return false
        return effect.key === ATOM_CONTRACT_REGISTRY['action.close_long'].key
          || effect.key === ATOM_CONTRACT_REGISTRY['action.close_short'].key
      })
    ) {
      const hasShortEntry = out.some(effect => effect.kind === 'atom' && effect.key === ATOM_CONTRACT_REGISTRY['action.open_short'].key)
      const hasLongEntry = out.some(effect => effect.kind === 'atom' && effect.key === ATOM_CONTRACT_REGISTRY['action.open_long'].key)
      const closeKey = hasShortEntry && !hasLongEntry
        ? ATOM_CONTRACT_REGISTRY['action.close_short'].key
        : ATOM_CONTRACT_REGISTRY['action.close_long'].key
      const evidence = this.findEvidenceText(userMessage, '(?:平仓|平多|平空|止盈|止损|离场|卖出|出场|下穿|跌破|close|exit|sell|take[ -]?profit|stop[ -]?loss)')
      pushAtom({
        key: closeKey,
        phase: 'exit',
        params: {},
        ...(evidence ? { evidence: { text: evidence } } : {}),
      })
    }
    if (
      this.hasRiskIntent(userMessage)
      && !out.some(effect => effect.kind === 'atom' && this.resolveRuleEffectRole(effect) === 'risks')
      && this.hasPercentStopRiskIntent(userMessage)
    ) {
      const evidence = this.findEvidenceText(userMessage, '(?:止损|止盈|stop\\s*loss|take\\s*profit)')
      pushAtom({
        key: ATOM_CONTRACT_REGISTRY['risk.stop_loss_pct'].key,
        phase: 'exit',
        params: {},
        ...(evidence ? { evidence: { text: evidence } } : {}),
      })
    }
    if (
      !out.some(effect => effect.kind === 'atom' && this.resolveRuleEffectRole(effect) === 'orchestration')
      && this.hasTimeframeIntent(userMessage)
    ) {
      const evidence = this.findTimeframeEvidence(userMessage)
      pushAtom({
        key: ATOM_CONTRACT_REGISTRY['scope.timeframe'].key,
        params: {
          timeframeScopeKind: 'timeframe',
          ...(typeof contextSlots.timeframe === 'string' && contextSlots.timeframe.trim().length > 0
            ? {
                primaryTimeframe: contextSlots.timeframe,
                requiredTimeframes: [contextSlots.timeframe],
              }
            : {}),
          alignmentPolicy: 'tolerant',
        },
        ...(evidence ? { evidence: { text: evidence } } : {}),
      })
    }
    if (!out.some(effect => effect.kind === 'atom' && this.resolveRuleEffectRole(effect) === 'programs')) {
      const atoms = flatPatch.atoms ?? []
      const hasGrid = atoms.some(atom => atom.key === ATOM_CONTRACT_REGISTRY['grid.range_rebalance'].key)
      const hasAdaptive = atoms.some(atom => atom.key === ATOM_CONTRACT_REGISTRY['program.adaptive_volatility_grid'].key)
      const explicitProgramEvidence = this.findEvidenceText(
        userMessage,
        '(?:事件监听|webhook\\s*监听|外部事件订阅|订阅[^，。；;]{0,20}(?:事件源|webhook))',
      )
      const programKey = hasAdaptive
        ? ATOM_CONTRACT_REGISTRY['program.adaptive_volatility_grid'].key
        : hasGrid
          ? ATOM_CONTRACT_REGISTRY['program.dynamic_grid'].key
          : explicitProgramEvidence
            ? ATOM_CONTRACT_REGISTRY['program.event_listener'].key
            : null
      if (programKey) {
        const atomEvidence = atoms.find(atom =>
          (programKey === ATOM_CONTRACT_REGISTRY['program.adaptive_volatility_grid'].key && atom.key === ATOM_CONTRACT_REGISTRY['program.adaptive_volatility_grid'].key)
          || (programKey === ATOM_CONTRACT_REGISTRY['program.dynamic_grid'].key && atom.key === ATOM_CONTRACT_REGISTRY['grid.range_rebalance'].key)
          || (programKey === ATOM_CONTRACT_REGISTRY['program.event_listener'].key && atom.key === ATOM_CONTRACT_REGISTRY['external.signal'].key)
        )?.evidence
        pushAtom({
          key: programKey,
          phase: 'program',
          params: { programKind: programKey.slice('program.'.length) },
          ...(isEvidenceWithText(atomEvidence)
            ? { evidence: { text: atomEvidence.text } }
            : explicitProgramEvidence
              ? { evidence: { text: explicitProgramEvidence } }
              : {}),
        })
      }
    }
    return out
  }

  private hasOpenActionIntent(userMessage: string): boolean {
    return /买入|买|开多|开空|开仓|做多|做空|进场|open|buy|long|short|enter/iu.test(userMessage)
  }

  // #1633 staging30 s18：放量 / 量能放大 / volume spike 等"成交量异动"语义。
  // 与 ATOM_CONTRACT_REGISTRY['volume.threshold'].surface.intent.keywords 中的
  // 放量 / 倍均量 等关键词对齐，作为 fallback predicate 兜底触发器。
  private hasVolumeSpikeIntent(userMessage: string): boolean {
    return /放量|放大量|量能放大|量能放量|成交量放大|倍均量|倍量|volume\s*(?:spike|surge|breakout)/iu.test(userMessage)
  }

  // Issue #1691: 与 hasOpenActionIntent 对称的纯出场词法。
  // 「平仓 / 平多 / 平空 / 止盈 / 止损 / 离场 / 卖出 / close / exit / sell / take-profit / stop-loss」
  // 与 generic-seed-dispatcher.helpers.ts 中 EXIT_PHRASES 词法对齐。
  private hasCloseActionIntent(userMessage: string): boolean {
    return /平仓|平多|平空|止盈|止损|离场|卖出|出场|close|exit|sell|take[ -]?profit|stop[ -]?loss/iu.test(userMessage)
  }

  private hasRiskIntent(userMessage: string): boolean {
    return /止损|止盈|风控|风险|回撤|熔断|stop\s*loss|take\s*profit|risk|drawdown/iu.test(userMessage)
  }

  private hasPercentStopRiskIntent(userMessage: string): boolean {
    return /止损|止盈|stop\s*loss|take\s*profit/iu.test(userMessage)
  }

  private hasTimeframeIntent(userMessage: string): boolean {
    return /(?:\d+\s*(?:m|min|分钟|小时|h|d|天|日线|周线)|K\s*线|周期|timeframe)/iu.test(userMessage)
  }

  private findTimeframeEvidence(userMessage: string, timeframe?: unknown): string | null {
    if (typeof timeframe === 'string' && timeframe.trim().length > 0) {
      const exact = this.findEvidenceText(userMessage, this.escapeRegexText(timeframe))
      if (exact) return exact
    }
    return this.findEvidenceText(userMessage, '(?:\\d+\\s*(?:m|min|分钟|小时|h|d|天)|日线|周线|K\\s*线|周期|timeframe)')
  }

  private findEvidenceText(userMessage: string, pattern: string): string | null {
    const match = new RegExp(pattern, 'iu').exec(userMessage)
    if (!match) return null
    return match[0]
  }

  private escapeRegexText(value: unknown): string {
    return typeof value === 'string' ? value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') : ''
  }

  private applySemanticConflictResolution(
    atomItems: PatchAtomNode[],
    slotItems: Record<'triggers' | 'actions' | 'risk', PatchAtomNode[]>,
  ): void {
    const addPositionKey = ATOM_CONTRACT_REGISTRY['action.add_position'].key
    const takeProfitKey = ATOM_CONTRACT_REGISTRY['risk.take_profit_pct'].key
    const addPositionClauses = new Set(
      atomItems
        .filter(item => item.key === addPositionKey)
        .map(item => readPatchEvidenceText(item))
        .filter((text): text is string => typeof text === 'string' && text.trim().length > 0),
    )
    if (addPositionClauses.size === 0) return

    const isConflictingTakeProfit = (item: PatchAtomNode): boolean => {
      if (item.key !== takeProfitKey) return false
      const evidence = readPatchEvidenceText(item)
      return typeof evidence === 'string' && addPositionClauses.has(evidence)
    }

    removeInPlace(atomItems, isConflictingTakeProfit)
    removeInPlace(slotItems.risk, isConflictingTakeProfit)
  }

  /**
   * s30 generic：DCA drawdown leg sizing 跨子句回填。
   *
   * 触发条件：text 含 `回撤|加投|补仓` 切分点，且切分点之后能抽出 quote sizing。
   * 行为：把尾段 sizing 注入到 atomItems / slotItems 内 key === 'position.dca_schedule'
   * 的所有节点 params.drawdownPerOrderSizing；若尾段同时含 dropPct 也补 dropPct。
   * 与首段 perOrderSizing 不同时才回填（避免冗余）。
   */
  private applyDcaDrawdownLegBackfill(
    text: string,
    atomItems: PatchAtomNode[],
    slotItems: Record<'triggers' | 'actions' | 'risk', PatchAtomNode[]>,
  ): void {
    if (!text) return
    const dcaKey = ATOM_CONTRACT_REGISTRY['position.dca_schedule'].key
    const dcaNodes: PatchAtomNode[] = [
      ...atomItems.filter(n => n.key === dcaKey),
      ...slotItems.triggers.filter(n => n.key === dcaKey),
      ...slotItems.actions.filter(n => n.key === dcaKey),
      ...slotItems.risk.filter(n => n.key === dcaKey),
    ]
    if (dcaNodes.length === 0) return

    const splitMatch = text.match(/(回撤|加投|补仓)/u)
    if (!splitMatch || splitMatch.index === undefined) return
    const tail = text.slice(splitMatch.index)
    const tailRole = extractSizingRoleFromText(tail)
    if (!tailRole || tailRole.sizing.kind !== 'quote') return

    const tailDropPctMatch = tail.match(/(\d+(?:\.\d+)?)\s*%/u)
    const tailDropPct = tailDropPctMatch ? Number(tailDropPctMatch[1]) : null

    for (const node of dcaNodes) {
      const params = node.params as Record<string, unknown>
      const primary = params.perOrderSizing as { kind?: string; value?: number; asset?: string } | undefined
      const sameAsPrimary = primary
        && primary.kind === tailRole.sizing.kind
        && primary.value === tailRole.sizing.value
        && primary.asset === tailRole.sizing.asset
      if (!sameAsPrimary && params.drawdownPerOrderSizing === undefined) {
        params.drawdownPerOrderSizing = toPerOrderSizingShape(tailRole.sizing)
      }
      if (tailDropPct !== null && Number.isFinite(tailDropPct) && tailDropPct > 0 && params.dropPct === undefined) {
        params.dropPct = tailDropPct
      }
    }
  }

  /**
   * Issue #1633 s29: pyramiding_limit profit-trigger + layer-sizing backfill。
   *
   * generic 规则：text 中含 "盈利 N% (后|时|再|则) 加仓 M%" 时，把 N 写入
   * pyramiding_limit.params.profitThreshold（百分比，未归一化），M 写入
   * pyramiding_limit.params.layerSizing（百分比，未归一化）。
   *
   * 仅当对应 slot 在 atom params 上为 undefined 时回填，已存在则保留 dispatcher 主匹配值。
   *
   * 不引入 atom-key 字面量分支：通过 ATOM_CONTRACT_REGISTRY['position.pyramiding_limit'].key
   * 读 atom key（与本服务其它 lifecycle 后处理一致）。
   */
  private applyPyramidingProfitTriggerBackfill(
    text: string,
    atomItems: PatchAtomNode[],
    slotItems: Record<'triggers' | 'actions' | 'risk', PatchAtomNode[]>,
  ): void {
    if (!text) return
    const pyramidingKey = ATOM_CONTRACT_REGISTRY['position.pyramiding_limit'].key
    const nodes: PatchAtomNode[] = [
      ...atomItems.filter(n => n.key === pyramidingKey),
      ...slotItems.triggers.filter(n => n.key === pyramidingKey),
      ...slotItems.actions.filter(n => n.key === pyramidingKey),
      ...slotItems.risk.filter(n => n.key === pyramidingKey),
    ]
    if (nodes.length === 0) return

    // "盈利 N% (后|时|再|则) ... 加仓 M%" 必须共存才认定为 profit-trigger + sizing pair
    const profitMatch = /(?:盈利|获利|利润|赚)\s*(\d+(?:\.\d+)?)\s*%/u.exec(text)
    const sizingMatch = /(?:加仓|补仓|scale\s*in)\D{0,8}(\d+(?:\.\d+)?)\s*%/iu.exec(text)
    const profitThreshold = profitMatch?.[1] ? Number(profitMatch[1]) : null
    const layerSizingPct = sizingMatch?.[1] ? Number(sizingMatch[1]) : null
    const hasValidProfit = profitThreshold !== null && Number.isFinite(profitThreshold) && profitThreshold > 0 && profitThreshold <= 100
    const hasValidSizing = layerSizingPct !== null && Number.isFinite(layerSizingPct) && layerSizingPct > 0 && layerSizingPct <= 100
    if (!hasValidProfit && !hasValidSizing) return

    for (const node of nodes) {
      const params = node.params as Record<string, unknown>
      if (hasValidProfit && params.profitThreshold === undefined) {
        params.profitThreshold = profitThreshold
      }
      if (hasValidSizing && (params.layerSizing === undefined || params.layerSizing === 0)) {
        params.layerSizing = layerSizingPct
      }
    }
  }

  /**
   * Issue #1383 后续：跨子句对偶继承（registry-driven generic pass）
   *
   * 红线守门（与本服务一致）：本方法不允许 atom-key 字面量；不允许 bucket 字面量比较——
   * 全部从 ATOM_CONTRACT_REGISTRY 读 contract.surface.crossClauseInheritFrom 表驱动。
   *
   * 工作过程：
   *   1. 用已匹配 atomItems 建 sibling 索引（key → 实例数组）
   *   2. 遍历声明了 crossClauseInheritFrom 的 atom × 所有 clause
   *   3. 若该 clause 没正常匹配本 atom（缺 keyword 但有对偶 verb），且 sibling 索引里
   *      能找到 crossClauseInheritFrom 指向的 atom 实例 → 按 inheritParams 列表继承
   *      sibling 参数，模拟一次完整匹配 emit 进 atomItems / slotItems
   *
   * 自镜像：crossClauseInheritFrom === 'self' 表示本 atom 自身作为 sibling 源（适合
   * 同 atom 不同 phase 共享参数的场景，例如 bollinger.touch_middle 入场/出场）。
   */
  private applyCrossClauseInheritance(
    clauses: readonly string[],
    atomItems: PatchAtomNode[],
    slotItems: Record<'triggers' | 'actions' | 'risk', PatchAtomNode[]>,
    atomDedupeKeys: Set<string>,
    slotDedupeKeys: Record<'triggers' | 'actions' | 'risk', Set<string>>,
  ): void {
    // 建 sibling 索引（key → 实例数组），取已 push 的 atomItems 副本
    const siblingsByKey = new Map<string, PatchAtomNode[]>()
    for (const node of atomItems) {
      const list = siblingsByKey.get(node.key) ?? []
      list.push(node)
      siblingsByKey.set(node.key, list)
    }

    for (const [atomKey, contractUntyped] of Object.entries(ATOM_CONTRACT_REGISTRY)) {
      const contract = contractUntyped as AtomContract
      const surface = contract.surface
      if (!surface) continue
      const inheritFromDecl = surface.crossClauseInheritFrom
      if (!inheritFromDecl) continue
      const inheritParams = surface.inheritParams ?? []

      // 解析继承源 key：'self' 表示同 atom 自镜像
      const sourceKey = inheritFromDecl === 'self' ? atomKey : inheritFromDecl
      const sourceSiblings = siblingsByKey.get(sourceKey)
      if (!sourceSiblings || sourceSiblings.length === 0) continue

      const slot = BUCKET_TO_PATCH_SLOT[contract.bucket]

      for (const clause of clauses) {
        // 若本子句已经正常匹配本 atom，跳过（避免重复 emit）
        const alreadyMatched = atomItems.some((node) => {
          if (node.key !== atomKey) return false
          const ev = node.evidence as { text?: string } | undefined
          return ev?.text === clause
        })
        if (alreadyMatched) continue
        // Issue #1391 review M4：self-mirror（sourceKey === atomKey）场景下，若本 clause
        //   已被 sibling（同 atom 不同 sideScope）覆盖，跳过 self-mirror 派生，避免
        //   "触及中轨" 一句先 emit sideScope=both，再被 self-mirror 派生 sideScope=long/short
        //   产生三份冗余。判定基于 evidence.text 等于本 clause 的 sibling 是否已存在。
        if (sourceKey === atomKey) {
          const selfMirrorAlreadyCovered = sourceSiblings.some((n) => {
            const ev = (n.evidence as { text?: string } | undefined)
            return ev?.text === clause
          })
          if (selfMirrorAlreadyCovered) continue
        }

        // 子句必须命中本 atom 的 verb；keyword 此处不要求（这才是"跨子句继承"的意义）
        const direction = matchVerbDirection(clause, surface.intent.verbs)
        if (!direction) continue

        // Issue #1391 review M2：取最近 sibling 是脆弱启发式——多 entry sibling 场景
        //   ("EMA7 上穿 EMA21 时开多；上穿 EMA50 时加仓；下穿 时平多") 会无条件取 slow=50
        //   但语义通常对偶第一条 slow=21。改成 "与本 clause 距离最近的对偶 phase sibling"：
        //   先派生本 clause 的 phase，再在 sibling 中选 phase 配对的最近一条（exit→entry，
        //   entry→exit，self→任意），剩余仍 fallback 到最后一条。
        const tentativePhase = resolvePhaseFromClause(clause, surface.phaseResolver, { atomKey, params: {} }) ?? 'entry'
        const counterpartPhase: 'entry' | 'exit' | 'gate' | 'program' = tentativePhase === 'exit' ? 'entry' : tentativePhase === 'entry' ? 'exit' : 'entry'
        const sibling = sourceSiblings.slice().reverse().find((n) => {
          const np = (n as { phase?: 'entry' | 'exit' | 'gate' | 'program' | null }).phase
          // self-mirror（sourceKey === atomKey）允许任何 phase；否则优先取对偶 phase 的 sibling
          if (sourceKey === atomKey) return true
          return np === counterpartPhase
        }) ?? sourceSiblings[sourceSiblings.length - 1]
        if (!sibling) continue

        // 继承声明的 params + 本子句仍可抽到的 params 叠加（本子句优先覆盖继承值）
        const inheritedParams: Record<string, unknown> = {}
        for (const slotKey of inheritParams) {
          const v = (sibling.params as Record<string, unknown>)[slotKey]
          if (v !== undefined) {
            inheritedParams[slotKey] = v
          }
        }
        const ownParams = extractParamsWithSizingRoles(surface.paramSlots, clause, atomKey)
        const params: Record<string, unknown> = { ...inheritedParams, ...ownParams }

        // matchRequires 校验（继承后必须满足）
        if (
          surface.matchRequires?.some(slotKey => params[slotKey] === undefined || params[slotKey] === null)
        ) {
          continue
        }

        const phase = resolvePhaseFromClause(clause, surface.phaseResolver, { atomKey, params }) ?? 'entry'
        // Issue #1391 review M2：phase=exit 且未显式平多/平空时，sideScope 应镜像 sibling.sideScope
        //   （"平掉它的反向仓位"），而不是按 verb direction(cross_under→short) 重新派生，
        //   避免 "EMA7 上穿开多；下穿 时平多" 的"下穿平多"被错误派生为 sideScope=short。
        let sideScope: 'long' | 'short' | 'both' = (resolveSide(surface.sideResolver, clause, direction) ?? 'both') as 'long' | 'short' | 'both'
        const explicitActionSide = detectExplicitActionSide(clause)
        if (explicitActionSide) sideScope = explicitActionSide
        if (phase === 'exit') {
          const closeSide = detectCloseSide(clause)
          if (closeSide) {
            sideScope = closeSide
          }
          else {
            // 既无显式 close-verb 也无 explicit action side：取 sibling.sideScope 作为镜像兜底
            const siblingSide = (sibling as { sideScope?: 'long' | 'short' | 'both' | null }).sideScope
            if (siblingSide === 'long' || siblingSide === 'short' || siblingSide === 'both') {
              sideScope = siblingSide
            }
          }
        }

        const sortedParams = Object.fromEntries(
          Object.entries(params).sort(([a], [b]) => a.localeCompare(b)),
        )
        const dedupeKey = `${atomKey}|${phase}|${sideScope}|${JSON.stringify(sortedParams)}`
        if (atomDedupeKeys.has(dedupeKey)) continue
        atomDedupeKeys.add(dedupeKey)
        if (slot) {
          if (slotDedupeKeys[slot].has(dedupeKey)) continue
          slotDedupeKeys[slot].add(dedupeKey)
        }

        const evidenceSource: NonNullable<AtomContractSurface['evidenceProvenance']> = surface.evidenceProvenance ?? 'user_explicit'
        const evidence = { text: clause, source: evidenceSource }
        const node: PatchAtomNode = {
          key: atomKey,
          phase,
          params,
          evidence,
        }
        if (slot === 'triggers' || slot === 'actions' || slot === 'risk') {
          node.sideScope = sideScope
        }
        atomItems.push({ ...node, sideScope })
        if (slot) {
          slotItems[slot].push(node)
        }

        // sibling 索引也要回写新增节点，允许链式继承（例如 cross_over → cross_under
        // 后续子句若再依赖 cross_under 继承也能拿到）
        const list = siblingsByKey.get(atomKey) ?? []
        list.push(node)
        siblingsByKey.set(atomKey, list)
      }
    }
  }

  matchClauseAgainstRegistry(clause: string): readonly AtomMatch[] {
    const out: AtomMatch[] = []
    for (const [atomKey, contract] of Object.entries(ATOM_CONTRACT_REGISTRY as Record<string, AtomContract>)) {
      const surface = contract.surface
      if (!surface) continue
      const m = this.matchSurface(surface, clause, atomKey)
      if (m) {
        for (const expanded of expandMovingAverageReferenceMatches(m, surface)) {
          out.push({ atomKey, ...expanded })
        }
      }
    }
    return out
  }

  /**
   * extractSingleSlot —— 单 slot 抽参（Issue #1409）
   *
   * 用途：resolver 通用 open slot 答复通道。给定 (atomKey, slotKey, answer)，
   * 仅跑该 slot 的 extractor + schema 校验，返回 schema-validated 值或 ok:false。
   *
   * 红线：
   *   - 不读 atom-key 字面量（registry 查找）
   *   - 不读 bucket 字面量
   *   - 不写业务规则；纯函数式 schema-driven
   *
   * Schema 校验（顺序）：
   *   1. atom / slotKey 不存在 → reason='unknown_slot'
   *   2. extractor 未声明 → reason='no_extractor'
   *   3. extractor 抽不到 + default 不存在 → reason='no_match'
   *   4. kind=number-int 必须 Number.isInteger
   *   5. schema.range 越界 → reason='out_of_range'
   *   6. schema.multipleOf 不整除 → reason='not_multiple_of'
   *   7. schema.enum 不在集合 → reason='not_in_enum'
   */
  extractSingleSlot(
    atomKey: string,
    slotKey: string,
    answer: string,
  ): { ok: true; value: unknown } | { ok: false; reason: string } {
    const contract = (ATOM_CONTRACT_REGISTRY as Record<string, AtomContract>)[atomKey]
    const surface = contract?.surface
    const schema = surface?.paramSlots[slotKey]
    if (!surface || !schema) {
      return { ok: false, reason: 'unknown_slot' }
    }

    const ext = schema.extractor
    if (!ext) {
      return { ok: false, reason: 'no_extractor' }
    }

    const parser = GENERIC_PARSERS[ext.kind]
    if (!parser) {
      return { ok: false, reason: `unknown_parser_kind:${ext.kind}` }
    }

    // C2: 单 slot 答复抽参不走 schema.default / ext.default fallback——
    //   default 是「未声明」时的稳态值，不是「答非所问也算答了」的语义。
    //   parser/derive 真正命中才进 schema validation；都没命中视作 no_match。
    let value: unknown = parser(answer, ext)
    if ((value === undefined || value === null) && ext.derive) {
      const derive = DERIVES[ext.derive]
      if (!derive) {
        return { ok: false, reason: `unknown_derive:${ext.derive}` }
      }
      value = derive(answer, { atomKey, params: {} })
    }
    if (value === undefined || value === null) {
      return { ok: false, reason: 'no_match' }
    }

    // schema validation（kind-specific + range / multipleOf / enum）
    if (schema.kind === 'number' && typeof value !== 'number') {
      const coerced = Number(value)
      if (!Number.isFinite(coerced)) {
        return { ok: false, reason: 'not_a_number' }
      }
      value = coerced
    }
    if (ext.kind === 'number-int' && typeof value === 'number' && !Number.isInteger(value)) {
      return { ok: false, reason: 'not_integer' }
    }
    if (schema.range && typeof value === 'number') {
      if (value < schema.range[0] || value > schema.range[1]) {
        return { ok: false, reason: 'out_of_range' }
      }
    }
    if (schema.multipleOf !== undefined && typeof value === 'number') {
      // m2: IEEE-754 浮点容差，避免 0.3 % 0.1 ≈ 0.0999... 误判 not_multiple_of
      const remainder = Math.abs(value % schema.multipleOf)
      const tolerance = Math.max(Math.abs(value), schema.multipleOf) * 1e-9
      if (remainder > tolerance && Math.abs(remainder - schema.multipleOf) > tolerance) {
        return { ok: false, reason: 'not_multiple_of' }
      }
    }
    if (schema.enum && !schema.enum.includes(String(value))) {
      return { ok: false, reason: 'not_in_enum' }
    }

    return { ok: true, value }
  }

  matchSurface(
    surface: AtomContractSurface,
    clause: string,
    atomKey: string,
  ): Omit<AtomMatch, 'atomKey'> | null {
    const kw = matchKeyword(clause, surface.intent.keywords)
    const direction = matchVerbDirection(clause, surface.intent.verbs)
    // Issue #1338：require BOTH kw AND verb-direction to fire. 旧逻辑 `!kw && !direction`
    // 表示"两者皆无才拒"——只要 kw 或 verb 任一命中即匹配，导致：
    //   - 'EMA20 上穿 EMA50' 同时命中 indicator.cross_over (kw+verb)、indicator.above/below (仅 kw)；
    //   - 'EMA20 下穿 EMA50' 又命中 cross_over (仅 kw '上穿' 未中、'EMA' kw 仍中)；
    //   - 'EMA20 上穿 EMA50 时' 命中 position.no_position (仅 verb '时')。
    // 改成 kw && direction 后，关键词标识"主题"、动词标识"关系"，两者缺一不命中，
    // 自然消除并行原子规则爆炸；同时 sideScope 由真实命中的 direction 派生，不再回落 'both'。
    if (!kw || !direction) return null

    const params = extractParamsWithSizingRoles(surface.paramSlots, clause, atomKey)
    if (surface.matchRequires?.some(slotKey => params[slotKey] === undefined || params[slotKey] === null)) {
      return null
    }
    const phase = resolvePhaseFromClause(clause, surface.phaseResolver, { atomKey, params })
    let sideScope = resolveSide(surface.sideResolver, clause, direction)
    const explicitActionSide = detectExplicitActionSide(clause)
    if (explicitActionSide) sideScope = explicitActionSide
    // Issue #1338 M1：exit phase 下若 clause 含 close-verb（平多/平空），用 close-verb
    //   推导的目标仓位方向覆盖 direction-derived side——'EMA20 下穿 平多' 应 long
    //   单边（平的是多仓），而非 cross_under → short。
    if (phase === 'exit') {
      const closeSide = detectCloseSide(clause)
      if (closeSide) sideScope = closeSide
    }

    return {
      clauseText: clause,
      direction,
      params,
      phase,
      sideScope,
    }
  }
}

function readPatchEvidenceText(item: { evidence?: unknown }): string | null {
  const evidence = item.evidence
  if (!evidence || typeof evidence !== 'object' || Array.isArray(evidence)) return null
  const text = (evidence as { text?: unknown }).text
  return typeof text === 'string' ? text : null
}
