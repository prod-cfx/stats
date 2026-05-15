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
import type { SemanticPositionSizingContract } from '../types/semantic-state'
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
  readonly phase: 'entry' | 'exit' | 'gate' | null
  readonly sideScope: 'long' | 'short' | 'both' | null
}

export type DispatchResult = CodegenSemanticPatch

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

const PARSER_NUMBER_INT: ParserFn = (clause, spec) => {
  const raw = matchNumberAtIndex(clause, spec.pattern, /\d+/, spec.index ?? 0)
  if (raw === undefined) return undefined
  const n = Number.parseInt(raw, 10)
  if (Number.isNaN(n)) return undefined
  if (spec.range && (n < spec.range[0] || n > spec.range[1])) return undefined
  return n
}

const PARSER_NUMBER_DECIMAL: ParserFn = (clause, spec) => {
  const raw = matchNumberAtIndex(clause, spec.pattern, /\d+(?:\.\d+)?/, spec.index ?? 0)
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
  return sign * (n / 100)
}

const PARSER_DURATION: ParserFn = (clause, spec) => {
  const re = spec.pattern ? new RegExp(spec.pattern) : /(\d+)\s*([mhdw])/i
  const m = clause.match(re)
  if (!m) return undefined
  const unit = m[2] ?? ''
  return `${m[1]}${unit.toLowerCase()}`
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
const SIZING_ROLE_PREFIX_RE = /(?:仓位|资金(?!费率)|比例|使用|投入|固定|单笔|每格|每次|每笔|每单|用)\s*(?:使用|用|投入)?\s*[：:]?\s*$/u
const SIZING_ROLE_SUFFIX_RE = /^\s*(?:仓位|资金(?!费率)|比例)/u
const RISK_ROLE_NEAR_RE = /(?:止损|止盈|亏损|盈利|ATR|atr)\s*$/u

function hasSizingRoleContext(text: string, index: number, length: number): boolean {
  const prefix = text.slice(Math.max(0, index - 14), index)
  const suffix = text.slice(index + length, index + length + 14)
  if (RISK_ROLE_NEAR_RE.test(prefix) || /^(?:\s*(?:止损|止盈|亏损|盈利|ATR|atr))/u.test(suffix)) return false
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

  return null
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
  const params = extractParams(paramSlots, clause, atomKey)
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

/* ──────────────────────────────────────────────────────────────────────────
 * contextSlots 抽取（NL 通用解析，不读 atom-key）
 * ────────────────────────────────────────────────────────────────────────── */

const EXCHANGE_RE = /\b(okx|binance|bybit|coinbase|kraken|huobi|gate|bitget)\b/i
// quote 枚举从 SYMBOL_QUOTES 派生，两处保持单一真相源（M1）
const SYMBOL_RE = new RegExp(`([A-Z]{2,10})[\\s/]?(${SYMBOL_QUOTES.join('|')})\\b`)
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
const TIMEFRAME_COMPOUND_RE = /\b(\d{1,3})\s*(分钟|小时|天|周|min(?:ute)?s?|hours?|days?|weeks?|m|h|d|w)\b/i
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
function tryNormalizeTimeframe(text: string): string | undefined {
  // 优先匹配标准简写（避免 '15分钟' 中的 '15m' 子串先被命中产生错位）
  const direct = text.match(TIMEFRAME_RE)
  if (direct) return direct[1].toLowerCase()
  const compound = text.match(TIMEFRAME_COMPOUND_RE)
  if (!compound) return undefined
  const value = Number.parseInt(compound[1], 10)
  if (Number.isNaN(value) || value <= 0) return undefined
  const unit = TIMEFRAME_UNIT_TO_CANONICAL[compound[2].toLowerCase()]
  if (!unit) return undefined
  return `${value}${unit}`
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
  const tokens = text.split(/[\s,，。.；;:：!！?？()（）、/\\]+/)
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

function extractContextSlots(text: string): ContextSlots | undefined {
  const slots: ContextSlots = {}
  const exMatch = text.match(EXCHANGE_RE)
  if (exMatch) slots.exchange = exMatch[1].toLowerCase()
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
const BUCKET_TO_PATCH_SLOT: Readonly<Record<AtomContractBucket, 'triggers' | 'actions' | 'risk'>> = {
  trigger: 'triggers',
  action: 'actions',
  risk: 'risk',
  // positionConstraint → actions：DCA / pyramiding / grid 本质是"如何执行仓位"，
  //   isActionable=true，映射 actions 而非独立 position 段（PR2c5）。
  positionConstraint: 'actions',
  // orchestration → risk：portfolioRisk 类守门节点归入 risk 段（PR2c5）。
  orchestration: 'risk',
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
    if (text.length > GenericSeedDispatcher.MAX_UTTERANCE_LENGTH) {
      throw new Error(
        `[GenericSeedDispatcher] utterance length ${text.length} exceeds MAX_UTTERANCE_LENGTH=${GenericSeedDispatcher.MAX_UTTERANCE_LENGTH}; reject to prevent ReDoS.`,
      )
    }
    const patch: CodegenSemanticPatch = {}

    const ctx = extractContextSlots(text)
    if (ctx) patch.contextSlots = ctx as CodegenSemanticPatch['contextSlots']

    const clauses = splitClauses(text)
    const sizingRole = clauses.map(clause => extractSizingRoleFromText(clause)).find((role): role is ExtractedSizingRole => role !== null)
      ?? extractSizingRoleFromText(text)
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
    const slotItems: Record<'triggers' | 'actions' | 'risk', unknown[]> = {
      triggers: [],
      actions: [],
      risk: [],
    }
    const atomItems: unknown[] = []
    // Issue #1338 Phase 4：跨 clause 命中去重——同一 atom 在多个 clause 命中且
    // (phase, sideScope, params) 完全相同时，只保留首条。例如 'EMA20 上穿 EMA50
    // 时市价开多；EMA20 下穿 EMA50 时市价平多' 中 position.no_position 因 verb '时'
    // 两次命中产生重复 gate 规则；dedupe 后只保留 1 条。
    const slotDedupeKeys: Record<'triggers' | 'actions' | 'risk', Set<string>> = {
      triggers: new Set(),
      actions: new Set(),
      risk: new Set(),
    }

    for (const clause of clauses) {
      const matches = this.matchClauseAgainstRegistry(clause)
      for (const m of matches) {
        const contract = (ATOM_CONTRACT_REGISTRY as Record<string, AtomContract>)[m.atomKey]
        if (!contract) continue
        const slot = BUCKET_TO_PATCH_SLOT[contract.bucket]
        if (!slot) continue // bucket 不在 BUCKET_TO_PATCH_SLOT —— 未知 bucket 跳过，不 throw

        const params = { ...m.params }
        const phase = m.phase ?? 'entry'
        const sideScope = m.sideScope ?? 'both'

        // Issue #1338 Phase 4：dedupe key 用 (atomKey, phase, sideScope, sorted params JSON)，
        // 跨 clause 等价命中只保留首条。
        const sortedParams = Object.fromEntries(
          Object.entries(params).sort(([a], [b]) => a.localeCompare(b)),
        )
        const dedupeKey = `${m.atomKey}|${phase}|${sideScope}|${JSON.stringify(sortedParams)}`
        if (slotDedupeKeys[slot].has(dedupeKey)) continue
        slotDedupeKeys[slot].add(dedupeKey)

        // evidence.source 由 atom surface.evidenceProvenance 声明（数据驱动，无 atom-key 字面量比较）。
        // external.signal 声明 'webhook'；其余 atom 省略，默认 'user_explicit'。
        const evidenceSource: NonNullable<AtomContractSurface['evidenceProvenance']> = contract.surface?.evidenceProvenance ?? 'user_explicit'
        const evidence = { text: m.clauseText, source: evidenceSource }
        const shape = { key: m.atomKey, phase, sideScope, ...params }
        // phase は resolver が解決した後に全 slot に記録する（M1: actionMatchesFulfilledPhases が
        // action.phase を参照できるよう action にも phase を付与）。
        // sideScope は triggers のみ意味を持つため引き続き trigger 限定。
        const node: Record<string, unknown> = {
          key: m.atomKey,
          phase,
          params,
          evidence,
        }
        if (slot === 'triggers') {
          node.sideScope = sideScope
        }
        atomItems.push({ ...node, sideScope })
        slotItems[slot].push(node)
      }
    }

    // review C3：替代 `as never` 类型逃生，使用 patch schema 自身派生的精确 cast；
    // 未来 PR3+ 改 CodegenSemanticPatch 字段类型时编译器能抓到 mismatch。
    if (slotItems.triggers.length > 0) {
      patch.triggers = slotItems.triggers as CodegenSemanticPatch['triggers']
    }
    if (slotItems.actions.length > 0) {
      patch.actions = slotItems.actions as CodegenSemanticPatch['actions']
    }
    if (slotItems.risk.length > 0) {
      patch.risk = slotItems.risk as CodegenSemanticPatch['risk']
    }
    if (atomItems.length > 0) {
      patch.atoms = atomItems as CodegenSemanticPatch['atoms']
    }

    return patch
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
