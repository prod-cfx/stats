import type { SemanticContextSlotState, SemanticSlotState } from '../types/semantic-state'
import { ExecutionModelFieldUnsourcedException } from '../exceptions/execution-model-field-unsourced.exception'
import { ExecutionModelSymbolMalformedException } from '../exceptions/execution-model-symbol-malformed.exception'

/**
 * Issue #1459 闸 4：ExecutionModel 字段来源 invariant + symbol 拼接收敛单一入口。
 *
 * 关键 invariant：EXECUTION_MODEL 关键字段必须能反查到 `contextSlots.<field>`，
 * 且来源（evidence.source）合规。绕过此 helper 直接拼接 venue / symbol / timeframe
 * 默认值是 Issue #1455 子链路根因（venue='okx' 默认绕过、symbol BTCUSDTUSDT 双
 * USDT 拼接）。
 *
 * 字段白名单（必须 source=user_explicit；不允许默认值）：
 *   - symbol            ← contextSlots.symbol
 *   - venue             ← contextSlots.exchange
 *   - primaryTimeframe  ← contextSlots.timeframe
 *   - instrumentType    ← contextSlots.marketType（'spot' | 'perp' → 'spot' | 'perpetual'）
 *
 * marginMode / positionMode 由 rule 集合 / position 推断，本 invariant 不覆盖。
 *
 * 通用化：本 helper 不绑 BTC / ETH / USDT / OKX / Binance 具体值；仅约束「来源
 * 必须显式」与「symbol 形态正则合规」。新增 venue / 后缀只需扩 SUPPORTED_QUOTES。
 */

const SOURCE_USER_EXPLICIT = 'user_explicit'

/** symbol 形态白名单：1..20 个 [A-Z0-9_-]，避免下游交易所拒单 */
const SYMBOL_CHAR_RE = /^[A-Z0-9_-]+$/u
const SYMBOL_MAX_LENGTH = 20

/**
 * 常见报价币种。检测双 quote 拼接（如 BTCUSDTUSDT）专用，不参与 venue-specific
 * 后缀剥离（OKX 的 :SPOT/:PERP 由上游 normalizePublishedSymbol 处理）。
 *
 * 严格按长度降序：USDT/USDC 在前，USD 在后，避免「BTC + USDC」被误识别为「BTC +
 * USD + C」。
 */
const SUPPORTED_QUOTES = ['USDT', 'USDC', 'USD', 'BUSD', 'FDUSD'] as const

export interface ExecutionModelSourcedField {
  /** contextSlots 路径上的字段名（symbol / exchange / marketType / timeframe） */
  contextSlotKey: keyof SemanticContextSlotState
  /** ExecutionModel 字段名（venue / symbol / instrumentType / primaryTimeframe） */
  executionModelField: 'symbol' | 'venue' | 'instrumentType' | 'primaryTimeframe'
}

export const EXECUTION_MODEL_SOURCED_FIELDS: readonly ExecutionModelSourcedField[] = [
  { contextSlotKey: 'symbol', executionModelField: 'symbol' },
  { contextSlotKey: 'exchange', executionModelField: 'venue' },
  { contextSlotKey: 'timeframe', executionModelField: 'primaryTimeframe' },
  { contextSlotKey: 'marketType', executionModelField: 'instrumentType' },
] as const

/**
 * 校验单 slot 是否来源合规。返回 trimmed value（合规）或抛 DomainException。
 *
 * 校验链：
 *   1. slot 存在且 status === 'locked'，否则 reason='missing'
 *   2. value 是非空字符串，否则 reason='missing'
 *   3. evidence?.source === 'user_explicit'，否则 reason='inferred'
 *
 * 注：evidence 缺失视为 inferred（fail-closed）；contextSlots 必须由 user_explicit
 * 锚定才放行，避免任何隐式默认值绕过。
 */
export function assertSlotUserExplicit(
  slot: SemanticSlotState | null | undefined,
  field: 'symbol' | 'venue' | 'instrumentType' | 'primaryTimeframe',
): string {
  if (!slot || slot.status !== 'locked' || typeof slot.value !== 'string' || slot.value.trim().length === 0) {
    throw new ExecutionModelFieldUnsourcedException({ field, reason: 'missing' })
  }
  const source = slot.evidence?.source
  if (source !== SOURCE_USER_EXPLICIT) {
    throw new ExecutionModelFieldUnsourcedException({
      field,
      reason: 'inferred',
      actualSource: source ?? null,
    })
  }
  return slot.value.trim()
}

/**
 * 集中校验所有白名单字段。返回字段名 → value 映射；任一字段不合规即抛异常。
 */
