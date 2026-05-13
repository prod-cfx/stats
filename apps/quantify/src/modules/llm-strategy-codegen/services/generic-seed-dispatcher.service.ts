import type { CapabilityTriple } from '../atom-contracts/atom-contract-emit.types'
import type {
  AtomContractSurface,
  Direction,
  ExtractorSpec,
  ParamSlotSchema,
  ResolveCtx,
  SideResolverSpec,
} from '../atom-contracts/atom-contract-surface.types'
import type { AtomContract } from '../atom-contracts/atom-contract-types'
import type { CodegenSemanticPatch } from '../types/codegen-semantic-patch'
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
 *   5. 用 contract.emit.capability 装配 contracts[].capabilities[]
 *   6. 返回 CodegenSemanticPatch
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

const PARSER_NUMBER_INT: ParserFn = (clause, spec) => {
  const re = spec.pattern ? new RegExp(spec.pattern) : /\d+/
  const m = clause.match(re)
  if (!m) return undefined
  const n = Number.parseInt(m[0], 10)
  if (Number.isNaN(n)) return undefined
  if (spec.range && (n < spec.range[0] || n > spec.range[1])) return undefined
  return n
}

const PARSER_NUMBER_DECIMAL: ParserFn = (clause, spec) => {
  const re = spec.pattern ? new RegExp(spec.pattern) : /\d+(?:\.\d+)?/
  const m = clause.match(re)
  if (!m) return undefined
  const n = Number.parseFloat(m[0])
  if (Number.isNaN(n)) return undefined
  if (spec.range && (n < spec.range[0] || n > spec.range[1])) return undefined
  return n
}

const PARSER_PERCENT: ParserFn = (clause, spec) => {
  const re = spec.pattern ? new RegExp(spec.pattern) : /-?\d+(?:\.\d+)?\s*%/
  const m = clause.match(re)
  if (!m) return undefined
  const raw = m[0]
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
  // 长 key 优先匹配（review C2 真 bug 修复）：避免 "大于等于" 被先匹中的 "大于" 提前 short-circuit。
  // Object.entries 不保证按 key 长度排序，必须显式 sort。
  const entries = Object.entries(map).sort(([a], [b]) => b.length - a.length)
  for (const [zh, normalized] of entries) {
    if (clause.includes(zh)) return normalized
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
        const m = clause.match(/\d+/)
        return m ? Number.parseInt(m[0], 10) : 0
      })()
    if (period < 10) return 'short_term'
    if (period < 50) return 'mid_term'
    return 'long_term'
  },
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
    .split(/[，,。.；;\n]+/g)
    .map(s => s.trim())
    .filter(s => s.length > 0)
}

/* ──────────────────────────────────────────────────────────────────────────
 * contextSlots 抽取（NL 通用解析，不读 atom-key）
 * ────────────────────────────────────────────────────────────────────────── */

const EXCHANGE_RE = /\b(okx|binance|bybit|coinbase|kraken|huobi|gate|bitget)\b/i
// quote 枚举从 SYMBOL_QUOTES 派生，两处保持单一真相源（M1）
const SYMBOL_RE = new RegExp(`([A-Z]{2,10})[\\s/]?(${SYMBOL_QUOTES.join('|')})\\b`)
const TIMEFRAME_RE = /\b(1m|3m|5m|15m|30m|1h|2h|4h|6h|8h|12h|1d|3d|1w)\b/i
const MARKET_TYPE_PERP_RE = /合约|永续|perp/i
const MARKET_TYPE_SPOT_RE = /现货|spot/i

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
  const tfMatch = text.match(TIMEFRAME_RE)
  if (tfMatch) slots.timeframe = tfMatch[1].toLowerCase()
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

const BUCKET_TO_PATCH_SLOT: Readonly<Record<string, 'triggers' | 'actions' | 'risk'>> = {
  trigger: 'triggers',
  action: 'actions',
  risk: 'risk',
  // positionConstraint → actions：DCA / pyramiding / grid 本质是"如何执行仓位"，
  //   isActionable=true，映射 actions 而非独立 position 段（PR2c5）。
  positionConstraint: 'actions',
  // orchestration → risk：portfolioRisk 类守门节点归入 risk 段（PR2c5）。
  orchestration: 'risk',
}

// review m1：显式映射表替代 endsWith('s') chop——后者在新增 'positions'/'metrics' 等 slot 时
// 会拼出错误 contract kind。新加 patch slot 必须同步在此声明。
const SLOT_TO_KIND: Readonly<Record<'triggers' | 'actions' | 'risk', string>> = {
  triggers: 'trigger',
  actions: 'action',
  risk: 'risk',
}

