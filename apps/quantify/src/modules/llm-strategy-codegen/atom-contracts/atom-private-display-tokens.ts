/**
 * Atom-private display tokens — 单一 atom 私有的 enum 渲染数据（Issue #1279 PR3c.3）
 *
 * ## 范围
 * 仅放被**单个** atom 使用的 enum 文本。跨 ≥2 atom 共享的 enum 走
 * `shared-display-tokens.ts` 的 `SHARED_ENUM_DISPLAY.*`。
 *
 * ## 红线
 *   1. 纯数据 `export const`，禁止函数包装 / NestJS DI / Service 注入。
 *   2. renderer 通过 `ATOM_PRIVATE_DISPLAY.<group>.<value>.<locale>` 直接索引，
 *      字段访问错误立即 TS 编译失败（fail-loud）。
 *   3. 私有数据按 atom 分组，每组顶部注释标明专属 atom。
 *
 * ## 数据来源
 *   - 抽自 `nl-gateway/display-registry/display-token-table.ts` 的 zh 字面量
 *   - en 文案按通用金融术语对照表补齐，与 `atom-contracts/atom-contract-registry.ts`
 *     的 `ATOM_PUBLIC_NAMES` 风格保持一致
 */

import type { LocaleMap } from './atom-contract-display.types'

/** `price.candle_pattern` 专用：K 线形态枚举 */
const CANDLE_PATTERN = {
  engulfing: { zh: '吞没', en: 'engulfing' },
  hammer: { zh: '锤子线', en: 'hammer' },
  doji: { zh: '十字星', en: 'doji' },
  consecutive_body: { zh: '连续实体', en: 'consecutive body' },
} as const satisfies Readonly<Record<string, LocaleMap>>

/** `price.chart_pattern` 专用：图形形态枚举 */
const CHART_PATTERN = {
  head_and_shoulders: { zh: '头肩', en: 'head and shoulders' },
  double_top: { zh: '双顶', en: 'double top' },
  double_bottom: { zh: '双底', en: 'double bottom' },
  triangle: { zh: '三角形', en: 'triangle' },
} as const satisfies Readonly<Record<string, LocaleMap>>

/** `portfolioRisk.drawdown_block` 专用：回撤模式枚举 */
const DRAWDOWN_MODE = {
  enforce: { zh: '阻止开新仓', en: 'block new entries' },
  observe: { zh: '仅记录', en: 'observe only' },
} as const satisfies Readonly<Record<string, LocaleMap>>

/** `volume.threshold` 专用：量能类型枚举 */
const VOLUME_METRIC = {
  base_volume: { zh: '成交量', en: 'base volume' },
  quote_volume: { zh: '成交额', en: 'quote volume' },
} as const satisfies Readonly<Record<string, LocaleMap>>

/** `position.dca_schedule` 专用：DCA 触发方式枚举 */
const DCA_TRIGGER_MODE = {
  price_interval: { zh: '价格间隔触发', en: 'price interval' },
  time_interval: { zh: '时间间隔触发', en: 'time interval' },
  signal: { zh: '信号触发', en: 'signal' },
} as const satisfies Readonly<Record<string, LocaleMap>>

/** `indicator.divergence` 专用：背离方向枚举（与共享 directionBias 中文不同：底/顶背离） */
const DIVERGENCE_DIRECTION = {
  bullish: { zh: '底背离', en: 'bullish divergence' },
  bearish: { zh: '顶背离', en: 'bearish divergence' },
} as const satisfies Readonly<Record<string, LocaleMap>>

/** `external.signal` 专用：信号来源枚举 */
const SIGNAL_PROVIDER = {
  tradingview: { zh: 'TradingView', en: 'TradingView' },
  discord: { zh: 'Discord', en: 'Discord' },
  telegram: { zh: 'Telegram', en: 'Telegram' },
  webhook: { zh: 'Webhook', en: 'Webhook' },
} as const satisfies Readonly<Record<string, LocaleMap>>

/**
 * 顶层私有 enum 显示表
 *
 * renderer 直接 `ATOM_PRIVATE_DISPLAY.<group>.<value>.<locale>` 读取字面量字段；
 * 字段访问错误立即 TS 编译失败（fail-loud）。
 */
export const ATOM_PRIVATE_DISPLAY = {
  candlePattern: CANDLE_PATTERN,
  chartPattern: CHART_PATTERN,
  drawdownMode: DRAWDOWN_MODE,
  volumeMetric: VOLUME_METRIC,
  dcaTriggerMode: DCA_TRIGGER_MODE,
  divergenceDirection: DIVERGENCE_DIRECTION,
  signalProvider: SIGNAL_PROVIDER,
} as const

export type AtomPrivateDisplayCategory = keyof typeof ATOM_PRIVATE_DISPLAY