export function assertExecutionModelFieldsSourced(
  contextSlots: SemanticContextSlotState,
): Record<ExecutionModelSourcedField['executionModelField'], string> {
  const result = {} as Record<ExecutionModelSourcedField['executionModelField'], string>
  for (const entry of EXECUTION_MODEL_SOURCED_FIELDS) {
    result[entry.executionModelField] = assertSlotUserExplicit(
      contextSlots[entry.contextSlotKey],
      entry.executionModelField,
    )
  }
  return result
}

/**
 * symbol 形态正则校验。剥离首段 :SPOT/:PERP venue 后缀（沿用 OKX 习惯），再对
 * 主体做以下检查：
 *   - 非空（trim 后长度 > 0）
 *   - 长度 ≤ 20
 *   - 字符集 [A-Z0-9_-]
 *   - 不得出现双 quote 拼接（BTCUSDTUSDT / ETHUSDTUSDT / FOOUSDUSDT 等）
 */
export function assertSymbolWellFormed(symbol: string): void {
  const trimmed = symbol.trim().toUpperCase().replace(/:(SPOT|PERP)$/u, '')
  if (trimmed.length === 0) {
    throw new ExecutionModelSymbolMalformedException({ symbol, reason: 'empty' })
  }
  if (trimmed.length > SYMBOL_MAX_LENGTH) {
    throw new ExecutionModelSymbolMalformedException({ symbol, reason: 'too_long' })
  }
  if (!SYMBOL_CHAR_RE.test(trimmed)) {
    throw new ExecutionModelSymbolMalformedException({ symbol, reason: 'illegal_chars' })
  }
  if (hasDuplicatedQuote(trimmed)) {
    throw new ExecutionModelSymbolMalformedException({ symbol, reason: 'duplicated_quote' })
  }
}

/**
 * 检测 symbol 是否以两段 quote 收尾（如 BTCUSDTUSDT / ETHUSDUSDT）。
 *
 * 算法：遍历支持的 quote 集合，找到与 symbol 后缀匹配的 quote A；剥去 A 后再次
 * 匹配 quote 集合，若仍有任何 quote 匹配后缀 → 视为双 quote。
 *
 * 这种检测不会误判合法 「BASE + QUOTE」（如 BTCUSDT）：剥去 USDT 后 BTC 不在
 * quote 集合内。
 */
function hasDuplicatedQuote(symbol: string): boolean {
  const matchedTail = SUPPORTED_QUOTES.find(quote => symbol.endsWith(quote))
  if (!matchedTail) return false
  const remainder = symbol.slice(0, symbol.length - matchedTail.length)
  if (remainder.length === 0) return false
  return SUPPORTED_QUOTES.some(quote => remainder.endsWith(quote))
}

/**
 * symbol 构造单一入口。接受 contextSlots，输出标准化 symbol。
 *
 * Contract：
 *   - 入参：contextSlots.symbol.status === 'locked' 且 value 非空字符串
 *     - 当 `enforceUserExplicit=true` 时：额外要求 evidence.source === 'user_explicit'
 *   - 出参：标准化大写 symbol，剥离 :SPOT/:PERP 后缀，通过形态正则（始终强制）
 *
 * 形态正则是默认强制项（覆盖 BTCUSDTUSDT 等双 quote 拼接），不依赖 enforceUserExplicit。
 * 这把 Issue #1455 实测的 cmpakxase 会话 symbol bug 当场 fail-closed，不绕过 fixture
 * 兼容。
 *
 * `enforceUserExplicit` 默认 false，是为了不破坏既有 stage spec fixture（contextSlots
 * 普遍缺 evidence；语义视为合法但未来不可绕过）。后续 follow-up 收敛 fixture 后改默认值。
 *
 * 调用方禁止再做 `symbol || fallback` 之类的拼接。该 helper 是
 * Issue #1459 验收标准「symbol 拼接收敛到单一 buildSymbol」的落点。
 */
export function buildSymbol(args: {
  contextSlots: SemanticContextSlotState
  enforceUserExplicit?: boolean
}): string {
  const slot = args.contextSlots.symbol
  if (!slot || slot.status !== 'locked' || typeof slot.value !== 'string' || slot.value.trim().length === 0) {
    throw new ExecutionModelFieldUnsourcedException({ field: 'symbol', reason: 'missing' })
  }
  if (args.enforceUserExplicit) {
    const source = slot.evidence?.source
    if (source !== SOURCE_USER_EXPLICIT) {
      throw new ExecutionModelFieldUnsourcedException({
        field: 'symbol',
        reason: 'inferred',
        actualSource: source ?? null,
      })
    }
  }
  const normalized = slot.value.trim().toUpperCase().replace(/:(SPOT|PERP)$/u, '')
  assertSymbolWellFormed(normalized)
  return normalized
}
