/**
 * Data-sync 模块内部使用的 DI token 定义。
 *
 * 单独拆出文件是为了避免模块定义与服务之间产生循环引用：
 * - module 需要引用 Orchestrator/Job
 * - Orchestrator 需要引用 token
 */
export const DATA_PULL_JOB_REGISTRY = 'DATA_PULL_JOB_REGISTRY' as const

/**
 * 订单薄 WS 适配器 registry：
 * - 每个交易所/市场类型实现一个 adapter（例如 BINANCE.CEX.SPOT）
 * - OrderbookWsSyncManager 会按配置分组并调用对应 adapter 动态订阅/退订
 */
export const ORDERBOOK_WS_ADAPTER_REGISTRY = 'ORDERBOOK_WS_ADAPTER_REGISTRY' as const