/* ──────────────────────────────────────────────────────────────────────────
 * Contract Envelope Assembler
 *
 * id / shape / requires / runtimeRequirements 等字段是 CodegenSemanticPatch
 * 数据结构强制要求的 envelope；capability triple 由 contract.emit.capability
 * 派生（**registry 真相源**），不再用 dispatcher 内置 BUCKET_CAPABILITY 表。
 * ────────────────────────────────────────────────────────────────────────── */

function kebabCase(s: string): string {
  return s.replace(/\./g, '-').replace(/_/g, '-')
}

function buildContractEnvelope(
  bucketSlot: 'triggers' | 'actions' | 'risk',
  idx: number,
  atomKey: string,
  capability: CapabilityTriple,
  shape: Record<string, unknown>,
  params: Record<string, unknown>,
): Record<string, unknown> {
  // bucket slot → contract kind 字符串（review m1：显式映射表）
  const kind = SLOT_TO_KIND[bucketSlot]
  return {
    id: `contract-seed-${kind}-${idx}-${kebabCase(atomKey)}`,
    kind,
    capabilities: [
      {
        domain: capability.domain,
        verb: capability.verb,
        object: capability.object,
        shape,
      },
    ],
    requires: [],
    params,
    runtimeRequirements: [],
    stateRequirements: [],
    orderRequirements: [],
    openSlots: [],
  }
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
    const slotItems: Record<'triggers' | 'actions' | 'risk', unknown[]> = {
      triggers: [],
      actions: [],
      risk: [],
    }
    const slotIdx: Record<'triggers' | 'actions' | 'risk', number> = {
      triggers: 0,
      actions: 0,
      risk: 0,
    }

    for (const clause of clauses) {
      const matches = this.matchClauseAgainstRegistry(clause)
      for (const m of matches) {
        const contract = (ATOM_CONTRACT_REGISTRY as Record<string, AtomContract>)[m.atomKey]
        if (!contract) continue
        const slot = BUCKET_TO_PATCH_SLOT[contract.bucket]
        if (!slot) continue // bucket 不在 BUCKET_TO_PATCH_SLOT —— 未知 bucket 跳过，不 throw

        slotIdx[slot] += 1
        const params = { ...m.params }
        const phase = m.phase ?? 'entry'
        const sideScope = m.sideScope ?? 'both'
        // evidence.source 由 atom surface.evidenceProvenance 声明（数据驱动，无 atom-key 字面量比较）。
        // external.signal 声明 'webhook'；其余 atom 省略，默认 'user_explicit'。
        const evidenceSource: NonNullable<AtomContractSurface['evidenceProvenance']> = contract.surface?.evidenceProvenance ?? 'user_explicit'
        const evidence = { text: m.clauseText, source: evidenceSource }
        const shape = { key: m.atomKey, phase, sideScope, ...params }
        const envelope = buildContractEnvelope(
          slot,
          slotIdx[slot],
          m.atomKey,
          contract.emit.capability,
          shape,
          params,
        )

        // phase は resolver が解決した後に全 slot に記録する（M1: actionMatchesFulfilledPhases が
        // action.phase を参照できるよう action にも phase を付与）。
        // sideScope は triggers のみ意味を持つため引き続き trigger 限定。
        const node: Record<string, unknown> = {
          key: m.atomKey,
          phase,
          params,
          evidence,
          contracts: [envelope],
        }
        if (slot === 'triggers') {
          node.sideScope = sideScope
        }
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

    return patch
  }

  matchClauseAgainstRegistry(clause: string): readonly AtomMatch[] {
    const out: AtomMatch[] = []
    for (const [atomKey, contract] of Object.entries(ATOM_CONTRACT_REGISTRY as Record<string, AtomContract>)) {
      const surface = contract.surface
      if (!surface) continue
      const m = this.matchSurface(surface, clause, atomKey)
      if (m) out.push({ atomKey, ...m })
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
    if (!kw && !direction) return null

    const params = extractParams(surface.paramSlots, clause, atomKey)
    const phase = resolvePhaseFromClause(clause, surface.phaseResolver, { atomKey, params })
    const sideScope = resolveSide(surface.sideResolver, clause, direction)

    return {
      clauseText: clause,
      direction,
      params,
      phase,
      sideScope,
    }
  }
}
