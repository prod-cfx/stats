/**
 * Issue #1459 闸 4 review round 1（M3）：报价币种共享常量。
 *
 * 检测 symbol 后缀双 quote 拼接（如 BTCUSDTUSDT / ETHUSDTBTC）以及
 * canonical-spec-v2-ir-compiler 的 sizing.asset 推断时复用同一集合，
 * 避免「execution-model-source-invariant」与「ir-compiler」本地常量分叉
 * 漏掉 ETHBTC / SOLBTC 这类真实虚拟币 quote。
 *
 * 严格按长度降序排列，避免「BTC + USDC」被误识别为「BTC + USD + C」：
 *   - 5 字符：FDUSD
 *   - 4 字符：USDT / USDC / BUSD
 *   - 3 字符：USD / BTC / ETH
 *
 * 新增 venue / quote 时只需在此扩充。
 */
export const SUPPORTED_QUOTE_ASSETS = [
  'FDUSD',
  'USDT',
  'USDC',
  'BUSD',
  'USD',
  'BTC',
  'ETH',
] as const

export type SupportedQuoteAsset = (typeof SUPPORTED_QUOTE_ASSETS)[number]
