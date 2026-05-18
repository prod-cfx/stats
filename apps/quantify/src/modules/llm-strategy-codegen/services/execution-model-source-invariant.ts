import type { SemanticContextSlotState, SemanticSlotState } from '../types/semantic-state'
import { SUPPORTED_QUOTE_ASSETS } from '../constants/quote-assets'
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
 * marginMode / positionMode 由 rule 集合 / position 推断，本 invariant 不覆盖（review
 * round 1 m3：follow-up Issue 处理）。
 *
 * 通用化：本 helper 不绑 BTC / ETH / USDT / OKX / Binance 具体值；仅约束「来源
 * 必须显式」与「symbol 形态正则合规」。新增 venue / 后缀只需扩 SUPPORTED_QUOTE_ASSETS。
 */

const SOURCE_USER_EXPLICIT = 'user_explicit'

/** symbol 形态白名单：1..20 个 [A-Z0-9_-]，避免下游交易所拒单 */
const SYMBOL_CHAR_RE = /^[A-Z0-9_-]+$/u
const SYMBOL_MAX_LENGTH = 20

/**
 * Issue #1459 闸 4 review M3：使用 `constants/quote-assets.ts` 共享集合，
 * 与 `canonical-spec-v2-ir-compiler.service.ts` 的 sizing.asset 推断共用同一份，
 * 避免分叉漏掉 ETHBTC / SOLBTC 这类真实虚拟币 quote。
 */
const SUPPORTED_QUOTES = SUPPORTED_QUOTE_ASSETS

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
 * Issue #1459 闸 4 review C2：本 helper 由 stage 入口 invoke，
 * 永远强制 source=user_explicit，不接受 opt-in 关闭。
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
 *
 * Issue #1459 闸 4 review C1：由 `CodegenPublicationGenerationStage.generate()`
 * 在 IR build 入口调用一次，覆盖 venue / primaryTimeframe / instrumentType
 * （symbol 通过 buildSymbol 已校验）。
 */
export function assertExecutionModelFieldsSourced(
  contextSlots: SemanticContextSlotState | null | undefined,
): Record<ExecutionModelSourcedField['executionModelField'], string> {
  const result = {} as Record<ExecutionModelSourcedField['executionModelField'], string>
  for (const entry of EXECUTION_MODEL_SOURCED_FIELDS) {
    const slot = contextSlots ? contextSlots[entry.contextSlotKey] : undefined
    result[entry.executionModelField] = assertSlotUserExplicit(slot, entry.executionModelField)
  }
  return result
}

/**
 * symbol 形态正则校验。剥离首段 `:SPOT/:PERP` / 末尾 `-SWAP/-PERP` venue 后缀，
 * 再对主体做以下检查：
 *   - 非空（trim 后长度 > 0）
 *   - 长度 ≤ 20
 *   - 字符集 [A-Z0-9_-]
 *   - 不得出现双 quote 拼接（BTCUSDTUSDT / ETHUSDTUSDT / FOOUSDUSDT 等）
 *
 * `-SWAP` / `-PERP` 后缀剥离覆盖 OKX `BTC-USDT-SWAP`、Hyperliquid `BTC-PERP`
 * 等真实 venue 标识符（review M4），剥离后再检测双 quote。
 */
export function assertSymbolWellFormed(symbol: string): void {
  let trimmed = symbol.trim().toUpperCase().replace(/:(SPOT|PERP)$/u, '')
  trimmed = trimmed.replace(/-(SWAP|PERP)$/u, '')
  if (trimmed.length === 0) {
    throw new ExecutionModelSymbolMalformedException({ symbol, reason: 'empty' })
  }
  if (trimmed.length > SYMBOL_MAX_LENGTH) {
    throw new ExecutionModelSymbolMalformedException({ symbol, reason: 'too_long' })
  }
  if (!SYMBOL_CHAR_RE.test(trimmed)) {
    throw new ExecutionModelSymbolMalformedException({ symbol, reason: 'illegal_chars' })
  }
  // 双 quote 检测：先剥可能的 `-` 分隔符（`BTC-USDT` 合法，剥离后是 `BTCUSDT`）
  const compact = trimmed.replace(/-/gu, '')
  if (hasDuplicatedQuote(compact)) {
    throw new ExecutionModelSymbolMalformedException({ symbol, reason: 'duplicated_quote' })
  }
}

/**
 * 检测 symbol 是否以两段 quote 收尾（如 BTCUSDTUSDT / ETHUSDUSDT）。
 *
 * 算法：
 *   1. 找到与 symbol 后缀匹配的 quote A（按长度降序，首匹配）
 *   2. 剥去 A 得 remainder；若 remainder 为空 → 视为单 quote（非法 base，已由 length 校验兜底）
 *   3. 在 remainder 上再找 quote B；剥去 B 后必须仍有非空 base
 *      （否则 ETHBTC 这种「ETH base + BTC quote」会被误判：remainder='ETH'，
 *      虽然 ETH 也在 quote 集合，但剥去后剩 '' → 没有 base，说明 ETH 是真正的 base 而非冗余 quote）
 *
 * SUPPORTED_QUOTES 严格按长度降序，避免 USDC 被先匹配成 USD+C。
 */
function hasDuplicatedQuote(symbol: string): boolean {
  const matchedTail = SUPPORTED_QUOTES.find(quote => symbol.endsWith(quote))
  if (!matchedTail) return false
  const remainder = symbol.slice(0, symbol.length - matchedTail.length)
  if (remainder.length === 0) return false
  const secondQuote = SUPPORTED_QUOTES.find(quote => remainder.endsWith(quote))
  if (!secondQuote) return false
  const base = remainder.slice(0, remainder.length - secondQuote.length)
  return base.length > 0
}

/**
 * Issue #1459 闸 4 review M3：导出共享 quote 列表，供 spec / 调用方使用。
 */
export { SUPPORTED_QUOTES }

/**
 * symbol 构造单一入口。接受 contextSlots，输出标准化 symbol。
 *
 * Contract：
 *   - 入参：contextSlots.symbol.status === 'locked' 且 value 非空字符串
 *     - 当 `enforceUserExplicit=true`（**默认**）时：额外要求 evidence.source === 'user_explicit'
 *   - 出参：标准化大写 symbol，剥离 :SPOT/:PERP / -SWAP/-PERP 后缀，通过形态正则（始终强制）
 *
 * Issue #1459 闸 4 review C2：`enforceUserExplicit` 默认改为 true。生产路径不再
 * 接受隐式 inferred；fixture 路径如需放行必须显式传 `enforceUserExplicit: false`，
 * 并附「为何不能 user_explicit」的说明。
 */
export function buildSymbol(args: {
  contextSlots: SemanticContextSlotState
  enforceUserExplicit?: boolean
}): string {
  const slot = args.contextSlots.symbol
  if (!slot || slot.status !== 'locked' || typeof slot.value !== 'string' || slot.value.trim().length === 0) {
    throw new ExecutionModelFieldUnsourcedException({ field: 'symbol', reason: 'missing' })
  }
  const enforceUserExplicit = args.enforceUserExplicit !== false
  if (enforceUserExplicit) {
    const source = slot.evidence?.source
    if (source !== SOURCE_USER_EXPLICIT) {
      throw new ExecutionModelFieldUnsourcedException({
        field: 'symbol',
        reason: 'inferred',
        actualSource: source ?? null,
      })
    }
  }
  const normalized = slot.value.trim().toUpperCase().replace(/:(SPOT|PERP)$/u, '').replace(/-(SWAP|PERP)$/u, '')
  assertSymbolWellFormed(normalized)
  return normalized
}
